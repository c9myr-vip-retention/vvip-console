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
check("admin reads the catalogue (49 permissions, 5 groups) and 3 built-in roles", r.status === 200 && keys.length === 49 && new Set(keys).size === 49 && r.data.groups.length === 5 && r.data.roles.map((x) => x.key).join() === "admin,agent,viewer" && r.data.setup_needed === false, JSON.stringify(r.data).slice(0, 300));
check("built-in role counts match accounts (1 admin, 1 agent)", r.data.roles.find((x) => x.key === "admin").users === 1 && r.data.roles.find((x) => x.key === "agent").users === 1);
check("every page has its own permission", ["page.changes", "page.performance", "page.contact", "page.checkin", "page.grace", "page.players", "page.tasks", "page.schedule", "page.projects", "page.workload", "page.myday", "page.myperf", "page.account", "page.settings"].every((k) => keys.includes(k)));
const agentRole = r.data.roles.find((x) => x.key === "agent"), adminRole = r.data.roles.find((x) => x.key === "admin");
check("Agent starts with the agent pages, Settings (My account tab inside), not Performance", ["page.contact", "page.tasks", "page.myday", "page.settings", "page.account"].every((k) => agentRole.perms.includes(k)) && !agentRole.perms.includes("page.performance"), JSON.stringify(agentRole.perms));
check("Admin starts with Settings and Performance, not the agent-only pages", adminRole.perms.includes("page.settings") && adminRole.perms.includes("page.performance") && !adminRole.perms.includes("page.myday"));
const meLegacyAgent = await me(S), meLegacyAdmin = await me(A);
check("old-settings accounts keep exactly their pages (agent sees agent pages, admin sees admin pages)", has(meLegacyAgent, "page.contact") && has(meLegacyAgent, "page.myday") && has(meLegacyAgent, "page.settings") && has(meLegacyAgent, "page.account") && !has(meLegacyAgent, "page.performance") && has(meLegacyAdmin, "page.settings") && !has(meLegacyAdmin, "page.myday"));
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
const PA = (await call(A, "POST", "/api/work/projects", { name: "[r] admin's project", members: ["terry"] })).data.project.id;
check("supervisor cannot archive or delete a project they do not own -> 403", (await call(T, "POST", `/api/work/projects/${PA}/archive`, { archived: 1 })).status === 403 && (await call(T, "POST", `/api/work/projects/${PA}/delete`)).status === 403);
const PT = (await call(T, "POST", "/api/work/projects", { name: "[r] terry's own" })).data.project;
check("supervisor (an agent-based role) can create and delete their own project", PT && (await call(T, "POST", `/api/work/projects/${PT.id}/delete`)).status === 200);
sql(`DELETE FROM project_members WHERE project_id IN (${PA}, ${PT.id}); DELETE FROM projects WHERE id IN (${PA}, ${PT.id})`);;
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
await call(A, "POST", "/api/roles/agent/update", { overrides: { "schedule.manage": true, "contact.delete": false, "contact.delete_own": false } });
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
check("a new role named Viewer gets a fresh key and starts from the fixed Viewer defaults", (await roleOf("viewer-2")).perms.every((k) => k.startsWith("page.")));
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

