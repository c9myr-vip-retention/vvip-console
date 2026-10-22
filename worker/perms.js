// Roles and permissions.
//
// One permission = one function someone may or may not do. A role is a name plus a starting point (`base`: admin, agent, viewer or
// none) and any number of overrides (a permission switched on or off on top of the base). Effective permission = override, else the
// starting point. A role based on Admin, Agent or Viewer starts from that built-in role AS IT IS NOW (so editing Agent changes every role that
// starts from Agent); a built-in role starts from the code defaults below. Roles are ranked, most senior first (roles.sort).
// The three built-in roles (admin, agent, viewer) can be renamed and edited like any other.
//
// An account that has no role_key yet (every account today) keeps exactly the access its old flags give it: legacyPerms() below.
// Giving an account a role in Settings moves it onto this system, and syncFlags() keeps the old columns (role, can_edit, can_delete,
// on_leaderboard, manage_users) in step so every query that still reads them stays right.

export const GROUPS = [
  ["daily", "Daily work"],
  ["tasks", "Tasks and work"],
  ["schedule", "Schedule"],
  ["admin", "Admin"],
];

// d = default for [admin, agent, viewer]
export const PERMS = [
  { key: "dashboard.view", group: "daily", label: "See the admin Dashboard", desc: "Open the Dashboard page: the live staff board, KPIs, trends, brand health and top lists. It hides the page; numbers stay limited to the team(s) the role may see.", d: [1, 0, 0] },
  { key: "contact.edit", group: "daily", label: "Log contacts", desc: "Assign players, set status, write notes, CRM and Telegram. Without it the account is view-only.", d: [1, 1, 0] },
  { key: "contact.delete", group: "daily", label: "Clear a contact or note", desc: "Delete a logged contact or a player note.", d: [1, 1, 0] },
  { key: "assign.manage", group: "daily", label: "Assign players to agents", desc: "Manual and automatic assignment, login-check assignment.", d: [1, 0, 0] },
  { key: "campaigns.manage", group: "daily", label: "Manage campaigns", desc: "Create, edit, export, close and delete campaigns and their reports.", d: [1, 0, 0] },
  { key: "data.sync", group: "daily", label: "Run data syncs", desc: "Run feeders, Lark and engagement syncs, feed checks, and log livechat numbers.", d: [1, 0, 0] },
  { key: "mistakes.log", group: "daily", label: "Log mistakes", desc: "Log a mistake against an agent.", d: [1, 0, 0] },
  { key: "kpi.scored", group: "daily", label: "Counts as a scored CS agent", desc: "Shows on the KPI leaderboard and in agent scoring.", d: [0, 1, 0] },
  { key: "teams.all", group: "daily", label: "See every team", desc: "See all teams' brands and data and switch between teams. Without it the account only sees its own team.", d: [1, 0, 0] },
  { key: "activity.view", group: "daily", label: "See the activity log", desc: "Read the audit trail of who did what.", d: [1, 0, 0] },

  { key: "tasks.use", group: "tasks", label: "Create and work on own tasks", desc: "Make tasks for themselves, start and finish them, comment. Without it tasks are view-only.", d: [1, 1, 0] },
  { key: "tasks.assign_others", group: "tasks", label: "Assign tasks to other people", desc: "Create a task for someone else, reassign a task, bulk-assign.", d: [1, 0, 0] },
  { key: "tasks.view_all", group: "tasks", label: "See everyone's tasks", desc: "See tasks they do not own, are not assigned and do not observe.", d: [1, 0, 0] },
  { key: "tasks.edit_any", group: "tasks", label: "Edit any task", desc: "Change tasks they do not own or hold.", d: [1, 0, 0] },
  { key: "tasks.delete_any", group: "tasks", label: "Delete any task", desc: "Delete tasks they did not create.", d: [1, 0, 0] },
  { key: "workload.all", group: "tasks", label: "Team workload: all teams", desc: "See every team's workload. Without it they see their own team only.", d: [1, 0, 0] },
  { key: "projects.manage", group: "tasks", label: "Manage projects", desc: "Create, edit, archive and delete projects; see all projects.", d: [1, 0, 0] },
  { key: "flows.manage", group: "tasks", label: "Manage flows", desc: "Create, edit and delete flows.", d: [1, 0, 0] },
  { key: "templates.manage", group: "tasks", label: "Manage task templates", desc: "Create, edit and delete task templates.", d: [1, 0, 0] },
  { key: "analytics.view", group: "tasks", label: "See analytics and everyone's efficiency", desc: "Task analytics and every person's task efficiency. Without it they see their own.", d: [1, 0, 0] },
  { key: "tasks.clear", group: "tasks", label: "Clear all task data", desc: "Permanently delete every task with its checklists, comments and history, to reset the data. Cannot be undone.", d: [1, 0, 0] },
  { key: "bin.manage", group: "tasks", label: "Use the recycle bin", desc: "See, restore and permanently remove deleted items.", d: [1, 0, 0] },

  { key: "schedule.manage", group: "schedule", label: "Edit the schedule", desc: "Add, edit, move and delete schedule items, types and shift times; shift groups and bulk delete.", d: [1, 0, 0] },
  { key: "schedule.swaps", group: "schedule", label: "Decide shift swaps", desc: "See swap requests and approve or decline them.", d: [1, 0, 0] },
  { key: "schedule.swap_request", group: "schedule", label: "Request a shift swap", desc: "Ask for a swap on a shift they are on.", d: [1, 1, 0] },

  { key: "users.manage", group: "admin", label: "Manage accounts, roles and permissions", desc: "Create, edit and delete accounts, and edit roles. At least one account must always keep this.", d: [1, 0, 0] },
];
export const PERM_KEYS = PERMS.map((p) => p.key);
const BASES = ["admin", "agent", "viewer", "none"];
const baseIdx = { admin: 0, agent: 1, viewer: 2 };

