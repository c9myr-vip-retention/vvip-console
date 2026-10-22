// Local checks for the tasks-backend routes (people, tasks, status, checklist, comments, delete, workload).
// LOCAL ONLY: talks to `wrangler dev --local` and seeds a THROWAWAY local D1 with `wrangler d1 execute --local`. Never --remote.
//   1) apply schema.sql, schema_v2..v25 with: npx wrangler d1 execute groupb-tracker-db --local --persist-to <dir> --file=...
//   2) npx wrangler dev --local --persist-to <dir> --port 8799 --var SESSION_SECRET:x --var PASSWORD_SALT:y --var INGEST_TOKEN:x
//   3) PERSIST=<dir> BASE=http://127.0.0.1:8799 node scripts/test-tasks-api.mjs      (BASE defaults to http://127.0.0.1:8787)
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
const myt = (n = 0) => new Date(Date.now() + 8 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

// accounts: aldo (admin), sara + daniel (agents), vic (viewer), zed (agent, used as observer)
await call(null, "POST", "/api/users/init", { username: "aldo", password: PW });
const A = await login("aldo");
for (const [u, role, edit] of [["sara", "agent", 1], ["daniel", "agent", 1], ["zed", "agent", 1], ["vic", "viewer", 0]]) await call(A, "POST", "/api/users", { username: u, password: PW, role, can_edit: edit, team: "B" });
await call(A, "POST", "/api/users", { username: "otto", password: PW, role: "agent", can_edit: 1, team: "C" });   // other team: only an admin should see him in the workload
sql("UPDATE users SET team = 'B' WHERE username IN ('sara','daniel','zed','vic'); UPDATE users SET team = 'C' WHERE username = 'otto'");   // another suite may have created them without a team
const S = await login("sara"), D = await login("daniel"), Z = await login("zed"), V = await login("vic");
sql("DELETE FROM tasks WHERE title LIKE '[t]%'");   // re-runs on the same throwaway DB

// ---- people ----
let r = await call(S, "GET", "/api/work/people");
check("people: any authed user, lists everyone", r.status === 200 && ["aldo", "daniel", "sara", "vic", "zed"].every((u) => r.data.people.some((p) => p.username === u)) && r.data.people[0].role !== undefined, JSON.stringify(r.data));
check("people: unauthenticated is 401", (await call(null, "GET", "/api/work/people")).status === 401);

// ---- create ----
r = await call(S, "POST", "/api/work/tasks", { title: "[t] sara one", assignee: "daniel", description: "d", tags: ["x", "x", "y"], est_minutes: 30, due_date: myt(1), checklist: ["a", " ", "b"], observers: ["zed", "ghost"], high_priority: 1, linked_player: "p1" });
check("agent create: 201, assignee forced to self", r.status === 201 && r.data.task.assignee === "sara" && r.data.task.owner === "sara", JSON.stringify(r.data));
const T1 = r.data.task?.id;
check("create: fields stored (tags deduped, observers filtered, checklist counted)", r.data.task.tags.join() === "x,y" && r.data.task.observers.join() === "zed" && r.data.task.checklist_total === 2 && r.data.task.status === "pending" && r.data.task.high_priority === 1 && r.data.task.est_minutes === 30, JSON.stringify(r.data.task));
check("create: title required (400)", (await call(S, "POST", "/api/work/tasks", { description: "x" })).status === 400);
check("create: bad due_date (400)", (await call(S, "POST", "/api/work/tasks", { title: "[t] x", due_date: "2026-13-40" })).status === 400);
check("viewer cannot create (403)", (await call(V, "POST", "/api/work/tasks", { title: "[t] x" })).status === 403);
r = await call(A, "POST", "/api/work/tasks", { title: "[t] admin for daniel", assignee: "daniel" });
check("admin assigns to someone else", r.status === 201 && r.data.task.assignee === "daniel" && r.data.task.owner === "aldo");
const T2 = r.data.task.id;
check("admin: unknown assignee (400)", (await call(A, "POST", "/api/work/tasks", { title: "[t] x", assignee: "ghost" })).status === 400);

// ---- create from template + projects ----
const tpl = await call(A, "POST", "/api/work/templates", { name: "[t] Weekly report", deadline: "2 days", assignee: "daniel", checklist: ["draft", "send"] });
const TPL = tpl.data.template.id;
r = await call(S, "POST", "/api/work/tasks", { template_id: TPL });
check("template (agent): title, due +2d, checklist filled, assignee self", r.status === 201 && r.data.task.title === "[t] Weekly report" && r.data.task.due_date === myt(2) && r.data.task.checklist_total === 2 && r.data.task.assignee === "sara", JSON.stringify(r.data.task));
r = await call(A, "POST", "/api/work/tasks", { template_id: TPL });
check("template (admin): gets template assignee", r.status === 201 && r.data.task.assignee === "daniel");
check("template: unknown id (404)", (await call(S, "POST", "/api/work/tasks", { template_id: 99999 })).status === 404);
const pm = (await call(A, "POST", "/api/work/projects", { name: "[t] members only", privacy: "members", members: ["daniel"] })).data.project.id;
const pt = (await call(A, "POST", "/api/work/projects", { name: "[t] team wide", privacy: "team", members: [] })).data.project.id;
check("agent: project they are not in -> 403", (await call(S, "POST", "/api/work/tasks", { title: "[t] p", project_id: pm })).status === 403);
check("agent: team-privacy project allowed", (await call(S, "POST", "/api/work/tasks", { title: "[t] p", project_id: pt })).status === 201);
check("agent: member project allowed", (await call(D, "POST", "/api/work/tasks", { title: "[t] p", project_id: pm })).status === 201);
check("admin: any project", (await call(A, "POST", "/api/work/tasks", { title: "[t] p", project_id: pm })).status === 201);

// ---- visibility / list ----
r = await call(S, "GET", "/api/work/tasks");
check("sara list: only hers (assignee/owner)", r.status === 200 && r.data.tasks.length >= 1 && r.data.tasks.every((t) => t.assignee === "sara" || t.owner === "sara" || t.observers.includes("sara")), JSON.stringify(r.data.tasks.map((t) => t.title)));
check("sara list: does not include daniel's admin task", !r.data.tasks.some((t) => t.id === T2));
r = await call(Z, "GET", "/api/work/tasks");
check("observer sees the task in list", r.data.tasks.some((t) => t.id === T1));
check("admin sees all", (await call(A, "GET", "/api/work/tasks")).data.tasks.some((t) => t.id === T2));
check("agent assignee=self ok", (await call(S, "GET", "/api/work/tasks?assignee=sara")).status === 200);
check("agent assignee=other -> 403", (await call(S, "GET", "/api/work/tasks?assignee=daniel")).status === 403);
check("admin assignee filter works", (await call(A, "GET", "/api/work/tasks?assignee=daniel")).data.tasks.every((t) => t.assignee === "daniel"));
check("q filter", (await call(A, "GET", "/api/work/tasks?q=" + encodeURIComponent("admin for"))).data.tasks.length === 1);
check("q filter treats % literally", (await call(A, "GET", "/api/work/tasks?q=%25")).data.tasks.length === 0);
check("project_id filter", (await call(A, "GET", `/api/work/tasks?project_id=${pt}`)).data.tasks.length === 1);
check("bad status filter (400)", (await call(A, "GET", "/api/work/tasks?status=nope")).status === 400);
check("get one: observer allowed", (await call(Z, "GET", `/api/work/tasks/${T1}`)).status === 200);
check("get one: stranger 403", (await call(D, "GET", `/api/work/tasks/${T1}`)).status === 403);
check("get one: missing 404", (await call(A, "GET", "/api/work/tasks/999999")).status === 404);
r = await call(S, "GET", `/api/work/tasks/${T1}`);
check("get one: shape (checklist, observers, comments, activity)", r.data.checklist.length === 2 && r.data.observers.join() === "zed" && Array.isArray(r.data.comments) && r.data.activity[0].text === "Created the task" && r.data.checklist[0].pos < r.data.checklist[1].pos, JSON.stringify(r.data));

// ---- update ----
r = await call(S, "POST", `/api/work/tasks/${T1}/update`, { title: "[t] sara one (edited)", due_date: null, est_minutes: 45, tags: ["z"], observers: [] });
check("assignee edits own task", r.status === 200 && r.data.task.title.endsWith("(edited)") && r.data.task.due_date === null && r.data.task.est_minutes === 45 && r.data.task.tags.join() === "z" && r.data.task.observers.length === 0, JSON.stringify(r.data));
check("observer cannot edit (403)", (await call(Z, "POST", `/api/work/tasks/${T1}/update`, { title: "hack" })).status === 403);
await call(S, "POST", `/api/work/tasks/${T1}/update`, { observers: ["zed"] });
check("stranger cannot edit (403)", (await call(D, "POST", `/api/work/tasks/${T1}/update`, { title: "hack" })).status === 403);
check("viewer cannot edit (403)", (await call(V, "POST", `/api/work/tasks/${T1}/update`, { title: "hack" })).status === 403);
check("agent cannot reassign (403)", (await call(S, "POST", `/api/work/tasks/${T1}/update`, { assignee: "daniel" })).status === 403);
check("empty title rejected (400)", (await call(S, "POST", `/api/work/tasks/${T1}/update`, { title: " " })).status === 400);
check("agent edit with project they are not in (403)", (await call(S, "POST", `/api/work/tasks/${T1}/update`, { project_id: pm })).status === 403);
r = await call(A, "POST", `/api/work/tasks/${T1}/update`, { assignee: "daniel" });
check("admin reassigns", r.status === 200 && r.data.task.assignee === "daniel" && r.data.task.owner === "sara");
await call(A, "POST", `/api/work/tasks/${T1}/update`, { assignee: "sara" });

// ---- status flow ----
check("complete from pending -> 400", (await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "complete" })).status === 400);
check("bad action -> 400", (await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "fly" })).status === 400);
check("non-assignee cannot start (403)", (await call(A, "POST", `/api/work/tasks/${T1}/status`, { action: "start" })).status === 403);
check("owner/observer cannot start (403)", (await call(Z, "POST", `/api/work/tasks/${T1}/status`, { action: "start" })).status === 403);
r = await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "start" });
check("start -> progress with started_at", r.status === 200 && r.data.task.status === "progress" && !!r.data.task.started_at, JSON.stringify(r.data));
const T3 = (await call(S, "POST", "/api/work/tasks", { title: "[t] sara two" })).data.task.id;
r = await call(S, "POST", `/api/work/tasks/${T3}/status`, { action: "start" });
check("second start -> 409 with ongoing {id,title}", r.status === 409 && r.data.error === "sara already has an ongoing task" && r.data.ongoing.id === T1 && r.data.ongoing.title.includes("sara one"), JSON.stringify(r));
check("start on already-progress task -> 400", (await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "start" })).status === 400);
check("reassign while in progress -> 400", (await call(A, "POST", `/api/work/tasks/${T1}/update`, { assignee: "daniel" })).status === 400);
sql(`UPDATE tasks SET started_at = datetime('now','-90 seconds') WHERE id = ${T1}`);   // fake 90s of work
r = await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "pause" });
check("pause -> pending, started_at cleared, elapsed added (>=90s)", r.data.task.status === "pending" && r.data.task.started_at === null && r.data.task.spent_seconds >= 90 && r.data.task.spent_seconds < 150, JSON.stringify(r.data.task));
check("pause when not in progress -> 400", (await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "pause" })).status === 400);
await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "start" });
sql(`UPDATE tasks SET started_at = datetime('now','-60 seconds') WHERE id = ${T1}`);
r = await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "complete" });
check("complete: done, completed_at set, elapsed accumulates (>=150s)", r.data.task.status === "done" && !!r.data.task.completed_at && r.data.task.started_at === null && r.data.task.spent_seconds >= 150 && r.data.task.spent_seconds < 260, JSON.stringify(r.data.task));
check("done tasks hidden from default list", !(await call(S, "GET", "/api/work/tasks")).data.tasks.some((t) => t.id === T1));
check("include=done shows them", (await call(S, "GET", "/api/work/tasks?include=done")).data.tasks.some((t) => t.id === T1));
check("status=done shows them without include", (await call(S, "GET", "/api/work/tasks?status=done")).data.tasks.some((t) => t.id === T1));
check("start on done -> 400", (await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "start" })).status === 400);
check("defer on done -> 400", (await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "defer" })).status === 400);
r = await call(A, "POST", `/api/work/tasks/${T1}/status`, { action: "reopen" });
check("admin reopens: pending, completed_at cleared", r.status === 200 && r.data.task.status === "pending" && r.data.task.completed_at === null, JSON.stringify(r.data.task));
check("reopen when pending -> 400", (await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "reopen" })).status === 400);
check("observer cannot defer (403)", (await call(Z, "POST", `/api/work/tasks/${T1}/status`, { action: "defer" })).status === 403);
r = await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "defer" });
check("assignee defers", r.data.task.status === "deferred");
r = await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "start" });
check("deferred task can be started", r.data.task.status === "progress");
r = await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "defer" });
check("defer from progress clears started_at", r.data.task.status === "deferred" && r.data.task.started_at === null);
check("viewer cannot change status (403)", (await call(V, "POST", `/api/work/tasks/${T1}/status`, { action: "reopen" })).status === 403);
r = await call(S, "GET", `/api/work/tasks/${T1}`);
const acts = r.data.activity.map((a) => a.text);
check("activity rows for status changes", ["Started the task", "Paused the task", "Completed the task", "Reopened the task", "Deferred the task"].every((x) => acts.includes(x)), JSON.stringify(acts));

