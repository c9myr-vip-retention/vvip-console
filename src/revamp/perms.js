// Permission check for the revamp UI. `me.perms` comes from GET /api/me (worker/perms.js). While an older Worker is still live there is
// no `perms`, so fall back to what the old flags mean: manage_users = every admin permission, can_edit = act, can_delete, on_leaderboard.
import { NAV } from "./tokens.js";

const AGENT_ACT = ["contact.edit", "tasks.use", "schedule.swap_request"];

export function can(me, key) {
  if (!me) return false;
  if (Array.isArray(me.perms)) return me.perms.includes(key);
  if (key === "kpi.scored") return !!me.on_leaderboard;
  if (key === "contact.delete") return !!(me.can_delete || me.manage_users);
  if (AGENT_ACT.includes(key)) return !!(me.can_edit || me.manage_users);
  return !!me.manage_users;
}
export const canAny = (me, keys) => keys.some((k) => can(me, k));

// Pages that need a permission. Anything not listed is open to everyone.
export const PAGE_PERM = {
  dash: "dashboard.view", perf: "teams.all", assign: "assign.manage", flows: "flows.manage", tpl: "templates.manage", ana: "analytics.view",
  bin: "bin.manage", set: ["users.manage", "activity.view", "bin.manage", "tasks.clear"],
};
// Admin pages added to an agent-style sidebar when the role holds the permission: [section, page key, label]
const EXTRA = [
  ["Overview", "dash", "Dashboard"], ["Daily work", "assign", "Assignments"], ["Work", "flows", "Flows"], ["Work", "tpl", "Templates"],
  ["Task insight", "ana", "Analytics"], ["Task insight", "bin", "Recycle bin"], ["Admin", "set", "Settings"],
];
export const canOpen = (me, key) => { const p = PAGE_PERM[key]; return !p || (Array.isArray(p) ? canAny(me, p) : can(me, p)); };

/** Keys of the pages this person can open. */
export const pageKeys = (me) => new Set(navFor(me).flatMap(([, items]) => items.map(([k]) => k)));

/** The sidebar for this person: admin-style when they can see every team, agent-style otherwise; either way only the pages they may use. */
export function navFor(me) {
  const wide = can(me, "teams.all");
  const out = NAV[wide ? "admin" : "agent"].map(([h, items]) => [h, items.filter(([k]) => canOpen(me, k))]).filter(([, items]) => items.length);
  if (!wide) {
    for (const [h, k, label] of EXTRA) {
      if (!canOpen(me, k)) continue;
      let sec = out.find(([x]) => x === h);
      if (!sec) { sec = [h, []]; if (h === "Overview") out.unshift(sec); else out.push(sec); }
      sec[1].push([k, label]);
    }
  }
  return out;
}