export const defaultFor = (base, key) => {
  const p = PERMS.find((x) => x.key === key);
  const i = baseIdx[base];
  return !!(p && i !== undefined && p.d[i]);
};

export const BUILTIN_ROLES = [
  { key: "admin", name: "Admin", base: "admin" },
  { key: "agent", name: "Agent", base: "agent" },
  { key: "viewer", name: "Viewer", base: "viewer" },
];

/** What an account with no role_key can do: exactly what its old flags have always given it. */
export function legacyPerms(user) {
  const out = new Set();
  const mgr = !!user.manage_users;
  if (mgr) { for (const p of PERMS) if (p.d[0]) out.add(p.key); }
  const edit = !!user.can_edit || mgr, del = !!user.can_delete || mgr;
  if (edit) { out.add("contact.edit"); out.add("tasks.use"); out.add("schedule.swap_request"); }
  if (del) out.add("contact.delete");
  if (user.on_leaderboard) out.add("kpi.scored");
  return out;
}

/** Roles from the database, as Map(key -> { key, name, base, builtin, overrides }). null when the tables are not there yet. */
export async function loadRoles(db) {
  try {
    const r = await db.prepare("SELECT key, name, base, builtin FROM roles WHERE deleted_at IS NULL ORDER BY sort, rowid").all();
    const p = await db.prepare("SELECT role_key, perm, allowed FROM role_permissions").all();
    const map = new Map();
    for (const x of r.results || []) map.set(x.key, { key: x.key, name: x.name, base: String(x.base || "none"), builtin: !!x.builtin, overrides: {} });
    for (const x of p.results || []) { const role = map.get(x.role_key); if (role && PERM_KEYS.includes(x.perm)) role.overrides[x.perm] = !!x.allowed; }
    return map;
  } catch { return null; }
}

/** The permissions a role starts from. base is "none", a fixed code default set ("admin", "agent", "viewer"), or the key of another role,
 *  which makes that role a template: this role starts from it AS IT IS NOW. A role whose base is a role that no longer exists falls back to
 *  the fixed defaults of that name, or to nothing. */
