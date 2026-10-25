// Calendar view: month grid, tasks on their due date. Drag a task to another day to change its date.
import React, { useMemo, useState } from "react";
import { Select, toast } from "../../ui/index.jsx";
import TaskCard from "../../taskviews/TaskCard.jsx";
import { STATUS, byDue, canMoveDate, dragStart, dragEnd, dragging, dow, fmtDay, fmtTime, isAdmin, toNum, toStr, todayNum, useSaver } from "../../taskviews/shared.js";
import "../../taskviews/taskviews.css";

const NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], MAX = 3;
const dotColor = (t, today) => (t.status === "done" ? "var(--pos,#4CC38A)" : t.due_date && toNum(t.due_date) < today ? "var(--neg,#F2727F)" : STATUS[t.status]?.color || "#8B94A7");

export default function Calendar({ tasks, people, me, onOpen, onChange }) {
  const today = todayNum(), t0 = new Date(today * 864e5);
  const [ym, setYm] = useState({ y: t0.getUTCFullYear(), m: t0.getUTCMonth() });
  const [sel, setSel] = useState(null);                                       // selected day number
  const [over, setOver] = useState(null);
  const [who, setWho] = useState("");
  const save = useSaver(onChange);

  const shown = useMemo(() => (tasks || []).filter((t) => t.due_date && (!who || t.assignee === who)), [tasks, who]);
  const byDay = useMemo(() => { const m = {}; shown.forEach((t) => { (m[t.due_date] = m[t.due_date] || []).push(t); }); Object.values(m).forEach((a) => a.sort(byDue)); return m; }, [shown]);

  const first = Math.round(Date.UTC(ym.y, ym.m, 1) / 864e5), len = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const start = first - dow(first), rows = Math.ceil((dow(first) + len) / 7), days = Array.from({ length: rows * 7 }, (_, i) => start + i);
  const go = (d) => { const n = new Date(Date.UTC(ym.y, ym.m + d, 1)); setYm({ y: n.getUTCFullYear(), m: n.getUTCMonth() }); setSel(null); };
  const title = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const drop = (e, n) => {
    e.preventDefault(); setOver(null);
    const t = (tasks || []).find((x) => x.id === dragging()); if (!t || t.due_date === toStr(n)) return;
    if (!canMoveDate(t, me)) { toast("You can only change the date of your own tasks"); return; }
    save(t.id, { due_date: toStr(n) }, `Moved to ${fmtDay(n)}`);
  };
  const selTasks = sel !== null ? byDay[toStr(sel)] || [] : [];
  const assignees = [...new Set((tasks || []).map((t) => t.assignee).filter(Boolean))].sort();

  return (
    <div className="tv tv-calendar">
      <div className={`tv-cal-wrap${sel !== null ? " has-day" : ""}`}>
        <div className="tv-panel">
          <div className="tv-cal-h">
            <b>{title}</b><span className="tv-grow" />
            {isAdmin(me) && <Select value={who} onChange={setWho} placeholder="All assignees" style={{ width: 160 }}
              options={(people?.length ? people.map((p) => p.username) : assignees).map((u) => ({ value: u, label: u }))} />}
            <button className="btn sm" onClick={() => go(-1)} aria-label="Previous month">‹</button>
            <button className="btn sm" onClick={() => { setYm({ y: t0.getUTCFullYear(), m: t0.getUTCMonth() }); setSel(today); }}>Today</button>
            <button className="btn sm" onClick={() => go(1)} aria-label="Next month">›</button>
          </div>
          <div className="tv-cal">
            {NAMES.map((n) => <div key={n} className="tv-dh">{n}</div>)}
            {days.map((n) => {
              const d = new Date(n * 864e5), list = byDay[toStr(n)] || [], inMonth = d.getUTCMonth() === ym.m;
              return (
                <div key={n} data-date={toStr(n)} className={`tv-cell${inMonth ? "" : " mute"}${n === today ? " td" : ""}${sel === n ? " sel" : ""}${over === n ? " drop" : ""}`}
                  onClick={() => setSel(sel === n ? null : n)}
                  onDragOver={(e) => { e.preventDefault(); if (over !== n) setOver(n); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === n ? null : o)); }}
                  onDrop={(e) => drop(e, n)}>
                  <div className="tv-dn">{d.getUTCDate() === 1 ? fmtDay(n) : d.getUTCDate()}</div>
                  {list.slice(0, MAX).map((t) => {
                    const mv = canMoveDate(t, me);
                    return (
                      <div key={t.id} data-id={t.id} className={`tv-ev${mv ? " drag" : ""}`} draggable={mv} title={`${t.title} · ${t.assignee}`}
                        onDragStart={mv ? (e) => dragStart(e, t.id) : undefined} onDragEnd={dragEnd}
                        onClick={(e) => { e.stopPropagation(); onOpen && onOpen(t.id); }}>
                        <i className="bd" style={{ background: dotColor(t, today) }} />
                        <span className={`tt${t.status === "done" ? " done" : ""}`}>{t.title}</span>
                        {t.due_time && sel === null && <span style={{ color: "var(--dm)" }}>{fmtTime(t.due_time)}</span>}
                      </div>
                    );
                  })}
                  {list.length > MAX && <button className="tv-more" onClick={(e) => { e.stopPropagation(); setSel(n); }}>+{list.length - MAX} more</button>}
                </div>
              );
            })}
          </div>
        </div>
        {sel !== null && (
          <aside className="tv-panel tv-dayp">
            <h4>{fmtDay(sel, { weekday: "long", day: "numeric", month: "short" })}</h4>
            <div style={{ color: "var(--dm)" }}>{selTasks.length ? `${selTasks.length} task${selTasks.length > 1 ? "s" : ""}` : "No tasks due this day"}</div>
            {selTasks.map((t) => <TaskCard key={t.id} t={t} drag={false} onOpen={onOpen} />)}
          </aside>
        )}
      </div>
    </div>
  );
}
