// Tasks: List | Deadline | Planner | Calendar | Gantt over one filtered set of tasks, the task drawer and the New task popup.
import React, { useEffect, useMemo, useState } from "react";
import { Seg, Select } from "../ui/index.jsx";
import Deadline from "./TaskViews/Deadline.jsx";
import Planner from "./TaskViews/Planner.jsx";
import Calendar from "./TaskViews/Calendar.jsx";
import Gantt from "./TaskViews/Gantt.jsx";
import TaskList from "../tasks/TaskList.jsx";
import useTaskOverlays from "../tasks/useTaskOverlays.jsx";
import { useTasksData, meOf, isAdmin, canEdit, todayMY } from "../tasks/common.jsx";

const VIEWS = { list: TaskList, deadline: Deadline, planner: Planner, cal: Calendar, gantt: Gantt };
const PRESETS = [
  ["active", "All active", (t) => t.status !== "done"],
  ["progress", "Ongoing", (t) => t.status === "progress"],
  ["over", "Overdue", (t, today) => t.status !== "done" && !!t.due_date && t.due_date < today],
  ["today", "Due today", (t, today) => t.status !== "done" && t.due_date === today],
  ["wait", "Waiting", (t) => t.status === "pending"],
  ["deferred", "Deferred", (t) => t.status === "deferred"],
  ["done", "Completed", (t) => t.status === "done"],
  ["all", "Everything", () => true],
];
const GROUPS = [["none", "Nothing"], ["project", "Project"], ["assignee", "Assignee"], ["status", "Status"], ["deadline", "Deadline"]];
const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export default function Tasks({ ctx }) {
  const me = useMemo(() => meOf(ctx), [ctx.me]);   // eslint-disable-line react-hooks/exhaustive-deps
  const admin = isAdmin(me);
  const { tasks, people, projects, loading, error, reload } = useTasksData();
  const { overlays, openTask, newTask } = useTaskOverlays({ me, people, projects, tasks, onChange: reload });
  // A notification asked for a task: open it (it may arrive before this page is on screen, or while it is).
  useEffect(() => {
    const take = (id) => { if (id) { try { sessionStorage.removeItem("rv_open_task"); } catch (e) { /* private mode */ } openTask(Number(id)); } };
    try { take(sessionStorage.getItem("rv_open_task")); } catch (e) { /* private mode */ }
    const on = (e) => take(e.detail);
    window.addEventListener("rv-open-task", on);
    return () => window.removeEventListener("rv-open-task", on);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setViewState] = useState(() => (VIEWS[read("rv_task_view", "list")] ? read("rv_task_view", "list") : "list"));
  const setView = (v) => { setViewState(v); write("rv_task_view", v); };
  const [preset, setPreset] = useState("active");
  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("");
  const [project, setProject] = useState("");
  const [group, setGroup] = useState("none");

  const today = todayMY();
  const fn = PRESETS.find((p) => p[0] === preset)[2];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => fn(t, today)
      && (!assignee || t.assignee === assignee)
      && (!project || String(t.project_id) === project)
      && (!s || t.title.toLowerCase().includes(s) || (t.tags || []).some((x) => x.toLowerCase().includes(s))));
  }, [tasks, preset, q, assignee, project, today]);   // eslint-disable-line react-hooks/exhaustive-deps
  const count = (f) => tasks.filter((t) => f(t, today)).length;
  const overdue = count(PRESETS[2][2]);

  const View = VIEWS[view];
  const peopleOpts = [...new Set([...people.map((p) => p.username), ...tasks.map((t) => t.assignee).filter(Boolean)])].sort().map((u) => ({ value: u, label: u }));

  return (
    <div>
      <div className="top">
        <h1>{admin ? "Tasks" : "My tasks"}</h1>
        <Seg value={view} onChange={setView} options={[{ value: "list", label: "List" }, { value: "deadline", label: "Deadline" }, { value: "planner", label: "Planner" }, { value: "cal", label: "Calendar" }, { value: "gantt", label: "Gantt" }]} />
        <span className="grow" />
        {canEdit(me) && <button className="btn pri" onClick={() => newTask({})}>+ New task</button>}
      </div>
      <div className="bar">
        <Select value={preset} onChange={setPreset} style={{ width: 190 }} options={PRESETS.map(([k, l, f]) => ({ value: k, label: `${l} (${count(f)})` }))} />
        <input className="search" placeholder="Search tasks or tags" value={q} onChange={(e) => setQ(e.target.value)} />
        {admin && <Select value={assignee} onChange={setAssignee} placeholder="Everyone" options={peopleOpts} style={{ width: 150 }} />}
        <Select value={project} onChange={setProject} placeholder="All projects" options={projects.map((p) => ({ value: String(p.id), label: p.name }))} style={{ width: 190 }} />
        <span className={"dl" + (overdue ? " over" : "")}>{overdue} overdue</span>
        <span className="grow" />
        {view === "list" && <label className="dim" style={{ display: "flex", alignItems: "center", gap: 8 }}>Group by <Select value={group} onChange={setGroup} options={GROUPS.map(([v, l]) => ({ value: v, label: l }))} style={{ width: 130 }} /></label>}
      </div>
      {error && <div className="banner crit">{error}</div>}
      {loading
        ? <div className="pageload">Loading…</div>
        : <View key={view} tasks={filtered} people={people} me={me} projects={projects} group={group} onOpen={openTask} onChange={reload} />}
      {overlays}
    </div>
  );
}