// DB-level unique violation is mapped to 409 too (race): a second progress row cannot exist
let dbBlocked = false;
try { sql(`UPDATE tasks SET status='progress' WHERE id=${T3}`); await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "reopen" }); sql(`UPDATE tasks SET status='progress' WHERE id=${T1}`); } catch (e) { dbBlocked = /UNIQUE/i.test(String(e.stderr) + String(e.stdout) + String(e.message)); }
check("DB index uq_one_ongoing_per_person blocks a second progress row", dbBlocked);
sql(`UPDATE tasks SET status='pending', started_at=NULL WHERE id=${T3}`);

// ---- checklist ----
const CL = (tok, b, id = T3) => call(tok, "POST", `/api/work/tasks/${id}/checklist`, b);
r = await CL(S, { action: "add", text: "one" });
check("checklist add", r.status === 200 && r.data.checklist.length === 1 && r.data.checklist[0].done === 0);
r = await CL(S, { action: "add", text: "two" });
const [i1, i2] = r.data.checklist.map((x) => x.id);
check("checklist add keeps order", r.data.checklist.map((x) => x.text).join() === "one,two");
check("checklist add needs text (400)", (await CL(S, { action: "add", text: " " })).status === 400);
r = await CL(S, { action: "toggle", item_id: i1 });
check("checklist toggle on", r.data.checklist[0].done === 1);
check("toggle reflected in task counts", (await call(S, "GET", `/api/work/tasks/${T3}`)).data.task.checklist_done === 1);
r = await CL(S, { action: "toggle", item_id: i1 });
check("checklist toggle off", r.data.checklist[0].done === 0);
check("toggle foreign item -> 404", (await CL(S, { action: "toggle", item_id: 999999 })).status === 404);
check("observer cannot change checklist (403)", (await CL(Z, { action: "add", text: "x" }, T1)).status === 403);
check("viewer cannot change checklist (403)", (await CL(V, { action: "add", text: "x" })).status === 403);
r = await CL(S, { action: "remove", item_id: i2 });
check("checklist remove", r.data.checklist.length === 1 && r.data.checklist[0].id === i1);
check("bad checklist action (400)", (await CL(S, { action: "nuke" })).status === 400);
const a3 = (await call(S, "GET", `/api/work/tasks/${T3}`)).data.activity.map((a) => a.text);
check("checklist writes activity rows", a3.includes('Added checklist item "one"') && a3.includes('Checked off "one"') && a3.includes('Unchecked "one"') && a3.includes('Removed checklist item "two"'), JSON.stringify(a3));

