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
  ["pages", "Pages (what shows in the sidebar)"],
  ["daily", "Daily work"],
  ["tasks", "Tasks and work"],
  ["schedule", "Schedule"],
  ["admin", "Admin"],
];

// d = default for [admin, agent, viewer]
// The "pages" group has one permission per page that had none: it decides whether the page shows in the sidebar. The page's data is still
// limited by the function permissions below (and by team). A page that already is one function (Dashboard, Assignments, Flows, Templates,
// Analytics, Recycle bin) keeps using that permission as its page switch.
export const PERMS = [
  { key: "page.changes", group: "pages", label: "Changes page", desc: "Show the Changes page in the sidebar.", d: [1, 1, 1] },
  { key: "page.performance", group: "pages", label: "Performance page", desc: "Show the Performance page in the sidebar.", d: [1, 0, 0] },
  { key: "page.contact", group: "pages", label: "Contact page", desc: "Show the Contact page in the sidebar.", d: [1, 1, 1] },
  { key: "page.checkin", group: "pages", label: "Check-in page", desc: "Show the Check-in page in the sidebar.", d: [1, 1, 1] },
  { key: "page.grace", group: "pages", label: "Grace claims page", desc: "Show the Grace claims page in the sidebar.", d: [1, 1, 1] },
  { key: "page.players", group: "pages", label: "Players page", desc: "Show the Players page in the sidebar.", d: [1, 1, 1] },
  { key: "page.tasks", group: "pages", label: "Tasks page", desc: "Show the Tasks page in the sidebar.", d: [1, 1, 1] },
  { key: "page.schedule", group: "pages", label: "Schedule page", desc: "Show the Schedule page in the sidebar.", d: [1, 1, 1] },
  { key: "page.projects", group: "pages", label: "Projects page", desc: "Show the Projects page in the sidebar.", d: [1, 1, 1] },
  { key: "page.workload", group: "pages", label: "Team workload page", desc: "Show the Team workload page in the sidebar.", d: [1, 1, 1] },
  { key: "page.myday", group: "pages", label: "My day page", desc: "Show the My day page in the sidebar.", d: [0, 1, 1] },
  { key: "page.myperf", group: "pages", label: "My performance page", desc: "Show the My performance page in the sidebar.", d: [0, 1, 1] },
  { key: "page.account", group: "pages", label: "My account (tab in Settings)", desc: "Show the My account tab in Settings: change your password and see your details.", d: [1, 1, 1] },
  { key: "page.settings", group: "pages", label: "Settings page", desc: "Show the Settings page in the sidebar. Open to everyone by default; which tabs appear inside depends on the other permissions (My account has its own switch).", d: [1, 1, 1] },

  { key: "dashboard.view", group: "daily", label: "See the admin Dashboard", desc: "Open the Dashboard page: the live staff board, KPIs, trends, brand health and top lists. It hides the page; numbers stay limited to the team(s) the role may see.", d: [1, 0, 0] },
  { key: "contact.edit_own", group: "daily", label: "Log contacts for their own players", desc: "Assign, set status and write notes on players assigned to them (or not assigned yet). Without this and the next one the account is view-only.", d: [1, 1, 0] },
  { key: "contact.edit", group: "daily", label: "Log contacts for any player", desc: "The same on players assigned to other agents. Switch this off and an agent can only work their own players.", d: [1, 1, 0] },
  { key: "contact.delete_own", group: "daily", label: "Clear their own contacts and notes", desc: "Delete a contact or a player note that they logged themselves.", d: [1, 1, 0] },
  { key: "contact.delete", group: "daily", label: "Clear anyone's contact or note", desc: "Delete a logged contact or a player note somebody else wrote.", d: [1, 1, 0] },
  { key: "assign.manage", group: "daily", label: "Assign players to agents", desc: "Manual and automatic assignment, login-check assignment.", d: [1, 0, 0] },
  { key: "campaigns.manage", group: "daily", label: "Manage campaigns", desc: "Create, edit, export, close and delete campaigns and their reports.", d: [1, 0, 0] },
  { key: "data.sync", group: "daily", label: "Run data syncs", desc: "Run feeders, Lark and engagement syncs, feed checks, and log livechat numbers.", d: [1, 0, 0] },
  { key: "mistakes.log", group: "daily", label: "Log mistakes", desc: "Log a mistake against an agent.", d: [1, 0, 0] },
  { key: "kpi.scored", group: "daily", label: "Counts as a scored CS agent", desc: "Shows on the KPI leaderboard and in agent scoring.", d: [0, 1, 0] },
  { key: "teams.all", group: "daily", label: "See every team", desc: "See all teams' brands and data and switch between teams. Without it the account only sees its own team.", d: [1, 0, 0] },
  { key: "people.above", group: "daily", label: "See people above their rank", desc: "The role hierarchy hides people in more senior roles (a HOD cannot see the CEO). Switch this on to let this role see them, in staff lists and their tasks. The most senior role never needs it.", d: [0, 0, 0] },
  { key: "people.same_rank", group: "daily", label: "See same-rank colleagues' tasks when on a team", desc: "People in the same role with no team see each other's tasks. When this role has a team it only sees the tasks of people below it. Switch this on to also see the tasks of same-rank colleagues.", d: [0, 0, 0] },
  { key: "people.all", group: "daily", label: "See people from every team", desc: "Agent and staff lists show people from every team, not only the team in view. Off for everyone by default.", d: [0, 0, 0] },
  { key: "activity.view", group: "daily", label: "See the activity log", desc: "Read the audit trail of who did what.", d: [1, 0, 0] },

  { key: "tasks.use", group: "tasks", label: "Create and work on own tasks", desc: "Make tasks for themselves, start and finish them, comment. Without it tasks are view-only.", d: [1, 1, 0] },
  { key: "tasks.assign_others", group: "tasks", label: "Assign tasks to other people", desc: "Create a task for someone else, reassign a task, bulk-assign.", d: [1, 0, 0] },
  { key: "tasks.view_all", group: "tasks", label: "See everyone's tasks", desc: "See tasks they do not own, are not assigned and do not observe.", d: [1, 0, 0] },
  { key: "tasks.edit_any", group: "tasks", label: "Edit any task", desc: "Change tasks they do not own or hold.", d: [1, 0, 0] },
  { key: "tasks.delete_any", group: "tasks", label: "Delete any task", desc: "Delete tasks they did not create.", d: [1, 0, 0] },
  { key: "workload.all", group: "tasks", label: "Team workload: all teams", desc: "See every team's workload. Without it they see their own team only.", d: [1, 0, 0] },
  { key: "projects.use", group: "tasks", label: "Create and manage own projects", desc: "Create projects, and edit, archive and delete the ones they own. They see the projects they are a member of.", d: [1, 1, 0] },
  { key: "projects.manage", group: "tasks", label: "Manage any project", desc: "Edit, archive and delete projects they do not own, and see every project.", d: [1, 0, 0] },
  { key: "flows.own", group: "tasks", label: "Manage flows they administer", desc: "Create flows (they become the flow's administrator) and edit or delete the flows they administer.", d: [1, 0, 0] },
  { key: "flows.manage", group: "tasks", label: "Manage any flow", desc: "Create, edit and delete every flow.", d: [1, 0, 0] },
  { key: "templates.own", group: "tasks", label: "Manage task templates they created", desc: "Create task templates, and edit or delete the ones they created.", d: [1, 0, 0] },
  { key: "templates.manage", group: "tasks", label: "Manage any task template", desc: "Create, edit and delete every task template.", d: [1, 0, 0] },
  { key: "analytics.view", group: "tasks", label: "See analytics and everyone's efficiency", desc: "Task analytics and every person's task efficiency. Without it they see their own.", d: [1, 0, 0] },
  { key: "tasks.clear", group: "tasks", label: "Clear all task data", desc: "Permanently delete every task with its checklists, comments and history, to reset the data. Cannot be undone.", d: [1, 0, 0] },
  { key: "bin.manage", group: "tasks", label: "Use the recycle bin", desc: "See, restore and permanently remove deleted items.", d: [1, 0, 0] },

  { key: "schedule.edit_own", group: "schedule", label: "Edit schedule items they are on or created", desc: "Add schedule items, and edit, move or delete the ones they created or are named on.", d: [1, 0, 0] },
  { key: "schedule.manage", group: "schedule", label: "Edit the whole schedule", desc: "Add, edit, move and delete any schedule item, plus types, shift times, shift groups and bulk delete.", d: [1, 0, 0] },
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
  if (edit) { out.add("contact.edit"); out.add("contact.edit_own"); out.add("tasks.use"); out.add("projects.use"); out.add("schedule.swap_request"); }
  if (del) { out.add("contact.delete"); out.add("contact.delete_own"); }
  if (user.on_leaderboard) out.add("kpi.scored");
  if (!mgr) for (const p of PERMS) if (p.group === "pages" && p.d[1]) out.add(p.key);        // an old non-manager account already sees the pages an agent sees
  return out;
}

