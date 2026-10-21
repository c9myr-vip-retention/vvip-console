// Small pure helpers shared by the shell and the pages the shell-ui agent owns.
// Classes the Contact worklist treats as a to-do (HEALTHY / WATCH are not).
export const TODO_CLS = new Set(["GRACE", "TOP_LOSS", "TOP_DEP", "BLOCKED", "DSLD30", "DSLD14", "DSLD7"]);

const ck = (r) => `${r.player_key}|${r.brand}|${r.tier_segment}`;

/** Rows still to contact on `snap`: actionable class and no outcome logged yet (status empty or ASSIGNED).
 *  `who` limits to players assigned to that username (agent view); null/undefined = everyone (admin view). */
export function contactTodo(rows, contacts, snap, who) {
  if (!snap) return [];
  const done = new Set(), owner = new Map();
  (contacts || []).forEach((c) => {
    if (c.snapshot_date !== snap) return;
    const k = ck(c);
    owner.set(k, c.assigned_to);
    if (c.status && c.status !== "ASSIGNED") done.add(k);
  });
  return (rows || []).filter((r) => TODO_CLS.has(r._cls) && !done.has(ck(r)) && (!who || owner.get(ck(r)) === who));
}
