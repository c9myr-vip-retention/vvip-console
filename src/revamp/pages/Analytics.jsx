// Analytics (admin). Four cards read from the tasks table through GET /api/work/analytics: plain SVG / CSS charts, no library.
import React, { useState } from "react";
import { Select } from "../ui";
import { api, allowed, useLoad, Notice, AdminOnly, LineChart, BarRows, rateColor, fmtDay, pctText } from "../setup/common.jsx";

const RANGES = [{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "365", label: "Last 12 months" }];

const Card = ({ title, sub, children }) => (
  <div className="card"><h3>{title}</h3><div className="body"><div className="dim" style={{ marginBottom: 10 }}>{sub}</div>{children}</div></div>
);

export default function Analytics({ ctx }) {
  const admin = allowed(ctx, "analytics.view");
  const [days, setDays] = useState("30");
  const { data, loading, error } = useLoad(() => (admin ? api.analytics(Number(days)) : Promise.resolve(null)), [admin, days]);
  if (!admin) return <AdminOnly what="Analytics" />;
  const weeks = data?.created_vs_completed || [];
  return (
    <>
      <div className="top">
        <h1>Analytics</h1><span className="badge admin">Admin only</span><span className="grow" />
        <Select value={days} onChange={setDays} options={RANGES} style={{ width: 160 }} />
      </div>
      <Notice error={error} loading={loading && !data} />
      {data && (
        <div className="grid g2">
          <Card title="Tasks by completion" sub="Created vs completed per week">
            <LineChart labels={weeks.map((w) => fmtDay(w.week))} series={[{ label: "Created", color: "#56B6C2", values: weeks.map((w) => w.created) }, { label: "Completed", color: "#4CC38A", values: weeks.map((w) => w.completed) }]} />
            <div className="leg"><span><i style={{ background: "#56B6C2" }} />Created</span><span><i style={{ background: "#4CC38A" }} />Completed</span></div>
          </Card>
          <Card title="Workload & efficiency" sub="Open tasks per agent · on-time rate at the right">
            <BarRows rows={data.workload.map((w) => ({ label: w.username, value: w.open, text: `${w.open} · ${pctText(w.rate)}`, color: "var(--blue)" }))} empty="No open tasks." />
          </Card>
          <Card title="Flow productivity" sub="Completed tasks per flow">
            <BarRows rows={data.flows.map((f) => ({ label: f.name, value: f.completed }))} />
          </Card>
          <Card title="Employee performance" sub="Compliance rate, ranked">
            <BarRows max={100} rows={data.compliance.map((c) => ({ label: c.username, value: c.rate ?? 0, text: pctText(c.rate), color: rateColor(c.rate) }))} />
          </Card>
        </div>
      )}
      <p className="note" style={{ marginTop: 14 }}>These reports are read straight from the tasks table. Compliance counts overdue open tasks against the score until they are completed.</p>
    </>
  );
}
