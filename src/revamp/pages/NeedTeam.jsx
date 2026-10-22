// Shown instead of a page that only works one team at a time (assignments, team KPIs) while the team selector says "All teams".
import React from "react";

export default function NeedTeam({ ctx, what }) {
  const teams = (ctx.teamKeys || []).filter((t) => t !== "ALL");
  return (
    <div className="card"><div className="body" style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      <b>{what} works one team at a time</b>
      <span className="dim">The team selector is on “All teams”. Pick a team to continue.</span>
      <div style={{ display: "flex", gap: 8 }}>{teams.map((t) => <button key={t} className="btn" onClick={() => ctx.setViewTeam(t)}>Team {t}</button>)}</div>
    </div></div>
  );
}
