// Shared bits for the tasks pages: API wrapper (mock-aware), live clock, status actions, permission helpers.
import React, { useEffect, useRef, useState } from "react";
import { work } from "../api/work.js";
import { toast } from "../ui/index.jsx";
import * as mock from "./fixtures.js";
export { STATUS, dueInfo, elapsedSec, fmtElapsed, todayNum, toNum, toStr, fmtDay, BUCKETS, bucketOf, byDue } from "../taskviews/shared.js";

/** work.* client, swapped for the in-memory fixtures when localStorage.revamp_mock === "1". */
export const tapi = new Proxy({}, { get: (_, k) => (...a) => (mock.mockOn() && mock.api[k] ? mock.api[k](...a) : work[k](...a)) });

export const todayMY = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
export const addDaysIso = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** Whole person object used by the task views: { username, role, manage_users, can_edit }. */
export const meOf = (ctx) => {
  const m = ctx?.me || {};
  return { username: m.username, role: m.role, manage_users: m.manage_users ? 1 : 0, can_edit: m.can_edit !== false, team: m.team };
};
export const isAdmin = (me) => !!me?.manage_users;
export const canEdit = (me) => me?.can_edit !== false;
export const isMine = (t, me) => t.assignee === me?.username;

/** Re-render every second while `on` (live timers). */
export function useNow(on = true) {
  const [, tick] = useState(0);
  useEffect(() => { if (!on) return undefined; const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, [on]);
}

export const priorityMark = (t) => (t.high_priority ? <span className="fire" title="High priority">🔥 </span> : null);

/** Run a status action (start/pause/complete/defer/reopen). Errors become toasts; a 409 on Start keeps the ongoing task so the page can offer to open it. */
export function useTaskActions(onDone) {
  const [conflict, setConflict] = useState(null);       // { message, ongoing: {id,title} }
  const [busy, setBusy] = useState(false);
  const done = useRef(onDone); done.current = onDone;
  const run = async (task, action) => {
    if (busy) return null;
    setBusy(true); setConflict(null);
    try {
      const r = await tapi.setStatus(task.id, action);
      toast({ start: "Started", pause: "Paused", complete: "Completed", defer: "Deferred", reopen: "Reopened" }[action] || "Saved");
      done.current && done.current(r.task);
      return r.task;
    } catch (e) {
      if (e.status === 409) {
        const msg = e.message || `${task.assignee} already has an ongoing task`;
        setConflict({ message: msg, ongoing: e.data?.ongoing || null });
      } else toast(e.message || "Could not save");
      return null;
    } finally { setBusy(false); }
  };
  return { run, busy, conflict, clearConflict: () => setConflict(null) };
}

/** The "<name> already has an ongoing task" banner with a link to the blocking task. */
export function ConflictBanner({ conflict, onOpen, onClose }) {
  if (!conflict) return null;
  return (
    <div className="banner warn" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span>{conflict.message}.</span>
      {conflict.ongoing && <button className="btn sm" onClick={() => onOpen(conflict.ongoing.id)}>Open “{conflict.ongoing.title}”</button>}
      <span className="grow" />
      <button className="btn sm" onClick={onClose}>Dismiss</button>
    </div>
  );
}

/** Small progress bar for checklist_done / checklist_total (nothing when the task has no checklist). */
export function CheckProg({ t, label = true }) {
  const n = t.checklist_total || 0, d = t.checklist_done || 0;
  if (!n) return label ? <div className="dim" style={{ fontSize: 11.5 }}>No checklist</div> : null;
  const pct = Math.round((100 * d) / n);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="prog" style={{ flex: 1 }}><i style={{ width: pct + "%", background: pct === 100 ? "var(--pos)" : "var(--accent)" }} /></div>
      {label && <span className="mono dim" style={{ fontSize: 11.5 }}>{d}/{n}</span>}
    </div>
  );
}

export const STATUS_COLOR = { pending: "#8B94A7", progress: "#5F9AD6", done: "#4CC38A", deferred: "#E39A4B" };
export const StatusPill = ({ status }) => (
  <span className="pill" style={{ "--c": STATUS_COLOR[status] || "#8B94A7" }}>{{ pending: "Pending", progress: "In progress", done: "Completed", deferred: "Deferred" }[status] || status}</span>
);
export const DueBadge = ({ info }) => <span className={"dl" + (info.cls === "over" ? " over" : info.cls === "today" ? " today" : "")}>{info.text}</span>;

/** Load tasks (done included), people and projects once; reload() refetches. */
export function useTasksData() {
  const [state, setState] = useState({ tasks: [], people: [], projects: [], loading: true, error: "" });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = async () => {
    try {
      const [t, p, pr] = await Promise.all([
        tapi.tasks({ include: "done" }),
        tapi.people().catch(() => ({ people: [] })),
        tapi.projects({ archived: 0 }).catch(() => ({ projects: [] })),
      ]);
      if (alive.current) setState({ tasks: t.tasks || [], people: p.people || [], projects: pr.projects || [], loading: false, error: "" });
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, loading: false, error: e.message || "Could not load tasks" }));
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  return { ...state, reload: load };
}
