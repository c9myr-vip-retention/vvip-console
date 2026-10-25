// Permissions that come as a pair (what they may do to their OWN records, and to OTHER people's) are shown as one row with three choices:
// None, Own only, Own + others. Behind it are the two real permissions (own, any); see worker/perms.js. `any` always includes `own`.
export const SCOPES = [
  { id: "contact.edit", own: "contact.edit_own", any: "contact.edit", label: "Log contacts", desc: "Assign players, set status, write notes, CRM and Telegram. Own only: players assigned to them (or not assigned yet). Own + others: any player." },
  { id: "contact.delete", own: "contact.delete_own", any: "contact.delete", label: "Clear contacts and notes", desc: "Own only: the contacts and notes they logged themselves. Own + others: anyone's." },
  { id: "tasks.edit", own: "tasks.use", any: "tasks.edit_any", label: "Create and edit tasks", desc: "None: tasks are view-only. Own only: make tasks for themselves, start, finish and comment on their own. Own + others: also change tasks they do not hold." },
  { id: "projects", own: "projects.use", any: "projects.manage", label: "Projects", desc: "Own only: create projects, and edit, archive or delete the ones they own. Own + others: every project, and they see all of them." },
  { id: "flows", own: "flows.own", any: "flows.manage", label: "Flows", desc: "Own only: create flows and manage the ones they administer. Own + others: every flow." },
  { id: "templates", own: "templates.own", any: "templates.manage", label: "Task templates", desc: "Own only: create templates and manage the ones they created. Own + others: every template." },
  { id: "schedule", own: "schedule.edit_own", any: "schedule.manage", label: "Schedule", desc: "Own only: add items, and change the ones they created or are named on. Own + others: the whole schedule, plus types, shift times and bulk delete." },
];
export const SCOPE_OPTIONS = [{ value: "none", label: "None" }, { value: "own", label: "Own only" }, { value: "all", label: "Own + others" }];
export const SCOPE_BY_KEY = Object.fromEntries(SCOPES.flatMap((s) => [[s.own, s], [s.any, s]]));

/** none | own | all, from a set of permission keys. */
export const levelOf = (perms, s) => (perms.has(s.any) ? "all" : perms.has(s.own) ? "own" : "none");
/** The two permissions as on/off for a level. */
export const wantedFor = (level) => ({ own: level !== "none", any: level === "all" });