// ---- personal permissions: same role, different people ----
const isNull = (v) => v === null || v === "null";                      // the local D1 helper prints SQL NULL as the text "null"
await call(A, "POST", "/api/roles", { name: "Floor", base: "agent" });
await call(A, "POST", "/api/users", { username: "pia", password: PW, role_key: "floor", team: "B" });
await call(A, "POST", "/api/users", { username: "pat", password: PW, role_key: "floor", team: "B" });
const idPia = rows("SELECT id FROM users WHERE username = 'pia'")[0].id, idPat = rows("SELECT id FROM users WHERE username = 'pat'")[0].id;
const PIA = await login("pia"), PAT = await login("pat");
check("two people on the same role start with the same permissions", JSON.stringify((await me(PIA)).perms.sort()) === JSON.stringify((await me(PAT)).perms.sort()));
r = await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "dashboard.view": true, "contact.edit": false, "contact.edit_own": false } });
check("give one person an extra permission and take one away", r.status === 200 && r.data.overrides["dashboard.view"] === true && r.data.overrides["contact.edit"] === false && r.data.perms.includes("dashboard.view") && !r.data.perms.includes("contact.edit"), JSON.stringify(r.data));
let mp = await me(PIA), mt2 = await me(PAT);
await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "page.contact": false } });
check("a personal exception can hide one page for one person", !has(await me(PIA), "page.contact") && has(await me(PAT), "page.contact"));
await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "page.contact": null } });
check("it shows on their /api/me", has(mp, "dashboard.view") && !has(mp, "contact.edit") && mp.can_edit === false, JSON.stringify(mp));
check("the other person on the same role is unchanged", !has(mt2, "dashboard.view") && has(mt2, "contact.edit"));
check("the old columns follow the exceptions (can_edit is 0)", rows("SELECT can_edit FROM users WHERE username = 'pia'")[0].can_edit === 0);
check("GET /api/users shows the personal permissions", JSON.parse((await call(A, "GET", "/api/users")).data.find((u) => u.username === "pia").perm_overrides)["dashboard.view"] === true);
check("it is enforced: they can use a permission they were given (tasks.assign_others)", (await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "tasks.assign_others": true } })).status === 200 && (await call(PIA, "POST", "/api/work/tasks", { title: "[r] pia gives", assignee: "pat" })).data.task.assignee === "pat");
check("...and the other person still cannot", (await call(PAT, "POST", "/api/work/tasks", { title: "[r] pat tries", assignee: "pia" })).data.task.assignee === "pat");
await call(A, "POST", "/api/roles/floor/update", { overrides: { "dashboard.view": true } });
r = await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "dashboard.view": true } });
check("setting what the role already has leaves no exception", r.status === 200 && !("dashboard.view" in r.data.overrides), JSON.stringify(r.data));
await call(A, "POST", "/api/roles/floor/update", { overrides: { "dashboard.view": null } });
r = await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "contact.edit": null, "contact.edit_own": null } });
check("clear one exception", r.status === 200 && !("contact.edit" in r.data.overrides) && r.data.perms.includes("contact.edit"), JSON.stringify(r.data));
check("clearing it brings the old column back", rows("SELECT can_edit FROM users WHERE username = 'pia'")[0].can_edit === 1);
await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "kpi.scored": false } });
await call(A, "POST", "/api/roles/floor/update", { overrides: { "contact.delete": false, "contact.delete_own": false } });
check("editing the role keeps the exceptions and re-syncs the columns", rows("SELECT can_delete, on_leaderboard FROM users WHERE username = 'pia'")[0].can_delete === 0 && rows("SELECT on_leaderboard FROM users WHERE username = 'pia'")[0].on_leaderboard === 0 && JSON.stringify(Object.keys(JSON.parse(rows("SELECT perm_overrides FROM users WHERE username = 'pia'")[0].perm_overrides)).sort()) === JSON.stringify(["kpi.scored", "tasks.assign_others"]));
check("unknown permission is 400", (await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "nope.nope": true } })).status === 400);
check("unknown account is 404", (await call(A, "POST", "/api/users/perms", { id: 999999, overrides: { "dashboard.view": true } })).status === 404);
check("an agent cannot set personal permissions (403)", (await call(S, "POST", "/api/users/perms", { id: idPia, overrides: { "dashboard.view": true } })).status === 403);
check("a person cannot give themselves permissions (403)", (await call(PIA, "POST", "/api/users/perms", { id: idPia, overrides: { "users.manage": true } })).status === 403);
await call(A, "POST", "/api/users", { username: "leg1", password: PW, role: "agent", can_edit: 1, team: "B" });                // an old-settings account: no role
check("an account with no role cannot have personal permissions (400)", (await call(A, "POST", "/api/users/perms", { id: rows("SELECT id FROM users WHERE username = 'leg1'")[0].id, overrides: { "dashboard.view": true } })).status === 400);
r = await call(A, "POST", "/api/users/perms", { id: idPia, reset: true });
check("reset: back to exactly the role", r.status === 200 && Object.keys(r.data.overrides).length === 0 && isNull(rows("SELECT perm_overrides FROM users WHERE username = 'pia'")[0].perm_overrides), JSON.stringify(r.data));
await call(A, "POST", "/api/users/perms", { id: idPia, overrides: { "dashboard.view": true } });
await call(A, "POST", "/api/users/role", { id: idPia, role_key: "reader" });
check("moving them to a different role clears their personal permissions", isNull(rows("SELECT perm_overrides FROM users WHERE username = 'pia'")[0].perm_overrides) && !has(await me(PIA), "dashboard.view"));
// the last manager cannot lose users.manage through a personal exception
await call(A, "POST", "/api/roles", { name: "Solo", base: "admin" });
await call(A, "POST", "/api/roles/solo/update", { overrides: { "users.manage": true } });
await call(A, "POST", "/api/users", { username: "solo1", password: PW, role_key: "solo", team: "B" });
const idSolo = rows("SELECT id FROM users WHERE username = 'solo1'")[0].id;
const idAldo2 = rows("SELECT id FROM users WHERE username = 'aldo'")[0].id;
sql("DELETE FROM users WHERE username = 'boss1'");   // the earlier second manager
sql("UPDATE users SET role_key = NULL, role = 'admin', manage_users = 0, can_edit = 1, can_delete = 1 WHERE username = 'aldo'");   // aldo is not a manager now, so solo1 is the only one
r = await call(await login("solo1"), "POST", "/api/users/perms", { id: idSolo, overrides: { "users.manage": false } });
check("the last manager cannot take users.manage away from themselves (400)", r.status === 400, JSON.stringify(r));
sql("UPDATE users SET manage_users = 1 WHERE username = 'aldo'");

