import React, { useEffect, useState } from "react";
import { Avatar } from "../ui/index.jsx";
import { dueInfo, elapsedSec, fmtElapsed, dragStart, dragEnd } from "./shared.js";
import "./taskviews.css";

const IconCheck = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="2.5" /><path d="M5 8.2l2.2 2.2L11 6" /></svg>;
const IconChat = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg>;
const IconClock = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.2" /></svg>;

export function MiniTimer({ t }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  return <span className="tv-mono">{fmtElapsed(elapsedSec(t))}</span>;
}

/** Task card shared by Deadline and Planner. `drag` enables HTML5 dragging. */
export default function TaskCard({ t, drag, onOpen, assigneeName }) {
  const due = dueInfo(t);
  const meta = [
    t.checklist_total ? <span key="c" className="tv-meta"><IconCheck />{t.checklist_done}/{t.checklist_total}</span> : null,
    t.comment_count ? <span key="m" className="tv-meta"><IconChat />{t.comment_count}</span> : null,
    t.est_minutes ? <span key="e" className="tv-meta"><IconClock />{t.est_minutes >= 60 ? `${Math.round(t.est_minutes / 6) / 10}h` : `${t.est_minutes}m`}</span> : null,
  ].filter(Boolean);
  return (
    <div className={`tv-card${drag ? " drag" : ""}${t.status === "done" ? " done" : ""}`} draggable={!!drag} data-id={t.id}
      onDragStart={drag ? (e) => dragStart(e, t.id) : undefined} onDragEnd={drag ? dragEnd : undefined}
      onClick={() => onOpen && onOpen(t.id)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(t.id); }}>
      <div className="tv-title">{t.high_priority ? <span className="tv-fire" title="High priority">!</span> : null}{t.title}</div>
      {t.tags && t.tags.length > 0 && <div className="tv-tags">{t.tags.slice(0, 3).map((x) => <span key={x} className="tv-tag">{x}</span>)}</div>}
      {meta.length > 0 && <div className="tv-metas">{meta}</div>}
      {t.status === "progress" && <div className="tv-ong"><i /> Ongoing · <MiniTimer t={t} /></div>}
      <div className="tv-foot"><span className={`tv-due ${due.cls}`}>{due.text}</span><span title={assigneeName || t.assignee}><Avatar name={t.assignee} /></span></div>
    </div>
  );
}
