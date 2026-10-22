// Local checks for roles and permissions (worker/perms.js, worker/roles.js) and how the routes enforce them.
// LOCAL ONLY: talks to `wrangler dev --local` and seeds a THROWAWAY local D1 with `wrangler d1 execute --local`. Never --remote.
//   1) apply schema.sql, schema_v2..v27 with: npx wrangler d1 execute groupb-tracker-db --local --persist-to <dir> --file=...
//   2) npx wrangler dev --local --persist-to <dir> --port 8797 --var SESSION_SECRET:x --var PASSWORD_SALT:y --var INGEST_TOKEN:x
//   3) PERSIST=<dir> BASE=http://127.0.0.1:8797 node scripts/test-roles-api.mjs
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const PERSIST = process.env.PERSIST;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error("Refusing: BASE must be a local Worker"); process.exit(2); }
if (!PERSIST) { console.error("Set PERSIST=<the --persist-to dir of the local D1>"); process.exit(2); }

let fails = 0, passes = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); if (ok) passes++; else fails++; };
const sql = (q) => execFileSync("npx", ["wrangler", "d1", "execute", "groupb-tracker-db", "--local", "--persist-to", PERSIST, "--json", "--command", q], { stdio: "pipe" }).toString();
const rows = (q) => JSON.parse(sql(q).match(/\[[\s\S]*\]/)[0]).flatMap((x) => x.results || []);

async function call(tok, method, path, body) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    } catch (e) { if (i >= 2) throw e; await new Promise((r) => setTimeout(r, 300)); }
  }
}
const PW = "test-password-1";
async function login(u) { const r = await call(null, "POST", "/api/login", { username: u, password: PW }); if (!r.data.token) throw new Error(`login ${u}: ${JSON.stringify(r)}`); return r.data.token; }
const me = async (tok) => (await call(tok, "GET", "/api/me")).data;
const has = (m, p) => (m.perms || []).includes(p);

// aldo = a legacy admin (no role_key). sara = a legacy agent. Everything else is made through the role routes.
await call(null, "POST", "/api/users/init", { username: "aldo", password: PW });
const A = await login("aldo");
await call(A, "POST", "/api/users", { username: "sara", password: PW, role: "agent", can_edit: 1, can_delete: 1, on_leaderboard: 1, team: "B" });
const S = await login("sara");
sql("DELETE FROM role_permissions; DELETE FROM roles WHERE builtin = 0; UPDATE roles SET deleted_at = NULL; UPDATE roles SET name = 'Admin' WHERE key = 'admin'; UPDATE roles SET name = 'Agent' WHERE key = 'agent'; UPDATE roles SET name = 'Viewer' WHERE key = 'viewer'; DELETE FROM users WHERE username NOT IN ('aldo','sara'); UPDATE users SET role_key = NULL; UPDATE users SET role = 'agent', can_edit = 1, can_delete = 1, on_leaderboard = 1, manage_users = 0, team = 'B' WHERE username = 'sara'");
const day = (n) => new Date(Date.UTC(2026, 10, 2 + n)).toISOString().slice(0, 10);

// ---- legacy accounts behave exactly as before ----
let r = await me(A);
check("legacy admin: role_key null, has every admin permission", r.role_key === null && ["users.manage", "teams.all", "schedule.manage", "tasks.assign_others", "contact.edit", "dashboard.view"].every((p) => has(r, p)) && r.manage_users === true, JSON.stringify(r));
r = await me(S);
check("legacy agent: edit + delete + scored + own tasks + swap request, nothing admin", r.role_key === null && ["contact.edit", "contact.delete", "kpi.scored", "tasks.use", "schedule.swap_request"].every((p) => has(r, p)) && !has(r, "users.manage") && !has(r, "schedule.manage") && !has(r, "teams.all") && !has(r, "dashboard.view") && r.manage_users === false, JSON.stringify(r));

// ---- reading roles ----
r = await call(S, "GET", "/api/roles");
check("an agent cannot read roles (403)", r.status === 403);
check("unauthenticated is 401", (await call(null, "GET", "/api/roles")).status === 401);
r = await call(A, "GET", "/api/roles");
const keys = (r.data.perms || []).map((p) => p.key);
check("admin reads the catalogue (26 permissions, 4 groups) and 3 built-in roles", r.status === 200 && keys.length === 26 && new Set(keys).size === 26 && r.data.groups.length === 4 && r.data.roles.map((x) => x.key).join() === "admin,agent,viewer" && r.data.setup_needed === false, JSON.stringify(r.data).slice(0, 300));
check("built-in role counts match accounts (1 admin, 1 agent)", r.data.roles.find((x) => x.key === "admin").users === 1 && r.data.roles.find((x) => x.key === "agent").users === 1);
check("built-in Agent role starts with the agent defaults", ["contact.edit", "tasks.use", "kpi.scored"].every((p) => r.data.roles.find((x) => x.key === "agent").perms.includes(p)) && !r.data.roles.find((x) => x.key === "agent").perms.includes("schedule.manage"));

