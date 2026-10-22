// Role routes (Settings > Roles). Mounted by worker/index.js after requireAuth. Returns a Response, or null for paths that are not ours.
// All of them need users.manage. See worker/perms.js for the model and schema/schema_v27_roles.sql for the tables.
//   GET  /api/roles                      roles (ranked, most senior first) + the permission catalogue
//   POST /api/roles                      { name, base, copy? }                new role at the bottom (most junior). base = "none", a fixed
//                                                                             "admin"/"agent"/"viewer" set, or any role key (a template); copy = take a
//                                                                             one-off copy of it instead of following it
//   POST /api/roles/:key/update          { name?, base?, overrides?, reset?, sees? } rename, change the starting point, switch permissions,
//                                                                             set who they can see: { mode: "all" | "rank" | "list", list? }
//   POST /api/roles/:key/move            { dir: "up" | "down" }               change its rank
//   POST /api/roles/:key/delete          { move_to? }                         remove any role (people on it move to move_to; roles that
//                                                                             started from it keep the permissions they have now)
//   POST /api/users/role                 { id, role_key, team? }              give an account a role (a new role clears its personal permissions)
//   POST /api/users/perms                { id, overrides?, reset? }           personal permissions: { perm: true | false | null } on top of the role
// Changing a role re-syncs the old columns of every account whose permissions could have changed (legacyColumns), and nothing may remove
// the last account that can manage accounts.
import { GROUPS, PERMS, PERM_KEYS, loadRoles, rolePerms, startPerms, baseProblem, legacyColumns, managerCount, slugRole, userOverrides, applyOverrides, parseSees } from "./perms.js";

const NO_TABLES = "Roles are not set up yet (schema_v27 has not been run)";
const LAST = "Can't remove the last account that can manage accounts and roles. Give someone else that permission first.";

async function body(c) { try { const b = await c.request.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; } }
const clone = (role) => ({ ...role, overrides: { ...role.overrides } });

async function allUsers(db) {
  try {
    const { results } = await db.prepare("SELECT id, username, role, can_edit, can_delete, on_leaderboard, manage_users, role_key, team, perm_overrides FROM users").all();
    return results || [];
  } catch {                                  // schema_v28 not run yet: no perm_overrides column
    const { results } = await db.prepare("SELECT id, username, role, can_edit, can_delete, on_leaderboard, manage_users, role_key, team FROM users").all();
    return results || [];
  }
}
/** Forget an account's personal permissions (when its role changes). Harmless before schema_v28. */
async function clearOverrides(db, where, ...binds) {
  try { await db.prepare(`UPDATE users SET perm_overrides = NULL WHERE ${where}`).bind(...binds).run(); } catch { /* no column yet */ }
}
/** True when `users` under `roles` would leave nobody able to manage accounts although somebody can today. */
function locksOut(before, after, rolesBefore, rolesAfter) {
  const b = managerCount(before, rolesBefore);
  return b > 0 && managerCount(after, rolesAfter) === 0;
}
// How many accounts sit on each role. An account without a role_key counts toward the built-in role named in its old `role`.
const countOn = (users, key) => users.filter((u) => (u.role_key ? u.role_key === key : u.role === key)).length;

/** One role as the API returns it. rank 1 = most senior. */
function roleOut(role, roles, users) {
  return {
    key: role.key, name: role.name, base: role.base, builtin: role.builtin, overrides: role.overrides,
    sees: role.sees || { mode: "all", list: [] }, perms: [...rolePerms(role, roles)], start: [...startPerms(role, roles)], users: countOn(users, role.key), assigned: users.filter((u) => u.role_key === role.key).length, rank: [...roles.keys()].indexOf(role.key) + 1,
    used_by: [...roles.values()].filter((r) => r.key !== role.key && r.base === role.key).length,         // roles that start from this one
  };
}

/** Bring the old columns of every account on a role back in step with what the role now allows. */
async function syncAll(db, roles) {
  await db.batch([...roles.values()].map((role) => {
    const col = legacyColumns(role, roles);
    return db.prepare("UPDATE users SET role = ?, can_edit = ?, can_delete = ?, on_leaderboard = ?, manage_users = ? WHERE role_key = ?")
      .bind(col.role, col.can_edit, col.can_delete, col.on_leaderboard, col.manage_users, role.key);
  }));
  // accounts with personal permissions: their old columns follow the role AND their exceptions
  let own = [];
  try { own = (await db.prepare("SELECT id, role_key, perm_overrides FROM users WHERE role_key IS NOT NULL AND perm_overrides IS NOT NULL").all()).results || []; } catch { /* no column yet */ }
  const fixes = own.filter((u) => roles.has(u.role_key)).map((u) => {
    const col = legacyColumns(roles.get(u.role_key), roles, userOverrides(u));
    return db.prepare("UPDATE users SET role = ?, can_edit = ?, can_delete = ?, on_leaderboard = ?, manage_users = ? WHERE id = ?")
      .bind(col.role, col.can_edit, col.can_delete, col.on_leaderboard, col.manage_users, u.id);
  });
  if (fixes.length) await db.batch(fixes);
}

