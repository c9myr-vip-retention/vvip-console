// Permission check for the revamp UI. `me.perms` comes from GET /api/me (worker/perms.js). While an older Worker is still live there is
// no `perms`, so fall back to what the old flags mean: manage_users = every admin permission, can_edit = act, can_delete, on_leaderboard.
import { NAV } from "./tokens.js";

const AGENT_ACT = ["contact.edit", "tasks.use", "schedule.swap_request"];
const PAGE_ALL = ["page.changes", "page.contact", "page.checkin", "page.grace", "page.players", "page.tasks", "page.schedule", "page.projects", "page.workload", "page.settings", "page.account"];   // everyone has these by default
const PAGE_AGENT = ["page.myday", "page.myperf"];                                                                                          // agent-style sidebar only

export function can(me, key) {
  if (!me) return false;
  if (Array.isArray(me.perms)) return me.perms.includes(key);
  if (key === "kpi.scored") return !!me.on_leaderboard;
  if (key === "contact.delete") return !!(me.can_delete || me.manage_users);
  if (AGENT_ACT.includes(key)) return !!(me.can_edit || me.manage_users);
  if (PAGE_ALL.includes(key)) return true;
  if (PAGE_AGENT.includes(key)) return !me.manage_users;
  return !!me.manage_users;
}
export const canAny = (me, keys) => keys.some((k) => can(me, k));

// The permission behind each page: it decides whether the page shows in the sidebar. Every page has exactly one, so every page can be switched.
// Dashboard, Assignments, Flows, Templates and Analytics are themselves one function each, so they use that function's permission.
export const PAGE_PERM = {
  dash: "dashboard.view", delta: "page.changes", perf: "page.performance",
  queue: "page.contact", checkin: "page.checkin", grace: "page.grace", players: "page.players", assign: "assign.manage",
  tasks: "page.tasks", sched: "page.schedule", proj: "page.projects", flows: "flows.manage", tpl: "templates.manage", team: "page.workload",
  ana: "analytics.view", set: "page.settings",                // the Recycle bin is a tab in Settings, not a page of its own
  home: "page.myday", mine: "page.myperf",
};
// Pages the other sidebar style does not list are added to this section when the role may open them: [section, page key, label]
const EXTRA = [
  ["Overview", "dash", "Dashboard"], ["Overview", "perf", "Performance"], ["Daily work", "assign", "Assignments"],
  ["Work", "flows", "Flows"], ["Work", "tpl", "Templates"], ["Task insight", "ana", "Analytics"], ["Admin", "set", "Settings"],
  ["Me", "home", "My day"], ["Me", "mine", "My performance"],
];
export const canOpen = (me, key) => { const p = PAGE_PERM[key]; return !p || can(me, p); };

/** The sidebar for this person: admin-style when they can see every team, agent-style otherwise; either way only the pages they may use. */
export function navFor(me) {
  const wide = can(me, "teams.all");
  const out = NAV[wide ? "admin" : "agent"].map(([h, items]) => [h, items.filter(([k]) => canOpen(me, k))]).filter(([, items]) => items.length);
  const have = new Set(out.flatMap(([, items]) => items.map(([k]) => k)));
  for (const [h, k, label] of EXTRA) {
    if (have.has(k) || !canOpen(me, k)) continue;
    let sec = out.find(([x]) => x === h);
    if (!sec) { sec = [h, []]; if (h === "Overview") out.unshift(sec); else out.push(sec); }
    sec[1].push([k, label]);
  }
  return out;
}

/** Keys of the pages this person can open. */
export const pageKeys = (me) => new Set(navFor(me).flatMap(([, items]) => items.map(([k]) => k)));
