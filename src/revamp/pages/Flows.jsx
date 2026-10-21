// Flows (admin): a pipeline for one type of recurring work. Rows show live counts from the tasks table.
import React, { useState } from "react";
import { Modal, Select, toast } from "../ui";
import { api, isAdmin, useLoad, person, Notice, AdminOnly, Confirm, newTask, fmtWhen, pctText } from "../setup/common.jsx";

const RATING_COLOR = { Excellent: "#4CC38A", Good: "#E8C547", "Needs attention": "#F2727F", "No data": "#8B94A7" };

function FlowForm({ flow, people, projects, onClose, onSaved }) {
  const [f, setF] = useState({ name: flow?.name || "", project_id: flow?.project_id ? String(flow.project_id) : "", admin_user: flow?.admin_user || "", default_assignee: flow?.default_assignee || "" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return setErr("Give the flow a name");
    setBusy(true); setErr("");
    try {
      await api.saveFlow({ ...(flow ? { id: flow.id } : {}), name: f.name.trim(), project_id: f.project_id ? Number(f.project_id) : null, admin_user: f.admin_user || null, default_assignee: f.default_assignee || null });
      toast(flow ? "Flow saved" : "Flow created"); onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const users = people.map((u) => ({ value: u, label: u }));
  return (
    <Modal title={flow ? "Edit flow" : "New flow"} onClose={onClose} width="min(520px,94vw)"
      footer={<><button className="btn" onClick={onClose}>Cancel</button> <button className="btn pri" disabled={busy} onClick={save}>Save</button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <label>Name<input className="input" value={f.name} maxLength={120} onChange={(e) => set("name")(e.target.value)} autoFocus /></label>
        <label>Project<Select value={f.project_id} onChange={set("project_id")} placeholder="Ad hoc (no project)" options={projects.map((p) => ({ value: String(p.id), label: p.name }))} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>Flow administrator<Select value={f.admin_user} onChange={set("admin_user")} placeholder="None" options={users} /></label>
          <label>Default assignee<Select value={f.default_assignee} onChange={set("default_assignee")} placeholder="None" options={users} /></label>
        </div>
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

export default function Flows({ ctx, embedded }) {
  const admin = isAdmin(ctx);
  const { data, loading, error, reload } = useLoad(() => (admin ? api.flows() : Promise.resolve(null)), [admin]);
  const ref = useLoad(() => (admin ? Promise.all([api.people(), api.projects({ archived: 0 })]) : Promise.resolve(null)), [admin]);
  const [edit, setEdit] = useState(null), [del, setDel] = useState(null), [busy, setBusy] = useState(false);
  if (!admin) return <AdminOnly what="Flows" />;
  const people = (ref.data?.[0]?.people || []).map((p) => p.username), projects = ref.data?.[1]?.projects || [];
  const remove = async () => {
    setBusy(true);
    try { await api.deleteFlow(del.id); toast("Flow moved to the Recycle bin"); setDel(null); reload(); } catch (e) { toast(e.message); }
    setBusy(false);
  };
  const flows = data?.flows || [];
  return (
    <>
      <div className="top">
        {!embedded && <h1>Flows</h1>}
        {!embedded && <span className="badge admin">Admin</span>}
        <span className="grow" />
        <button className="btn pri" onClick={() => setEdit({})}>+ New flow</button>
      </div>
      <p className="dim" style={{ marginBottom: 12 }}>A flow is a pipeline for one type of recurring work. Anyone creates a task into a flow; the flow decides who gets it.</p>
      <Notice error={error} loading={loading && !data} />
      {data && (
        <div className="card tw">
          <table>
            <thead><tr><th>Name</th><th>Last task</th><th>Action</th><th className="r">Pending</th><th className="r">In progress</th><th className="r">Completed</th><th className="r">Efficiency</th><th>Rating</th><th>Flow administrator</th><th></th></tr></thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.id} style={{ cursor: "default" }}>
                  <td><b>{f.name}</b><br /><span className="dim">{f.project_name ? `Project: ${f.project_name}` : "Ad hoc"}</span></td>
                  <td className="dim">{f.last_task_at ? fmtWhen(f.last_task_at) : "No tasks yet"}</td>
                  <td><button className="btn sm" onClick={() => newTask({ flow_id: f.id })}>Create task</button></td>
                  <td className="r mono">{f.pending}</td><td className="r mono">{f.in_progress}</td><td className="r mono">{f.completed}</td>
                  <td className="r mono">{pctText(f.efficiency)}</td>
                  <td><span className="pill" style={{ "--c": RATING_COLOR[f.rating] || RATING_COLOR["No data"] }}>{f.rating}</span></td>
                  <td>{f.admin_user ? person(f.admin_user) : <span className="dim">—</span>}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}><button className="btn sm" onClick={() => setEdit(f)}>Edit</button> <button className="btn sm danger" aria-label={`Delete ${f.name}`} onClick={() => setDel(f)}>✕</button></td>
                </tr>
              ))}
              {!flows.length && <tr style={{ cursor: "default" }}><td colSpan={10} className="dim">No flows yet. Create one with “+ New flow”.</td></tr>}
            </tbody>
          </table>
          <div className="pg"><span>Total: {flows.length}</span></div>
        </div>
      )}
      {edit && <FlowForm flow={edit.id ? edit : null} people={people} projects={projects} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {del && <Confirm title="Delete flow" text={<>Move <b>{del.name}</b> to the Recycle bin? Its tasks are kept. You can restore the flow for 30 days.</>} onCancel={() => setDel(null)} onConfirm={remove} busy={busy} />}
    </>
  );
}
