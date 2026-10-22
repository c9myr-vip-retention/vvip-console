// Mock data for developing the setup pages without the Worker. Enabled ONLY when localStorage.revamp_mock === "1".
// Same method names and shapes as src/revamp/api/work.js. State is in memory and mutable so restore / delete / save feel real.
const stamp = (daysAgo, h = 10, m = 0) => { const d = new Date(Date.now() - daysAgo * 864e5); d.setUTCHours(h, m, 0, 0); return d.toISOString().slice(0, 19).replace("T", " "); };
const myt = (off = 0) => new Date(Date.now() + 8 * 3600e3 + off * 864e5).toISOString().slice(0, 10);
const me = () => { try { return JSON.parse(localStorage.getItem("revamp_mock_me") || "null") || { username: "aldo", manage_users: 1 }; } catch { return { username: "aldo", manage_users: 1 }; } };
const wait = (v) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v))), 60));
const deny = () => Promise.reject(Object.assign(new Error("Admin only"), { status: 403 }));
const admin = () => !!me().manage_users;

const PEOPLE = ["aldo", "mexha", "sara", "daniel", "mei"];
let seq = 100;

const projects = [
  { id: 1, name: "October Win-Back Drive", description: "Re-engage cooling whales across Team B", privacy: "members", archived: 0, members: ["aldo", "sara", "daniel", "mei"], last_active: stamp(0, 6, 44) },
  { id: 2, name: "Data Quality", description: "Telegram links, missing UIDs, feeder checks", privacy: "members", archived: 0, members: ["aldo", "mexha", "sara"], last_active: stamp(1, 4) },
  { id: 3, name: "KPI Season 4", description: "Targets and mistake review", privacy: "team", archived: 0, members: ["aldo", "daniel"], last_active: stamp(6, 3) },
  { id: 4, name: "Summer Reload 2025", description: "Closed campaign", privacy: "members", archived: 1, members: ["aldo", "mei"], last_active: stamp(70, 3) },
];
const flows = [
  { id: 1, name: "Daily contact list", project_id: null, admin_user: "aldo", default_assignee: "sara", last_task_at: stamp(0, 6, 44), pending: 4, in_progress: 6, completed: 31, efficiency: 92 },
  { id: 2, name: "Win-back follow-ups", project_id: 1, project_name: "October Win-Back Drive", admin_user: "mexha", default_assignee: "daniel", last_task_at: stamp(0, 5, 12), pending: 2, in_progress: 3, completed: 18, efficiency: 88 },
  { id: 3, name: "Player complaints", project_id: null, admin_user: "aldo", default_assignee: "mei", last_task_at: stamp(0, 3, 3), pending: 3, in_progress: 2, completed: 12, efficiency: 71 },
  { id: 4, name: "Telegram link requests", project_id: 2, project_name: "Data Quality", admin_user: "mexha", default_assignee: "sara", last_task_at: stamp(1, 9), pending: 1, in_progress: 1, completed: 9, efficiency: 64 },
  { id: 5, name: "Data fix requests", project_id: 2, project_name: "Data Quality", admin_user: "mexha", default_assignee: "mexha", last_task_at: stamp(3, 9), pending: 0, in_progress: 2, completed: 15, efficiency: 93 },
  { id: 6, name: "KPI & mistake review", project_id: null, admin_user: "aldo", default_assignee: "aldo", last_task_at: stamp(6, 9), pending: 0, in_progress: 0, completed: 6, efficiency: null },
];
const rating = (e) => (e === null ? "No data" : e >= 85 ? "Excellent" : e >= 70 ? "Good" : "Needs attention");
let templates = [
  { id: 1, name: "Contact list for Tier 3", deadline: "Same day", assignee: "sara", checklist: ["Pull today's list", "Send first message", "Log outcomes"], created_by: "aldo" },
  { id: 2, name: "Welcome-back message for cooling whales", deadline: "1 day", assignee: "daniel", checklist: ["Check last deposit", "Pick the hook"], created_by: "aldo" },
  { id: 3, name: "Weekly KPI report", deadline: "7 days", assignee: "mei", checklist: [], created_by: "mexha" },
  { id: 4, name: "Telegram link request", deadline: "2 days", assignee: "mexha", checklist: ["Verify the player", "Link the account"], created_by: "mexha" },
];
const tasks = [
  { id: 1, title: "Contact list for Tier 3 BM69", status: "done", assignee: "sara", project_id: 1, due_date: myt(-2) },
  { id: 2, title: "Welcome-back message for cooling whales", status: "progress", assignee: "daniel", project_id: 1, due_date: myt(1) },
  { id: 3, title: "Call back swecin about missed bonus", status: "pending", assignee: "mei", project_id: 1, due_date: myt(-1) },
  { id: 4, title: "Fix missing UIDs on ACE33 feed", status: "pending", assignee: "mexha", project_id: 2, due_date: myt(3) },
  { id: 5, title: "Link Telegram for 12 players", status: "done", assignee: "sara", project_id: 2, due_date: myt(-4) },
  { id: 6, title: "Season 4 target sheet", status: "pending", assignee: "daniel", project_id: 3, due_date: null },
];
let bin = [
  { type: "task", id: 21, name: "Duplicate: weekly report", deleted_at: stamp(2, 5), deleted_by: "mexha" },
  { type: "task", id: 17, name: "Old handover checklist", deleted_at: stamp(9, 4), deleted_by: "aldo" },
  { type: "template", id: 9, name: "Retired: VIP birthday greeting", deleted_at: stamp(0, 2), deleted_by: "aldo" },
  { type: "flow", id: 8, name: "Test flow", deleted_at: stamp(20, 3), deleted_by: "mexha" },
  { type: "project", id: 7, name: "Old pilot project", deleted_at: stamp(27, 3), deleted_by: "aldo" },
];
const flowOut = (f) => ({ ...f, project_name: f.project_id ? (projects.find((p) => p.id === f.project_id) || {}).name || null : null, rating: rating(f.efficiency) });
const projOut = (p) => {
  const ts = tasks.filter((t) => t.project_id === p.id), done = ts.filter((t) => t.status === "done").length;
  return { ...p, members: p.members.map((u, i) => ({ username: u, role: i === 0 ? "owner" : "member", active: ts.filter((t) => t.assignee === u && t.status !== "done").length })),
    task_total: ts.length, task_done: done, overdue: ts.filter((t) => t.status !== "done" && t.due_date && t.due_date < myt()).length };
};
const eff = [
  { username: "sara", assigned: 3, in_progress: 1, completed: 6, on_time_rate: 86, avg_minutes: 42, overdue: 1 },
  { username: "daniel", assigned: 4, in_progress: 1, completed: 4, on_time_rate: 64, avg_minutes: 75, overdue: 2 },
  { username: "mei", assigned: 3, in_progress: 1, completed: 3, on_time_rate: 50, avg_minutes: 128, overdue: 1 },
];
const daily = Array.from({ length: 14 }, (_, i) => ({ date: myt(i - 13), rate: [70, 66, null, 62, 61, 64, 60, 58, 67, 72, null, 69, 71, 67][i] }));