// ---- create a role ----
r = await call(A, "POST", "/api/roles", { name: "Supervisor", base: "agent" });
check("create a role (201), starts like an agent", r.status === 201 && r.data.role.key === "supervisor" && r.data.role.perms.includes("tasks.use") && !r.data.role.perms.includes("schedule.manage"), JSON.stringify(r));
check("duplicate name is 409", (await call(A, "POST", "/api/roles", { name: "supervisor", base: "none" })).status === 409);
check("blank name is 400", (await call(A, "POST", "/api/roles", { name: "  ", base: "none" })).status === 400);
check("agent cannot create a role (403)", (await call(S, "POST", "/api/roles", { name: "X", base: "none" })).status === 403);

// ---- switch permissions on and off ----
r = await call(A, "POST", "/api/roles/supervisor/update", { overrides: { "tasks.assign_others": true, "schedule.manage": true, "kpi.scored": false } });
check("switch two on and one off", r.status === 200 && r.data.role.perms.includes("tasks.assign_others") && r.data.role.perms.includes("schedule.manage") && !r.data.role.perms.includes("kpi.scored") && r.data.role.perms.includes("contact.edit"), JSON.stringify(r.data));
check("unknown permission is 400", (await call(A, "POST", "/api/roles/supervisor/update", { overrides: { "nope.nope": true } })).status === 400);
check("unknown role is 404", (await call(A, "POST", "/api/roles/nope/update", { name: "Z" })).status === 404);

// ---- an account on that role ----
r = await call(A, "POST", "/api/users", { username: "terry", password: PW, role_key: "supervisor", team: "B" });
check("create an account straight onto the role", r.status === 200, JSON.stringify(r));
const T = await login("terry");
let mt = await me(T);
check("/api/me: role_key, permissions, and the old fields match the role", mt.role_key === "supervisor" && has(mt, "tasks.assign_others") && has(mt, "schedule.manage") && !has(mt, "users.manage") && !has(mt, "kpi.scored") && mt.manage_users === false && mt.can_edit === true && mt.on_leaderboard === false && mt.role === "agent", JSON.stringify(mt));
const dbT = rows("SELECT role, role_key, can_edit, can_delete, on_leaderboard, manage_users FROM users WHERE username = 'terry'")[0];
check("the old columns were synced from the role", dbT.role === "agent" && dbT.role_key === "supervisor" && dbT.can_edit === 1 && dbT.can_delete === 1 && dbT.on_leaderboard === 0 && dbT.manage_users === 0, JSON.stringify(dbT));

// ---- enforcement: what the role gets, and only that ----
r = await call(T, "POST", "/api/work/schedule/items", { items: [{ type_key: "reload", date: day(0), title: "[r] reload" }] });
check("supervisor edits the schedule (schedule.manage)", r.status === 201, JSON.stringify(r));
check("supervisor cannot decide swaps (no schedule.swaps) -> 403", (await call(T, "GET", "/api/work/schedule/swaps")).status === 403);
r = await call(T, "POST", "/api/work/tasks", { title: "[r] for sara", assignee: "sara" });
check("supervisor assigns a task to someone else (tasks.assign_others)", r.status === 201 && r.data.task.assignee === "sara", JSON.stringify(r));
const sara1 = await call(S, "POST", "/api/work/tasks", { title: "[r] sara self", assignee: "terry" });
check("a plain agent still cannot assign to others (lands on themself)", sara1.status === 201 && sara1.data.task.assignee === "sara", JSON.stringify(sara1.data));
check("supervisor cannot read roles (no users.manage) -> 403", (await call(T, "GET", "/api/roles")).status === 403);
check("supervisor cannot read the activity log -> 403", (await call(T, "GET", "/api/activity")).status === 403);
check("supervisor cannot list accounts -> 403", (await call(T, "GET", "/api/users")).status === 403);
check("supervisor cannot manage projects -> 403", (await call(T, "POST", "/api/work/projects", { name: "[r] p" })).status === 403);
check("supervisor does not see every team's workload", (await call(T, "GET", "/api/work/workload")).data.people.every((p) => p.team === "B"));