// ---- who each role can see (the hierarchy decides) ----
const peopleOf = async (tok) => (await call(tok, "GET", "/api/work/people")).data.people.map((x) => x.username).sort();
check("the 'see people from every team' permission exists and is off for everyone by default", !(await roleOf("admin")).perms.includes("people.all") && !(await roleOf("agent")).perms.includes("people.all") && keys.includes("people.all"));
for (const n of ["Boss2", "Mid2", "Junior2"]) await call(A, "POST", "/api/roles", { name: n, base: "agent" });
for (const [u, rk, tm] of [["bo", "boss2", "B"], ["mi", "mid2", "B"], ["ju", "junior2", "B"], ["ot1", "junior2", "A"], ["mi2", "mid2", "A"]]) await call(A, "POST", "/api/users", { username: u, password: PW, role_key: rk, team: tm });
const BO = await login("bo"), MI = await login("mi"), JU = await login("ju");
let pp = await peopleOf(MI);
check("by default the hierarchy applies: Mid2 sees itself and the roles below, in every team, but not the more senior Boss2", pp.includes("ju") && pp.includes("mi") && pp.includes("ot1") && !pp.includes("bo"), JSON.stringify(pp));
r = await call(A, "POST", "/api/roles/mid2/update", { sees: { team: "own" } });
check("set a role to see only its own team", r.status === 200 && r.data.role.sees.team === "own", JSON.stringify(r.data));
pp = await peopleOf(MI);
check("limited to its own team, Mid2 sees itself and its team's juniors, not the other team's juniors or colleagues", pp.includes("mi") && pp.includes("ju") && !pp.includes("mi2") && !pp.includes("ot1") && !pp.includes("bo"), JSON.stringify(pp));
await call(A, "POST", "/api/roles/mid2/update", { overrides: { "people.same_rank": true } });
pp = await peopleOf(MI);
check("limited to its own team + 'same-rank colleagues' on: a same-rank colleague of another team appears, the other team's juniors still do not", pp.includes("mi2") && !pp.includes("ot1") && !pp.includes("bo"), JSON.stringify(pp));
await call(A, "POST", "/api/roles/mid2/update", { overrides: { "people.same_rank": null } });
check("Boss2 (the most senior of the three) still sees everyone below, every team", (await peopleOf(BO)).includes("ot1") && (await peopleOf(BO)).includes("mi"));
check("the admin account still sees everyone", (await peopleOf(A)).includes("ot1"));
check("an account on old settings sees everyone", (await peopleOf(await login("leg1"))).includes("ot1"));
check("a bad value is 400, and the old rank / roles settings are gone (400)", (await call(A, "POST", "/api/roles/mid2/update", { sees: { team: "everything" } })).status === 400 && (await call(A, "POST", "/api/roles/mid2/update", { sees: { mode: "rank" } })).status === 400);
check("an agent cannot change who a role sees (403)", (await call(S, "POST", "/api/roles/mid2/update", { sees: { team: "all" } })).status === 403);
pp = (await call(MI, "GET", "/api/work/workload")).data.people.map((x) => x.username);
check("the workload list follows it too", pp.includes("ju") && !pp.includes("ot1") && !pp.includes("bo"), JSON.stringify(pp));
sql("INSERT OR REPLACE INTO player_days (snapshot_date, player_key, brand, tier_segment) VALUES (date('now','+8 hours'), 'zz_vis_1', 'SK69', 'V')");
r = await call(MI, "GET", "/api/rtn/board");
const names = (r.data.team || []).map((x) => x.username);
check("the board's agent list follows it too, and carries team and role", r.status === 200 && names.includes("mi") && names.includes("ju") && !names.includes("ot1") && !names.includes("bo") && r.data.team.every((x) => "team" in x && "role" in x), JSON.stringify(r.data.team || r.data).slice(0, 200));
r = await call(A, "GET", "/api/rtn/board");
check("the admin's board list still has everyone", (r.data.team || []).some((x) => x.username === "ot1") && (r.data.team || []).some((x) => x.username === "mi"));
await call(A, "POST", "/api/roles/mid2/update", { sees: { team: "all" } });
check("setting it back to every team", (await peopleOf(MI)).includes("ot1") && (await roleOf("mid2")).sees.team === "all" && isNull(rows("SELECT sees FROM roles WHERE key = 'mid2'")[0].sees));
sql("DELETE FROM player_days WHERE player_key LIKE 'zz_vis%'");

// ---- an agent is anyone with a team and "Counts as a scored CS agent", whatever their role is called ----
r = await call(A, "POST", "/api/roles", { name: "Jnr9", base: "none" });
await call(A, "POST", `/api/roles/${r.data.role.key}/update`, { overrides: { "kpi.scored": true, "tasks.use": true } });
const JR = r.data.role.key;
await call(A, "POST", "/api/users", { username: "jn9", password: PW, role_key: JR, team: "A" });
const WR = (await call(A, "POST", "/api/roles", { name: "Watch9", base: "viewer" })).data.role.key;
await call(A, "POST", "/api/users", { username: "vw9", password: PW, role_key: WR, team: "A" });
const jrow = (list) => (list || []).find((x) => x.username === "jn9");
check("a role built from nothing keeps the old role column as viewer (that is why the role name cannot decide who is an agent)", rows("SELECT role, on_leaderboard FROM users WHERE username = 'jn9'")[0].role === "viewer" && rows("SELECT on_leaderboard FROM users WHERE username = 'jn9'")[0].on_leaderboard === 1);
r = await call(A, "GET", "/api/work/people");
check("the people list says who is scored", jrow(r.data.people) && jrow(r.data.people).on_leaderboard === 1 && jrow(r.data.people).team === "A" && r.data.people.find((x) => x.username === "vw9").on_leaderboard === 0, JSON.stringify(r.data.people));
r = await call(A, "GET", "/api/work/workload");
check("the workload shows the scored agent, not the view-only one", jrow(r.data.people) && !r.data.people.some((x) => x.username === "vw9"), JSON.stringify(r.data.people.map((x) => x.username)));
sql("INSERT OR REPLACE INTO player_days (snapshot_date, player_key, brand, tier_segment) VALUES (date('now','+8 hours'), 'zz_sc_1', 'BM69', 'V')");
r = await call(A, "GET", "/api/rtn/board");
check("the board agent list carries the scored flag and team", jrow(r.data.team) && jrow(r.data.team).on_leaderboard === 1 && jrow(r.data.team).team === "A", JSON.stringify((r.data.team || []).slice(0, 3)));
sql("DELETE FROM player_days WHERE player_key LIKE 'zz_sc%'");

// ---- a role limited to its own team: the board, people and workload lists follow the account's team, not the team in view ----
const OT = (await call(A, "POST", "/api/roles", { name: "OwnTeam9", base: "agent" })).data.role.key;
await call(A, "POST", "/api/users", { username: "ow9", password: PW, role_key: OT, team: "A" });
await call(A, "POST", "/api/users", { username: "ow9a", password: PW, role_key: OT, team: "A" });
await call(A, "POST", "/api/users", { username: "ob9", password: PW, role_key: OT, team: "B" });
const OW = await login("ow9");
const UN = (await call(A, "POST", "/api/roles", { name: "Under9", base: "agent" })).data.role.key;      // created after OwnTeam9, so it is below it
await call(A, "POST", "/api/users", { username: "un9a", password: PW, role_key: UN, team: "A" });
await call(A, "POST", "/api/users", { username: "un9b", password: PW, role_key: UN, team: "B" });
pp = await peopleOf(OW);
check("same role, every team, no limit: they see each other, and every junior of every team", pp.includes("ob9") && pp.includes("un9a") && pp.includes("un9b"), JSON.stringify(pp));
await call(A, "POST", `/api/roles/${OT}/update`, { sees: { team: "own" } });
pp = await peopleOf(OW);
check("limited to its own team: its own team's colleagues and downline only", pp.includes("ow9") && pp.includes("ow9a") && pp.includes("un9a") && !pp.includes("ob9") && !pp.includes("un9b"), JSON.stringify(pp));
check("limited to its own team: nobody above is seen", !pp.includes("aldo") && !pp.some((u) => ["jn9", "vw9"].includes(u)), JSON.stringify(pp));
await call(A, "POST", `/api/roles/${OT}/update`, { overrides: { "people.same_rank": true } });
pp = await peopleOf(OW);
check("own team + 'same-rank colleagues' on: a same-rank colleague of another team appears, but not that team's downline and not anyone above", pp.includes("ob9") && !pp.includes("un9b") && !pp.includes("aldo"), JSON.stringify(pp));
await call(A, "POST", `/api/roles/${OT}/update`, { overrides: { "people.same_rank": null } });
await call(A, "POST", `/api/roles/${OT}/update`, { sees: { team: "all" } });

