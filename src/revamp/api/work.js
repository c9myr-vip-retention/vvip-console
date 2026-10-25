// API client for /api/work/* — the ONLY place the revamp UI calls the new routes.
// Shapes are defined in docs/design/BUILD-CONTRACT.md (section 3). Every call returns parsed JSON or throws Error(message).
// `mock` hook: when localStorage.revamp_mock === "1" a page may swap in its own fixtures (see contract, section 6).
const API_BASE = import.meta.env.VITE_API_BASE || "https://groupb-tracker-api.viprtn.workers.dev";   // keep equal to src/App.jsx

export async function http(path, options = {}) {
  const token = localStorage.getItem("session_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || "API error"); e.status = res.status; e.data = data; throw e; }
  return data;
}
/** A file from the Worker (it needs the person's sign-in, so a plain link will not do). Returns a Blob. */
export async function fetchBlob(path) {
  const token = localStorage.getItem("session_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) { let m = "Could not open the file"; try { m = (await res.json()).error || m; } catch { /* not JSON */ } throw new Error(m); }
  return res.blob();
}
const get = (p) => http(p);
const post = (p, body) => http(p, { method: "POST", body: JSON.stringify(body || {}) });
const qs = (o = {}) => { const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString(); return s ? `?${s}` : ""; };

export const work = {
  // people (pickers)
  people: () => get("/api/work/people"),
  // tasks
  tasks: (q) => get(`/api/work/tasks${qs(q)}`),                       // q: { assignee, status, project_id, flow_id, q, include: "done" }
  task: (id) => get(`/api/work/tasks/${id}`),                          // { task, checklist, observers, comments, activity }
  createTask: (b) => post("/api/work/tasks", b),
  updateTask: (id, b) => post(`/api/work/tasks/${id}/update`, b),
  setStatus: (id, action) => post(`/api/work/tasks/${id}/status`, { action }),   // start | pause | complete | defer | reopen
  checklist: (id, b) => post(`/api/work/tasks/${id}/checklist`, b),    // { action: add|toggle|remove, text?, item_id? }
  comment: (id, body, attachments) => post(`/api/work/tasks/${id}/comments`, { body, ...(attachments && attachments.length ? { attachments } : {}) }),   // attachments: [{ name, mime, data (base64) }]
  attachment: (id) => fetchBlob(`/api/work/attachments/${id}`),
  react: (commentId, emoji) => post(`/api/work/comments/${commentId}/react`, { emoji }),                // toggles; answers with the task's comments
  notifications: () => get("/api/work/notifications"),                                                  // { items, unread }: tags, new comments, new tasks for me
  readNotifications: (b) => post("/api/work/notifications/read", b),                                    // { ids } | { task_id } | { all: true }
  deleteTask: (id) => post(`/api/work/tasks/${id}/delete`),
  workload: () => get("/api/work/workload"),
  // roles and accounts (Settings). Needs users.manage; see worker/roles.js
  roles: () => get("/api/roles"),
  createRole: (b) => post("/api/roles", b),                                         // { name, base: admin|agent|viewer|none }
  updateRole: (key, b) => post(`/api/roles/${key}/update`, b),                      // { name?, base?, overrides?: { perm: true|false|null }, reset? }
  moveRole: (key, b) => post(`/api/roles/${key}/move`, b),                          // { dir: "up" | "down" }
  deleteRole: (key, b) => post(`/api/roles/${key}/delete`, b),                      // { move_to? }
  accounts: () => get("/api/users"),
  createAccount: (b) => post("/api/users", b),                                      // { username, password, role_key, team }
  setAccountPerms: (b) => post("/api/users/perms", b),                              // { id, overrides?: { perm: true|false|null }, reset? } personal permissions on top of the role
  setAccountRole: (b) => post("/api/users/role", b),                                // { id, role_key, team? }
  setAccountFlags: (b) => post("/api/users/perm", b),                                // the old editor: { id, role, can_edit, can_delete, on_leaderboard, manage_users, team }
  deleteAccount: (id) => http(`/api/users/${id}`, { method: "DELETE" }),
  // schedule
  schedule: (from, to) => get(`/api/work/schedule${qs({ from, to })}`),
  addScheduleItems: (items) => post("/api/work/schedule/items", { items }),
  updateScheduleItem: (id, b) => post(`/api/work/schedule/items/${id}/update`, b),
  deleteScheduleItem: (id) => post(`/api/work/schedule/items/${id}/delete`),
  deleteScheduleItems: (b) => post("/api/work/schedule/items/bulk-delete", b),    // { type_key?, from?, to?, preview? } -> { count, repeating } | { deleted }
  addScheduleType: (b) => post("/api/work/schedule/types", b),
  updateScheduleType: (key, b) => post(`/api/work/schedule/types/${key}/update`, b),   // { name?, color? }
  clearTasks: (b) => post("/api/work/tasks/clear", b),                                 // { preview: true } -> { counts }; { confirm: "CLEAR TASKS" } -> { cleared }
  deleteScheduleType: (key, b) => post(`/api/work/schedule/types/${key}/delete`, b),   // { preview? } -> { items }
  addShiftPreset: (b) => post("/api/work/schedule/shifts", b),                   // { name, start_time, end_time }
  updateShiftPreset: (key, b) => post(`/api/work/schedule/shifts/${key}/update`, b),
  deleteShiftPreset: (key) => post(`/api/work/schedule/shifts/${key}/delete`),
  requestSwap: (id, note) => post(`/api/work/schedule/items/${id}/swap`, { note }),
  swaps: () => get("/api/work/schedule/swaps"),
  decideSwap: (id, status) => post(`/api/work/schedule/swaps/${id}`, { status }),
  // projects / flows / templates
  projects: (q) => get(`/api/work/projects${qs(q)}`),
  project: (id) => get(`/api/work/projects/${id}`),
  saveProject: (b) => post("/api/work/projects", b),                   // { id?, name, description, privacy, members: [username] }
  archiveProject: (id, archived) => post(`/api/work/projects/${id}/archive`, { archived }),
  deleteProject: (id) => post(`/api/work/projects/${id}/delete`),                    // the owner, or anyone who can manage any project
  flows: () => get("/api/work/flows"),
  saveFlow: (b) => post("/api/work/flows", b),
  deleteFlow: (id) => post(`/api/work/flows/${id}/delete`),
  templates: () => get("/api/work/templates"),
  saveTemplate: (b) => post("/api/work/templates", b),                 // admin only
  deleteTemplate: (id) => post(`/api/work/templates/${id}/delete`),   // admin only
  // insight (admin) + efficiency
  analytics: (days) => get(`/api/work/analytics${qs({ days })}`),
  efficiency: (user) => get(`/api/work/efficiency${qs({ user })}`),
  bin: () => get("/api/work/bin"),
  restore: (type, id) => post("/api/work/bin/restore", { type, id }),
  purge: (type, id) => post("/api/work/bin/purge", { type, id }),
};
