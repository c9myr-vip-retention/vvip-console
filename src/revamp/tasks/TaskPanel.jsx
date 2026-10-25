// Task drawer: status buttons, live timer, checklist, comments, observers, activity.
// Rules (BUILD-CONTRACT section 2): only the assignee starts / pauses / completes; a task must be started before it can be completed;
// one ongoing task per person (the Worker answers 409, shown here with a link to the blocking task); a viewer can only read.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { DrawerPanel, MultiSelect, Avatar, toast } from "../ui/index.jsx";
import { usePending } from "./Attachments.jsx";
import { Messages, Composer } from "./Chat.jsx";
import { useLive } from "../live.js";
import { tapi, canEditAnyTask, canDeleteAnyTask, canEdit, useNow, useTaskActions, ConflictBanner, StatusPill, DueBadge, CheckProg, dueInfo, elapsedSec, fmtElapsed } from "./common.jsx";

const when = (ts) => {
  if (!ts) return "";
  const d = new Date(String(ts).replace(" ", "T") + "Z");
  if (isNaN(d)) return ts;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur" });
};
const fmtEst = (m) => (m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "Not set");
const fmtSpent = (s) => `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`;

export default function TaskPanel({ id, me, people = [], projects = [], tasks = [], onClose, onChange, onOpen }) {
  const [d, setD] = useState(null);                       // { task, checklist, observers, comments, activity }
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("comments");
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [editDesc, setEditDesc] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const chatEnd = useRef(null);
  const pending = usePending();

  const load = useCallback(async () => {
    try { const r = await tapi.task(id); setD(r); setErr(""); } catch (e) { setErr(e.message || "Could not load the task"); }
  }, [id]);
  useEffect(() => { setD(null); setConfirmDel(false); setEditDesc(null); load(); }, [load]);
  useLive(["tasks"], load);                          // a new comment or a change by someone else shows up on its own
  // Opening the task (or a new message arriving while it is open) clears its notifications.
  const seenCount = useRef(-1);
  useEffect(() => {
    if (!d) return;
    if (seenCount.current !== d.comments.length) { seenCount.current = d.comments.length; tapi.readNotifications({ task_id: id }).catch(() => {}); }
  }, [d && d.comments.length, id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => { load(); onChange && onChange(); };
  const { run, busy, conflict, clearConflict } = useTaskActions(refresh);
  const t = d?.task;
  useNow(t?.status === "progress");
  useEffect(() => { if (chatEnd.current) chatEnd.current.scrollTop = chatEnd.current.scrollHeight; }, [d?.comments?.length, d?.activity?.length, tab]);

  const guard = async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message || "Could not save"); return null; } };

  if (err && !t) {
    return (
      <DrawerPanel onClose={onClose}>
        <div className="dh"><h2>Task</h2><button className="btn sm" onClick={onClose}>Close ✕</button></div>
        <div className="db"><div className="banner crit">{err}</div></div>
      </DrawerPanel>
    );
  }
  if (!t) return <DrawerPanel onClose={onClose}><div className="dh"><h2 className="dim">Loading…</h2><button className="btn sm" onClick={onClose}>Close ✕</button></div></DrawerPanel>;

  const admin = canEditAnyTask(me), delAny = canDeleteAnyTask(me), editable = canEdit(me);
  const mine = t.assignee === me.username, mineOrOwner = mine || t.owner === me.username;
  const mayEdit = editable && (admin || mineOrOwner);
  const other = tasks.find((x) => x.assignee === t.assignee && x.status === "progress" && x.id !== t.id);
  const project = projects.find((p) => p.id === t.project_id);
  const info = dueInfo(t);
  const live = t.status === "progress";
  const spent = elapsedSec(t);
  const cl = d.checklist || [];
  const ckDone = cl.filter((c) => c.done).length;
  const progTask = { ...t, checklist_total: cl.length, checklist_done: ckDone };

  const doToggle = (it) => guard(() => tapi.checklist(t.id, { action: "toggle", item_id: it.id }).then(refresh));
  const doAddItem = () => { const text = newItem.trim(); if (!text) return; setNewItem(""); guard(() => tapi.checklist(t.id, { action: "add", text }).then(refresh)); };
  const doRemove = (it) => guard(() => tapi.checklist(t.id, { action: "remove", item_id: it.id }).then(refresh));
  const send = () => {
    const body = draft.trim(), sending = pending.files.map(({ name, mime, data }) => ({ name, mime, data }));
    if (!body && !sending.length) return;
    setDraft(""); pending.clear();
    guard(() => tapi.comment(t.id, body, sending).then(refresh));
  };
  const react = (commentId, emoji) => guard(() => tapi.react(commentId, emoji).then((r) => setD((cur) => (cur ? { ...cur, comments: r.comments } : cur))));
  const setPrio = () => guard(() => tapi.updateTask(t.id, { high_priority: t.high_priority ? 0 : 1 }).then(refresh));
  const saveDesc = () => { const v = editDesc; setEditDesc(null); if (v !== null && v !== (t.description || "")) guard(() => tapi.updateTask(t.id, { description: v }).then(refresh), "Saved"); };
  const setObservers = (list) => guard(() => tapi.updateTask(t.id, { observers: list }).then(refresh));
  const del = () => guard(() => tapi.deleteTask(t.id), "Task deleted").then((r) => { if (r) { onChange && onChange(); onClose(); } });

  const observerOpts = people.filter((p) => p.username !== t.assignee).map((p) => ({ value: p.username, label: p.username }));
  const person = (u) => <span className="who"><Avatar name={u} /> <span>{u || "—"}</span></span>;

  const act = (action, label, cls = "") => <button key={action} className={"btn " + cls} disabled={busy} onClick={() => run(t, action)}>{label}</button>;
  const gate = (label, why) => <button key={label} className="btn" disabled title={why}>{label}</button>;
  let buttons = [];
  if (!editable) buttons = [];
  else if (t.status === "done") buttons = [act("reopen", "Reopen")];
  else if (t.status === "progress") buttons = [mine ? act("complete", "Complete", "pri") : gate("Complete", "Only the assignee can complete this task"), mine ? act("pause", "Pause") : gate("Pause", "Only the assignee can pause this task"), (mineOrOwner || admin) && act("defer", "Defer")];
  else if (t.status === "deferred") buttons = [act("reopen", "Reopen")];
  else buttons = [mine ? (other ? gate("Start", "One ongoing task at a time") : act("start", "Start", "pri")) : gate("Start", "Only the assignee can start this task"), (mineOrOwner || admin) && act("defer", "Defer")];

  return (
    <DrawerPanel onClose={onClose}>
      <div className="dh">
        <button disabled={!mayEdit} onClick={setPrio} style={{ fontSize: 18 }} title={t.high_priority ? "High priority" : "Mark high priority"}>{t.high_priority ? "🔥" : "♢"}</button>
        <h2>{t.title}</h2>
        <button className="btn sm" onClick={onClose}>Close ✕</button>
      </div>
      <div className="dgrid">
        <div className="dleft">
          {live && (
            <div className="ongbox">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="pill" style={{ "--c": "#5F9AD6" }}>ONGOING</span>
                <span className="grow" />
                <span className="timer mono" style={{ fontSize: 22 }}>{fmtElapsed(spent)}</span>
              </div>
              <div style={{ marginTop: 8 }}><CheckProg t={progTask} /></div>
            </div>
          )}
          <ConflictBanner conflict={conflict} onOpen={(oid) => { clearConflict(); onOpen && onOpen(oid); }} onClose={clearConflict} />
          {!live && !conflict && other && t.status !== "done" && (
            <div className="banner warn" style={{ margin: 0 }}>
              {mine ? "You already have" : `${t.assignee} already has`} an ongoing task:<b style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => onOpen && onOpen(other.id)}>{other.title}</b>.
              Complete or pause it before starting another. You can assign as many tasks as you like, but only one can be ongoing.
            </div>
          )}
          <div className="sec">
            <h4>Description</h4>
            {editDesc !== null
              ? <><textarea className="input" autoFocus value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /><div style={{ display: "flex", gap: 8, marginTop: 6 }}><button className="btn sm pri" onClick={saveDesc}>Save</button><button className="btn sm" onClick={() => setEditDesc(null)}>Cancel</button></div></>
              : <div className={t.description ? "" : "dim"} style={{ whiteSpace: "pre-wrap", cursor: mayEdit ? "text" : "default" }} onClick={() => mayEdit && setEditDesc(t.description || "")}>{t.description || (mayEdit ? "Add a description…" : "No description.")}</div>}
          </div>
          <div className="fields">
            <span className="k">Task owner</span>{person(t.owner)}
            <span className="k">Assignee</span>{person(t.assignee)}
            <span className="k">Deadline</span><span><DueBadge info={info} /></span>
            <span className="k">Status</span><span><StatusPill status={t.status} /></span>
            <span className="k">Priority</span><span>{t.high_priority ? <span className="fire">🔥 High</span> : "Normal"}</span>
            {project && <><span className="k">Project</span><span><span className="tag">{project.name}</span></span></>}
            <span className="k">Estimate</span><span className="mono">{fmtEst(t.est_minutes)}</span>
            <span className="k">Time spent</span><span className="mono">{fmtSpent(spent)}{t.est_minutes ? <span className="dim"> of {fmtEst(t.est_minutes)}</span> : null}</span>
            {t.linked_player && <><span className="k">Player</span><span className="tag">{t.linked_player}</span></>}
            <span className="k">Created</span><span className="dim">{when(t.created_at)} · ID {t.id}</span>
          </div>
          {t.est_minutes > 0 && spent > 0 && (
            <div className="prog"><i style={{ width: Math.min(100, (100 * spent) / (t.est_minutes * 60)) + "%", background: spent > t.est_minutes * 60 ? "var(--neg)" : "var(--accent)" }} /></div>
          )}
          <div className="sec">
            <h4>Checklist <span className="mono">{ckDone}/{cl.length}</span></h4>
            {cl.length === 0 && <div className="dim">No steps yet.</div>}
            {cl.map((c) => (
              <div key={c.id} className="ck">
                <input type="checkbox" className="chk" checked={!!c.done} disabled={!mayEdit} onChange={() => doToggle(c)} />
                <span className={"grow" + (c.done ? " done-t" : "")}>{c.text}</span>
                {mayEdit && <button className="dim" title="Remove" onClick={() => doRemove(c)}>✕</button>}
              </div>
            ))}
            {mayEdit && (
              <div className="qadd" style={{ marginTop: 6, marginBottom: 0 }}>
                <input className="input" placeholder="+ Add item and press Enter" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doAddItem()} />
              </div>
            )}
          </div>
          <div className="sec">
            <h4>Observers <span className="mono">{d.observers.length}</span></h4>
            <div className="who" style={{ flexWrap: "wrap", gap: 12 }}>
              {d.observers.length === 0 && <span className="dim">Nobody is watching this task.</span>}
              {d.observers.map((u) => <span key={u} className="who"><Avatar name={u} /> {u}</span>)}
              {mayEdit && <MultiSelect value={d.observers} options={observerOpts} label="Observers" onChange={setObservers} />}
            </div>
          </div>
          {t.tags.length > 0 && <div className="sec"><h4>Tags</h4><div className="chiprow">{t.tags.map((x) => <span key={x} className="tag">{x}</span>)}</div></div>}
        </div>
        <div className="dright">
          <div className="tabs" style={{ marginTop: 6 }}>
            <button className={tab === "comments" ? "on" : ""} onClick={() => setTab("comments")}>Comments <span className="dim">{d.comments.length}</span></button>
            <button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity <span className="dim">{d.activity.length}</span></button>
          </div>
          <div ref={chatEnd} style={{ flex: 1, overflow: "auto", padding: "4px 16px 8px", minHeight: 0 }}>
            {tab === "comments" && (d.comments.length === 0
              ? <div className="dim" style={{ padding: "24px 0", textAlign: "center" }}>No messages yet. Say something, or tag someone with @.</div>
              : <Messages comments={d.comments} me={me.username} people={people} canReact={editable} onReact={react} />)}
            {tab === "activity" && (d.activity.length === 0
              ? <div className="dim" style={{ padding: "24px 0", textAlign: "center" }}>No activity yet.</div>
              : d.activity.map((a) => (
                <div key={a.id} className="cm sys"><div className="bub"><small>{when(a.created_at)}</small><b style={{ color: "var(--txt)", fontWeight: 600 }}>{a.actor}</b> {String(a.text).replace(/^./, (ch) => ch.toLowerCase())}</div></div>
              )))}
          </div>
          {tab === "comments" && editable && <Composer draft={draft} setDraft={setDraft} onSend={send} people={people} me={me.username} pending={pending} />}
        </div>
      </div>
      <div className="df">
        {buttons}
        {!mine && editable && t.status !== "done" && <span className="dim" style={{ fontSize: 12 }}>Only {t.assignee} can start, pause or complete this task.</span>}
        <span className="grow" />
        {editable && (delAny || t.owner === me.username) && (confirmDel
          ? <><span className="dim">Delete this task?</span><button className="btn danger" onClick={del}>Yes, delete</button><button className="btn" onClick={() => setConfirmDel(false)}>No</button></>
          : <button className="btn danger" onClick={() => setConfirmDel(true)}>Delete</button>)}
      </div>
    </DrawerPanel>
  );
}