export function startPerms(role, roles, depth = 0) {
  const out = new Set();
  const parent = roles && depth < 5 && role.base !== "none" && role.key !== role.base ? roles.get(role.base) : null;
  const inherited = parent ? rolePerms(parent, roles, depth + 1) : null;
  for (const k of PERM_KEYS) if (inherited ? inherited.has(k) : defaultFor(role.base, k)) out.add(k);
  return out;
}

/** The fixed code base a role ultimately comes from: "admin", "agent", "viewer" or "none". Decides the old `role` column. */
export function codeBase(role, roles, depth = 0) {
  if (role.base === "none") return "none";
  const parent = roles && depth < 5 && role.key !== role.base ? roles.get(role.base) : null;
  if (parent) return codeBase(parent, roles, depth + 1);
  return ["admin", "agent", "viewer"].includes(role.base) ? role.base : "none";
}

/** Why `base` is not a valid starting point for the role with key `selfKey`, or null when it is. Refuses loops (A starts from B starts from A). */
export function baseProblem(base, roles, selfKey) {
  const fixed = ["admin", "agent", "viewer"].includes(base);
  if (base === "none" || (fixed && (!roles.has(base) || base === selfKey))) return null;   // a built-in role may use its own fixed defaults
  if (!roles.has(base)) return "Unknown starting point";
  if (base === selfKey) return "A role cannot start from itself";
  for (let cur = roles.get(base), n = 0; cur && n < 10; cur = roles.get(cur.base), n++) {
    if (cur.key === selfKey) return "That would make a loop: the other role already starts from this one";
    if (cur.base === cur.key) break;
  }
  return null;
}

export function rolePerms(role, roles, depth = 0) {
  const start = startPerms(role, roles, depth), out = new Set();
  for (const k of PERM_KEYS) { const o = role.overrides[k]; if (o === undefined ? start.has(k) : o) out.add(k); }
  return out;
}

/** Personal exceptions on top of a role: { permission: true | false }, kept as JSON in users.perm_overrides. true grants a permission the role
 *  lacks, false takes one away. Anything that is not a known permission with a true/false value is ignored. */
export function userOverrides(user) {
  try {
    const raw = JSON.parse((user && user.perm_overrides) || "{}"), out = {};
    for (const [k, v] of Object.entries(raw)) if (PERM_KEYS.includes(k) && typeof v === "boolean") out[k] = v;
    return out;
  } catch { return {}; }
}
export function applyOverrides(set, overrides) {
  const out = new Set(set);
  for (const [k, v] of Object.entries(overrides || {})) { if (v) out.add(k); else out.delete(k); }
  return out;
}

/** The effective permission set of an account: its role plus its personal exceptions. roles may be null (tables missing): then everyone is legacy.
 *  An account without a role keeps exactly what its old flags give it; personal exceptions only apply to accounts that have a role. */
export function resolvePerms(user, roles) {
  const rk = user && user.role_key;
  if (rk && roles && roles.has(rk)) return applyOverrides(rolePerms(roles.get(rk), roles), userOverrides(user));
  return legacyPerms(user);
}

/** The old columns an account on `role` (with these personal exceptions) must carry so every query that still reads them agrees. */
export function legacyColumns(role, roles, overrides) {
  const perms = applyOverrides(rolePerms(role, roles), overrides);
  return {
    role: codeBase(role, roles) === "none" ? "viewer" : codeBase(role, roles),
    can_edit: perms.has("contact.edit") ? 1 : 0, can_delete: perms.has("contact.delete") ? 1 : 0,
    on_leaderboard: perms.has("kpi.scored") ? 1 : 0, manage_users: perms.has("users.manage") ? 1 : 0,
  };
}

/** Accounts that hold users.manage, given the roles as they would be. users: rows with role_key and the old flag columns. */
export function managerCount(users, roles) {
  return users.filter((u) => resolvePerms(u, roles).has("users.manage")).length;
}

export const slugRole = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "role";
export { BASES };
