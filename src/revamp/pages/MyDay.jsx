// My day (agent home): my ongoing task with a live timer, what is due today, what is overdue, and the rest of my list.
import React, { useMemo, useState } from "react";
import { Seg } from "../ui/index.jsx";
import useTaskOverlays from "../tasks/useTaskOverlays.jsx";
import {
  useTasksData, meOf, canEdit, todayMY, useNow, useTaskActions, ConflictBanner, DueBadge, CheckProg,
  dueInfo, elapsedSec, fmtElapsed, BUCKETS, bucketOf, byDue,
} from "../tasks/common.jsx";

const HT = [["active", "Active"], ["over", "Overdue"], ["today", "Due today"], ["done", "Done"]];
const BUCKET_ORDER = ["over", "today", "week", "next", "later", "none", "done"];
const greet = () => { const h = new Date(Date.now() + 8 * 3600e3).getUTCHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export default function MyDay({ ctx }) {
  const me = useMemo(() => meOf(ctx), [ctx.me]);   // eslint-disable-line react-hooks/exhaustive-deps
  const { tasks, people, projects, loading, error, reload } = useTasksData();
  const { overlays, openTask, newTask } = useTaskOverlays({ me, people, projects, tasks, onChange: reload });
  const { run, busy, conflict, clearConflict } = useTaskActions(reload);
  const [ht, setHt] = useState("active");
  const today = todayMY();

  const mine = useMemo(() => tasks.filter((t) => t.assignee === me.username), [tasks, me.username]);
  const active = mine.filter((t) => t.status !== "done");
  const ongoing = mine.find((t) => t.status === "progress");
  const over = active.filter((t) => t.due_date && t.due_date < today).sort(byDue);
  const dueToday = active.filter((t) => t.due_date === today).sort(byDue);
  const notOn = (l) => l.filter((t) => t.status !== "progress");     // the ongoing task already has its own card
  const next = active.filter((t) => t.status === "pending").sort(byDue)[0];
  useNow(!!ongoing);

  const pname = (id) => projects.find((p) => p.id === id)?.name || "No project";
  const filt = (k) => k === "over" ? over : k === "today" ? dueToday : k === "done" ? mine.filter((t) => t.status === "done") : active;
  const list = filt(ht);
  const groups = BUCKET_ORDER.map((k) => [k, BUCKETS.find((b) => b[0] === k)[1], list.filter((t) => bucketOf(t) === k).sort(byDue)]).filter((g) => g[2].length);
  const ed = canEdit(me);

  const row = (t) => (
    <div key={t.id} className="frow" onClick={() => openTask(t.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openTask(t.id)}>
      <div className="grow">
        <div className={"t" + (t.status === "done" ? " done-t" : "")}>{t.high_priority ? <span className="fire">🔥 </span> : null}{t.title}</div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>{pname(t.project_id)}</span>
          {t.checklist_total > 0 && <span>{t.checklist_done}/{t.checklist_total} steps</span>}
          {t.status === "progress" && <span style={{ color: "var(--blue)" }}>● Ongoing · <span className="mono">{fmtElapsed(elapsedSec(t))}</span></span>}
        </div>
      </div>
      <DueBadge info={dueInfo(t)} />
      {ed && t.status === "progress" && <button className="btn sm pri" disabled={busy} onClick={(e) => { e.stopPropagation(); run(t, "complete"); }}>✓ Complete</button>}
      {ed && t.status === "pending" && <button className="btn sm" disabled={busy} onClick={(e) => { e.stopPropagation(); run(t, "start"); }}>▶ Start</button>}
    </div>
  );
  const mini = (title, items, empty, extra) => (
    <div className="card">
      <h3>{title} <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>{items.length}</span>{extra}</h3>
      <div>{items.length ? items.slice(0, 5).map(row) : <div className="body dim">{empty}</div>}{items.length > 5 && <div className="wmore" onClick={() => setHt(title === "Overdue" ? "over" : "today")}>Show all {items.length}</div>}</div>
    </div>
  );

  return (
    <div>
      <div className="hello top">
        <div>
          <h1>{greet()}, {me.username}</h1>
          <p>{over.length} task{over.length === 1 ? "" : "s"} overdue · {dueToday.length} due today · {active.length} open</p>
        </div>
        <span className="grow" />
        {ed && <button className="btn pri" onClick={() => newTask({})}>+ New task</button>}
      </div>
      {error && <div className="banner crit">{error}</div>}
      <ConflictBanner conflict={conflict} onOpen={(id) => { clearConflict(); openTask(id); }} onClose={clearConflict} />

      {ongoing ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="body" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span className="pill" style={{ "--c": "#5F9AD6" }}>ONGOING</span>
              <b className="grow" style={{ cursor: "pointer", minWidth: 200 }} onClick={() => openTask(ongoing.id)}>{ongoing.title}</b>
              <span className="timer mono" style={{ fontSize: 22 }}>{fmtElapsed(elapsedSec(ongoing))}</span>
              {ed && <button className="btn" disabled={busy} onClick={() => run(ongoing, "pause")}>Pause</button>}
              {ed && <button className="btn pri" disabled={busy} onClick={() => run(ongoing, "complete")}>Complete</button>}
            </div>
            <CheckProg t={ongoing} />
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 14, borderStyle: "dashed" }}>
          <div className="body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="grow"><b>No ongoing task</b><div className="dim">You can have many tasks assigned, but only one ongoing at a time.</div></div>
            {ed && next && <button className="btn pri" disabled={busy} onClick={() => run(next, "start")}>Start “{next.title.length > 40 ? next.title.slice(0, 40) + "…" : next.title}”</button>}
          </div>
        </div>
      )}

      {loading ? <div className="pageload">Loading…</div> : (
        <div className="grid" style={{ alignItems: "start", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
          <div className="card">
            <h3>My tasks<span className="grow" /><button className="btn sm" onClick={() => ctx.goto && ctx.goto("tasks")}>Full task views →</button></h3>
            <div className="bar" style={{ padding: "10px 14px 0" }}>
              <Seg value={ht} onChange={setHt} options={HT.map(([k, l]) => ({ value: k, label: l, count: filt(k).length }))} />
            </div>
            {groups.length === 0 && <div className="body dim" style={{ padding: 30, textAlign: "center" }}>Nothing here. Nice.</div>}
            {groups.map(([k, label, items]) => (
              <div key={k}>
                <div className="ddh" style={{ padding: "12px 14px 4px" }}>{label} · {items.length}</div>
                {items.map(row)}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {mini("Due today", notOn(dueToday), "Nothing due today.")}
            {mini("Overdue", notOn(over), "Nothing overdue.")}
          </div>
        </div>
      )}
      {overlays}
    </div>
  );
}
