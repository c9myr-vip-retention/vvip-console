// Local checks for the work-setup routes (projects, flows, templates, analytics, efficiency, recycle bin).
// LOCAL ONLY: talks to `wrangler dev --local` and seeds a THROWAWAY local D1 with `wrangler d1 execute --local`. Never --remote.
//   1) apply schema.sql, schema_v2..v25 with: npx wrangler d1 execute groupb-tracker-db --local --persist-to <dir> --file=...
//   2) npx wrangler dev --local --persist-to <dir> --port 8787 --var SESSION_SECRET:x --var PASSWORD_SALT:y
//   3) PERSIST=<dir> node scripts/test-setup-api.mjs        (BASE defaults to http://127.0.0.1:8787)
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const PERSIST = process.env.PERSIST;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error("Refusing: BASE must be a local Worker"); process.exit(2); }
if (!PERSIST) { console.error("Set PERSIST=<the --persist-to dir of the local D1>"); process.exit(2); }

let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); if (!ok) fails++; };
const sql = (q) => execFileSync("npx", ["wrangler", "d1", "execute", "groupb-tracker-db", "--local", "--persist-to", PERSIST, "--json", "--command", q], { stdio: "pipe" }).toString();
const rows = (q) => JSON.parse(sql(q).match(/\[[\s\S]*\]/)[0]).flatMap((x) => x.results || []);

async function call(tok, method, path, body) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    } catch (e) { if (i >= 2) throw e; await new Promise((r) => setTimeout(r, 300)); }   // idle keep-alive sockets drop while wrangler seeds the DB
  }
}
const PW = "test-password-1";
async function login(u) { const r = await call(null, "POST", "/api/login", { username: u, password: PW }); if (!r.data.token) throw new Error(`login ${u}: ${JSON.stringify(r)}`); return r.data.token; }

// accounts: aldo (admin), sara + daniel (agents), vic (viewer)
await call(null, "POST", "/api/users/init", { username: "aldo", password: PW });
const A = await login("aldo");
for (const [u, role, edit] of [["sara", "agent", 1], ["daniel", "agent", 1], ["vic", "viewer", 0]]) await call(A, "POST", "/api/users", { username: u, password: PW, role, can_edit: edit, team: "B" });
const S = await login("sara"), D = await login("daniel"), V = await login("vic");

// ---- projects ----
let r = await call(A, "POST", "/api/work/projects", { name: "Win-Back", description: "d", privacy: "members", members: ["sara", "ghost"] });
check("admin creates project", r.status === 201 && r.data.project.members.length === 2, JSON.stringify(r));
const P = r.data.project.id;
check("owner is creator, unknown user dropped", r.data.project.members[0].username === "aldo" && r.data.project.members[0].role === "owner");
r = await call(A, "POST", "/api/work/projects", { name: "Solo", members: [] });
const P2 = r.data.project.id;
check("agent cannot create project (403)", (await call(S, "POST", "/api/work/projects", { name: "x" })).status === 403);
check("viewer cannot create project (403)", (await call(V, "POST", "/api/work/projects", { name: "x" })).status === 403);
check("agent cannot archive (403)", (await call(S, "POST", `/api/work/projects/${P}/archive`, { archived: 1 })).status === 403);
r = await call(S, "GET", "/api/work/projects?archived=0");
check("agent sees only member projects", r.status === 200 && r.data.projects.length === 1 && r.data.projects[0].id === P, JSON.stringify(r.data));
check("agent gets 404 for non-member project", (await call(S, "GET", `/api/work/projects/${P2}`)).status === 404);
check("admin sees both projects", (await call(A, "GET", "/api/work/projects?archived=0")).data.projects.length === 2);
r = await call(A, "POST", "/api/work/projects", { id: P, name: "Win-Back 2", description: "e", privacy: "team", members: ["daniel"] });
check("admin edits project + replaces members, owner kept", r.status === 200 && r.data.project.name === "Win-Back 2" && r.data.project.members.map((m) => m.username).sort().join() === "aldo,daniel", JSON.stringify(r.data));
await call(A, "POST", "/api/work/projects", { id: P, name: "Win-Back 2", members: ["sara", "daniel"] });

