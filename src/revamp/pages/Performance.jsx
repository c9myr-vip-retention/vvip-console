// Performance, shared. Admin (key "perf"): the live Performance (KPI scorecard, mistake log, save rate by CS / class / brand) and Task efficiency.
// Agent (key "mine"): their own save rate from the same endpoint (GET /api/rtn/performance) plus their own task efficiency.
import { can } from "../perms.js";
import React, { useEffect, useMemo, useState } from "react";
import { Seg, Select, BrandBadge } from "../ui";
import { api, Performance as LivePerformance, BRANDS, CLASSES, ckey, dispName, fmt } from "../../App.jsx";
import { bcolor } from "../daily/widgets.jsx";
import { Head, Live, Empty } from "../daily2/common.jsx";
import TaskEfficiency from "./TaskEfficiency.jsx";
import NeedTeam from "./NeedTeam.jsx";

const TIER_W = { 4: 1.0, 3: 0.75, 2: 0.5, 1: 0.1 };   // comeback-depth weights, same as the live By CS Score column
const monthOptions = () => {
  const out = [], d = new Date();
  for (let i = 0; i < 6; i++) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`); }
  return out;
};

function aggBy(logs, key) {
  const m = {};
  logs.forEach((l) => {
    const k = l[key] || "—";
    const v = (m[k] = m[k] || { assigned: 0, contacted: 0, responded: 0, recovered: 0, no_response: 0 });
    if (l.status === "ASSIGNED") v.assigned++;
    else if (l.status === "CONTACTED") v.contacted++;
    else if (l.status === "RESPONDED") v.responded++;
    else if (l.status === "RECOVERED") v.recovered++;
    else if (l.status === "NO_RESPONSE") v.no_response++;
  });
  return Object.entries(m).map(([name, v]) => {
    const actioned = v.contacted + v.responded + v.recovered + v.no_response;
    return { name, ...v, actioned, save: actioned ? Math.round((100 * v.recovered) / actioned) : 0 };
  }).sort((a, b) => b.actioned - a.actioned);
}

function Block({ title, first, rows, label }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3>{title}</h3>
      <div className="tw"><table className="d2-tbl">
        <thead><tr><th>{first}</th><th className="r">Assigned</th><th className="r">Contacted</th><th className="r">Responded</th><th className="r">Recovered</th><th className="r">No resp.</th><th className="r">Actioned</th><th className="r">Save %</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ cursor: "default" }}>
              <td>{label ? label(r.name) : r.name}</td><td className="r mono">{r.assigned}</td><td className="r mono">{r.contacted}</td><td className="r mono">{r.responded}</td>
              <td className="r mono pos">{r.recovered}</td><td className="r mono">{r.no_response}</td><td className="r mono">{r.actioned}</td>
              <td className={"r mono " + (r.save >= 20 ? "pos" : r.save >= 10 ? "warn" : "neg")}>{r.save}%</td>
            </tr>))}
          {!rows.length && <tr><td colSpan="8" className="dim" style={{ padding: 22, textAlign: "center", cursor: "default" }}>Nothing logged yet.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

/** An agent's own save rate for one calendar month. */
function MyRetention({ ctx }) {
  const me = ctx.me || {};
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0]);
  const [res, setRes] = useState(null);       // { logs, reactivation } | { error }
  const [mk, setMk] = useState(null);
  useEffect(() => {
    let alive = true;
    setRes(null);
    api(`/api/rtn/performance?team=${encodeURIComponent(ctx.viewTeam || "B")}&month=${month}`)
      .then((d) => { if (alive) setRes(d); }).catch((e) => { if (alive) setRes({ error: e.message || "Could not load performance" }); });
    api(`/api/rtn/mistakes?month=${month}`).then((d) => { if (alive) setMk(d); }).catch(() => { if (alive) setMk({ mistakes: [] }); });
    return () => { alive = false; };
  }, [month, ctx.viewTeam]);

  const logs = useMemo(() => (res?.logs || []).filter((l) => l.assigned_to === me.username), [res, me.username]);
  const react = (res?.reactivation || []).filter((x) => x.agent === me.username);
  const score = Math.round(react.reduce((s, x) => s + (TIER_W[x.tier] ?? 0.1), 0) * 100) / 100;
  const tot = aggBy(logs, "assigned_to")[0] || { actioned: 0, recovered: 0, save: 0 };
  const byKey = useMemo(() => { const m = {}; (ctx.teamData || []).forEach((r) => (m[ckey(r)] = r)); return m; }, [ctx.teamData]);
  const recs = useMemo(() => {
    const seen = new Set();
    return logs.filter((l) => l.status === "RECOVERED").sort((a, b) => String(b.snapshot_date).localeCompare(String(a.snapshot_date)))
      .filter((l) => { const k = ckey(l); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  }, [logs]);
  const mine = (mk?.mistakes || []).filter((m) => m.agent === me.username);

  return (
    <>
      <div className="bar">
        <Select value={month} onChange={setMonth} style={{ width: 190 }} options={months.map((m, i) => ({ value: m, label: m + (i === 0 ? " (this month)" : "") }))} />
        <span className="grow" />
        <span className="dim">Team {ctx.viewTeam || me.team || "B"}</span>
      </div>
      {!res && <Empty>Loading performance…</Empty>}
      {res?.error && <div className="d2-err">{res.error}</div>}
      {res && !res.error && (
        <>
          <div className="d2-kpis">
            <div className="card kpi"><div className="l">Contacted</div><div className="v">{tot.actioned}</div><div className="d dim">players actioned this month</div></div>
            <div className="card kpi"><div className="l">Recovered</div><div className="v pos">{tot.recovered}</div></div>
            <div className="card kpi"><div className="l">Save %</div><div className={"v " + (tot.save >= 20 ? "pos" : tot.save >= 10 ? "warn" : "neg")}>{tot.save}%</div><div className="d dim">Recovered ÷ Actioned</div></div>
            <div className="card kpi"><div className="l">Weighted score</div><div className="v">{score.toFixed(2)}</div><div className="d dim">1-6d ×0.10 · 7-13d ×0.50 · 14-29d ×0.75 · 30+d ×1.00</div></div>
          </div>
          <div className="d2-two">
            <div>
              <Block title="By class" first="Class" rows={aggBy(logs, "class")} label={(n) => CLASSES[n]?.label || n} />
              <Block title="By brand" first="Brand" rows={aggBy(logs, "brand")} label={(n) => <span className="who"><i className="bd" style={{ background: bcolor(n) }} />{n}</span>} />
            </div>
            <div>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3>My recoveries</h3>
                <div className="body">
                  {recs.map((l) => { const p = byKey[ckey(l)]; return (
                    <div className="d2-rec" key={ckey(l) + l.snapshot_date}>
                      <BrandBadge brand={l.brand} color={bcolor(l.brand)} />
                      <b style={{ flex: 1 }}>{p ? dispName(p) : l.player_key}</b>
                      <span className="dim mono">{String(l.snapshot_date || "").slice(5)}</span>
                    </div>); })}
                  {!recs.length && <div className="dim">No recoveries logged this month.</div>}
                </div>
              </div>
              <div className="card">
                <h3>My mistakes <span className="badge">view only</span></h3>
                <div className="body">
                  {mine.map((m) => <div className="d2-rec" key={m.id}><span style={{ flex: 1 }}>{m.category}{m.note ? <span className="dim"> · {m.note}</span> : null}</span><span className="mono">{m.points} pts</span></div>)}
                  {!mine.length && <div className="dim">No mistakes logged this month.</div>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Performance({ ctx }) {
  const me = ctx.me || {};
  const admin = can(me, "teams.all");
  const [tab, setTab] = useState("ret");
  const tabs = [{ value: "ret", label: admin ? "Retention & save rate" : "My save rate" }, { value: "tasks", label: admin ? "Task efficiency" : "My task efficiency" }];
  return (
    <>
      <Head title={admin ? "Performance" : "My performance"} sub={admin ? "Team save rate, retention targets and task efficiency." : "Your save rate, recoveries and task efficiency."}>
        <Seg value={tab} onChange={setTab} options={tabs} />
      </Head>
      {tab === "tasks" ? <TaskEfficiency ctx={ctx} /> : admin && ctx.viewTeam === "ALL" ? <NeedTeam ctx={ctx} what="Retention and save rate" /> : admin ? (
        ctx.snap || ctx.board ? (
          <Live>
            <LivePerformance data={ctx.teamData || []} team={ctx.team || []} me={me} viewTeam={ctx.viewTeam || "B"} contacts={ctx.contacts || []}
              snap={ctx.snap} onSaveContact={ctx.saveContact} onClearContact={ctx.clearContact} readOnly={ctx.readOnly}
              onDrill={(brand, tier) => ctx.goto("queue", { brand, tier })} />
          </Live>
        ) : <Empty>Loading…</Empty>
      ) : <MyRetention ctx={ctx} />}
    </>
  );
}
