// Planner view: one column per person. Admin drags a card to another person to reassign; drop on the tray to clear the deadline.
import React, { useMemo, useState } from "react";
import { Avatar, toast } from "../../ui/index.jsx";
import TaskCard from "../../taskviews/TaskCard.jsx";
import { byDue, canMoveDate, canReassign, dragging, useSaver, isAdmin } from "../../taskviews/shared.js";
import "../../taskviews/taskviews.css";

export default function Planner({ tasks, people, me, onOpen, onChange }) {
  const [over, setOver] = useState(null);
  const save = useSaver(onChange);
  const active = useMemo(() => (tasks || []).filter((t) => t.status !== "done"), [tasks]);

  // admin sees every person; an agent sees only people that appear on tasks they can see
  const cols = useMemo(() => {
    const names = new Set(active.map((t) => t.assignee).filter(Boolean));
    if (isAdmin(me)) (people || []).forEach((p) => names.add(p.username));
    else if (me?.username) names.add(me.username);
    return [...names].sort((a, b) => (a === me?.username ? -1 : b === me?.username ? 1 : a.localeCompare(b)));
  }, [active, people, me]);
  const dated = (u) => active.filter((t) => t.assignee === u && t.due_date).sort(byDue);
  const nodue = active.filter((t) => !t.due_date).sort((a, b) => (a.assignee || "").localeCompare(b.assignee || "") || a.id - b.id);
  const ongoing = (u) => active.find((t) => t.assignee === u && t.status === "progress");

  const dropOn = (e, user) => {
    e.preventDefault(); setOver(null);
    const t = active.find((x) => x.id === dragging()); if (!t || t.assignee === user) return;
    if (!canReassign(t, me)) { toast(isAdmin(me) ? "This task can't be reassigned" : "Only an admin can reassign tasks"); return; }
    save(t.id, { assignee: user }, `Assigned to ${user}`);
  };
  const dropTray = (e) => {
    e.preventDefault(); setOver(null);
    const t = active.find((x) => x.id === dragging()); if (!t || !t.due_date) return;
    if (!canMoveDate(t, me)) { toast("You can only change the deadline of your own tasks"); return; }
    save(t.id, { due_date: null }, "Deadline cleared");
  };
  const dragOK = (t) => canMoveDate(t, me) || canReassign(t, me);

  return (
    <div className="tv tv-planner">
      <p className="tv-hint">{isAdmin(me) ? "One column per person. Drag a card to another person to reassign it." : "Your tasks and the people you work with. Only an admin can reassign."} Drop on “No deadline” to clear a deadline.</p>
      <div className="tv-board" style={{ gridAutoColumns: "minmax(190px,1fr)" }}>
        {cols.map((u) => {
          const items = dated(u), on = ongoing(u);
          return (
            <div key={u} className={`tv-col${over === u ? " drop" : ""}`} data-user={u}
              onDragOver={(e) => { e.preventDefault(); if (over !== u) setOver(u); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === u ? null : o)); }}
              onDrop={(e) => dropOn(e, u)}>
              <div className="tv-ch">
                <div className="tv-who"><Avatar name={u} /><div>{u}<small>{on ? "Ongoing: 1" : "Idle"}</small></div></div>
                <span className="n">{items.length}</span>
              </div>
              <div className="tv-cb">
                {items.map((t) => <TaskCard key={t.id} t={t} drag={dragOK(t)} onOpen={onOpen} />)}
                {!items.length && <div className="tv-empty">No dated tasks</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`tv-tray${over === "__tray" ? " drop" : ""}`} data-tray="1"
        onDragOver={(e) => { e.preventDefault(); if (over !== "__tray") setOver("__tray"); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === "__tray" ? null : o)); }}
        onDrop={dropTray}>
        <h4>No deadline <span>{nodue.length}</span></h4>
        {nodue.length ? <div className="tv-trayg">{nodue.map((t) => <TaskCard key={t.id} t={t} drag={dragOK(t)} onOpen={onOpen} />)}</div>
          : <div className="tv-empty">Drop a card here to remove its deadline</div>}
      </div>
    </div>
  );
}