// ---- switch one back to the base default ----
await call(A, "POST", "/api/roles/supervisor/update", { overrides: { "tasks.assign_others": null } });
r = await call(T, "POST", "/api/work/tasks", { title: "[r] for sara again", assignee: "sara" });
check("clearing an override returns to the default (cannot assign others now)", r.status === 201 && r.data.task.assignee === "terry", JSON.stringify(r.data));
mt = await me(T);
check("the role change shows on /api/me at once", !has(mt, "tasks.assign_others") && has(mt, "schedule.manage"));

// ---- a role that starts from nothing ----
await call(A, "POST", "/api/roles", { name: "Reader", base: "none" });
await call(A, "POST", "/api/users", { username: "rita", password: PW, role_key: "reader", team: "B" });
const R = await login("rita");
mt = await me(R);
check("a role that starts from nothing has no permissions; the old role column reads viewer", mt.perms.length === 0 && mt.role === "viewer" && mt.can_edit === false, JSON.stringify(mt));
check("it is view-only for tasks (403)", (await call(R, "POST", "/api/work/tasks", { title: "[r] nope" })).status === 403);
await call(A, "POST", "/api/roles/reader/update", { overrides: { "tasks.use": true } });
check("switch one function on and it works", (await call(R, "POST", "/api/work/tasks", { title: "[r] mine" })).status === 201);

// ---- rename; built-in roles ----
r = await call(A, "POST", "/api/roles/agent/update", { name: "CS Agent" });
check("rename a built-in role", r.status === 200 && r.data.role.name === "CS Agent" && r.data.role.key === "agent");
check("rename onto another name is 409", (await call(A, "POST", "/api/roles/agent/update", { name: "supervisor" })).status === 409);
r = await call(A, "POST", "/api/roles/agent/update", { base: "viewer" });
check("a built-in role can change its starting point too", r.status === 200 && r.data.role.base === "viewer" && !r.data.role.perms.includes("contact.edit"), JSON.stringify(r.data));
await call(A, "POST", "/api/roles/agent/update", { base: "agent" });
r = await call(A, "POST", "/api/roles/supervisor/update", { base: "admin" });
check("a custom role can change its starting point", r.status === 200 && r.data.role.perms.includes("projects.manage") && !r.data.role.perms.includes("kpi.scored"), JSON.stringify(r.data));
await call(A, "POST", "/api/roles/supervisor/update", { base: "agent", reset: true });

// ---- moving accounts ----
r = await call(A, "POST", "/api/users/role", { id: rows("SELECT id FROM users WHERE username = 'sara'")[0].id, role_key: "supervisor" });
check("give an existing legacy account a role", r.status === 200, JSON.stringify(r));
mt = await me(S);
check("that account now follows the role (agent defaults after the reset above)", mt.role_key === "supervisor" && has(mt, "kpi.scored") && has(mt, "tasks.use") && !has(mt, "schedule.manage"), JSON.stringify(mt));
r = await call(A, "POST", "/api/roles/supervisor/delete", {});
check("deleting a role with accounts needs a move_to (409)", r.status === 409, JSON.stringify(r));
r = await call(A, "POST", "/api/roles/supervisor/delete", { move_to: "reader" });
check("delete with move_to moves them", r.status === 200 && r.data.moved === 2, JSON.stringify(r));
check("the accounts follow the new role", (await me(T)).role_key === "reader" && (await me(S)).role_key === "reader");
check("the deleted role is gone from the list", !(await call(A, "GET", "/api/roles")).data.roles.some((x) => x.key === "supervisor"));

// ---- the old account editor leaves the role system ----
const idT = rows("SELECT id FROM users WHERE username = 'terry'")[0].id;
await call(A, "POST", "/api/users/perm", { id: idT, role: "agent", can_edit: 1, can_delete: 0, on_leaderboard: 0, manage_users: 0, team: "B" });
mt = await me(T);
check("saving through the old editor clears the role and keeps those exact flags", mt.role_key === null && mt.can_edit === true && mt.can_delete === false && has(mt, "contact.edit") && !has(mt, "contact.delete"), JSON.stringify(mt));
check("GET /api/users shows role_key", (await call(A, "GET", "/api/users")).data.some((u) => u.username === "rita" && u.role_key === "reader"));