// ---- comments ----
r = await call(Z, "POST", `/api/work/tasks/${T1}/comments`, { body: "from the observer" });
check("observer can comment", r.status === 200 && r.data.comments.length === 1 && r.data.comments[0].author === "zed");
r = await call(A, "POST", `/api/work/tasks/${T1}/comments`, { body: "from admin" });
check("admin can comment; comments in order", r.data.comments.map((x) => x.author).join() === "zed,aldo");
check("stranger cannot comment (403)", (await call(D, "POST", `/api/work/tasks/${T1}/comments`, { body: "x" })).status === 403);
check("viewer cannot comment (403)", (await call(V, "POST", `/api/work/tasks/${T1}/comments`, { body: "x" })).status === 403);
check("empty comment (400)", (await call(S, "POST", `/api/work/tasks/${T1}/comments`, { body: "  " })).status === 400);
check("comment_count in list", (await call(S, "GET", "/api/work/tasks?include=done")).data.tasks.find((t) => t.id === T1).comment_count === 2);

// ---- workload (admin) ----
// an agent sees only their own team; an admin sees every team (each row says which)
r = await call(S, "GET", "/api/work/workload");
check("agent workload: 200, own team only (team B, no otto), my_team set", r.status === 200 && r.data.my_team === "B" && r.data.people.length > 0 && r.data.people.every((p) => p.team === "B") && r.data.people.some((p) => p.username === "sara") && !r.data.people.some((p) => p.username === "otto"), JSON.stringify(r.data));
r = await call(V, "GET", "/api/work/workload");
check("viewer workload: 200, sees their team (team B), not otto", r.status === 200 && r.data.my_team === "B" && r.data.people.length > 1 && r.data.people.every((p) => p.team === "B") && !r.data.people.some((p) => p.username === "otto"), JSON.stringify(r.data));
check("unauthenticated workload is 401", (await call(null, "GET", "/api/work/workload")).status === 401);
r = await call(A, "GET", "/api/work/workload");
check("admin workload: every team, rows carry team", r.status === 200 && r.data.people.some((p) => p.username === "otto" && p.team === "C") && r.data.people.some((p) => p.username === "sara" && p.team === "B"), JSON.stringify(r.data));
const T4 = (await call(S, "POST", "/api/work/tasks", { title: "[t] sara quick" })).data.task.id;
await call(S, "POST", `/api/work/tasks/${T4}/status`, { action: "start" });
await call(S, "POST", `/api/work/tasks/${T4}/status`, { action: "complete" });
await call(S, "POST", `/api/work/tasks/${T3}/status`, { action: "start" });
await call(A, "POST", `/api/work/tasks/${T3}/update`, { due_date: myt(-2) });
await CL(S, { action: "add", text: "w" });
r = await call(A, "GET", "/api/work/workload");
const w = Object.fromEntries((r.data.people || []).map((p) => [p.username, p]));
check("workload lists users with edit/manage, not viewers", r.status === 200 && w.sara && w.daniel && w.aldo && !w.vic, JSON.stringify(r.data));
const dbRows = (u) => rows(`SELECT SUM(status!='done') a, SUM(status!='done' AND due_date<'${myt()}') o, SUM(status='done') d, SUM(status='pending') p FROM tasks WHERE deleted_at IS NULL AND assignee='${u}'`)[0];
const ex = dbRows("sara");
check("workload sara counts match the DB", w.sara.assigned === ex.a && w.sara.overdue === ex.o && w.sara.done === ex.d && w.sara.waiting === ex.p, JSON.stringify([w.sara, ex]));
check("workload overdue >= 1 and done >= 1", w.sara.overdue >= 1 && w.sara.done >= 1);
check("workload ongoing summary", w.sara.ongoing && w.sara.ongoing.id === T3 && w.sara.ongoing.checklist_total === 2 && w.sara.ongoing.checklist_done === 0 && "spent_seconds" in w.sara.ongoing && "est_minutes" in w.sara.ongoing && "started_at" in w.sara.ongoing, JSON.stringify(w.sara.ongoing));
check("workload: no ongoing -> null", w.daniel.ongoing === null);

