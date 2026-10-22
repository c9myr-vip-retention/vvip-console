// Page registry: sidebar key -> component. Pre-wired so parallel agents only replace their own page files.
// Every page receives ONE prop: ctx (see docs/design/BUILD-CONTRACT.md section 4).
// Performance is shared: key "perf" (admin, all tabs) and "mine" (agent, own tabs); it reads ctx.me.role.
import React, { useState } from "react";
import { Seg } from "./ui/index.jsx";
import TaskEfficiency from "./pages/TaskEfficiency.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Changes from "./pages/Changes.jsx";
import Performance from "./pages/Performance.jsx";
import Contact from "./pages/Contact.jsx";
import CheckIn from "./pages/CheckIn.jsx";
import GraceClaims from "./pages/GraceClaims.jsx";
import Players from "./pages/Players.jsx";
import Assignments from "./pages/Assignments.jsx";
import Tasks from "./pages/Tasks.jsx";
import Schedule from "./pages/Schedule.jsx";
import Projects from "./pages/Projects.jsx";
import Flows from "./pages/Flows.jsx";
import Templates from "./pages/Templates.jsx";
import TeamWorkload from "./pages/TeamWorkload.jsx";
import Analytics from "./pages/Analytics.jsx";
import RecycleBin from "./pages/RecycleBin.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import MyDay from "./pages/MyDay.jsx";
import AccountPage from "./pages/AccountPage.jsx";

// Mockup: Performance has two tabs, "Retention & save rate" and "Task efficiency" (agent: "My ..."). Kept here so both pages stay independent.
function PerfTabs({ ctx }) {
  const admin = !!ctx.me?.manage_users;
  const [t, setT] = useState("ret");
  const h = React.createElement;
  return h(React.Fragment, null,
    h("div", { className: "top", style: { marginBottom: 10 } }, h("span", { className: "grow" }),
      h(Seg, { value: t, onChange: setT, options: [{ value: "ret", label: admin ? "Retention & save rate" : "My save rate" }, { value: "tasks", label: admin ? "Task efficiency" : "My task efficiency" }] })),
    t === "ret" ? h(Performance, { ctx }) : h(TaskEfficiency, { ctx }));
}

export const PAGES = {
  dash: Dashboard,
  delta: Changes,
  perf: PerfTabs,
  queue: Contact,
  checkin: CheckIn,
  grace: GraceClaims,
  players: Players,
  assign: Assignments,
  tasks: Tasks,
  sched: Schedule,
  proj: Projects,
  flows: Flows,
  tpl: Templates,
  team: TeamWorkload,
  ana: Analytics,
  bin: RecycleBin,
  set: SettingsPage,
  home: MyDay,
  mine: PerfTabs,
  eff: TaskEfficiency,   // direct key; not a sidebar item (the mockup reaches it through the Performance tabs)
  acct: AccountPage,
};