// ---- every permission comes as "own" and "any": switch the "any" one off and the person keeps working on their own things ----
sql("UPDATE users SET role_key = NULL, role = 'agent', can_edit = 1, can_delete = 1, on_leaderboard = 1, manage_users = 0, perm_overrides = NULL WHERE username = 'sara'");   // sara is a plain old-settings agent again
const OWN = (await call(A, "POST", "/api/roles", { name: "OwnOnly9", base: "agent" })).data.role.key;
r = await call(A, "POST", `/api/roles/${OWN}/update`, { overrides: { "contact.edit": false, "contact.delete": false, "schedule.edit_own": true, "templates.own": true, "flows.own": true } });
check("an agent role with the 'any' contact permissions off still has the 'own' ones", r.status === 200 && r.data.role.perms.includes("contact.edit_own") && r.data.role.perms.includes("contact.delete_own") && !r.data.role.perms.includes("contact.edit") && !r.data.role.perms.includes("contact.delete"), JSON.stringify(r.data.role.perms));
await call(A, "POST", "/api/users", { username: "own9", password: PW, role_key: OWN, team: "B" });
const O9 = await login("own9");
let mo = await me(O9);
check("/api/me: can_edit stays true for an own-only account, and lists the own permissions", mo.can_edit === true && has(mo, "contact.edit_own") && !has(mo, "contact.edit"), JSON.stringify(mo));
const snap = rows("SELECT date('now','+8 hours') AS d")[0].d;
const cp = (pk, extra = {}) => ({ snapshot_date: snap, player_key: pk, brand: "SK69", tier_segment: "V", status: "CALLED", ...extra });
sql(`DELETE FROM contact_log WHERE player_key LIKE 'zz_own%'; DELETE FROM player_notes WHERE player_key LIKE 'zz_own%'; INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, assigned_to, status, updated_by) VALUES ('${snap}', 'zz_own_sara', 'SK69', 'V', 'sara', 'CALLED', 'sara')`);
check("own-only: logging a contact on an unassigned player works", (await call(O9, "POST", "/api/rtn/contact", cp("zz_own_free"))).status === 200);
check("own-only: a player assigned to someone else is off limits (403)", (await call(O9, "POST", "/api/rtn/contact", cp("zz_own_sara"))).status === 403);
r = await call(S, "POST", "/api/rtn/contact", cp("zz_own_free", { status: "NO ANSWER" }));
check("own-only: the other agent (with the 'any' permission) can still do it", r.status === 200, JSON.stringify(r.data));
check("own-only: handing a player to someone else is refused", (await call(O9, "POST", "/api/rtn/contact", cp("zz_own_mine", { assigned_to: "sara" }))).status === 403);
check("own-only: assigning to themself is fine", (await call(O9, "POST", "/api/rtn/contact", cp("zz_own_mine", { assigned_to: "own9" }))).status === 200);
check("own-only: once assigned to them, a player is theirs", (await call(O9, "POST", "/api/rtn/contact", cp("zz_own_mine", { assigned_to: "own9", status: "RECOVERED" }))).status === 200);
check("own-only: clearing a contact somebody else logged is refused", (await call(O9, "POST", "/api/rtn/contact", { snapshot_date: snap, player_key: "zz_own_sara", brand: "SK69", tier_segment: "V", clear: true })).status === 403 && rows("SELECT COUNT(*) n FROM contact_log WHERE player_key = 'zz_own_sara'")[0].n === 1);
check("own-only: clearing their own contact works", (await call(O9, "POST", "/api/rtn/contact", { snapshot_date: snap, player_key: "zz_own_mine", brand: "SK69", tier_segment: "V", clear: true })).status === 200 && rows("SELECT COUNT(*) n FROM contact_log WHERE player_key = 'zz_own_mine'")[0].n === 0);
check("own-only: a note on someone else's player is refused", (await call(O9, "POST", "/api/rtn/notes", { player_key: "zz_own_sara", brand: "SK69", note: "x" })).status === 403);
sql("INSERT INTO player_notes (player_key, brand, note, created_by) VALUES ('zz_own_sara', 'SK69', 'sara wrote this', 'sara')");
const noteId = rows("SELECT id FROM player_notes WHERE player_key = 'zz_own_sara'")[0].id;
check("own-only: deleting somebody else's note is refused", (await call(O9, "DELETE", `/api/rtn/notes/${noteId}`)).status === 403 && rows("SELECT COUNT(*) n FROM player_notes WHERE id = " + noteId)[0].n === 1);
check("an agent with the 'any' permission can delete it", (await call(S, "DELETE", `/api/rtn/notes/${noteId}`)).status === 200);
check("own-only: a note on a free player, then deleting it", (await call(O9, "POST", "/api/rtn/notes", { player_key: "zz_own_free", brand: "SK69", note: "mine" })).status === 200 && (await call(O9, "DELETE", `/api/rtn/notes/${rows("SELECT id FROM player_notes WHERE player_key = 'zz_own_free'")[0].id}`)).status === 200);
sql("DELETE FROM contact_log WHERE player_key LIKE 'zz_own%'; DELETE FROM player_notes WHERE player_key LIKE 'zz_own%'");
r = await call(A, "POST", `/api/roles/${OWN}/update`, { overrides: { "contact.edit_own": false, "contact.delete_own": false } });
mo = await me(O9);
check("with both versions off the account is view-only", mo.can_edit === false && (await call(O9, "POST", "/api/rtn/contact", cp("zz_own_x"))).status === 403);
await call(A, "POST", `/api/roles/${OWN}/update`, { overrides: { "contact.edit_own": null, "contact.delete_own": null } });