// ---- delete ----
check("agent cannot delete admin-owned task (403)", (await call(D, "POST", `/api/work/tasks/${T2}/delete`)).status === 403);
check("assignee-but-not-owner cannot delete (403)", (await call(D, "POST", `/api/work/tasks/${T2}/delete`)).status === 403);
check("viewer cannot delete (403)", (await call(V, "POST", `/api/work/tasks/${T3}/delete`)).status === 403);
r = await call(S, "POST", `/api/work/tasks/${T3}/delete`);
check("owner deletes an ongoing task", r.status === 200 && r.data.ok === true);
const del = rows(`SELECT status, started_at, deleted_at, deleted_by, spent_seconds FROM tasks WHERE id=${T3}`)[0];
check("deleted ongoing task becomes pending, started_at cleared, deleted_by set", del.status === "pending" && (del.started_at === null || del.started_at === "null") && !!del.deleted_at && del.deleted_by === "sara", JSON.stringify(del));
check("deleted task -> 404 and gone from list", (await call(S, "GET", `/api/work/tasks/${T3}`)).status === 404 && !(await call(S, "GET", "/api/work/tasks")).data.tasks.some((t) => t.id === T3));
check("deleted task not in workload ongoing", (await call(A, "GET", "/api/work/workload")).data.people.find((p) => p.username === "sara").ongoing === null);
// restore (from the bin) must not clash now that the task is pending
await call(S, "POST", `/api/work/tasks/${T1}/status`, { action: "start" });
check("bin restore of that task works (no unique clash)", (await call(A, "POST", "/api/work/bin/restore", { type: "task", id: T3 })).status === 200);
check("admin deletes a task he owns", (await call(A, "POST", `/api/work/tasks/${T2}/delete`)).status === 200);
check("delete twice -> 404", (await call(A, "POST", `/api/work/tasks/${T2}/delete`)).status === 404);
check("unknown sub-route is not ours (404)", (await call(A, "POST", `/api/work/tasks/${T1}/explode`)).status === 404);

