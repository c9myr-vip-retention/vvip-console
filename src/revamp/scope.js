// People lists follow the team in view. Without the "See people from every team" permission a list shows only that team's people (and the
// signed-in person); with it, everyone. A list that carries no team at all (an older Worker) is left as it is.
export function scopeTeam(list, viewTeam, me) {
  const all = Array.isArray(list) ? list : [];
  if (me && Array.isArray(me.perms) && me.perms.includes("people.all")) return all;
  if (!viewTeam || viewTeam === "ALL" || !all.some((p) => p && Object.prototype.hasOwnProperty.call(p, "team"))) return all;
  return all.filter((p) => p.team === viewTeam || (me && p.username === me.username));
}