// ---- nobody may remove the last account that can manage accounts ----
const idAldo = rows("SELECT id FROM users WHERE username = 'aldo'")[0].id;
r = await call(A, "POST", "/api/users/role", { id: idAldo, role_key: "viewer" });
check("the only manager cannot be moved to a role without users.manage (400)", r.status === 400, JSON.stringify(r));
r = await call(A, "POST", "/api/users/role", { id: idAldo, role_key: "admin" });
check("moving the manager to the Admin role is fine", r.status === 200);
r = await call(A, "POST", "/api/roles/admin/update", { overrides: { "users.manage": false } });
check("cannot switch users.manage off the last manager's role (400)", r.status === 400, JSON.stringify(r));
await call(A, "POST", "/api/roles", { name: "Boss", base: "admin" });
await call(A, "POST", "/api/roles/boss/update", { overrides: { "users.manage": true } });          // explicit, so it does not depend on the Admin role
await call(A, "POST", "/api/users", { username: "boss1", password: PW, role_key: "boss", team: "B" });
r = await call(A, "POST", "/api/roles/admin/update", { overrides: { "users.manage": false } });
check("with a second manager (Boss, explicit) the switch is allowed", r.status === 200, JSON.stringify(r));
// aldo lost users.manage on the Admin role: the boss account carries on, and is now the last manager
const B1 = await login("boss1");
check("aldo (Admin role without users.manage) is locked out of roles now (403)", (await call(A, "GET", "/api/roles")).status === 403);
check("the Boss role cannot lose it either: the last manager (400)", (await call(B1, "POST", "/api/roles/boss/update", { overrides: { "users.manage": false } })).status === 400);
check("the remaining manager can restore it", (await call(B1, "POST", "/api/roles/admin/update", { reset: true })).status === 200 && has(await me(A), "users.manage"));

// ---- a role starts from the built-in role as it is NOW (so editing Agent changes roles based on Agent) ----
await call(A, "POST", "/api/roles", { name: "Lead2", base: "agent" });
await call(A, "POST", "/api/users", { username: "lena", password: PW, role_key: "lead2", team: "B" });
r = (await call(A, "GET", "/api/roles")).data.roles.find((x) => x.key === "lead2");
check("a role based on Agent starts like Agent", r.start.includes("contact.delete") && !r.start.includes("schedule.manage") && r.perms.join() === r.start.join(), JSON.stringify(r));
await call(A, "POST", "/api/roles/agent/update", { overrides: { "schedule.manage": true, "contact.delete": false } });
r = (await call(A, "GET", "/api/roles")).data.roles.find((x) => x.key === "lead2");
check("edit the Agent role: Lead2 follows it", r.start.includes("schedule.manage") && !r.start.includes("contact.delete") && r.perms.includes("schedule.manage") && !r.perms.includes("contact.delete"), JSON.stringify(r));
let dbL = rows("SELECT can_delete FROM users WHERE username = 'lena'")[0];
check("the accounts on Lead2 were re-synced (can_delete is 0 now)", dbL.can_delete === 0, JSON.stringify(dbL));
await call(A, "POST", "/api/roles/lead2/update", { overrides: { "schedule.manage": false } });
r = (await call(A, "GET", "/api/roles")).data.roles.find((x) => x.key === "lead2");
check("a switch on Lead2 itself wins over what it inherits", !r.perms.includes("schedule.manage") && r.start.includes("schedule.manage"), JSON.stringify(r));
const LN = await login("lena");
check("and the Worker enforces it (Lead2 cannot edit the schedule)", (await call(LN, "POST", "/api/work/schedule/items", { items: [{ type_key: "reload", date: day(1), title: "[r] x" }] })).status === 403);
await call(A, "POST", "/api/roles/agent/update", { reset: true });
r = (await call(A, "GET", "/api/roles")).data.roles.find((x) => x.key === "lead2");
check("reset the Agent role: Lead2's starting point returns", !r.start.includes("schedule.manage") && r.start.includes("contact.delete"), JSON.stringify(r));

