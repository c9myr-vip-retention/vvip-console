// Projects. Admin: full control (Flows and Templates are their own sidebar pages). Agent: only the projects they are a member of.
// A project opens into a detail view with its tasks, members and activity.
import React, { useMemo, useState } from "react";
import { Avatar, Modal, MultiSelect, Select, Seg, toast } from "../ui";
import { api, allowed, canEdit, useLoad, person, Notice, newTask, openTask, fmtWhen, fmtDay } from "../setup/common.jsx";

const STATUS = { pending: ["Pending", "#8B94A7"], progress: ["In progress", "#4C8DF6"], done: ["Completed", "#4CC38A"], deferred: ["Deferred", "#A78BFA"] };
const todayMyt = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const Pill = ({ s }) => <span className="pill" style={{ "--c": (STATUS[s] || STATUS.pending)[1] }}>{(STATUS[s] || STATUS.pending)[0]}</span>;
const Faces = ({ members, max = 4 }) => (
  <span className="who">{members.slice(0, max).map((m) => <span key={m.username} title={m.username}><Avatar name={m.username} /></span>)}{members.length > max && <span className="dim">+{members.length - max}</span>}</span>
);

function ProjectForm({ project, people, onClose, onSaved }) {
  const [f, setF] = useState({ name: project?.name || "", description: project?.description || "", privacy: project?.privacy || "members", members: (project?.members || []).filter((m) => m.role !== "owner").map((m) => m.username) });
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return setErr("Give the project a name");
    setBusy(true); setErr("");
    try {
      const r = await api.saveProject({ ...(project ? { id: project.id } : {}), name: f.name.trim(), description: f.description.trim(), privacy: f.privacy, members: f.members });
      toast(project ? "Project saved" : "Project created"); onSaved(r.project);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={project ? "Edit project" : "Create project"} onClose={onClose} width="min(520px,94vw)"
      footer={<><button className="btn" onClick={onClose}>Cancel</button> <button className="btn pri" disabled={busy} onClick={save}>Save</button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <label>Name<input className="input" value={f.name} maxLength={120} onChange={(e) => set("name")(e.target.value)} autoFocus /></label>
        <label>Description<textarea className="input" rows={3} value={f.description} onChange={(e) => set("description")(e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>Privacy<Select value={f.privacy} onChange={set("privacy")} options={[{ value: "members", label: "Members only" }, { value: "team", label: "Team" }]} /></label>
          <div>Members<div><MultiSelect label="Choose members" style={{ width: "100%", minHeight: 34, justifyContent: "space-between" }} value={f.members} onChange={set("members")} options={people.map((u) => ({ value: u, label: u }))} /></div></div>
        </div>
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

function ProjectDetail({ ctx, id, onBack, onChanged }) {
  const admin = allowed(ctx, "projects.manage"), me = ctx?.me?.username;
  const [tab, setTab] = useState("tasks"), [edit, setEdit] = useState(false);
  const proj = useLoad(() => api.project(id), [id]);
  const tasks = useLoad(() => api.tasks({ project_id: id, include: "done" }), [id]);
  const ppl = useLoad(() => (admin ? api.people() : Promise.resolve({ people: [] })), [admin]);
  const p = proj.data?.project, ts = tasks.data?.tasks || [], today = todayMyt();
  const done = ts.filter((t) => t.status === "done").length, overdue = ts.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
  const progress = ts.length ? Math.round((100 * done) / ts.length) : 0;
  const archive = async () => { try { await api.archiveProject(id, !p.archived); toast(p.archived ? "Project restored" : "Project archived"); onChanged(); onBack(); } catch (e) { toast(e.message); } };
  if (!p) return <><div className="top"><button className="btn sm" onClick={onBack}>← Projects</button></div><Notice error={proj.error} loading={proj.loading} /></>;
  return (
    <>
      <div className="top">
        <button className="btn sm" onClick={onBack}>← Projects</button>
        <h1>{p.name}</h1><span className="tag">{p.privacy}</span>{p.archived ? <span className="tag">archived</span> : null}
        <span className="grow" />
        <Faces members={p.members} max={6} />
        {admin && <button className="btn" onClick={() => setEdit(true)}>Settings</button>}
        {admin && <button className="btn" onClick={archive}>{p.archived ? "Unarchive" : "Archive"}</button>}
        {canEdit(ctx) && !p.archived && <button className="btn pri" onClick={() => newTask({ project_id: p.id })}>+ Task</button>}
      </div>
      {p.description && <p className="dim" style={{ marginBottom: 12 }}>{p.description}</p>}
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="l">Progress</div><div className="v">{progress}%</div><div className="prog" style={{ marginTop: 6 }}><i style={{ width: `${progress}%` }} /></div></div>
        <div className="card kpi"><div className="l">Open tasks</div><div className="v">{ts.length - done}</div></div>
        <div className="card kpi alert"><div className="l">Overdue</div><div className={`v ${overdue ? "neg" : ""}`}>{overdue}</div></div>
      </div>
      <div style={{ marginBottom: 12 }}><Seg value={tab} onChange={setTab} options={[{ value: "tasks", label: "Tasks", count: ts.length }, { value: "members", label: "Members", count: p.members.length }, { value: "activity", label: "Activity" }]} /></div>
      {tab === "tasks" && (
        <div className="card tw"><table>
          <thead><tr><th>Task</th><th>Deadline</th><th>Status</th><th>Assignee</th></tr></thead>
          <tbody>
            {ts.map((t) => (
              <tr key={t.id} onClick={() => openTask(t.id)} style={{ cursor: "pointer" }}>
                <td><span style={t.status === "done" ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{t.title}</span></td>
                <td className={t.status !== "done" && t.due_date && t.due_date < today ? "neg" : "dim"}>{t.due_date ? fmtDay(t.due_date) : "No deadline"}</td>
                <td><Pill s={t.status} /></td><td>{person(t.assignee)}</td>
              </tr>
            ))}
            {!ts.length && <tr style={{ cursor: "default" }}><td colSpan={4} className="dim">{tasks.loading ? "Loading…" : "No tasks in this project yet."}</td></tr>}
          </tbody>
        </table></div>
      )}
      {tab === "members" && (
        <div className="card tw"><table>
          <thead><tr><th>Member</th><th>Role</th><th className="r">Active tasks</th></tr></thead>
          <tbody>{p.members.map((m) => <tr key={m.username} style={{ cursor: "default" }}><td>{person(m.username)}{m.username === me && <span className="dim"> (you)</span>}</td><td>{m.role === "owner" ? "Owner" : "Member"}</td><td className="r mono">{m.active ?? 0}</td></tr>)}</tbody>
        </table></div>
      )}
      {tab === "activity" && (
        <div className="card"><div className="body">
          {(proj.data.activity || []).map((a) => <div key={a.id} style={{ padding: "6px 0" }}><span className="dim">{fmtWhen(a.created_at)}</span> · <b>{a.actor}</b> {String(a.text || "").charAt(0).toLowerCase() + String(a.text || "").slice(1)} “{a.title}”</div>)}
          {!(proj.data.activity || []).length && <span className="dim">No activity yet.</span>}
        </div></div>
      )}
      {edit && <ProjectForm project={p} people={(ppl.data?.people || []).map((x) => x.username)} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); proj.reload(); onChanged(); }} />}
    </>
  );
}

function ProjectList({ ctx, onOpen, reloadKey, onChanged }) {
  const admin = allowed(ctx, "projects.manage"), me = ctx?.me?.username;
  const [scope, setScope] = useState("0"), [q, setQ] = useState(""), [create, setCreate] = useState(false);
  const { data, loading, error, reload } = useLoad(() => api.projects({ archived: scope }), [scope, reloadKey]);
  const ppl = useLoad(() => (admin ? api.people() : Promise.resolve({ people: [] })), [admin]);
  const rows = useMemo(() => (data?.projects || []).filter((p) => !q || `${p.name} ${p.description || ""}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  return (
    <>
      <div className="top">
        <h1>{admin ? "Projects" : "My projects"}</h1><span className="grow" />
        {admin && <button className="btn pri" onClick={() => setCreate(true)}>+ Create project</button>}
      </div>
      <div className="bar">
        <Seg value={scope} onChange={setScope} options={[{ value: "0", label: admin ? "All" : "My" }, { value: "1", label: "Archived" }]} />
        <input className="search" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Notice error={error} loading={loading && !data} />
      {data && (
        <div className="card tw"><table>
          <thead><tr><th>Name</th><th>Active</th><th>Performance</th><th>Members</th><th>Role</th><th>Privacy</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const pc = p.task_total ? Math.round((100 * p.task_done) / p.task_total) : 0, mine = p.members.find((m) => m.username === me);
              return (
                <tr key={p.id} onClick={() => onOpen(p.id)} style={{ cursor: "pointer" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(p.id)}>
                  <td><b>{p.name}</b><br /><span className="dim">{p.description}</span></td>
                  <td className="dim">{fmtWhen(p.last_active)}</td>
                  <td style={{ minWidth: 150 }}><div className="prog"><i style={{ width: `${pc}%` }} /></div><span className="dim mono">{pc}% · {p.task_done}/{p.task_total} done</span></td>
                  <td><Faces members={p.members} /></td>
                  <td>{mine ? (mine.role === "owner" ? "Owner" : "Member") : <span className="dim">—</span>}</td>
                  <td><span className="tag">{p.privacy}</span></td>
                </tr>
              );
            })}
            {!rows.length && <tr style={{ cursor: "default" }}><td colSpan={6} className="dim">{scope === "1" ? "No archived projects." : admin ? "No projects yet. Create one with “+ Create project”." : "You are not a member of any project yet."}</td></tr>}
          </tbody>
        </table><div className="pg"><span>Total: {rows.length}</span></div></div>
      )}
      {create && <ProjectForm people={(ppl.data?.people || []).map((x) => x.username)} onClose={() => setCreate(false)} onSaved={(p) => { setCreate(false); reload(); onChanged(); if (p) onOpen(p.id); }} />}
    </>
  );
}

export default function Projects({ ctx }) {
  const [open, setOpen] = useState(null), [rk, setRk] = useState(0);
  const bump = () => setRk((n) => n + 1);
  return open
    ? <ProjectDetail ctx={ctx} id={open} onBack={() => setOpen(null)} onChanged={bump} />
    : <ProjectList ctx={ctx} onOpen={setOpen} reloadKey={rk} onChanged={bump} />;
}