// ---- templates ----
r = await call(A, "POST", "/api/work/templates", { name: "Contact list", deadline: "Same day", assignee: "sara", checklist: ["a", " ", "b"] });
check("admin creates template", r.status === 201 && r.data.template.checklist.join() === "a,b", JSON.stringify(r));
const T = r.data.template.id;
check("bad deadline rejected (400)", (await call(A, "POST", "/api/work/templates", { name: "x", deadline: "soon" })).status === 400);
check("agent can read templates", (await call(S, "GET", "/api/work/templates")).data.templates.length === 1);
check("viewer can read templates", (await call(V, "GET", "/api/work/templates")).status === 200);
check("agent cannot create template (403)", (await call(S, "POST", "/api/work/templates", { name: "x" })).status === 403);
check("viewer cannot create template (403)", (await call(V, "POST", "/api/work/templates", { name: "x" })).status === 403);
check("agent cannot delete template (403)", (await call(S, "POST", `/api/work/templates/${T}/delete`)).status === 403);
check("viewer cannot delete template (403)", (await call(V, "POST", `/api/work/templates/${T}/delete`)).status === 403);
r = await call(A, "POST", "/api/work/templates", { id: T, name: "Contact list v2", deadline: "2 days" });
check("admin edits template", r.data.template.name === "Contact list v2" && r.data.template.assignee === null);

// ---- flows ----
r = await call(A, "POST", "/api/work/flows", { name: "Daily contact", project_id: P, admin_user: "aldo", default_assignee: "sara" });
check("admin creates flow", r.status === 201 && r.data.flow.project_name === "Win-Back 2", JSON.stringify(r));
const F = r.data.flow.id;
for (const [who, tok] of [["agent", S], ["viewer", V]]) {
  check(`${who} blocked from flows (403)`, (await call(tok, "GET", "/api/work/flows")).status === 403);
  check(`${who} blocked from analytics (403)`, (await call(tok, "GET", "/api/work/analytics")).status === 403);
  check(`${who} blocked from bin (403)`, (await call(tok, "GET", "/api/work/bin")).status === 403);
  check(`${who} blocked from bin purge (403)`, (await call(tok, "POST", "/api/work/bin/purge", { type: "task", id: 1 })).status === 403);
}
check("flow with unknown admin rejected", (await call(A, "POST", "/api/work/flows", { name: "x", admin_user: "ghost" })).status === 400);

// ---- seed tasks (throwaway local D1 only) ----
const d = (n) => `date('now','+8 hours','${n} days')`, ts = (n, h) => `datetime(${d(n)} || ' ${h}:00:00', '-8 hours')`;   // MYT wall time -> UTC stamp
sql("DELETE FROM tasks WHERE title LIKE '[test]%'");
const task = (title, who, status, due, done, spent, extra = "") =>
  `INSERT INTO tasks (title, owner, assignee, status, project_id, flow_id, due_date, completed_at, spent_seconds, created_at${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('[test] ${title}','aldo','${who}','${status}',${P},${F},${due ? d(due) : "NULL"},${done ? ts(done, "15") : "NULL"},${spent},${ts(-3, "09")}${extra ? "," + extra.split("=")[1] : ""})`;
sql([
  task("A on time", "sara", "done", -2, -3, 3600), task("B late", "sara", "done", -3, -1, 1800),
  task("C overdue", "sara", "pending", -1, null, 0), task("D going", "sara", "progress", 2, null, 0),
  task("E on time", "daniel", "done", 1, -1, 600), task("F deleted", "daniel", "pending", 5, null, 0, "deleted_at=datetime('now')"),
].join("; "));
const delId = rows("SELECT id FROM tasks WHERE title='[test] F deleted'")[0].id;

r = await call(A, "GET", "/api/work/flows");
const fl = r.data.flows.find((x) => x.id === F);
check("flow counts: 1 pending, 1 in progress, 2 completed", fl && fl.pending === 1 && fl.in_progress === 1 && fl.completed === 3, JSON.stringify(fl));
check("flow efficiency 67 and rating Needs attention", fl && fl.efficiency === 67 && fl.rating === "Needs attention", JSON.stringify(fl));
check("flow last_task_at set", !!fl.last_task_at);
r = await call(A, "GET", "/api/work/projects?archived=0");
const pr = r.data.projects.find((x) => x.id === P);
check("project stats exclude deleted task (5 total, 3 done)", pr.task_total === 5 && pr.task_done === 3, JSON.stringify(pr));

// ---- efficiency ----
r = await call(S, "GET", "/api/work/efficiency");
const me = r.data.users[0];
check("agent efficiency = self only", r.data.users.length === 1 && me.username === "sara");
check("sara: completed 2, assigned 2, overdue 1, rate 33, avg 45 min", me.completed === 2 && me.assigned === 2 && me.overdue === 1 && me.on_time_rate === 33 && me.avg_minutes === 45, JSON.stringify(me));
check("agent cannot read another user's efficiency (403)", (await call(S, "GET", "/api/work/efficiency?user=daniel")).status === 403);
r = await call(A, "GET", "/api/work/efficiency");
check("admin efficiency lists everyone", r.data.users.map((u) => u.username).sort().join() === "daniel,sara", JSON.stringify(r.data.users));
check("admin efficiency ?user=daniel", (await call(A, "GET", "/api/work/efficiency?user=daniel")).data.users[0].on_time_rate === 100);
check("viewer efficiency returns self (empty row)", (await call(V, "GET", "/api/work/efficiency")).data.users[0].username === "vic");