export async function handleRoles(c) {
  const { path, method } = c;
  const isUsersRole = path === "/api/users/role";
  if (!path.startsWith("/api/roles") && !isUsersRole && path !== "/api/users/perms") return null;
  if (!c.can("users.manage")) return c.err("Managers only", 403);
  const db = c.env.DB;

  if (path === "/api/roles" && method === "GET") {
    const roles = await loadRoles(db);
    const catalogue = { groups: GROUPS, perms: PERMS.map((p) => ({ key: p.key, group: p.group, label: p.label, desc: p.desc, defaults: { admin: !!p.d[0], agent: !!p.d[1], viewer: !!p.d[2] } })) };
    if (!roles) return c.ok({ ...catalogue, roles: [], setup_needed: true });
    const users = await allUsers(db);
    return c.ok({ ...catalogue, setup_needed: false, roles: [...roles.values()].map((r) => roleOut(r, roles, users)) });
  }

  const roles = await loadRoles(db);
  if (!roles) return c.err(NO_TABLES, 503);

  // ── personal permissions: an account's own exceptions on top of its role ──
  if (path === "/api/users/perms" && method === "POST") {
    const b = await body(c);
    const users = await allUsers(db);
    const target = users.find((u) => Number(u.id) === Number(b.id));
    if (!target) return c.err("User not found", 404);
    if (!target.role_key || !roles.has(target.role_key)) return c.err("Give this account a role first. Personal permissions sit on top of a role.", 400);
    const next = b.reset ? {} : { ...userOverrides(target) };
    if (b.overrides && typeof b.overrides === "object") {
      for (const [k, v] of Object.entries(b.overrides)) {
        if (!PERM_KEYS.includes(k)) return c.err(`Unknown permission "${k}"`, 400);
        if (v === null) delete next[k]; else next[k] = !!v;
      }
    }
    // an exception that equals what the role already says is not an exception: drop it
    const roleSet = rolePerms(roles.get(target.role_key), roles);
    for (const k of Object.keys(next)) if (next[k] === roleSet.has(k)) delete next[k];
    const after = users.map((u) => (u.id === target.id ? { ...u, perm_overrides: JSON.stringify(next) } : u));
    if (locksOut(users, after, roles, roles)) return c.err(LAST, 400);
    const col = legacyColumns(roles.get(target.role_key), roles, next);
    try {
      await db.prepare("UPDATE users SET perm_overrides = ?, can_edit = ?, can_delete = ?, on_leaderboard = ?, manage_users = ? WHERE id = ?")
        .bind(Object.keys(next).length ? JSON.stringify(next) : null, col.can_edit, col.can_delete, col.on_leaderboard, col.manage_users, target.id).run();
    } catch { return c.err("Personal permissions are not set up yet (schema_v28 has not been run)", 503); }
    c.log(c.user, "perm", `Personal permissions · ${target.username}: ${Object.keys(next).length ? Object.entries(next).map(([k, v]) => `${v ? "+" : "-"}${k}`).join(" ") : "none"}`);
    return c.ok({ overrides: next, perms: [...applyOverrides(roleSet, next)], role_perms: [...roleSet] });
  }

  // ── new role ──
  if (path === "/api/roles" && method === "POST") {
    const b = await body(c);
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 30) : "";
    const base = typeof b.base === "string" && b.base ? b.base : "none";
    if (!name) return c.err("Give the role a name");
    const bad = baseProblem(base, roles, "");
    if (bad) return c.err(bad, 400);
    if ([...roles.values()].some((r) => r.name.toLowerCase() === name.toLowerCase())) return c.err("A role with that name already exists", 409);
    const taken = new Set((await db.prepare("SELECT key FROM roles").all()).results.map((r) => r.key));
    let key = slugRole(name), n = 2;
    while (taken.has(key)) key = `${slugRole(name)}-${n++}`;
    const top = await db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM roles").first();
    // copy: a one-off copy of the template's permissions as they are now; the new role does not follow later changes to it
    const copy = !!b.copy && base !== "none";
    const copied = copy ? [...rolePerms({ key: "", name: "", base, overrides: {} }, roles)] : [];
    await db.prepare("INSERT INTO roles (key, name, base, builtin, sort) VALUES (?,?,?,0,?)").bind(key, name, copy ? "none" : base, (top?.m || 0) + 1).run();
    if (copied.length) await db.batch(copied.map((k) => db.prepare("INSERT INTO role_permissions (role_key, perm, allowed) VALUES (?,?,1)").bind(key, k)));
    c.log(c.user, "role", `Created role "${name}" (${copy ? "copied from" : "starts from"} ${base})`);
    const after = await loadRoles(db);
    return c.ok({ role: roleOut(after.get(key), after, await allUsers(db)) }, 201);
  }

  // ── rank ──
  let m = path.match(/^\/api\/roles\/([a-z0-9-]+)\/move$/);
  if (m && method === "POST") {
    const b = await body(c);
    const order = [...roles.keys()], i = order.indexOf(m[1]);
    if (i < 0) return c.err("Role not found", 404);
    if (b.dir !== "up" && b.dir !== "down") return c.err("dir must be up or down");
    const j = b.dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= order.length) return c.ok({ roles: order });                       // already at the end: nothing to do
    [order[i], order[j]] = [order[j], order[i]];
    await db.batch(order.map((k, idx) => db.prepare("UPDATE roles SET sort = ? WHERE key = ?").bind(idx + 1, k)));
    c.log(c.user, "role", `Moved role "${roles.get(m[1]).name}" ${b.dir}`);
    return c.ok({ roles: order });
  }

  // ── edit a role ──
  m = path.match(/^\/api\/roles\/([a-z0-9-]+)\/(update|delete)$/);
  if (m && method === "POST") {
    const role = roles.get(m[1]);
    if (!role) return c.err("Role not found", 404);
    const b = await body(c);
    const users = await allUsers(db);

    if (m[2] === "update") {
      const next = clone(role);
      if (b.name !== undefined) {
        const name = typeof b.name === "string" ? b.name.trim().slice(0, 30) : "";
        if (!name) return c.err("Give the role a name");
        if ([...roles.values()].some((r) => r.key !== role.key && r.name.toLowerCase() === name.toLowerCase())) return c.err("A role with that name already exists", 409);
        next.name = name;
      }
      if (b.base !== undefined) {
        const bad = typeof b.base !== "string" ? "Unknown starting point" : baseProblem(b.base, roles, role.key);
        if (bad) return c.err(bad, 400);
        next.base = b.base;
      }
      if (b.sees !== undefined) {
        const m = b.sees && b.sees.mode;
        if (!["all", "rank", "list"].includes(m)) return c.err("sees.mode must be all, rank or list", 400);
        const list = m === "list" ? [...new Set((Array.isArray(b.sees.list) ? b.sees.list : []).filter((k) => typeof k === "string" && roles.has(k) && k !== role.key))] : [];
        const team = b.sees.team === undefined ? ((role.sees && role.sees.team) || "all") : b.sees.team;
        if (!["all", "own"].includes(team)) return c.err("sees.team must be all or own", 400);
        next.sees = { mode: m, list, team };
      }
      if (b.reset) next.overrides = {};
      if (b.overrides && typeof b.overrides === "object") {
        for (const [k, v] of Object.entries(b.overrides)) {
          if (!PERM_KEYS.includes(k)) return c.err(`Unknown permission "${k}"`);
          if (v === null) delete next.overrides[k]; else next.overrides[k] = !!v;
        }
      }
      const rolesAfter = new Map(roles); rolesAfter.set(role.key, next);
      if (locksOut(users, users, roles, rolesAfter)) return c.err(LAST, 400);
      await db.prepare("UPDATE roles SET name = ?, base = ? WHERE key = ?").bind(next.name, next.base, role.key).run();
      if (b.sees !== undefined) {
        try { await db.prepare("UPDATE roles SET sees = ? WHERE key = ?").bind(next.sees.mode === "all" && next.sees.team !== "own" ? null : JSON.stringify(next.sees), role.key).run(); }
        catch { return c.err("Who-can-see is not set up yet (schema_v29 has not been run)", 503); }
      }
      await db.prepare("DELETE FROM role_permissions WHERE role_key = ?").bind(role.key).run();
      const rows = Object.entries(next.overrides);
      if (rows.length) await db.batch(rows.map(([k, v]) => db.prepare("INSERT INTO role_permissions (role_key, perm, allowed) VALUES (?,?,?)").bind(role.key, k, v ? 1 : 0)));
      await syncAll(db, rolesAfter);           // roles based on this one change with it
      c.log(c.user, "role", `Changed role "${next.name}"`);
      return c.ok({ role: roleOut(next, rolesAfter, users) });
    }

    // delete (built-in roles too)
    const held = users.filter((u) => u.role_key === role.key);
    let target = null;
    if (held.length) {
      target = typeof b.move_to === "string" ? roles.get(b.move_to) : null;
      if (!target || target.key === role.key) return c.err(`${held.length} account${held.length === 1 ? " is" : "s are"} on this role. Choose a role to move them to.`, 409);
    }
    const after = users.map((u) => (u.role_key === role.key ? { ...u, role_key: target.key } : u));
    const rolesAfter = new Map(roles); rolesAfter.delete(role.key);
    // roles that started from this one start from what this one started from, with overrides that keep every permission they have today
    const rebased = [];
    for (const child of roles.values()) {
      if (child.key === role.key || child.base !== role.key) continue;
      const had = rolePerms(child, roles), next = { ...child, base: role.base === role.key ? role.base : role.base, overrides: {} };
      const start = startPerms(next, rolesAfter);
      for (const k of PERM_KEYS) if (had.has(k) !== start.has(k)) next.overrides[k] = had.has(k);
      rolesAfter.set(child.key, next); rebased.push(next);
    }
    if (locksOut(users, after, roles, rolesAfter)) return c.err(LAST, 400);
    for (const r of rebased) {
      await db.prepare("UPDATE roles SET base = ? WHERE key = ?").bind(r.base, r.key).run();
      await db.prepare("DELETE FROM role_permissions WHERE role_key = ?").bind(r.key).run();
      const rows = Object.entries(r.overrides);
      if (rows.length) await db.batch(rows.map(([k, v]) => db.prepare("INSERT INTO role_permissions (role_key, perm, allowed) VALUES (?,?,?)").bind(r.key, k, v ? 1 : 0)));
    }
    if (target) {
      await clearOverrides(db, "role_key = ?", role.key);
      const col = legacyColumns(target, rolesAfter);
      await db.prepare("UPDATE users SET role_key = ?, role = ?, can_edit = ?, can_delete = ?, on_leaderboard = ?, manage_users = ? WHERE role_key = ?")
        .bind(target.key, col.role, col.can_edit, col.can_delete, col.on_leaderboard, col.manage_users, role.key).run();
    }
    await db.prepare("UPDATE roles SET deleted_at = datetime('now') WHERE key = ?").bind(role.key).run();
    await syncAll(db, rolesAfter);
    c.log(c.user, "role", `Deleted role "${role.name}"${target ? ` (${held.length} moved to "${target.name}")` : ""}${rebased.length ? `; ${rebased.length} role${rebased.length === 1 ? "" : "s"} kept their permissions` : ""}`);
    return c.ok({ ok: true, moved: held.length, rebased: rebased.length });
  }

  // ── give an account a role ──
  if (isUsersRole && method === "POST") {
    const b = await body(c);
    const role = roles.get(b.role_key);
    if (!b.id || !role) return c.err("Pick an account and a role");
    const users = await allUsers(db);
    const target = users.find((u) => Number(u.id) === Number(b.id));
    if (!target) return c.err("User not found", 404);
    const after = users.map((u) => (u.id === target.id ? { ...u, role_key: role.key } : u));
    if (locksOut(users, after, roles, roles)) return c.err(LAST, 400);
    const changed = target.role_key !== role.key;                         // a new role starts the account clean; the same role keeps its personal permissions
    const col = legacyColumns(role, roles, changed ? {} : userOverrides(target));
    const team = b.team === undefined ? target.team : (["A", "B", "C"].includes(b.team) ? b.team : null);
    await db.prepare("UPDATE users SET role_key = ?, role = ?, can_edit = ?, can_delete = ?, on_leaderboard = ?, manage_users = ?, team = ? WHERE id = ?")
      .bind(role.key, col.role, col.can_edit, col.can_delete, col.on_leaderboard, col.manage_users, team, target.id).run();
    if (changed) await clearOverrides(db, "id = ?", target.id);
    c.log(c.user, "perm", `Set role → ${role.name} · ${target.username}`);
    return c.ok({ saved: true, role_key: role.key });
  }

  return null;
}