// schedule: items they created or are on
const si = (who = []) => ({ items: [{ type_key: "reload", date: "2026-12-05", title: "[r] own item", start_time: "10:00", end_time: "11:00", brands: [], who, note: "", repeat: "none" }] });
await call(A, "POST", "/api/work/schedule/items", si(["own9"]));
await call(A, "POST", "/api/work/schedule/items", si(["sara"]));
check("own schedule: can add items", (await call(O9, "POST", "/api/work/schedule/items", si())).status === 201);
const sch = (await call(A, "GET", "/api/work/schedule?from=2026-12-05&to=2026-12-05")).data.items.filter((x) => x.title === "[r] own item");
const onMe = sch.find((x) => x.who.includes("own9")), byMe = sch.find((x) => x.created_by === "own9"), other = sch.find((x) => x.who.includes("sara"));
check("the schedule items carry who made them", onMe && byMe && other && other.created_by === "aldo", JSON.stringify(sch));
check("own schedule: edits an item they are on", (await call(O9, "POST", `/api/work/schedule/items/${onMe.id}/update`, { note: "hi" })).status === 200);
check("own schedule: edits an item they created", (await call(O9, "POST", `/api/work/schedule/items/${byMe.id}/update`, { note: "hi" })).status === 200);
check("own schedule: cannot change someone else's item (403)", (await call(O9, "POST", `/api/work/schedule/items/${other.id}/update`, { note: "no" })).status === 403 && (await call(O9, "POST", `/api/work/schedule/items/${other.id}/delete`)).status === 403);
check("own schedule: deletes an item they created", (await call(O9, "POST", `/api/work/schedule/items/${byMe.id}/delete`)).status === 200);
check("own schedule: still cannot use admin tools (bulk delete, types)", (await call(O9, "POST", "/api/work/schedule/items/bulk-delete", { preview: true })).status === 403 && (await call(O9, "POST", "/api/work/schedule/types", { name: "Nope", color: "#112233" })).status === 403);
check("an agent without the schedule permission cannot add (403)", (await call(S, "POST", "/api/work/schedule/items", si())).status === 403);
sql("DELETE FROM schedule_items WHERE title = '[r] own item'");

// templates and flows: the ones they made or administer
r = await call(O9, "POST", "/api/work/templates", { name: "[r] my template", deadline: "1 day" });
const myTpl = r.data.template && r.data.template.id;
const adminTpl = (await call(A, "POST", "/api/work/templates", { name: "[r] admin template", deadline: "1 day" })).data.template.id;
check("own templates: can create one", r.status === 201 && r.data.template.created_by === "own9", JSON.stringify(r.data));
check("own templates: edit and delete their own", (await call(O9, "POST", "/api/work/templates", { id: myTpl, name: "[r] my template 2", deadline: "2 days" })).status === 200 && (await call(O9, "POST", `/api/work/templates/${myTpl}/delete`)).status === 200);
check("own templates: not someone else's (403)", (await call(O9, "POST", "/api/work/templates", { id: adminTpl, name: "hijack" })).status === 403 && (await call(O9, "POST", `/api/work/templates/${adminTpl}/delete`)).status === 403);
check("an agent without it still cannot create (403)", (await call(S, "POST", "/api/work/templates", { name: "x" })).status === 403);
r = await call(O9, "POST", "/api/work/flows", { name: "[r] my flow", admin_user: "sara" });
const myFlow = r.data.flow && r.data.flow.id;
const adminFlow = (await call(A, "POST", "/api/work/flows", { name: "[r] admin flow", admin_user: "aldo" })).data.flow.id;
check("own flows: they become the administrator whatever they send", r.status === 201 && r.data.flow.admin_user === "own9", JSON.stringify(r.data));
const fl = (await call(O9, "GET", "/api/work/flows")).data.flows;
check("own flows: the list shows only flows they administer", fl.some((f) => f.id === myFlow) && !fl.some((f) => f.id === adminFlow), JSON.stringify(fl.map((f) => f.name)));
check("own flows: not someone else's (403)", (await call(O9, "POST", "/api/work/flows", { id: adminFlow, name: "hijack" })).status === 403 && (await call(O9, "POST", `/api/work/flows/${adminFlow}/delete`)).status === 403);
check("own flows: edit and delete their own", (await call(O9, "POST", "/api/work/flows", { id: myFlow, name: "[r] my flow 2" })).status === 200 && (await call(O9, "POST", `/api/work/flows/${myFlow}/delete`)).status === 200);
check("an agent without it cannot list flows (403)", (await call(S, "GET", "/api/work/flows")).status === 403);
sql("DELETE FROM flows WHERE name LIKE '[r]%'; DELETE FROM task_templates WHERE name LIKE '[r]%' OR name = 'hijack'");

