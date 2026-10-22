// DEV ONLY. Not registered anywhere and not part of the build. Open /src/revamp/tasks/harness.html with `npm run dev`.
// Query: ?page=tasks|home|team  &role=admin|agent|viewer  &user=sara  &view=list|deadline|planner|cal|gantt
import React from "react";
import { createRoot } from "react-dom/client";
import "../revamp.css";
import "./harness.css";
import { ToastHost } from "../ui/index.jsx";
import Tasks from "../pages/Tasks.jsx";
import MyDay from "../pages/MyDay.jsx";
import TeamWorkload from "../pages/TeamWorkload.jsx";

const q = new URLSearchParams(location.search);
const role = q.get("role") || "admin", user = q.get("user") || (role === "admin" ? "aldo" : "sara");
const me = { username: user, role: role === "admin" ? "admin" : "agent", manage_users: role === "admin" ? 1 : 0, can_edit: role !== "viewer", team: "B" };
localStorage.setItem("revamp_mock", "1");
localStorage.setItem("revamp_mock_me", JSON.stringify(me));
if (q.get("view")) localStorage.setItem("rv_task_view", q.get("view"));
const PAGES = { tasks: Tasks, home: MyDay, team: TeamWorkload };
const Page = PAGES[q.get("page") || "tasks"];
const ctx = { me, goto: (k) => console.log("goto", k) };

createRoot(document.getElementById("root")).render(
  <div className="rv" style={{ height: "100vh" }}>
    <div className="app" style={{ gridTemplateColumns: "1fr" }}>
      <div className="colmain"><main className="main"><Page ctx={ctx} /></main></div>
    </div>
    <ToastHost />
  </div>
);