export const api = {
  people: () => wait({ people: PEOPLE.map((u) => ({ username: u, role: u === "aldo" ? "admin" : "agent", team: "B" })) }),
  tasks: (q = {}) => wait({ tasks: tasks.filter((t) => !q.project_id || t.project_id === Number(q.project_id)).map((t) => ({ ...t, owner: "aldo", observers: [], tags: [], checklist_total: 0, checklist_done: 0, comment_count: 0 })) }),
  projects: (q = {}) => wait({ projects: projects.filter((p) => p.archived === (String(q.archived) === "1" ? 1 : 0) && (admin() || p.members.includes(me().username))).map(projOut) }),
  project: (id) => { const p = projects.find((x) => x.id === Number(id)); return p ? wait({ project: projOut(p), activity: [
    { id: 1, actor: "sara", text: "Completed the task", title: "Contact list for Tier 3 BM69", created_at: stamp(0, 4) },
    { id: 2, actor: "aldo", text: "Created the task", title: "Call back swecin about missed bonus", created_at: stamp(1, 8) }] }) : Promise.reject(new Error("Project not found")); },
  saveProject: (b) => {
    if (!admin()) return deny();
    const members = [...new Set([me().username, ...(b.members || [])])];
    if (b.id) { const p = projects.find((x) => x.id === Number(b.id)); Object.assign(p, { name: b.name, description: b.description, privacy: b.privacy, members: [p.members[0], ...members.filter((u) => u !== p.members[0])] }); return wait({ project: projOut(p) }); }
    const p = { id: ++seq, name: b.name, description: b.description || "", privacy: b.privacy || "members", archived: 0, members, last_active: stamp(0, 1) }; projects.push(p); return wait({ project: projOut(p) });
  },
  archiveProject: (id, archived) => { if (!admin()) return deny(); projects.find((p) => p.id === Number(id)).archived = archived ? 1 : 0; return wait({ ok: true }); },
  deleteProject: (id) => { const i = projects.findIndex((p) => p.id === Number(id)); if (i >= 0) projects.splice(i, 1); return wait({ ok: true }); },
  flows: () => (admin() ? wait({ flows: flows.map(flowOut) }) : deny()),
  saveFlow: (b) => {
    if (!admin()) return deny();
    if (b.id) Object.assign(flows.find((f) => f.id === Number(b.id)), b); else flows.unshift({ id: ++seq, pending: 0, in_progress: 0, completed: 0, efficiency: null, last_task_at: null, ...b });
    return wait({ ok: true });
  },
  deleteFlow: (id) => { if (!admin()) return deny(); const i = flows.findIndex((f) => f.id === Number(id)); const [f] = flows.splice(i, 1); bin.unshift({ type: "flow", id: f.id, name: f.name, deleted_at: stamp(0, new Date().getUTCHours()), deleted_by: me().username }); return wait({ ok: true }); },
  templates: () => wait({ templates }),
  saveTemplate: (b) => {
    if (!admin()) return deny();
    if (b.id) templates = templates.map((t) => (t.id === Number(b.id) ? { ...t, ...b } : t)); else templates.push({ id: ++seq, created_by: me().username, ...b });
    return wait({ ok: true });
  },
  deleteTemplate: (id) => { if (!admin()) return deny(); const t = templates.find((x) => x.id === Number(id)); templates = templates.filter((x) => x !== t); bin.unshift({ type: "template", id: t.id, name: t.name, deleted_at: stamp(0, new Date().getUTCHours()), deleted_by: me().username }); return wait({ ok: true }); },
  analytics: (days = 30) => (admin() ? wait({
    days: Number(days), created_vs_completed: [{ week: myt(-27), created: 8, completed: 6 }, { week: myt(-20), created: 12, completed: 9 }, { week: myt(-13), created: 10, completed: 11 }, { week: myt(-6), created: 14, completed: 12 }],
    workload: [{ username: "sara", open: 7, rate: 86 }, { username: "daniel", open: 5, rate: 64 }, { username: "mei", open: 4, rate: 50 }, { username: "mexha", open: 2, rate: 93 }],
    flows: [{ name: "Daily contact list", completed: 31 }, { name: "Win-back follow-ups", completed: 18 }, { name: "Data fix requests", completed: 15 }, { name: "Player complaints", completed: 12 }, { name: "Telegram link requests", completed: 9 }],
    compliance: [{ username: "mexha", rate: 93, completed: 15 }, { username: "sara", rate: 86, completed: 22 }, { username: "daniel", rate: 64, completed: 14 }, { username: "mei", rate: 50, completed: 9 }],
  }) : deny()),
  efficiency: (user) => {
    const rows = admin() ? eff.filter((e) => !user || e.username === user) : eff.filter((e) => e.username === me().username);
    return wait({ users: rows.length ? rows : [{ username: user || me().username, assigned: 0, in_progress: 0, completed: 0, on_time_rate: null, avg_minutes: null, overdue: 0 }], daily, days: null });
  },
  bin: () => (admin() ? wait({ items: bin, keep_days: 30 }) : deny()),
  restore: (type, id) => { if (!admin()) return deny(); bin = bin.filter((b) => !(b.type === type && b.id === id)); return wait({ ok: true }); },
  purge: (type, id) => { if (!admin()) return deny(); bin = bin.filter((b) => !(b.type === type && b.id === id)); return wait({ ok: true }); },
};