// ---- pictures and files on comments ----
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const TA = (await call(S, "POST", "/api/work/tasks", { title: "[t] attach", observers: ["zed"] })).data.task.id;
r = await call(S, "POST", `/api/work/tasks/${TA}/comments`, { body: "see this", attachments: [{ name: "shot.png", mime: "image/png", data: PNG }] });
const att = r.data.comments && r.data.comments[0] && r.data.comments[0].attachments && r.data.comments[0].attachments[0];
check("a comment can carry a picture", r.status === 200 && att && att.name === "shot.png" && att.mime === "image/png" && att.inline === true && att.size === Buffer.from(PNG, "base64").length, JSON.stringify(r.data));
const raw = async (tok, id) => fetch(BASE + `/api/work/attachments/${id}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
let fr = await raw(S, att.id);
check("the owner gets the same bytes back with the right type", fr.status === 200 && fr.headers.get("content-type") === "image/png" && Buffer.from(await fr.arrayBuffer()).equals(Buffer.from(PNG, "base64")));
check("a picture is shown in the page, with the safety headers", /^inline/.test(fr.headers.get("content-disposition") || "") && fr.headers.get("x-content-type-options") === "nosniff");
check("an observer can open it", (await raw(Z, att.id)).status === 200);
check("an admin can open it", (await raw(A, att.id)).status === 200);
check("someone with no access to the task cannot (403)", (await raw(D, att.id)).status === 403);
check("unauthenticated is 401", (await raw(null, att.id)).status === 401);
check("an unknown file is 404", (await raw(S, 999999)).status === 404);
check("the task detail lists the attachments", (await call(S, "GET", `/api/work/tasks/${TA}`)).data.comments[0].attachments[0].id === att.id);
r = await call(S, "POST", `/api/work/tasks/${TA}/comments`, { attachments: [{ name: "notes.txt", mime: "text/plain", data: Buffer.from("hello").toString("base64") }] });
check("a comment can be a file with no text", r.status === 200 && r.data.comments.length === 2 && r.data.comments[1].body === "" && r.data.comments[1].attachments[0].inline === false, JSON.stringify(r.data));
fr = await raw(S, r.data.comments[1].attachments[0].id);
check("other files are sent as a download", fr.status === 200 && /^attachment/.test(fr.headers.get("content-disposition") || "") && (await fr.text()) === "hello");
check("a comment with no text and no file is 400", (await call(S, "POST", `/api/work/tasks/${TA}/comments`, {})).status === 400);
check("a kind of file that is not allowed is 400", (await call(S, "POST", `/api/work/tasks/${TA}/comments`, { body: "x", attachments: [{ name: "run.exe", mime: "application/x-msdownload", data: PNG }] })).status === 400);
check("a script disguised as a picture type is still refused (svg is not allowed)", (await call(S, "POST", `/api/work/tasks/${TA}/comments`, { body: "x", attachments: [{ name: "a.svg", mime: "image/svg+xml", data: PNG }] })).status === 400);
check("a file that is too big is 413", (await call(S, "POST", `/api/work/tasks/${TA}/comments`, { body: "x", attachments: [{ name: "big.zip", mime: "application/zip", data: Buffer.alloc(1_300_000).toString("base64") }] })).status === 413);
check("garbage instead of a file is 400", (await call(S, "POST", `/api/work/tasks/${TA}/comments`, { body: "x", attachments: [{ name: "a.png", mime: "image/png", data: "not base64!!" }] })).status === 400);
check("more than 5 files is 400", (await call(S, "POST", `/api/work/tasks/${TA}/comments`, { body: "x", attachments: Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.png`, mime: "image/png", data: PNG })) })).status === 400);
check("nothing was saved by the refusals", rows(`SELECT COUNT(*) n FROM task_comments WHERE task_id = ${TA}`)[0].n === 2 && rows(`SELECT COUNT(*) n FROM task_attachments WHERE task_id = ${TA}`)[0].n === 2);
check("a view-only account cannot comment with a file (403)", (await call(V, "POST", `/api/work/tasks/${TA}/comments`, { body: "x", attachments: [{ name: "a.png", mime: "image/png", data: PNG }] })).status === 403);
check("a file name is made safe", (await call(S, "POST", `/api/work/tasks/${TA}/comments`, { body: "x", attachments: [{ name: "..\\..\\evil<script>.png", mime: "image/png", data: PNG }] })).data.comments[2].attachments[0].name === "evil_script_.png");
check("the reset counts the attachments", (await call(A, "POST", "/api/work/tasks/clear", { preview: true })).data.counts.attachments === 3);