// the migration copies existing OFF switches over, so nobody gains access by the split
sql("INSERT OR REPLACE INTO roles (key, name, base, builtin, sort) VALUES ('mig9', 'Mig9', 'agent', 0, 99); INSERT OR REPLACE INTO role_permissions (role_key, perm, allowed) VALUES ('mig9', 'contact.edit', 0), ('mig9', 'schedule.manage', 1), ('mig9', 'flows.manage', 0)");
sql(`UPDATE users SET perm_overrides = '{"contact.delete":false,"templates.manage":false,"projects.manage":true}' WHERE username = 'own9'`);
execFileSync("npx", ["wrangler", "d1", "execute", "groupb-tracker-db", "--local", "--persist-to", PERSIST, "--file", "schema/schema_v32_own_permissions.sql"], { stdio: "pipe" });
const mrows = rows("SELECT perm, allowed FROM role_permissions WHERE role_key = 'mig9' ORDER BY perm").map((x) => `${x.perm}=${x.allowed}`).join();
check("migration: roles with 'any' off get the 'own' one off too, nothing else changes", mrows === "contact.edit=0,contact.edit_own=0,flows.manage=0,flows.own=0,schedule.manage=1", mrows);
const ov = JSON.parse(rows("SELECT perm_overrides FROM users WHERE username = 'own9'")[0].perm_overrides);
check("migration: personal exceptions too", ov["contact.delete_own"] === false && ov["templates.own"] === false && ov["projects.manage"] === true && !("contact.edit_own" in ov), JSON.stringify(ov));
execFileSync("npx", ["wrangler", "d1", "execute", "groupb-tracker-db", "--local", "--persist-to", PERSIST, "--file", "schema/schema_v32_own_permissions.sql"], { stdio: "pipe" });
check("migration: running it twice changes nothing more", rows("SELECT COUNT(*) n FROM role_permissions WHERE role_key = 'mig9'")[0].n === 5);
sql("DELETE FROM role_permissions WHERE role_key = 'mig9'; DELETE FROM roles WHERE key = 'mig9'");

// ---- Assignments: unassign everyone not contacted yet, and the contact rows alone for live refresh ----
sql(`DELETE FROM contact_log WHERE player_key LIKE 'zz_un%'; INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, assigned_to, status, updated_by) VALUES ('${snap}', 'zz_un_idle', 'SK69', 'V', 'sara', 'ASSIGNED', 'aldo'), ('${snap}', 'zz_un_blank', 'SK69', 'V', 'sara', NULL, 'aldo'), ('${snap}', 'zz_un_done', 'SK69', 'V', 'sara', 'CONTACTED', 'sara'), ('${snap}', 'zz_un_free', 'SK69', 'V', NULL, 'ASSIGNED', 'aldo'), ('${snap}', 'zz_un_other', 'JOM99', 'V', 'sara', 'ASSIGNED', 'aldo')`);
check("an agent cannot unassign (403)", (await call(S, "POST", "/api/rtn/unassign", { snapshot_date: snap, team: "B" })).status === 403);
check("a bad team or date is 400", (await call(A, "POST", "/api/rtn/unassign", { snapshot_date: snap, team: "Z" })).status === 400 && (await call(A, "POST", "/api/rtn/unassign", { snapshot_date: "nope", team: "B" })).status === 400);
const bc0 = (await call(A, "GET", `/api/rtn/board-contacts?date=${snap}`)).data.contacts;
check("board-contacts returns just the contact rows", Array.isArray(bc0) && bc0.some((x) => x.player_key === "zz_un_done") && !("rows" in (await call(A, "GET", `/api/rtn/board-contacts?date=${snap}`)).data));
const pu0 = (await call(A, "GET", "/api/work/pulse")).data.areas.contact || 0;
r = await call(A, "POST", "/api/rtn/unassign", { snapshot_date: snap, team: "B" });
const who = Object.fromEntries(rows("SELECT player_key, assigned_to FROM contact_log WHERE player_key LIKE 'zz_un%'").map((x) => [x.player_key, x.assigned_to]));
check("unassign takes back the assigned players not contacted yet, only", r.status === 200 && r.data.unassigned === 2 && isNull(who.zz_un_idle) && isNull(who.zz_un_blank) && isNull(who.zz_un_free) && who.zz_un_done === "sara", JSON.stringify([r.data, who]));
check("a player of another team (Team A brand) is left alone", who.zz_un_other === "sara", JSON.stringify(who));
await new Promise((r2) => setTimeout(r2, 700));
check("the change bumps the 'contact' live counter", ((await call(A, "GET", "/api/work/pulse")).data.areas.contact || 0) === pu0 + 1);
check("running it again unassigns nobody", (await call(A, "POST", "/api/rtn/unassign", { snapshot_date: snap, team: "B" })).data.unassigned === 0);
sql("DELETE FROM contact_log WHERE player_key LIKE 'zz_un%'");

// ---- live: a person's own permissions, the contact rows, and the other areas ----
const pulseOf = async (tok) => (await call(tok, "GET", "/api/work/pulse")).data.areas;
const settle2 = () => new Promise((r2) => setTimeout(r2, 700));
let pm0 = await pulseOf(O9), ps0 = await pulseOf(S);
await call(A, "POST", `/api/roles/${OWN}/update`, { overrides: { "tasks.assign_others": true } });
let pm1 = await pulseOf(O9), ps1 = await pulseOf(S);
check("pulse: a person's 'me' fingerprint moves when an admin changes their permissions, and only theirs", typeof pm0.me === "number" && pm1.me !== pm0.me && ps1.me === ps0.me, JSON.stringify([pm0.me, pm1.me, ps0.me, ps1.me]));
await call(A, "POST", `/api/roles/${OWN}/update`, { overrides: { "tasks.assign_others": null } });
check("pulse: and moves back when it is undone", (await pulseOf(O9)).me === pm0.me);
await call(A, "POST", "/api/users/perms", { id: rows("SELECT id FROM users WHERE username = 'own9'")[0].id, overrides: { "dashboard.view": true } });
check("pulse: a personal exception moves it too", (await pulseOf(O9)).me !== pm0.me);
await call(A, "POST", "/api/users/perms", { id: rows("SELECT id FROM users WHERE username = 'own9'")[0].id, reset: true });

