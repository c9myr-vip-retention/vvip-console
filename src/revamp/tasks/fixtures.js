// Mock API for the tasks pages. Enabled ONLY when localStorage.revamp_mock === "1" (never the default).
// Same method names and shapes as src/revamp/api/work.js. Task rows come from the task-views fixtures so a drag on a
// board view and a status change in the panel act on the same data. State is in memory.
import { mockTasks, mockUpdate, MOCK_PEOPLE, MOCK_PROJECTS } from "../taskviews/fixtures.js";

export const mockOn = () => { try { return localStorage.getItem("revamp_mock") === "1"; } catch { return false; } };
const meNow = () => { try { return JSON.parse(localStorage.getItem("revamp_mock_me") || "null") || { username: "aldo", manage_users: 1 }; } catch { return { username: "aldo", manage_users: 1 }; } };
const isAdm = () => !!meNow().manage_users;
const wait = (v) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v))), 40));
const fail = (msg, status, extra) => Promise.reject(Object.assign(new Error(msg), { status, data: { error: msg, ...(extra || {}) } }));
const nowTs = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const parseUtc = (s) => Date.parse(String(s).replace(" ", "T") + "Z");
const myt = (off = 0) => new Date(Date.now() + 8 * 3600e3 + off * 864e5).toISOString().slice(0, 10);

let seq = 1000, extra = [];
const gone = new Set();                                  // tasks created in this session
const detail = {};                                            // id -> { checklist, observers, comments, activity }

const TEMPLATES = [
  { id: 1, name: "Contact list for Tier 3", deadline: "Same day", assignee: "sara", checklist: ["Pull today's list", "Send first message", "Log outcomes"], created_by: "aldo" },
  { id: 2, name: "Welcome-back message for cooling whales", deadline: "1 day", assignee: "daniel", checklist: ["Check last deposit", "Pick the hook"], created_by: "aldo" },
  { id: 3, name: "Weekly KPI report", deadline: "7 days", assignee: "mei", checklist: [], created_by: "mexha" },
  { id: 4, name: "Telegram link request", deadline: "2 days", assignee: "mexha", checklist: ["Verify the player", "Link the account"], created_by: "mexha" },
];

const all = () => [...mockTasks(), ...extra.map((t) => ({ ...t, tags: [...t.tags], observers: [...t.observers] }))].filter((t) => !gone.has(t.id));
const find = (id) => all().find((t) => t.id === Number(id));
function patch(id, p) {
  id = Number(id);
  const e = extra.find((t) => t.id === id);
  if (e) { Object.assign(e, p, { updated_at: nowTs() }); return Promise.resolve({ task: { ...e } }); }
  return mockUpdate(id, { ...p, updated_at: nowTs() });
}
const visible = (t, u) => isAdm() || t.assignee === u || t.owner === u || (t.observers || []).includes(u);

function det(id) {
  id = Number(id);
  if (!detail[id]) {
    const t = find(id) || {};
    const checklist = Array.from({ length: t.checklist_total || 0 }, (_, i) => ({ id: id * 100 + i, text: ["Pull the list", "Send the first message", "Log the outcome", "Check the reply", "Report to the lead"][i % 5], done: i < (t.checklist_done || 0) ? 1 : 0, pos: i }));
    const comments = Array.from({ length: t.comment_count || 0 }, (_, i) => ({ id: id * 100 + i, author: i % 2 ? t.assignee : t.owner, body: ["Please prioritise this one.", "On it. Will report back after the first batch.", "Player replied, waiting for the second message.", "Done with the first half."][i % 4], created_at: `${myt(-1)} 0${3 + i}:1${i}:00` }));
    detail[id] = { checklist, observers: [...(t.observers || [])], comments, activity: [{ id: id * 100, actor: t.owner || "aldo", text: "Created the task", created_at: t.created_at || nowTs() }] };
  }
  return detail[id];
}
const log = (id, text) => det(id).activity.unshift({ id: Date.now() + Math.random(), actor: meNow().username, text, created_at: nowTs() });
const sync = (id) => { const d = det(id); return patch(id, { checklist_total: d.checklist.length, checklist_done: d.checklist.filter((c) => c.done).length, comment_count: d.comments.length }); };

