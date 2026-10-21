// Dev-only entry for harness.html (see there). Logs in as admin1/agent1/viewer1 (password123, local test users from scripts/test-schedule-api.mjs),
// or uses the fixtures when localStorage.revamp_mock === "1" (then no login happens).
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Schedule from "../pages/Schedule.jsx";
import { http } from "../api/work.js";

function App() {
  const role = new URLSearchParams(location.search).get("role") || "admin";
  const [me, setMe] = useState(null);
  useEffect(() => {
    const mock = localStorage.getItem("revamp_mock") === "1";
    if (mock) {
      setMe({ username: role === "admin" ? "aldo" : "sara", role: role === "admin" ? "admin" : "agent", manage_users: role === "admin", can_edit: role !== "viewer" });
      return;
    }
    const user = { admin: "admin1", agent: "agent1", viewer: "viewer1" }[role];
    http("/api/login", { method: "POST", body: JSON.stringify({ username: user, password: "password123" }) }).then((r) => {
      localStorage.setItem("session_token", r.token);
      setMe({ username: r.username, role: r.role, manage_users: r.manage_users, can_edit: r.can_edit });
    });
  }, [role]);
  return me ? <Schedule ctx={{ me }} /> : null;
}
createRoot(document.getElementById("root")).render(<App />);