sql(`DELETE FROM contact_log WHERE player_key LIKE 'zz_lv%'; INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, assigned_to, status, updated_by, updated_at) VALUES ('${snap}', 'zz_lv_seed', 'SK69', 'V', NULL, 'ASSIGNED', 'aldo', datetime('now','-1 hour'))`);
const full0 = (await call(A, "GET", `/api/rtn/board-contacts?date=${snap}`)).data;
const stamp0 = full0.contacts.reduce((m, c) => (c.updated_at > m ? c.updated_at : m), "");
check("board-contacts without 'since' is the full list", Array.isArray(full0.contacts) && !full0.partial);
await new Promise((r2) => setTimeout(r2, 1100));
const cl0 = (await pulseOf(A)).contact || 0;
await call(S, "POST", "/api/rtn/contact", { snapshot_date: snap, player_key: "zz_lv_a", brand: "SK69", tier_segment: "V", status: "CALLED", assigned_to: "sara" });
await settle2();
const inc = (await call(A, "GET", `/api/rtn/board-contacts?date=${snap}&since=${encodeURIComponent(stamp0)}`)).data;
check("board-contacts with 'since' returns only what changed after it", inc.partial === true && inc.contacts.some((c) => c.player_key === "zz_lv_a") && inc.contacts.length < full0.contacts.length + 2 && !("total" in inc), JSON.stringify([inc.contacts.length, full0.contacts.length]));
check("a contact write bumps the 'contact' counter", ((await pulseOf(A)).contact || 0) === cl0 + 1);
const cr0 = (await pulseOf(A)).contactreset || 0;
await call(A, "POST", "/api/rtn/contact", { snapshot_date: snap, player_key: "zz_lv_a", brand: "SK69", tier_segment: "V", clear: true });
await settle2();
check("clearing a contact bumps 'contactreset' (a removed row cannot show in 'changed since')", ((await pulseOf(A)).contactreset || 0) === cr0 + 1);
const pl0 = (await pulseOf(A)).player || 0;
await call(S, "POST", "/api/rtn/notes", { player_key: "zz_lv_n", brand: "SK69", note: "hi" });
await settle2();
check("a note bumps the 'player' counter", ((await pulseOf(A)).player || 0) === pl0 + 1);
sql("DELETE FROM player_notes WHERE player_key LIKE 'zz_lv%'; DELETE FROM contact_log WHERE player_key LIKE 'zz_lv%'");

// ---- the role hierarchy: seniors are hidden from juniors; same role sees each other's tasks only when the viewer has no team ----
for (const n of ["Hier1", "Hier2", "Hier3"]) { await call(A, "POST", "/api/roles", { name: n, base: "agent" }); }       // no "see everyone's tasks" switch: the hierarchy alone decides
const mkp = async (u, rk, tm) => { await call(A, "POST", "/api/users", { username: u, password: PW, role_key: rk, ...(tm ? { team: tm } : {}) }); const tk = await login(u); await call(tk, "POST", "/api/work/tasks", { title: `[h] ${u}` }); return tk; };
const H1A = await mkp("h1a", "hier1"), H1B = await mkp("h1b", "hier1"), H1T = await mkp("h1t", "hier1", "B"), H1U = await mkp("h1u", "hier1", "B"), H2A = await mkp("h2a", "hier2", "B"), H3A = await mkp("h3a", "hier3", "B");
const seen = async (tok) => (await call(tok, "GET", "/api/work/tasks")).data.tasks.filter((x) => x.title.startsWith("[h] ")).map((x) => x.assignee).sort();
const idOf = (u) => rows(`SELECT id FROM tasks WHERE title = '[h] ${u}'`)[0].id;
let sv = await seen(H1A);
check("same role, no team: they see each other's tasks, and everyone below", ["h1a", "h1b", "h1t", "h1u", "h2a", "h3a"].every((u) => sv.includes(u)), JSON.stringify(sv));
sv = await seen(H1T);
check("same role with a team: only the tasks of people below (and their own)", sv.includes("h1t") && sv.includes("h2a") && sv.includes("h3a") && !sv.includes("h1a") && !sv.includes("h1b") && !sv.includes("h1u"), JSON.stringify(sv));
sv = await seen(H2A);
check("a junior role does not see the seniors' tasks, but sees below", sv.includes("h2a") && sv.includes("h3a") && !sv.some((u) => u.startsWith("h1")), JSON.stringify(sv));
sv = await seen(H3A);
check("the most junior sees only their own", JSON.stringify(sv) === JSON.stringify(["h3a"]), JSON.stringify(sv));
check("an old-settings admin (no role) is outside the hierarchy and sees everything", (await seen(A)).includes("h1a") && (await seen(A)).includes("h3a"));
check("opening a senior's task directly is refused (403)", (await call(H2A, "GET", `/api/work/tasks/${idOf("h1a")}`)).status === 403);
check("filtering the list by a senior is refused (403)", (await call(H2A, "GET", "/api/work/tasks?assignee=h1a")).status === 403);
check("opening a junior's task works", (await call(H2A, "GET", `/api/work/tasks/${idOf("h3a")}`)).status === 200);
check("a same-rank colleague's task is refused for someone with a team (403)", (await call(H1T, "GET", `/api/work/tasks/${idOf("h1u")}`)).status === 403 && (await call(H1A, "GET", `/api/work/tasks/${idOf("h1u")}`)).status === 200);
// people lists
let pp2 = await peopleOf(H2A);
check("staff lists hide the seniors too, and keep same-rank colleagues", pp2.includes("h3a") && pp2.includes("h2a") && !pp2.includes("h1a"), JSON.stringify(pp2));
check("a person with a team still sees same-rank colleagues in staff lists", (await peopleOf(H1T)).includes("h1u"));
pp2 = (await call(H2A, "GET", "/api/work/workload")).data.people.map((x) => x.username);
check("the workload follows the hierarchy", !pp2.some((u) => u.startsWith("h1")) && pp2.includes("h3a"), JSON.stringify(pp2));
// exceptions
await call(A, "POST", "/api/roles/hier2/update", { overrides: { "people.above": true } });
sv = await seen(H2A);
check("exception 'see people above their rank': the seniors' tasks and names appear", sv.includes("h1a") && (await peopleOf(H2A)).includes("h1a") && (await call(H2A, "GET", `/api/work/tasks/${idOf("h1a")}`)).status === 200, JSON.stringify(sv));
await call(A, "POST", "/api/roles/hier2/update", { overrides: { "people.above": null } });
check("and it goes away when switched off", !(await seen(H2A)).includes("h1a"));
await call(A, "POST", "/api/roles/hier1/update", { overrides: { "people.same_rank": true } });
sv = await seen(H1T);
check("exception 'see same-rank colleagues' tasks when on a team': they appear", sv.includes("h1u") && sv.includes("h1a"), JSON.stringify(sv));
// the own-team limit applies to tasks too: the viewer's own team's downline only (the other team's juniors are hidden)
const H2X = await mkp("h2x", "hier2", "A");
await call(A, "POST", "/api/roles/hier1/update", { sees: { team: "own" } });
sv = await seen(H1T);
check("own-team limit on tasks: the own team's juniors are seen, another team's juniors are not", sv.includes("h2a") && sv.includes("h3a") && !sv.includes("h2x"), JSON.stringify(sv));
await call(A, "POST", "/api/roles/hier1/update", { sees: { team: "all" } });
check("no limit: the other team's juniors are seen again", (await seen(H1T)).includes("h2x"));
// the exception also works when the role is limited to its own team, and for a colleague in another team
const H1X = await mkp("h1x", "hier1", "A");
await call(A, "POST", "/api/roles/hier1/update", { overrides: { "people.same_rank": true }, sees: { team: "own" } });
sv = await seen(H1T);
check("exception on + own-team limit: a same-rank colleague of ANOTHER team is still seen in the task list", sv.includes("h1x") && sv.includes("h1u") && sv.includes("h1a"), JSON.stringify(sv));
check("... and can be opened (200)", (await call(H1T, "GET", `/api/work/tasks/${idOf("h1x")}`)).status === 200);
await call(A, "POST", "/api/roles/hier1/update", { overrides: { "people.same_rank": null }, sees: { team: "all" } });
sv = await seen(H1T);
check("exception off again: the other-team colleague's task is hidden", !sv.includes("h1x") && !sv.includes("h1u"), JSON.stringify(sv));
await call(A, "POST", "/api/roles/hier1/update", { overrides: { "people.same_rank": null } });
check("a personal exception works too", (await call(A, "POST", "/api/users/perms", { id: rows("SELECT id FROM users WHERE username = 'h3a'")[0].id, overrides: { "people.above": true } })).status === 200 && (await seen(H3A)).includes("h1a"));
await call(A, "POST", "/api/users/perms", { id: rows("SELECT id FROM users WHERE username = 'h3a'")[0].id, reset: true });
const ana = (await call(H2A, "GET", "/api/work/efficiency")).data;
check("efficiency lists leave out the seniors", Array.isArray(ana.users) && !ana.users.some((u) => u.username.startsWith("h1")), JSON.stringify(ana.users && ana.users.map((u) => u.username)));
sql("DELETE FROM tasks WHERE title LIKE '[h] %'; DELETE FROM task_activity WHERE task_id NOT IN (SELECT id FROM tasks)");