/** Roles from the database, as Map(key -> { key, name, base, builtin, overrides }). null when the tables are not there yet. */
export async function loadRoles(db) {
  try {
    let r;
    try { r = await db.prepare("SELECT key, name, base, builtin, sees FROM roles WHERE deleted_at IS NULL ORDER BY sort, rowid").all(); }
    catch { r = await db.prepare("SELECT key, name, base, builtin FROM roles WHERE deleted_at IS NULL ORDER BY sort, rowid").all(); }   // schema_v29 not run yet
    const p = await db.prepare("SELECT role_key, perm, allowed FROM role_permissions").all();
    const map = new Map();
    for (const x of r.results || []) map.set(x.key, { key: x.key, name: x.name, base: String(x.base || "none"), builtin: !!x.builtin, overrides: {}, sees: parseSees(x.sees) });
    for (const x of p.results || []) { const role = map.get(x.role_key); if (role && PERM_KEYS.includes(x.perm)) role.overrides[x.perm] = !!x.allowed; }
    return map;
  } catch { return null; }
}

/** Who a role can see in agent and staff lists: { team: "all" | "own" }. "own" limits every list to the person's own team (whatever team is in
 *  view). Anything unreadable, and the older rank / roles-I-pick settings, mean everyone. */
export function parseSees(raw) {
  try {
    const o = JSON.parse(raw || "null");
    if (o && o.team === "own") return { team: "own" };
  } catch { /* fall through */ }
  return { team: "all" };
}