export const api = {
  people: () => wait({ people: MOCK_PEOPLE }),
  projects: () => wait({ projects: MOCK_PROJECTS.map((p) => ({ ...p, archived: 0, members: [] })) }),
  flows: () => (isAdm() ? wait({ flows: [{ id: 1, name: "Daily contact list", default_assignee: "sara", project_id: 1 }, { id: 2, name: "Win-back follow-ups", default_assignee: "daniel", project_id: 2 }] }) : fail("Admin only", 403)),
  templates: () => wait({ templates: TEMPLATES }),
  tasks: (q = {}) => {
    const u = meNow().username;
    let l = all().filter((t) => visible(t, u));
    if (q.assignee && isAdm()) l = l.filter((t) => t.assignee === q.assignee);
    if (q.include !== "done") l = l.filter((t) => t.status !== "done");
    if (q.status) l = l.filter((t) => t.status === q.status);
    if (q.q) l = l.filter((t) => t.title.toLowerCase().includes(String(q.q).toLowerCase()));
    return wait({ tasks: l });
  },
  task: (id) => { const t = find(id); if (!t) return fail("Task not found", 404); const d = det(id); return wait({ task: t, checklist: d.checklist, observers: d.observers, comments: d.comments, activity: d.activity }); },
  createTask: (b) => {
    const me = meNow(), assignee = isAdm() ? (b.assignee || me.username) : me.username;
    const t = {
      id: ++seq, title: b.title, description: b.description || "", status: "pending", high_priority: b.high_priority ? 1 : 0, owner: me.username, assignee,
      project_id: b.project_id || null, flow_id: b.flow_id || null, parent_id: null, due_date: b.due_date || null, due_time: b.due_time || null, est_minutes: b.est_minutes || null,
      started_at: null, spent_seconds: 0, completed_at: null, tags: b.tags || [], linked_player: b.linked_player || null, created_at: nowTs(), updated_at: nowTs(),
      observers: b.observers || [], checklist_total: (b.checklist || []).length, checklist_done: 0, comment_count: 0,
    };
    extra.push(t);
    detail[t.id] = { checklist: (b.checklist || []).map((x, i) => ({ id: t.id * 100 + i, text: x, done: 0, pos: i })), observers: [...t.observers], comments: [], activity: [{ id: 1, actor: me.username, text: "Created the task", created_at: nowTs() }] };
    return wait({ task: t });
  },
  updateTask: (id, b) => patch(id, b).then((r) => wait(r)),
  setStatus: (id, action) => {
    const t = find(id); if (!t) return fail("Task not found", 404);
    const me = meNow();
    if (["start", "pause", "complete"].includes(action) && t.assignee !== me.username) return fail("Only the assignee can do that", 403);
    if (action === "start") {
      const cur = all().find((x) => x.assignee === t.assignee && x.status === "progress" && x.id !== t.id);
      if (cur) return fail(`${t.assignee} already has an ongoing task`, 409, { ongoing: { id: cur.id, title: cur.title } });
      log(id, "Started the task");
      return patch(id, { status: "progress", started_at: nowTs() }).then(wait);
    }
    const spent = t.status === "progress" && t.started_at ? Math.round((Date.now() - parseUtc(t.started_at)) / 1000) : 0;
    if (action === "pause") { log(id, "Paused the task"); return patch(id, { status: "pending", started_at: null, spent_seconds: (t.spent_seconds || 0) + spent }).then(wait); }
    if (action === "complete") {
      if (t.status !== "progress") return fail("Start the task before completing it", 400);
      log(id, "Completed the task");
      return patch(id, { status: "done", started_at: null, spent_seconds: (t.spent_seconds || 0) + spent, completed_at: nowTs() }).then(wait);
    }
    if (action === "defer") { log(id, "Deferred the task"); return patch(id, { status: "deferred", started_at: null, spent_seconds: (t.spent_seconds || 0) + spent }).then(wait); }
    if (action === "reopen") { log(id, "Reopened the task"); return patch(id, { status: "pending", completed_at: null }).then(wait); }
    return fail("Unknown action", 400);
  },
  checklist: (id, b) => {
    const d = det(id);
    if (b.action === "add" && b.text) d.checklist.push({ id: Date.now(), text: b.text, done: 0, pos: d.checklist.length });
    if (b.action === "toggle") d.checklist = d.checklist.map((c) => (c.id === b.item_id ? { ...c, done: c.done ? 0 : 1 } : c));
    if (b.action === "remove") d.checklist = d.checklist.filter((c) => c.id !== b.item_id);
    return sync(id).then(() => wait({ checklist: d.checklist }));
  },
  comment: (id, body) => { const d = det(id); d.comments.push({ id: Date.now(), author: meNow().username, body, created_at: nowTs() }); return sync(id).then(() => wait({ comments: d.comments })); },
  deleteTask: (id) => { gone.add(Number(id)); return wait({ ok: true }); },
  workload: () => {
    if (!isAdm()) return fail("Admin only", 403);
    const today = myt(), list = all();
    return wait({ people: MOCK_PEOPLE.filter((p) => p.role === "agent").map((p) => {
      const mine = list.filter((t) => t.assignee === p.username), open = mine.filter((t) => t.status !== "done");
      const on = open.find((t) => t.status === "progress");
      return {
        username: p.username, assigned: open.length, overdue: open.filter((t) => t.due_date && t.due_date < today).length,
        done: mine.length - open.length, waiting: open.filter((t) => t.status === "pending").length,
        ongoing: on ? { id: on.id, title: on.title, started_at: on.started_at, spent_seconds: on.spent_seconds, est_minutes: on.est_minutes, checklist_done: on.checklist_done, checklist_total: on.checklist_total } : null,
      };
    }) });
  },
};
