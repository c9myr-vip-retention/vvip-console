// Task efficiency. Admin: everyone or one person. Agent: "My task efficiency" (the Worker returns only their own row).
import React, { useState } from "react";
import { Select } from "../ui";
import { api, allowed, useLoad, person, Notice, Donut, LineChart, rateColor, fmtDay, fmtMin, pctText, openTask } from "../setup/common.jsx";

const RANGES = [{ value: "", label: "All time" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }];

export default function TaskEfficiency({ ctx }) {
  const admin = allowed(ctx, "analytics.view");
  const [user, setUser] = useState(""), [days, setDays] = useState("30");
  const ppl = useLoad(() => (admin ? api.people() : Promise.resolve({ people: [] })), [admin]);
  const { data, loading, error } = useLoad(() => api.efficiency(admin ? user : "", days), [admin, user, days], ["tasks"]);
  const users = data?.users || [];
  const sum = (k) => users.reduce((a, u) => a + (u[k] || 0), 0);
  const rated = users.filter((u) => u.on_time_rate !== null);
  // Overall rate: completion-weighted average of the per-person rates (a single person: their own rate).
  const w = rated.reduce((a, u) => a + Math.max(1, u.completed + u.overdue), 0);
  const overall = rated.length ? Math.round(rated.reduce((a, u) => a + u.on_time_rate * Math.max(1, u.completed + u.overdue), 0) / w) : null;
  const series = (data?.daily || []).filter((d) => d.rate !== null);
  return (
    <>
      <div className="top">
        <b style={{ fontSize: 16 }}>{admin ? "Task efficiency" : "My task efficiency"}</b><span className="grow" />
        {admin && <Select value={user} onChange={setUser} placeholder="All team" style={{ width: 160 }} options={(ppl.data?.people || []).map((p) => ({ value: p.username, label: p.username }))} />}
        <Select value={days} onChange={setDays} options={RANGES} style={{ width: 150 }} />
      </div>
      <Notice error={error} loading={loading && !data} />
      {data && (
        <>
          <div className="grid g21" style={{ marginBottom: 14 }}>
            <div className="card"><h3>Deadline compliance rate</h3>
              <div className="body" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <Donut pct={overall} color={rateColor(overall)} />
                <div className="dim">Share of finished tasks closed before their deadline.<br />Overdue tasks count against the score until completed.</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <div className="card kpi"><div className="l">Tasks in progress</div><div className="v">{sum("in_progress")}</div></div>
              <div className="grid g2">
                <div className="card kpi"><div className="l">Completed tasks</div><div className="v pos">{sum("completed")}</div></div>
                <div className="card kpi alert"><div className="l">Overdue tasks</div><div className={`v ${sum("overdue") ? "neg" : ""}`}>{sum("overdue")}</div>
                  <button className="btn sm" style={{ marginTop: 6 }} onClick={() => ctx?.goto?.("tasks")}>Details</button></div>
              </div>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 14 }}><h3>Daily deadline compliance rate</h3>
            <div className="body">{series.length > 1 ? <LineChart max={100} labels={series.map((d) => fmtDay(d.date))} series={[{ label: "On time %", color: "#56B6C2", values: series.map((d) => d.rate) }]} /> : <span className="dim">Not enough finished tasks with a deadline yet.</span>}</div>
          </div>
          {admin && (
            <div className="card"><h3>By agent</h3><div className="tw"><table>
              <thead><tr><th>Agent</th><th className="r">In progress</th><th className="r">Completed</th><th className="r">Avg time</th><th className="r">Overdue</th><th>Compliance</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username} style={{ cursor: "default" }}>
                    <td>{person(u.username)}</td><td className="r mono">{u.in_progress}</td><td className="r mono">{u.completed}</td><td className="r mono">{fmtMin(u.avg_minutes)}</td>
                    <td className={`r mono ${u.overdue ? "neg" : ""}`}>{u.overdue}</td>
                    <td style={{ minWidth: 190 }}><div className="prog"><i style={{ width: `${u.on_time_rate || 0}%`, background: rateColor(u.on_time_rate) }} /></div><span className="dim mono">{pctText(u.on_time_rate)}</span></td>
                  </tr>
                ))}
                {!users.length && <tr style={{ cursor: "default" }}><td colSpan={6} className="dim">No task data yet.</td></tr>}
              </tbody>
            </table></div></div>
          )}
          {!admin && users[0] && <p className="note">Average time per finished task: {fmtMin(users[0].avg_minutes)}. Assigned and open: {users[0].assigned}.</p>}
        </>
      )}
    </>
  );
}