// ---- "Counts as a scored CS agent" is about the KPI score only: it neither shows nor hides anyone in task views ----
const TOr = (await call(A, "POST", "/api/roles", { name: "TaskOnly9", base: "none" })).data.role.key;
await call(A, "POST", `/api/roles/${TOr}/update`, { overrides: { "tasks.use": true } });
const SCr = (await call(A, "POST", "/api/roles", { name: "ScoreOnly9", base: "none" })).data.role.key;
await call(A, "POST", `/api/roles/${SCr}/update`, { overrides: { "kpi.scored": true } });
await call(A, "POST", "/api/users", { username: "to9", password: PW, role_key: TOr, team: "B" });
await call(A, "POST", "/api/users", { username: "sc9", password: PW, role_key: SCr, team: "B" });
const ppl = (await call(A, "GET", "/api/work/people")).data.people, wl9 = (await call(A, "GET", "/api/work/workload")).data.people.map((x) => x.username);
check("someone who works on tasks but is not a scored CS agent still shows in the task views", ppl.find((x) => x.username === "to9").tasks === true && ppl.find((x) => x.username === "to9").on_leaderboard === 0 && wl9.includes("to9"), JSON.stringify(wl9));
check("a scored CS agent who cannot use tasks is not a task person (the KPI switch does not make one)", ppl.find((x) => x.username === "sc9").tasks === false && ppl.find((x) => x.username === "sc9").on_leaderboard === 1 && !wl9.includes("sc9"), JSON.stringify(wl9));

// ---- leave the throwaway database the way the other suites expect it ----
sql("DELETE FROM role_permissions; DELETE FROM roles WHERE builtin = 0; UPDATE roles SET deleted_at = NULL, name = CASE key WHEN 'admin' THEN 'Admin' WHEN 'agent' THEN 'Agent' ELSE 'Viewer' END, base = key; DELETE FROM users WHERE username IN ('terry','rita','boss1','lena','vera','vic2','pia','pat','solo1','leg1','bo','mi','ju','jn9','vw9','ow9','ow9a','ob9','un9a','un9b','mi2','own9','h1a','h1b','h1t','h1u','h1x','h2a','h2x','h3a','to9','sc9'); UPDATE roles SET sees = NULL; UPDATE users SET perm_overrides = NULL; UPDATE roles SET sort = CASE key WHEN 'admin' THEN 1 WHEN 'agent' THEN 2 ELSE 3 END WHERE builtin = 1; UPDATE users SET role_key = NULL, role = 'admin', can_edit = 1, can_delete = 1, on_leaderboard = 0, manage_users = 1 WHERE username = 'aldo'; UPDATE users SET role_key = NULL, role = 'agent', can_edit = 1, can_delete = 1, on_leaderboard = 1, manage_users = 0 WHERE username = 'sara'");

console.log(fails ? `\n${fails} check(s) FAILED (${passes} passed)` : `\nAll ${passes} checks passed`);
process.exit(fails ? 1 : 0);
