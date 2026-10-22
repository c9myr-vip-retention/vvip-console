// List view: one table of tasks with quick add, sortable columns, optional grouping and inline Start / Complete.
import React, { useMemo, useState } from "react";
import { Avatar, toast } from "../ui/index.jsx";
import { tapi, isAdmin, canEdit, useNow, useTaskActions, ConflictBanner, StatusPill, DueBadge, dueInfo, elapsedSec, fmtElapsed, BUCKETS, bucketOf, byDue } from "./common.jsx";

const who = (u) => (u ? <span className="who"><Avatar name={u} /> <span>{u}</span></span> : <span className="dim">—</span>);
const STATUS_ORDER = { progress: 0, pending: 1, deferred: 2, done: 3 };
const STATUS_LABEL = { progress: "In progress", pending: "Pending", deferred: "Deferred", done: "Completed" };

export default function TaskList({ tasks, projects = [], me, group = "none", onOpen, onChange }) {
  const admin = isAdmin(me), editable = canEdit(me);
  const [sort, setSort] = useState({ k: "due", d: 1 });
  const [quick, setQuick] = useState("");
  const { run, busy, conflict, clearConflict } = useTaskActions(onChange);
  useNow(tasks.some((t) => t.status === "progress"));
  const pname = (id) => projects.find((p) => p.id === id)?.name || "";

  const rows = useMemo(() => {
    const l = [...tasks];
    const cmp = sort.k === "t" ? (a, b) => a.title.localeCompare(b.title) * sort.d : (a, b) => byDue(a, b) * sort.d;
    return l.sort(cmp);
  }, [tasks, sort]);

  const groupKey = (t) => {
    if (group === "project") return pname(t.project_id) || "No project";
    if (group === "assignee") return t.assignee || "Unassigned";
    if (group === "status") return STATUS_LABEL[t.status] || t.status;
    if (group === "deadline") return BUCKETS.find((b) => b[0] === bucketOf(t))[1];
    return "";
  };
  const groups = useMemo(() => {
    if (group === "none") return [["", rows]];
    const m = new Map();
    rows.forEach((t) => { const k = groupKey(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); });
    const order = (k) => group === "deadline" ? BUCKETS.findIndex((b) => b[1] === k) : group === "status" ? STATUS_ORDER[Object.keys(STATUS_LABEL).find((s) => STATUS_LABEL[s] === k)] : 0;
    return [...m.entries()].sort((a, b) => (group === "deadline" || group === "status" ? order(a[0]) - order(b[0]) : a[0].localeCompare(b[0])));
    // eslint-disable-next-line
  }, [rows, group, projects]);

  const addQuick = async () => {
    const title = quick.trim(); if (!title) return;
    setQuick("");
    try { await tapi.createTask({ title, assignee: me.username }); toast("Task added"); onChange && onChange(); } catch (e) { toast(e.message || "Could not add the task"); setQuick(title); }
  };
  const arrow = (k) => (sort.k === k ? (sort.d > 0 ? " ▲" : " ▼") : "");
  const sortBy = (k) => setSort((s) => (s.k === k ? { k, d: -s.d } : { k, d: 1 }));
  const cols = admin ? 8 : 7;

  const btn = (t) => {
    if (!editable || t.assignee !== me.username) return null;
    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
    if (t.status === "progress") return <button className="btn sm pri" disabled={busy} onClick={stop(() => run(t, "complete"))}>✓ Complete</button>;
    if (t.status === "pending") return <button className="btn sm" disabled={busy} onClick={stop(() => run(t, "start"))}>▶ Start</button>;
    return null;
  };

  return (
    <div>
      {editable && (
        <div className="qadd">
          <span className="dim">＋</span>
          <input className="input" placeholder="Add a task and press Enter (assigned to you, no deadline)" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQuick()} />
        </div>
      )}
      <ConflictBanner conflict={conflict} onOpen={(id) => { clearConflict(); onOpen(id); }} onClose={clearConflict} />
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th className="s" style={{ cursor: "pointer" }} onClick={() => sortBy("t")}>Task{arrow("t")}</th>
              <th className="s" style={{ cursor: "pointer" }} onClick={() => sortBy("due")}>Deadline{arrow("due")}</th>
              <th>Status</th>
              <th />
              {admin && <th>Created by</th>}
              <th>Assignee</th>
              <th>Project</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols} className="dim" style={{ padding: 30, textAlign: "center" }}>No tasks match.</td></tr>}
            {groups.map(([g, list]) => (
              <React.Fragment key={g || "all"}>
                {group !== "none" && <tr className="div"><td colSpan={cols}>{g} · {list.length}</td></tr>}
                {list.map((t) => (
                  <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => onOpen(t.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(t.id); }}>
                    <td>
                      <div className={"title-c" + (t.status === "done" ? " done-t" : "")} style={{ fontWeight: 500 }}>{t.high_priority ? <span className="fire">🔥 </span> : null}{t.title}</div>
                      <div className="dim" style={{ fontSize: 11.5, marginTop: 2, display: "flex", gap: 10 }}>
                        {t.checklist_total > 0 && <span>{t.checklist_done}/{t.checklist_total} steps</span>}
                        {t.comment_count > 0 && <span>💬 {t.comment_count}</span>}
                        {t.status === "progress" && <span style={{ color: "var(--blue)" }}>● Ongoing · <span className="mono">{fmtElapsed(elapsedSec(t))}</span></span>}
                      </div>
                    </td>
                    <td><DueBadge info={dueInfo(t)} /></td>
                    <td><StatusPill status={t.status} /></td>
                    <td className="r">{btn(t)}</td>
                    {admin && <td>{who(t.owner)}</td>}
                    <td>{who(t.assignee)}</td>
                    <td className="dim">{pname(t.project_id) || "—"}</td>
                    <td>{t.tags.length ? <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>{t.tags.slice(0, 3).map((x) => <span key={x} className="tag">{x}</span>)}{t.tags.length > 3 && <span className="dim">+{t.tags.length - 3}</span>}</span> : <span className="dim">—</span>}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div className="pg"><span className="dim">{rows.length} task{rows.length === 1 ? "" : "s"}</span></div>
      </div>
    </div>
  );
}