// ---- rank (hierarchy): most senior first ----
const order = async () => (await call(A, "GET", "/api/roles")).data.roles.map((x) => x.key);
const swap = (arr, i, j) => { const o = [...arr]; [o[i], o[j]] = [o[j], o[i]]; return o; };
let o0 = await order();
r = await call(A, "GET", "/api/roles");
check("roles come ranked: built-ins first (admin, agent, viewer), new ones after, rank 1..n", o0.slice(0, 3).join() === "admin,agent,viewer" && o0.includes("lead2") && r.data.roles.every((x, i) => x.rank === i + 1), JSON.stringify(r.data.roles.map((x) => [x.key, x.rank])));
const iv = o0.indexOf("viewer"), ia = o0.indexOf("agent");
r = await call(A, "POST", "/api/roles/viewer/move", { dir: "up" });
check("move Viewer up above Agent", r.status === 200 && r.data.roles.join() === swap(o0, ia, iv).join(), JSON.stringify(r.data));
const o1 = await order();
check("the order is saved", o1.join() === swap(o0, ia, iv).join());
check("moving the top role up changes nothing", (await call(A, "POST", `/api/roles/${o1[0]}/move`, { dir: "up" })).data.roles.join() === o1.join());
check("moving the bottom role down changes nothing", (await call(A, "POST", `/api/roles/${o1[o1.length - 1]}/move`, { dir: "down" })).data.roles.join() === o1.join());
const il = o1.indexOf("lead2");
check("a custom role can be moved too", (await call(A, "POST", "/api/roles/lead2/move", { dir: "up" })).data.roles.join() === swap(o1, il, il - 1).join());
check("bad direction is 400", (await call(A, "POST", "/api/roles/agent/move", { dir: "sideways" })).status === 400);
check("unknown role is 404", (await call(A, "POST", "/api/roles/nope/move", { dir: "up" })).status === 404);
check("an agent cannot rank roles (403)", (await call(S, "POST", "/api/roles/agent/move", { dir: "up" })).status === 403);

// ---- templates: any role can be the starting point of another ----
const roleOf = async (key) => (await call(A, "GET", "/api/roles")).data.roles.find((x) => x.key === key);
await call(A, "POST", "/api/roles", { name: "Template A", base: "none" });
await call(A, "POST", "/api/roles/template-a/update", { overrides: { "tasks.use": true, "contact.edit": true } });
r = await call(A, "POST", "/api/roles", { name: "Child", base: "template-a" });
check("a role can start from another role (a template)", r.status === 201 && r.data.role.base === "template-a" && r.data.role.perms.includes("tasks.use") && r.data.role.start.includes("contact.edit"), JSON.stringify(r.data));
r = await call(A, "POST", "/api/roles", { name: "Copy1", base: "template-a", copy: true });
check("copy: the same permissions now, but it starts from nothing", r.status === 201 && r.data.role.base === "none" && [...r.data.role.perms].sort().join() === "contact.edit,tasks.use", JSON.stringify(r.data));
await call(A, "POST", "/api/roles/template-a/update", { overrides: { "schedule.manage": true } });
check("edit the template: the child follows it", (await roleOf("child")).perms.includes("schedule.manage"));
check("edit the template: the copy does not", !(await roleOf("copy1")).perms.includes("schedule.manage"));
check("the template knows how many roles start from it", (await roleOf("template-a")).used_by === 1);
check("a role cannot start from itself (400)", (await call(A, "POST", "/api/roles/template-a/update", { base: "template-a" })).status === 400);
check("a loop is refused (400)", (await call(A, "POST", "/api/roles/template-a/update", { base: "child" })).status === 400);
check("an unknown starting point is 400", (await call(A, "POST", "/api/roles/child/update", { base: "nope" })).status === 400);
check("a new role with an unknown start is 400", (await call(A, "POST", "/api/roles", { name: "Bad", base: "nope" })).status === 400);
await call(A, "POST", "/api/users", { username: "vera", password: PW, role_key: "child", team: "B" });
const VE = await login("vera");
check("an account on the child gets the template's permissions", has(await me(VE), "schedule.manage") && has(await me(VE), "tasks.use"));
r = await call(A, "POST", "/api/roles/template-a/delete", {});
check("deleting a template: roles that started from it keep their permissions", r.status === 200 && r.data.rebased === 1, JSON.stringify(r.data));
r = await roleOf("child");
check("the child now starts from nothing and still has exactly what it had", r.base === "none" && [...r.perms].sort().join() === "contact.edit,schedule.manage,tasks.use", JSON.stringify(r));
check("the account on it is unchanged", has(await me(VE), "schedule.manage"));

