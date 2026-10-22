// Task templates. Everyone can read and "Use" one; only admins create, edit and delete (the Worker enforces it too).
import React, { useMemo, useState } from "react";
import { Modal, Select, toast } from "../ui";
import { api, allowed, useLoad, person, Notice, Confirm, newTask } from "../setup/common.jsx";

const DEADLINES = ["Same day", "1 day", "2 days", "3 days", "7 days", "No deadline"];

// Use a template: the New task popup (tasks-ui) listens for this event and prefills itself.
// If tasks-ui exports openNewTaskFromTemplate it can call it from the same listener.
export const startFromTemplate = (id) => newTask({ template_id: id });

function TemplateForm({ tpl, people, onClose, onSaved }) {
  const [f, setF] = useState({ name: tpl?.name || "", deadline: tpl?.deadline || "1 day", assignee: tpl?.assignee || "", checklist: (tpl?.checklist || []).join("\n") });
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return setErr("Give the template a name");
    setBusy(true); setErr("");
    try {
      await api.saveTemplate({ ...(tpl ? { id: tpl.id } : {}), name: f.name.trim(), deadline: f.deadline, assignee: f.assignee || null, checklist: f.checklist.split("\n").map((x) => x.trim()).filter(Boolean) });
      toast(tpl ? "Template saved" : "Template created"); onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={tpl ? "Edit template" : "Create template"} onClose={onClose} width="min(520px,94vw)"
      footer={<><button className="btn" onClick={onClose}>Cancel</button> <button className="btn pri" disabled={busy} onClick={save}>Save</button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <label>Name<input className="input" value={f.name} maxLength={120} onChange={(e) => set("name")(e.target.value)} autoFocus /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>Deadline<Select value={f.deadline} onChange={set("deadline")} options={DEADLINES.map((d) => ({ value: d, label: d }))} /></label>
          <label>Default assignee<Select value={f.assignee} onChange={set("assignee")} placeholder="Whoever uses it" options={people.map((u) => ({ value: u, label: u }))} /></label>
        </div>
        <label>Checklist <span className="dim">(one item per line)</span><textarea className="input" rows={5} value={f.checklist} onChange={(e) => set("checklist")(e.target.value)} /></label>
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

export default function Templates({ ctx, embedded }) {
  const any = allowed(ctx, "templates.manage"), own = allowed(ctx, "templates.own"), me = ctx?.me?.username;
  const admin = any || own;                                     // may create
  const mayChange = (t) => any || (own && t.created_by === me);   // "any template", or "own templates" and they made it
  const { data, loading, error, reload } = useLoad(() => api.templates(), [], ["projects"]);
  const ppl = useLoad(() => (admin ? api.people() : Promise.resolve({ people: [] })), [admin]);
  const [q, setQ] = useState(""), [edit, setEdit] = useState(null), [del, setDel] = useState(null), [busy, setBusy] = useState(false);
  const rows = useMemo(() => (data?.templates || []).filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const people = (ppl.data?.people || []).map((p) => p.username);
  const remove = async () => {
    setBusy(true);
    try { await api.deleteTemplate(del.id); toast("Template moved to the Recycle bin"); setDel(null); reload(); } catch (e) { toast(e.message); }
    setBusy(false);
  };
  return (
    <>
      <div className="top">
        {!embedded && <h1>Task templates</h1>}
        <span className="grow" />
        {admin && <button className="btn pri" onClick={() => setEdit({})}>+ Create</button>}
      </div>
      <div className="bar"><input className="search" placeholder="Find and search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Notice error={error} loading={loading && !data} />
      {data && (
        <div className="card tw">
          <table>
            <thead><tr><th>Name</th><th>Deadline</th><th>Assignee</th>{admin && <th>Created by</th>}<th></th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} style={{ cursor: "default" }}>
                  <td><b>{t.name}</b>{t.checklist.length > 0 && <><br /><span className="dim">{t.checklist.length} checklist item{t.checklist.length > 1 ? "s" : ""}</span></>}</td>
                  <td className="dim">{t.deadline}</td>
                  <td>{t.assignee ? person(t.assignee) : <span className="dim">Whoever uses it</span>}</td>
                  {admin && <td>{person(t.created_by)}</td>}
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm pri" onClick={() => startFromTemplate(t.id)}>Use</button>
                    {mayChange(t) && <> <button className="btn sm" onClick={() => setEdit(t)}>Edit</button> <button className="btn sm danger" aria-label={`Delete ${t.name}`} onClick={() => setDel(t)}>✕</button></>}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr style={{ cursor: "default" }}><td colSpan={admin ? 5 : 4} className="dim">No templates{q ? " match your search" : " yet"}.</td></tr>}
            </tbody>
          </table>
          <div className="pg"><span>Total: {rows.length}</span></div>
        </div>
      )}
      {edit && <TemplateForm tpl={edit.id ? edit : null} people={people} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {del && <Confirm title="Delete template" text={<>Move <b>{del.name}</b> to the Recycle bin? You can restore it for 30 days.</>} onCancel={() => setDel(null)} onConfirm={remove} busy={busy} />}
    </>
  );
}
