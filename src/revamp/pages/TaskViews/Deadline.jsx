// Deadline view: kanban columns by deadline bucket. Drag a card to a column to change its due date.
import React, { useMemo, useState } from "react";
import { toast } from "../../ui/index.jsx";
import TaskCard from "../../taskviews/TaskCard.jsx";
import { BUCKETS, bucketOf, bucketDate, byDue, canMoveDate, dragging, useSaver, todayNum } from "../../taskviews/shared.js";
import "../../taskviews/taskviews.css";

export default function Deadline({ tasks, people, me, onOpen, onChange }) {
  const [over, setOver] = useState(null);
  const save = useSaver(onChange);
  const today = todayNum();
  const nameOf = (u) => u;                                                   // people only carries usernames
  const cols = useMemo(() => {
    const m = Object.fromEntries(BUCKETS.map(([k]) => [k, []]));
    (tasks || []).forEach((t) => m[bucketOf(t, today)].push(t));
    Object.values(m).forEach((a) => a.sort(byDue));
    return m;
  }, [tasks, today]);

  const drop = (e, key) => {
    e.preventDefault(); setOver(null);
    const id = dragging(); const t = (tasks || []).find((x) => x.id === id); if (!t) return;
    const date = bucketDate(key, today);
    if (date === undefined) return;
    if (!canMoveDate(t, me)) { toast("You can only change the deadline of your own tasks"); return; }
    if ((t.due_date || null) === date) return;
    const label = BUCKETS.find((b) => b[0] === key)[1];
    save(id, { due_date: date }, date ? `Deadline set to ${date}` : `Moved to ${label}`);
  };

  return (
    <div className="tv tv-deadline">
      <p className="tv-hint">Grouped by deadline. Drag a card to a column to change its deadline.</p>
      <div className="tv-board" style={{ gridAutoColumns: "minmax(160px,1fr)" }}>
        {BUCKETS.map(([key, label, color]) => {
          const items = cols[key], target = bucketDate(key, today) !== undefined;
          return (
            <div key={key} className={`tv-col${over === key ? " drop" : ""}`} data-col={key}
              onDragOver={target ? (e) => { e.preventDefault(); if (over !== key) setOver(key); } : undefined}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === key ? null : o)); }}
              onDrop={target ? (e) => drop(e, key) : undefined}>
              <div className="tv-ch"><i className="dot" style={{ background: color }} />{label}<span className="n">{items.length}</span></div>
              <div className="tv-cb">
                {items.map((t) => <TaskCard key={t.id} t={t} drag={canMoveDate(t, me)} onOpen={onOpen} assigneeName={nameOf(t.assignee)} />)}
                {!items.length && <div className="tv-empty">Nothing here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
