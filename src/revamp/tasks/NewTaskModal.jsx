// New task popup. "Start from a template" fills title, deadline, assignee (admin only) and checklist.
// An agent can only create tasks for themselves (assignee is locked); an admin may pick anyone.
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Select, MultiSelect, DatePick, toast } from "../ui/index.jsx";
import { tapi, canAssign, todayMY, addDaysIso } from "./common.jsx";

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
  const admin = canAssign(me);                                  // may give a task to other people
  const [templates, setTemplates] = useState([]);
  const [flows, setFlows] = useState([]);
  const [tplId, setTplId] = useState("");
  const [f, setF] = useState({
    title: "", description: "", assignee: me.username, due_date: addDaysIso(todayMY(), 1), due_time: "19:00",
    project_id: initial.project_id ? String(initial.project_id) : "", est_hours: "2", observers: [], tags: "", linked_player: "", checklist: "",
    high_priority: false, flow_id: initial.flow_id || "",
  });
  const [assignees, setAssignees] = useState(() => [initial.assignee || me.username]);   // admin only: one task is created per person
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
    if (admin && t.assignee) setAssignees([t.assignee]);
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
        if (fl) { setF((x) => ({ ...x, flow_id: fl.id, assignee: fl.default_assignee || x.assignee, project_id: fl.project_id ? String(fl.project_id) : x.project_id })); if (fl.default_assignee) setAssignees([fl.default_assignee]); }
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
  const observerOpts = people.filter((p) => !(admin ? assignees : [f.assignee]).includes(p.username)).map((p) => ({ value: p.username, label: p.username }));
  // Admin only: pick people by role or team in one click (bulk assign, bulk observe)
  const groupsFor = (list) => {
    const out = [], by = (key) => [...new Set(list.map((p) => p[key]).filter(Boolean))].sort();
    for (const r of by("role")) out.push({ label: r === "agent" ? "All agents" : r === "admin" ? "All admins" : `All ${r}s`, values: list.filter((p) => p.role === r).map((p) => p.username) });
    for (const t of by("team")) out.push({ label: `Team ${t}`, values: list.filter((p) => p.team === t).map((p) => p.username) });
    return out.filter((g) => g.values.length);
  };
  const assigneeGroups = useMemo(() => (admin ? groupsFor(people) : []), [people, admin]);        // eslint-disable-line react-hooks/exhaustive-deps
  const observerGroups = useMemo(() => (admin ? groupsFor(people.filter((p) => !assignees.includes(p.username))) : []), [people, admin, assignees]);   // eslint-disable-line react-hooks/exhaustive-deps
  const projectOpts = projects.map((p) => ({ value: String(p.id), label: p.name }));

  const create = async () => {
    const title = f.title.trim();
    if (!title) { toast("Give the task a title"); return; }
    if (admin && !assignees.length) { toast("Pick at least one assignee"); return; }
    const who = admin ? (assignees.length ? assignees : [me.username]) : [me.username];
    const body = {
      title, description: f.description.trim() || undefined, assignee: who[0],
      due_date: f.due_date || undefined, due_time: f.due_date && f.due_time ? f.due_time : undefined,
      est_minutes: f.est_hours !== "" && Number(f.est_hours) > 0 ? Math.round(Number(f.est_hours) * 60) : undefined,
      project_id: f.project_id ? Number(f.project_id) : undefined, flow_id: f.flow_id ? Number(f.flow_id) : undefined,
      tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean), linked_player: f.linked_player.trim() || undefined,
      high_priority: f.high_priority ? 1 : 0, observers: f.observers,
      checklist: f.checklist.split("\n").map((s) => s.trim()).filter(Boolean), template_id: tplId ? Number(tplId) : undefined,
    };
    setSaving(true);
    try {
      let made = 0, last = null;
      for (const u of who) {
        try { const r = await tapi.createTask({ ...body, assignee: u, observers: f.observers.filter((o) => o !== u) }); made++; last = r.task; onCreated && onCreated(r.task); }
        catch (e) { if (who.length === 1) throw e; toast(`Created ${made} of ${who.length}. Stopped at ${u}: ${e.message || "failed"}`); return; }
      }
      toast(who.length > 1 ? `Created ${made} tasks, one for each of ${who.length} people` : "Task created");
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
          {admin ? (
            <label>Assignees <span className="dim">· one task is created for each person</span>
              <div><MultiSelect value={assignees} options={assigneeOpts} groups={assigneeGroups} label="Assign to" onChange={(v) => { setAssignees(v); if (v[0]) set("assignee", v[0]); }} /></div>
              <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{assignees.length ? (assignees.length <= 5 ? assignees.join(", ") : `${assignees.slice(0, 5).join(", ")} + ${assignees.length - 5} more`) : "Pick at least one person"}</div>
            </label>
          ) : (
            <label>Assignee (tasks you create are yours)
              <Select value={me.username} options={assigneeOpts} disabled onChange={() => {}} />
            </label>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            <div className="row2">
              <label>Deadline<DatePick value={f.due_date} onChange={(v) => set("due_date", v)} placeholder="Always going" /></label>
              <label>Time<Select value={f.due_time} options={TIMES} onChange={(v) => set("due_time", v)} disabled={!f.due_date} /></label>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row" }}>
              <input type="checkbox" className="chk" checked={!f.due_date}
                onChange={(e) => setF((x) => ({ ...x, due_date: e.target.checked ? "" : addDaysIso(todayMY(), 1), due_time: e.target.checked ? "" : x.due_time }))} />
              <span><b>Always going</b> <span className="dim">· no deadline, never overdue, stays on the list until someone completes it</span></span>
            </label>
          </div>
        </div>
        <div className="row2">
          <label>Project<Select value={f.project_id} placeholder="No project" options={projectOpts} onChange={(v) => set("project_id", v)} /></label>
          <label>Estimate (hours)<input className="input" type="number" min="0" step="0.5" value={f.est_hours} onChange={(e) => set("est_hours", e.target.value)} /></label>
        </div>
        <label>Observers (optional)
          <div><MultiSelect value={f.observers} options={observerOpts} groups={observerGroups} label="Add observers" onChange={(v) => set("observers", v)} /></div>
        </label>
        <div className="row2">
          <label>Tags (comma separated)<input className="input" placeholder="LPK777, Data" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></label>
          <label>Linked player (optional)<input className="input" placeholder="Player ID or username" value={f.linked_player} onChange={(e) => set("linked_player", e.target.value)} /></label>
        </div>
        <label>Checklist (optional)
          <textarea className="input" placeholder={"Check log\nCall player\nLog outcome"} value={f.checklist} onChange={(e) => set("checklist", e.target.value)} />
          <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>Break the task into small steps. Type one step per line (press Enter for the next one); each line becomes a tick box on the task. The assignee ticks them off as they go, and the task shows how many are done, like 2 of 3. Leave it empty if the task needs no steps.</span>
        </label>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row" }}><input type="checkbox" className="chk" checked={f.high_priority} onChange={(e) => set("high_priority", e.target.checked)} /> High priority</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row" }}><input type="checkbox" className="chk" checked={another} onChange={(e) => setAnother(e.target.checked)} /> Create another</label>
        </div>
        <div className="dim" style={{ fontSize: 12 }}>New tasks start as Pending. The assignee presses Start when they begin; only one task can be ongoing at a time.</div>
      </div>
    </Modal>
  );
}
