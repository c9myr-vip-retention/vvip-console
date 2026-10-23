// Dashboard (admin). Live staff board on top (who is on shift now), then the live Dashboard (KPIs, trends, brand health, lists,
// daily report) re-housed unchanged, then the brand cards at the bottom (tap one to open Contact filtered to that brand). Owned by agent "shell-ui".
import React, { useMemo } from "react";
import { Dashboard as LiveDashboard, BRANDS, fmtK } from "../../App.jsx";
import { brandColor } from "../tokens.js";
import { contactTodo } from "../shellHelpers.js";
import DashStaff from "./DashStaff.jsx";
import MyDay from "./MyDay.jsx";
import { can } from "../perms.js";

function BrandCards({ ctx }) {
  const { teamBrands, teamData, contacts, snap, health, goto } = ctx;
  const todo = useMemo(() => contactTodo(teamData, contacts, snap, null), [teamData, contacts, snap]);
  const stale = useMemo(() => new Set((health || []).filter((h) => h.last_fed && h.last_fed !== snap).map((h) => h.brand)), [health, snap]);
  const rows = teamBrands.map((b) => {
    const mine = teamData.filter((r) => r.brand === b);
    return {
      b, color: brandColor(b), players: mine.length,
      dep: mine.reduce((s, r) => s + (Number(r.daily_deposit) || 0), 0), todo: todo.filter((r) => r.brand === b).length,
    };
  });
  return (
    <>
      <div className="bar" style={{ margin: "0 0 8px" }}><b>Brands today</b><span className="dim">Tap a brand to open its contact queue.</span></div>
      <div className="brandcards" style={{ marginBottom: 14, gridTemplateColumns: `repeat(${Math.min(8, Math.max(4, rows.length))},1fr)` }}>
        {rows.map((r) => (
          <button key={r.b} className="bcard" style={{ "--b": r.color }} title={`${r.players} players`} onClick={() => goto("queue", { brand: r.b })}>
            <div className="bcn">{r.b}{stale.has(r.b) && <span className="chip warn">stale</span>}</div>
            <div className="mono">{fmtK(r.dep)}</div>
            <div className="bct"><b>{r.todo}</b> to contact</div>
          </button>
        ))}
      </div>
    </>
  );
}

/** A clear divider between the sections of the Dashboard. */
const Sep = ({ title, note }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 14px" }}>
    <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
    {note && <span className="dim">{note}</span>}
    <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
  </div>
);

export default function Dashboard({ ctx }) {
  const { me, viewTeam, teamData, teamBrands, board, contacts, dates, isPast, readOnly, saveContact, clearContact, snap, health } = ctx;
  const staleList = (health || []).filter((h) => h.last_fed && h.last_fed !== snap).map((h) => h.brand).filter((b) => teamBrands.includes(b));
  if (!can(me, "dashboard.view")) return <div className="card"><div className="body dim">The Dashboard needs the “See the admin Dashboard” permission.</div></div>;
  return (
    <>
      <div className="top"><h1>Dashboard</h1><span className="badge admin">Admin only</span></div>
      {staleList.length > 0 && <div className="banner warn">⚠ {staleList.length} brand{staleList.length > 1 ? "s" : ""} not fed today: {staleList.join(", ")}. Report will be incomplete.</div>}
      <DashStaff viewTeam={viewTeam} me={me} />
      <Sep title="My tasks" note="Your own work as a leader: tasks only, nothing to contact" />
      <MyDay ctx={ctx} embedded />
      <Sep title="Team numbers" note={viewTeam === "ALL" ? "All teams" : `Team ${viewTeam}`} />
      <div className="rv-live">
        <LiveDashboard data={teamData} brandOrder={teamBrands} viewTeam={viewTeam} snap={board.snapshot_date} isPast={isPast}
          contacts={contacts} me={me} team={ctx.team || board.team || []} dates={dates} onSaveContact={saveContact} onClearContact={clearContact} readOnly={readOnly} />
      </div>
      <div style={{ marginTop: 18 }}><BrandCards ctx={ctx} /></div>
    </>
  );
}