// ── the role hierarchy ──
// Roles are ranked most senior first (the order in Settings). A person sees their own rank and everyone below, not above, unless "people.above" is on.
// Tasks go one step further: two people in the same role see each other's tasks only when the viewer has no team; a viewer who has a team sees just the
// tasks of people below them, unless "people.same_rank" is on. Accounts without a role (old settings) are outside the hierarchy and see as they always did.

/** May `viewer` see `target`? tasks = the stricter rule for other people's tasks. rm = Map(role key -> rank, 0 is the most senior). */
export function canViewPerson(viewer, target, rm, perms, tasks) {
  if (!viewer || !target || viewer.username === target.username) return true;
  const vr = rm.get(viewer.role_key), tr = rm.get(target.role_key);
  if (vr === undefined || tr === undefined) return true;                  // no role: outside the hierarchy
  const has = (k) => !!perms && perms.has(k);
  if (tr < vr) return has("people.above");                                // more senior
  if (tr > vr) return true;                                               // below: downline
  if (!tasks) return true;                                                // same rank, in a staff list
  return !viewer.team || has("people.same_rank");                         // same rank, tasks: no team sees each other; a team needs the exception
}
const rankMap = (roles) => new Map([...(roles ? roles.keys() : [])].map((k, i) => [k, i]));

/** Usernames this viewer may NOT see (rows need username, role_key). tasks selects the stricter task rule. */
export function hiddenPeople(rows, viewer, roles, perms, { tasks = false } = {}) {
  const out = new Set();
  if (!viewer || !viewer.role_key || !roles || !roles.has(viewer.role_key)) return out;
  const rm = rankMap(roles);
  for (const r of rows || []) if (!canViewPerson(viewer, r, rm, perms, tasks)) out.add(r.username);
  return out;
}

/** People this account may see: the hierarchy first, then (when its role says so) only its own team. Always includes itself. Rows need `team` and `role_key`. */
export function filterPeople(rows, user, roles, perms, opts) {
  const rk = user && user.role_key, sees = rk && roles && roles.has(rk) ? roles.get(rk).sees : null;
  const hid = hiddenPeople(rows, user, roles, perms, opts);
  const own = !!(sees && sees.team === "own");
  if (!hid.size && !own) return rows;
  return rows.filter((r) => r.username === user.username || (!hid.has(r.username) && (!own || (!!user.team && r.team === user.team))));
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
    can_edit: perms.has("contact.edit") || perms.has("contact.edit_own") ? 1 : 0, can_delete: perms.has("contact.delete") || perms.has("contact.delete_own") ? 1 : 0,
    on_leaderboard: perms.has("kpi.scored") ? 1 : 0, manage_users: perms.has("users.manage") ? 1 : 0,
  };
}

/** Accounts that hold users.manage, given the roles as they would be. users: rows with role_key and the old flag columns. */
export function managerCount(users, roles) {
  return users.filter((u) => resolvePerms(u, roles).has("users.manage")).length;
}

export const slugRole = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "role";
export { BASES };