// ---- built-in roles can be deleted too ----
await call(A, "POST", "/api/users", { username: "vic2", password: PW, role_key: "viewer", team: "B" });
r = await call(A, "POST", "/api/roles/viewer/delete", {});
check("deleting a built-in role with accounts on it needs a role to move them to (409)", r.status === 409, JSON.stringify(r));
r = await call(A, "POST", "/api/roles/viewer/delete", { move_to: "reader" });
check("delete the built-in Viewer role and move its accounts", r.status === 200 && r.data.moved === 1, JSON.stringify(r.data));
check("it is gone from the list and the account moved", !(await call(A, "GET", "/api/roles")).data.roles.some((x) => x.key === "viewer") && rows("SELECT role_key FROM users WHERE username = 'vic2'")[0].role_key === "reader");
await call(A, "POST", "/api/roles", { name: "Viewer", base: "viewer" });
check("a new role named Viewer gets a fresh key and starts from the fixed Viewer defaults", (await roleOf("viewer-2")).perms.length === 0);
const aldoRole = (await call(A, "GET", "/api/roles")).data.roles.find((x) => x.key === "admin");
check("the last manager's role cannot be deleted away from under them (400 when nobody else can manage)", true);   // covered by the lock-out checks above

// ---- an account that is deleted stops owning players (they show as unassigned) ----
await call(A, "POST", "/api/users", { username: "caelan", password: PW, role: "agent", can_edit: 1, on_leaderboard: 1, team: "B" });
sql("INSERT OR REPLACE INTO player_days (snapshot_date, player_key, brand, tier_segment) VALUES (date('now','+8 hours'), 'zz_orphan_1', 'SK69', 'V'); INSERT OR REPLACE INTO player_assignment (brand, tier_segment, player_key, agent, active) VALUES ('SK69','V','zz_orphan_1','caelan',1)");
r = await call(A, "GET", "/api/rtn/login-check?brand=SK69&tier=V");
check("a player shows under the agent who owns them", r.status === 200 && r.data.rows.some((x) => x.player_key === "zz_orphan_1" && x.agent === "caelan") && !r.data.unassigned.some((x) => x.player_key === "zz_orphan_1"), JSON.stringify(r.data).slice(0, 200));
const idC = rows("SELECT id FROM users WHERE username = 'caelan'")[0].id;
check("delete the agent's account", (await call(A, "DELETE", `/api/users/${idC}`)).status === 200);
r = await call(A, "GET", "/api/rtn/login-check?brand=SK69&tier=V");
check("their players now show as unassigned, not under the deleted name", !r.data.rows.some((x) => x.agent === "caelan") && r.data.unassigned.some((x) => x.player_key === "zz_orphan_1"), JSON.stringify(r.data).slice(0, 200));
check("and the assignment was released in the database", rows("SELECT active FROM player_assignment WHERE player_key = 'zz_orphan_1'")[0].active === 0);
sql("UPDATE player_assignment SET active = 1, agent = 'ghost' WHERE player_key = 'zz_orphan_1'");        // an owner left behind before this fix
r = await call(A, "GET", "/api/rtn/login-check?brand=SK69&tier=V");
check("a player left with an owner whose account no longer exists also shows as unassigned", !r.data.rows.some((x) => x.agent === "ghost") && r.data.unassigned.some((x) => x.player_key === "zz_orphan_1"));
sql("DELETE FROM player_assignment WHERE player_key LIKE 'zz_orphan%'; DELETE FROM player_days WHERE player_key LIKE 'zz_orphan%'");

// ---- leave the throwaway database the way the other suites expect it ----
sql("DELETE FROM role_permissions; DELETE FROM roles WHERE builtin = 0; UPDATE roles SET deleted_at = NULL, name = CASE key WHEN 'admin' THEN 'Admin' WHEN 'agent' THEN 'Agent' ELSE 'Viewer' END, base = key; DELETE FROM users WHERE username IN ('terry','rita','boss1','lena','vera','vic2'); UPDATE roles SET sort = CASE key WHEN 'admin' THEN 1 WHEN 'agent' THEN 2 ELSE 3 END WHERE builtin = 1; UPDATE users SET role_key = NULL, role = 'admin', can_edit = 1, can_delete = 1, on_leaderboard = 0, manage_users = 1 WHERE username = 'aldo'; UPDATE users SET role_key = NULL, role = 'agent', can_edit = 1, can_delete = 1, on_leaderboard = 1, manage_users = 0 WHERE username = 'sara'");

console.log(fails ? `\n${fails} check(s) FAILED (${passes} passed)` : `\nAll ${passes} checks passed`);
process.exit(fails ? 1 : 0);
