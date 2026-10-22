// Team workload (admin): one card per person with the ongoing task, a live timer, checklist progress and counts.
// Click a number to see that person's tasks. Assignments is its own page.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Modal, Seg } from "../ui/index.jsx";
import useTaskOverlays from "../tasks/useTaskOverlays.jsx";
import { tapi, meOf, isAdmin, todayMY, useNow, StatusPill, DueBadge, CheckProg, dueInfo, fmtElapsed, byDue } from "../tasks/common.jsx";

const parseUtc =(s) => Date.parse(String(s).replace(" ", "T") + "Z");
const liveSec = (o) => (o.spent_seconds || 0) + (o.started_at ? Math.max(0, (Date.now() - parseUtc(o.started_at)) / 1000) : 0);
const KINDS = [["assigned", "Assigned"], ["over", "Overdue"], ["done", "Done"], ["wait", "Waiting"]];

function PersonTasks({ user, kind: k0, onClose, onOpen }) {
  const [kind, setKind] = useState(k0);
  const [tasks, setTasks] = useState(null);
  const today = todayMY();
  useEffect(() => { let off = false; tapi.tasks({ assignee: user, include: "done" }).then((r) => !off && setTasks(r.tasks || [])).catch(() => !off && setTasks([])); return () => { off = true; }; }, [user]);
  const pick = (t, k) => (k === "over" ? t.status !== "done" && t.due_date && t.due_date < today : k === "done" ? t.status === "done" : k === "wait" ? t.status === "pending" : t.status !== "done");
  const list = (tasks || []).filter((t) => t.assignee === user && pick(t, kind)).sort(byDue);
  return (
    <Modal title={<span className="who"><Avatar name={user} /> {user} · tasks</span>} onClose={onClose} width="min(760px,94vw)" footer={<button className="btn" onClick={onClose}>Close</button>}>
      <Seg value={kind} onChange={setKind} options={KINDS.map(([k, l]) => ({ value: k, label: l, count: tasks ? tasks.filter((t) => t.assignee === user && pick(t, k)).length : "" }))} />
      <div className="card">
        {tasks === null && <div className="body dim">Loading…</div>}
        {tasks && list.length === 0 && <div className="body dim" style={{ padding: 26, textAlign: "center" }}>No tasks here.</div>}
        {list.map((t) => (
          <div key={t.id} className="frow" onClick={() => { onClose(); onOpen(t.id); }}>
            <div className="grow"><div className={"t" + (t.status === "done" ? " done-t" : "")}>{t.high_priority ? <span className="fire">🔥 </span> : null}{t.title}</div></div>
            {t.status === "progress" && <StatusPill status="progress" />}
            <DueBadge info={dueInfo(t)} />
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function TeamWorkload({ ctx }) {
  const me = useMemo(() => meOf(ctx), [ctx.me]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState(null);
  const [people, setPeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState("");
  const [see, setSee] = useState(null);                 // { user, kind }

  const load = useCallback(async () => {
    try { const r = await tapi.workload(); setRows(r.people || []); setErr(""); } catch (e) { setErr(e.message || "Could not load the workload"); setRows((x) => x || []); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);
  useEffect(() => {
    tapi.people().then((r) => setPeople(r.people || [])).catch(() => {});
    tapi.projects({ archived: 0 }).then((r) => setProjects(r.projects || [])).catch(() => {});
  }, []);
  const { overlays, openTask, newTask } = useTaskOverlays({ me, people, projects, tasks: [], onChange: load });
  const viewers = useMemo(() => new Set(people.filter((p) => p.role === "viewer").map((p) => p.username)), [people]);   // view-only accounts are not agents
  const shown = useMemo(() => (rows || []).filter((p) => !viewers.has(p.username)), [rows, viewers]);
  useNow(!!rows && rows.some((r) => r.ongoing));

  if (!isAdmin(me)) return <div className="card"><div className="body dim">Team workload is for admins only.</div></div>;

  return (
    <div>
      <div className="top">
        <h1>Team workload</h1>
        <span className="badge admin">Admin only</span>
        <span className="grow" />
        <button className="btn pri" onClick={() => newTask({})}>+ Assign task</button>
      </div>
      <p className="dim" style={{ marginBottom: 12 }}>Assign as many tasks as you like. Each person can only have one ongoing at a time.</p>
      {err && <div className="banner crit">{err}</div>}
      {rows === null && <div className="pageload">Loading…</div>}
      <div className="wl">
        {shown.map((p) => {
          const on = p.ongoing;
          return (
            <div key={p.username} className="card">
              <div className="body" style={{ display: "grid", gap: 12 }}>
                <div className="who"><Avatar name={p.username} /><b>{p.username}</b><span className="grow" /><span className="pill" style={{ "--c": on ? "#5F9AD6" : "#8B94A7" }}>{on ? "Working" : "Idle"}</span></div>
                <div style={{ display: "flex", gap: 6, margin: "0 -10px" }}>
                  {[["assigned", p.assigned, "", "assigned"], ["over", p.overdue, p.overdue ? "neg" : "", "overdue"], ["done", p.done, "pos", "done"], ["wait", p.waiting, "", "waiting"]].map(([k, n, c, l]) => (
                    <button key={k} className="stat" title={`See ${p.username}’s ${l} tasks`} onClick={() => setSee({ user: p.username, kind: k })}>
                      <div className={"mono " + c} style={{ fontSize: 22 }}>{n}</div><div className="dim">{l}</div>
                    </button>
                  ))}
                </div>
                {on ? (
                  <div className="ongbox">
                    <div className="dim" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px" }}>Ongoing now</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "4px 0 8px" }}>
                      <b className="grow" style={{ cursor: "pointer" }} onClick={() => openTask(on.id)}>{on.title}</b>
                      <span className="timer mono" style={{ fontSize: 18 }}>{fmtElapsed(liveSec(on))}</span>
                    </div>
                    <CheckProg t={on} />
                  </div>
                ) : (
                  <div className="ongbox idle"><b>Nothing ongoing</b><div className="dim">{p.waiting ? `${p.waiting} waiting to be started` : "No tasks waiting"}</div></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {rows && shown.length === 0 && !err && <div className="card"><div className="body dim">No agents yet.</div></div>}
      {see && <PersonTasks user={see.user} kind={see.kind} onClose={() => setSee(null)} onOpen={openTask} />}
      {overlays}
    </div>
  );
}
