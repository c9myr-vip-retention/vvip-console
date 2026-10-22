// New task popup. "Start from a template" fills title, deadline, assignee (admin only) and checklist.
// An agent can only create tasks for themselves (assignee is locked); an admin may pick anyone.
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Select, MultiSelect, DatePick, toast } from "../ui/index.jsx";
import { tapi, isAdmin, todayMY, addDaysIso } from "./common.jsx";

const TIMES = (() => { const o = [{ value: "", label: "No time" }]; for (let h = 7; h <= 23; h++) for (const m of ["00", "30"]) { const v = `${String(h).padStart(2, "0")}:${m}`; o.push({ value: v, label: `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "am" : "pm"}` }); } return o; })();

/** "Same day" | "1 day" | "7 days" | "No deadline" -> days from today, or null. */
export function deadlineDays(text) {
  const s = String(text || "").toLowerCase();
  if (!s || s.includes("no deadline")) return null;
  if (s.includes("same")) return 0;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** props: me, people, projects, initial {template_id|flow_id|project_id|assignee}, onClose(), onCreated(task) */
export default function NewTaskModal({ me, people = [], projects = [], initial = {}, onClose, onCreated }) {
  const admin = isAdmin(me);
  const [templates, setTemplates] = useState([]);
  const [flows, setFlows] = useState([]);
  const [tplId, setTplId] = useState("");
  const [f, setF] = useState({
    title: "", description: "", assignee: me.username, due_date: addDaysIso(todayMY(), 1), due_time: "19:00",
    project_id: initial.project_id ? String(initial.project_id) : "", est_hours: "2", observers: [], tags: "", linked_player: "", checklist: "",
    high_priority: false, flow_id: initial.flow_id || "",
  });
  const [another, setAnother] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const applyTemplate = (t) => {
    if (!t) return;
    const days = deadlineDays(t.deadline);
    setF((x) => ({
      ...x, title: t.name, checklist: (t.checklist || []).join("\n"),
      due_date: days === null ? "" : addDaysIso(todayMY(), days), due_time: t.due_time || "",   // a template has no time unless it sets one
      assignee: admin && t.assignee ? t.assignee : x.assignee,
    }));
  };

  useEffect(() => {
    let off = false;
    tapi.templates().then((r) => {
      if (off) return;
      const list = r.templates || []; setTemplates(list);
      if (initial.template_id) { const t = list.find((x) => Number(x.id) === Number(initial.template_id)); if (t) { setTplId(String(t.id)); applyTemplate(t); } }
    }).catch(() => {});
    if (initial.flow_id && admin) {
      tapi.flows().then((r) => {
        if (off) return;
        const fl = (r.flows || []).find((x) => Number(x.id) === Number(initial.flow_id));
        setFlows(r.flows || []);
        if (fl) setF((x) => ({ ...x, flow_id: fl.id, assignee: fl.default_assignee || x.assignee, project_id: fl.project_id ? String(fl.project_id) : x.project_id }));
      }).catch(() => {});
    }
    return () => { off = true; };
    // eslint-disable-next-line
  }, []);

  const flowName = flows.find((x) => Number(x.id) === Number(f.flow_id))?.name;
  const nameOf = (u) => u;
  const assigneeOpts = useMemo(() => {
    const names = new Set([me.username]);
    if (admin) people.forEach((p) => names.add(p.username));
    return [...names].sort((a, b) => (a === me.username ? -1 : b === me.username ? 1 : a.localeCompare(b))).map((u) => ({ value: u, label: nameOf(u) + (u === me.username ? " (me)" : "") }));
  }, [people, me, admin]);
  const observerOpts = people.filter((p) => p.username !== f.assignee).map((p) => ({ value: p.username, label: p.username }));
  const projectOpts = projects.map((p) => ({ value: String(p.id), label: p.name }));

  const create = async () => {
    const title = f.title.trim();
    if (!title) { toast("Give the task a title"); return; }
    const body = {
      title, description: f.description.trim() || undefined, assignee: admin ? f.assignee : me.username,
      due_date: f.due_date || undefined, due_time: f.due_date && f.due_time ? f.due_time : undefined,
      est_minutes: f.est_hours !== "" && Number(f.est_hours) > 0 ? Math.round(Number(f.est_hours) * 60) : undefined,
      project_id: f.project_id ? Number(f.project_id) : undefined, flow_id: f.flow_id ? Number(f.flow_id) : undefined,
      tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean), linked_player: f.linked_player.trim() || undefined,
      high_priority: f.high_priority ? 1 : 0, observers: f.observers,
      checklist: f.checklist.split("\n").map((s) => s.trim()).filter(Boolean), template_id: tplId ? Number(tplId) : undefined,
    };
    setSaving(true);
    try {
      const r = await tapi.createTask(body);
      toast("Task created");
      onCreated && onCreated(r.task);
      if (another) setF((x) => ({ ...x, title: "", description: "", checklist: "", tags: "", linked_player: "", high_priority: false }));
      else onClose();
    } catch (e) { toast(e.message || "Could not create the task"); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={tplId ? "New task from template" : "New task"} onClose={onClose} width="min(720px,94vw)"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={saving} onClick={create}>{saving ? "Creating…" : "Create task"}</button></>}>
      <div style={{ display: "grid", gap: 12, maxHeight: "68vh", overflow: "auto", paddingRight: 2 }}>
        <label>Start from a template (optional)
          <Select value={tplId} placeholder="No template, start blank" options={templates.map((t) => ({ value: String(t.id), label: t.name }))}
            onChange={(v) => { setTplId(v); if (v) applyTemplate(templates.find((t) => String(t.id) === v)); }} />
        </label>
        {flowName && <div className="dim" style={{ fontSize: 12 }}>Flow: <b style={{ color: "var(--txt)" }}>{flowName}</b></div>}
        <label>Title<input className="input" autoFocus placeholder="What needs doing?" value={f.title} onChange={(e) => set("title", e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") create(); }} /></label>
        <label>Description<textarea className="input" placeholder="Details, links, what done looks like" value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
        <div className="row2">
          <label>Assignee{!admin && " (tasks you create are yours)"}
            <Select value={admin ? f.assignee : me.username} options={assigneeOpts} disabled={!admin} onChange={(v) => set("assignee", v)} />
          </label>
          <div className="row2">
            <label>Deadline<DatePick value={f.due_date} onChange={(v) => set("due_date", v)} placeholder="No deadline" /></label>
            <label>Time<Select value={f.due_time} options={TIMES} onChange={(v) => set("due_time", v)} disabled={!f.due_date} /></label>
          </div>
        </div>
        <div className="row2">
          <label>Project<Select value={f.project_id} placeholder="No project" options={projectOpts} onChange={(v) => set("project_id", v)} /></label>
          <label>Estimate (hours)<input className="input" type="number" min="0" step="0.5" value={f.est_hours} onChange={(e) => set("est_hours", e.target.value)} /></label>
        </div>
        <label>Observers (optional)
          <div><MultiSelect value={f.observers} options={observerOpts} label="Add observers" onChange={(v) => set("observers", v)} /></div>
        </label>
        <div className="row2">
          <label>Tags (comma separated)<input className="input" placeholder="LPK777, Data" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></label>
          <label>Linked player (optional)<input className="input" placeholder="Player ID or username" value={f.linked_player} onChange={(e) => set("linked_player", e.target.value)} /></label>
        </div>
        <label>Checklist (one item per line)<textarea className="input" placeholder={"Check log\nCall player\nLog outcome"} value={f.checklist} onChange={(e) => set("checklist", e.target.value)} /></label>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row" }}><input type="checkbox" className="chk" checked={f.high_priority} onChange={(e) => set("high_priority", e.target.checked)} /> High priority</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row" }}><input type="checkbox" className="chk" checked={another} onChange={(e) => setAnother(e.target.checked)} /> Create another</label>
        </div>
        <div className="dim" style={{ fontSize: 12 }}>New tasks start as Pending. The assignee presses Start when they begin; only one task can be ongoing at a time.</div>
      </div>
    </Modal>
  );
}