// ---- live updates: a change bumps its area's counter, and nothing else does ----
const pulse = async (tok) => (await call(tok, "GET", "/api/work/pulse"));
const settle = () => new Promise((r) => setTimeout(r, 700));      // the bump runs after the response is sent
let pu = await pulse(S);
check("pulse is 200 with an areas object", pu.status === 200 && pu.data.areas && typeof pu.data.areas === "object", JSON.stringify(pu.data));
check("pulse needs a sign-in (401)", (await pulse(null)).status === 401);
const p0 = pu.data.areas;
await call(S, "GET", "/api/work/tasks"); await call(S, "GET", "/api/work/workload"); await settle();
check("reading does not move any counter", JSON.stringify((await pulse(S)).data.areas) === JSON.stringify(p0));
const TP = (await call(S, "POST", "/api/work/tasks", { title: "[t] pulse" })).data.task.id; await settle();
let p1 = (await pulse(Z)).data.areas;
check("creating a task moves the tasks counter (and only that one)", (p1.tasks || 0) === (p0.tasks || 0) + 1 && (p1.schedule || 0) === (p0.schedule || 0), JSON.stringify([p0, p1]));
await call(S, "POST", `/api/work/tasks/${TP}/comments`, { body: "hi" }); await settle();
check("a comment moves it again", (await pulse(S)).data.areas.tasks === p1.tasks + 1);
p1 = (await pulse(S)).data.areas;
await call(V, "POST", `/api/work/tasks/${TP}/comments`, { body: "nope" }); await call(S, "POST", "/api/work/tasks", {}); await settle();
check("a refused change (403) or a bad one (400) moves nothing", (await pulse(S)).data.areas.tasks === p1.tasks);
await call(A, "POST", "/api/work/schedule/items", { items: [{ type_key: "reload", date: "2026-12-01", title: "[t] pulse", start_time: "10:00", end_time: "11:00", brands: [], who: [], note: "", repeat: "none" }] }); await settle();
const p2 = (await pulse(S)).data.areas;
check("a schedule change moves the schedule counter, not tasks", (p2.schedule || 0) === (p1.schedule || 0) + 1 && p2.tasks === p1.tasks, JSON.stringify([p1, p2]));
sql("DELETE FROM schedule_items WHERE title = '[t] pulse'");

