// DEV ONLY. Not registered anywhere and not part of the build. Open /src/revamp/taskviews/harness.html with `npm run dev`.
// Query: ?view=deadline|planner|cal|gantt  &role=admin|agent|viewer  &user=sara
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Deadline from "../pages/TaskViews/Deadline.jsx";
import Planner from "../pages/TaskViews/Planner.jsx";
import Calendar from "../pages/TaskViews/Calendar.jsx";
import Gantt from "../pages/TaskViews/Gantt.jsx";
import { Seg, ToastHost } from "../ui/index.jsx";
import { MOCK_PEOPLE, mockTasks } from "./fixtures.js";
import "../revamp.css";
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
    <div className="rv"><div className="app" style={{ gridTemplateColumns: "minmax(0,1fr)" }}><div className="colmain"><main className="main">
      <div className="top">
        <h1>Tasks</h1>
        <Seg value={view} onChange={setView} options={[{ value: "deadline", label: "Deadline" }, { value: "planner", label: "Planner" }, { value: "cal", label: "Calendar" }, { value: "gantt", label: "Gantt" }]} />
        <span className="dim">{user} ({role}) · {tasks.length} tasks</span>
        <span id="opened" className="dim grow" style={{ textAlign: "right" }}>{opened[0] ? `opened #${opened[0]}` : ""}</span>
      </div>
      <View key={view} tasks={tasks} people={MOCK_PEOPLE} me={me} onOpen={(id) => opened[1](id)} onChange={() => bump((n) => n + 1)} />
    </main></div></div><ToastHost /></div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