// ---- analytics ----
r = await call(A, "GET", "/api/work/analytics?days=30");
const an = r.data;
check("analytics created_vs_completed totals", an.created_vs_completed.reduce((a, w) => a + w.created, 0) === 5 && an.created_vs_completed.reduce((a, w) => a + w.completed, 0) === 3, JSON.stringify(an.created_vs_completed));
check("analytics workload (sara 2 open)", an.workload.find((w) => w.username === "sara").open === 2, JSON.stringify(an.workload));
check("analytics flows (Daily contact: 3)", an.flows[0].name === "Daily contact" && an.flows[0].completed === 3, JSON.stringify(an.flows));
check("analytics compliance ranked (daniel 100, sara 33)", an.compliance[0].username === "daniel" && an.compliance[0].rate === 100 && an.compliance[1].rate === 33, JSON.stringify(an.compliance));
check("analytics days clamps junk to 30", (await call(A, "GET", "/api/work/analytics?days=abc")).data.days === 30);

// ---- soft delete + bin ----
check("delete flow (soft)", (await call(A, "POST", `/api/work/flows/${F}/delete`)).status === 200);
check("deleted flow gone from list", !(await call(A, "GET", "/api/work/flows")).data.flows.some((x) => x.id === F));
check("delete template (soft)", (await call(A, "POST", `/api/work/templates/${T}/delete`)).status === 200);
check("deleted template gone from list", (await call(S, "GET", "/api/work/templates")).data.templates.length === 0);
check("delete project (soft)", (await call(A, "POST", `/api/work/projects/${P2}/delete`)).status === 200);
r = await call(A, "GET", "/api/work/bin");
const has = (t, id) => r.data.items.some((i) => i.type === t && i.id === id);
check("bin lists task, flow, template, project", has("task", delId) && has("flow", F) && has("template", T) && has("project", P2), JSON.stringify(r.data));
check("bin items carry deleted_by", r.data.items.find((i) => i.type === "flow" && i.id === F).deleted_by === "aldo");
check("restore flow", (await call(A, "POST", "/api/work/bin/restore", { type: "flow", id: F })).status === 200 && (await call(A, "GET", "/api/work/flows")).data.flows.some((x) => x.id === F));
check("restore task", (await call(A, "POST", "/api/work/bin/restore", { type: "task", id: delId })).status === 200);
check("restore of a live row is 404", (await call(A, "POST", "/api/work/bin/restore", { type: "task", id: delId })).status === 404);
check("purge refuses a live row (404)", (await call(A, "POST", "/api/work/bin/purge", { type: "project", id: P })).status === 404);
check("purge bad type (400)", (await call(A, "POST", "/api/work/bin/purge", { type: "users", id: 1 })).status === 400);
check("purge template", (await call(A, "POST", "/api/work/bin/purge", { type: "template", id: T })).status === 200);
check("purge project", (await call(A, "POST", "/api/work/bin/purge", { type: "project", id: P2 })).status === 200);
r = await call(A, "GET", "/api/work/bin");
check("purged rows gone from bin", !has("template", T) && !has("project", P2));
check("purge really deleted the row", rows(`SELECT COUNT(*) AS c FROM task_templates WHERE id=${T}`)[0].c === 0);
// a task that was in progress when deleted cannot be restored over an ongoing one
sql(`INSERT INTO tasks (title, owner, assignee, status, started_at, deleted_at) VALUES ('[test] G ghost','aldo','sara','progress',datetime('now'),datetime('now'))`);
const gid = rows("SELECT id FROM tasks WHERE title='[test] G ghost'")[0].id;
check("restore into a clash with an ongoing task -> 409", (await call(A, "POST", "/api/work/bin/restore", { type: "task", id: gid })).status === 409);
r = await call(A, "POST", "/api/work/bin/purge", { type: "task", id: gid });
check("purge task removes it", r.status === 200);

// ---- project archive ----
check("archive project", (await call(A, "POST", `/api/work/projects/${P}/archive`, { archived: 1 })).data.project.archived === 1);
check("archived list vs active list", (await call(A, "GET", "/api/work/projects?archived=1")).data.projects.length === 1 && (await call(A, "GET", "/api/work/projects?archived=0")).data.projects.length === 0);
check("unauthenticated request is 401", (await call(null, "GET", "/api/work/templates")).status === 401);

console.log(fails ? `\n${fails} check(s) FAILED` : "\nAll checks passed");
process.exit(fails ? 1 : 0);