// ---- clear all task data (a reset after testing). Runs last: it empties the task tables. ----
for (const [who, tok] of [["agent", S], ["viewer", V]]) check(`${who} cannot clear task data (403)`, (await call(tok, "POST", "/api/work/tasks/clear", { preview: true })).status === 403);
check("unauthenticated is 401", (await call(null, "POST", "/api/work/tasks/clear", { preview: true })).status === 401);
const n = (t) => rows(`SELECT COUNT(*) n FROM ${t}`)[0].n;
r = await call(A, "POST", "/api/work/tasks/clear", { preview: true });
check("preview counts match the database and deletes nothing", r.status === 200 && r.data.counts.tasks === n("tasks") && r.data.counts.tasks > 0 && r.data.counts.checklist === n("task_checklist") && r.data.counts.comments === n("task_comments") && r.data.counts.history === n("task_activity"), JSON.stringify(r.data));
const before = n("tasks");
check("without the confirmation it refuses (400)", (await call(A, "POST", "/api/work/tasks/clear", {})).status === 400);
check("with the wrong word it refuses (400)", (await call(A, "POST", "/api/work/tasks/clear", { confirm: "yes" })).status === 400);
check("nothing was deleted by the refusals", n("tasks") === before);
r = await call(A, "POST", "/api/work/tasks/clear", { confirm: "CLEAR TASKS" });
check("clear everything", r.status === 200 && r.data.cleared.tasks === before, JSON.stringify(r.data));
check("every task table is empty", ["tasks", "task_checklist", "task_observers", "task_comments", "task_activity", "task_attachments"].every((t) => n(t) === 0));
check("people and accounts are untouched", n("users") > 0);
check("the board is empty for everyone", (await call(S, "GET", "/api/work/tasks?include=done")).data.tasks.length === 0 && (await call(A, "GET", "/api/work/tasks?include=done")).data.tasks.length === 0);
check("a new task can be made after the reset", (await call(S, "POST", "/api/work/tasks", { title: "[t] after reset" })).status === 201);
await new Promise((res) => setTimeout(res, 600));
check("the reset is written to the activity log", rows("SELECT COUNT(*) n FROM activity_log WHERE detail LIKE 'Cleared all task data%'")[0].n >= 1);

console.log(fails ? `\n${fails} check(s) FAILED (${passes} passed)` : `\nAll ${passes} checks passed`);
process.exit(fails ? 1 : 0);
