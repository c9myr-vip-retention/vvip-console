// DEV ONLY. Not registered anywhere and not part of the build. Open /src/revamp/taskviews/harness.html with `npm run dev`.
// Query: ?view=deadline|planner|cal|gantt  &role=admin|agent|viewer  &user=sara
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Deadline from "../pages/TaskViews/Deadline.jsx";
import Planner from "../pages/TaskViews/Planner.jsx";
import Calendar from "../pages/TaskViews/Calendar.jsx";
import Gantt from "../pages/TaskViews/Gantt.jsx";
import { Seg } from "../ui/index.jsx";
import { MOCK_PEOPLE, mockTasks } from "./fixtures.js";
import "./harness.css";

localStorage.setItem("revamp_mock", "1");
const V = { deadline: Deadline, planner: Planner, cal: Calendar, gantt: Gantt };
const q = new URLSearchParams(location.search);

function App() {
  const [view, setView] = useState(q.get("view") || "deadline");
  const [, bump] = useState(0);
  const role = q.get("role") || "admin", user = q.get("user") || (role === "admin" ? "aldo" : "sara");
  const me = { username: user, role: role === "admin" ? "admin" : "agent", manage_users: role === "admin" ? 1 : 0, can_edit: role !== "viewer" };
  const all = mockTasks();
  const tasks = me.manage_users ? all : all.filter((t) => t.assignee === user || t.owner === user);
  const View = V[view], opened = useState(null);
  return (
    <div style={{ padding: 20 }}>
      <div className="top" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20 }}>Tasks</h1>
        <Seg value={view} onChange={setView} options={[{ value: "deadline", label: "Deadline" }, { value: "planner", label: "Planner" }, { value: "cal", label: "Calendar" }, { value: "gantt", label: "Gantt" }]} />
        <span style={{ color: "var(--dim)" }}>{user} ({role}) · {tasks.length} tasks</span>
        <span id="opened" style={{ marginLeft: "auto", color: "var(--dim)" }}>{opened[0] ? `opened #${opened[0]}` : ""}</span>
      </div>
      <View key={view} tasks={tasks} people={MOCK_PEOPLE} me={me} onOpen={(id) => opened[1](id)} onChange={() => bump((n) => n + 1)} />
      <div id="toasts" />
    </div>
  );
}
window.addEventListener("rv-toast", (e) => { const d = document.createElement("div"); d.className = "t"; d.textContent = e.detail; document.getElementById("toasts").appendChild(d); setTimeout(() => d.remove(), 2500); });
createRoot(document.getElementById("root")).render(<App />);
