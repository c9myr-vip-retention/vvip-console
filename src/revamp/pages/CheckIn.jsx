// Check-in: tick who logged in and who deposited, per brand and tier. Re-houses the live LoginCheck
// (same endpoints: GET/POST /api/rtn/login-check, /assign, /auto-assign), laid out like the mockup.
import { can } from "../perms.js";
import React, { useEffect, useMemo, useState } from "react";
import { Select, Seg, BrandBadge } from "../ui";
import { api, TEAMS, BRAND_ORDER, dispId, days, fmtDate, fmtRM, lcStatusColor } from "../../App.jsx";
import { bcolor, SearchBox } from "../daily/widgets.jsx";
import { Head, Empty, downloadCsv } from "../daily2/common.jsx";
import { useLive } from "../live.js";

export default function CheckIn({ ctx }) {
  const me = ctx.me || {};
  const manager = can(me, "assign.manage");
  const viewTeam = ctx.viewTeam || "B";
  const date = ctx.viewDate || "";
  const readOnly = !me.can_edit || !!ctx.isPast;
  const teamBrands = ctx.teamBrands || TEAMS[viewTeam] || BRAND_ORDER;
  const defaultBrand = () => (teamBrands.includes("SK69") ? "SK69" : teamBrands[0]);   // live pilot brand when the team has it, else the first brand the user may open

  const [d, setD] = useState(null);
  const [agent, setAgent] = useState(manager ? "" : (me.username || ""));   // "" = all agents
  const [brand, setBrand] = useState(() => defaultBrand());
  const [tier, setTier] = useState("V");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setBrand(defaultBrand()); /* eslint-disable-next-line */ }, [viewTeam]);

  const load = async (quiet) => {
    if (quiet !== true) setBusy(true);
    setErr("");
    const p = new URLSearchParams({ brand, tier });
    if (agent) p.set("agent", agent);
    if (date) p.set("date", date);
    try { setD(await api(`/api/rtn/login-check?${p}`)); }
    catch (e) { if (quiet !== true) setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [agent, date, brand, tier]);
  useLive(["checkin"], () => load(true));                         // someone ticked a login or assigned a player: it shows up here on its own

  const toggle = async (row, field) => {
    if (readOnly) return;
    const next = { ...row, [field]: row[field] ? 0 : 1 };
    setD((p) => ({ ...p, rows: p.rows.map((r) => (r.player_key === row.player_key ? next : r)) }));   // optimistic
    try {
      await api("/api/rtn/login-check", { method: "POST", body: JSON.stringify({
        date: d.date, brand: d.brand, tier_segment: d.tier, player_key: row.player_key, login: next.login, deposited: next.deposited }) });
    } catch (e) {
      setErr(e.message);
      setD((p) => ({ ...p, rows: p.rows.map((r) => (r.player_key === row.player_key ? row : r)) }));   // revert
    }
  };
  const assign = async (player_key, ag) => {
    if (!manager || !ag || readOnly) return;
    try {
      await api("/api/rtn/login-check/assign", { method: "POST", body: JSON.stringify({ brand: d.brand, tier_segment: d.tier, player_key, agent: ag }) });
      load();
    } catch (e) { setErr(e.message); }
  };
  const autoAssign = async () => {
    if (!manager || readOnly) return;
    try {
      await api("/api/rtn/login-check/auto-assign", { method: "POST", body: JSON.stringify({ brand: d.brand, tier_segment: d.tier }) });
      load();
    } catch (e) { setErr(e.message); }
  };

  // Display handle: Zyra brands show the uid, TC brands the username (same rule as the rest of the console).
  const pid = (r) => dispId({ brand, uid: r.uid, username: r.username }) || r.player_key;
  const allRows = d?.rows || [];
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? allRows.filter((r) => `${pid(r)} ${r.player_key} ${r.username || ""} ${r.group_name || ""}`.toLowerCase().includes(s)) : allRows;
    // eslint-disable-next-line
  }, [allRows, q, brand]);
  const loggedIn = allRows.filter((r) => r.login).length, deposited = allRows.filter((r) => r.deposited).length;
  const agents = d?.agents || [];
  const agentNames = agents.map((a) => a.agent);
  const setUp = agents.some((a) => a.n > 0);   // the brand has owners = it is live for check-in
  const showAgentCol = manager && agent === "";
  const unassigned = d?.unassigned || [];

  const exportCsv = () => downloadCsv(`logincheck_${d.brand}_${agent || "all"}_${d.date}.csv`,
    ["Player", "Player ID", "Agent", "Status", "Last deposit", "Login", "Deposit", "Deposit yesterday", "Filled by"],
    allRows.map((r) => [pid(r), r.player_key, r.agent, r.group_name || "", r.last_deposit || "", r.login ? "Y" : "N", r.deposited ? "Y" : "N", r.prev_deposit ?? "", r.filled_by || ""]));

  const lastDep = (r) => {
    if (!r.last_deposit) return <span className="dim">never</span>;
    const n = days(r.last_deposit, d.date);
    return <>{fmtDate(r.last_deposit)}{n != null && <span className="dim"> · {n}d</span>}</>;
  };
  const agentOpts = [{ value: "", label: `All agents · ${agents.reduce((s, a) => s + a.n, 0)}` }, ...agentNames.map((a) => ({ value: a, label: `${a} · ${agents.find((x) => x.agent === a)?.n ?? 0}` }))];
  const brandOpts = teamBrands.map((b) => ({ value: b, label: b, dot: bcolor(b) }));
  const bc = bcolor(brand);

  const sub = d && setUp
    ? `Tick who logged in and who deposited. ${loggedIn} of ${allRows.length} logged in · ${deposited} deposited`
    : "Tick who logged in and who deposited.";

  return (
    <>
      <Head title="Check-in" sub={sub} />
      <div className="bar">
        <Select value={brand} options={brandOpts} onChange={setBrand} style={{ width: 150 }} />
        <Seg value={tier} onChange={setTier} options={[{ value: "3", label: "Tier 3" }, { value: "V", label: "Tier V" }]} />
        <Select value={agent} options={agentOpts} onChange={setAgent} style={{ width: 170 }} />
        <SearchBox value={q} onChange={setQ} />
        <span className="grow" />
        {d && <span className="dim">{rows.length} players · check {d.date} · amount = yesterday's confirmed deposit</span>}
        <button className="btn sm" onClick={exportCsv} disabled={!allRows.length}>↓ CSV</button>
      </div>
      {err && <div className="d2-err">{err}</div>}
      {!d && busy && <Empty>Loading…</Empty>}
      {d && setUp && <div className="d2-prog"><i style={{ width: `${(100 * loggedIn) / Math.max(1, allRows.length)}%` }} /></div>}

      {d && !setUp && (
        <div className="card"><div className="body" style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}><b>{brand} · Tier {tier}</b> is not set up for check-in yet.</div>
          {manager ? (<>
            <div className="dim" style={{ marginBottom: 12 }}>
              {unassigned.length} Tier {tier} player{unassigned.length === 1 ? "" : "s"} ready to deal evenly across {agentNames.length} agent{agentNames.length === 1 ? "" : "s"}.</div>
            <button className="btn pri" onClick={autoAssign} disabled={readOnly || !unassigned.length}>Set up: auto-assign evenly</button>
          </>) : <div className="dim">No roster assigned here yet. Your team lead sets it up.</div>}
        </div></div>
      )}

      {d && setUp && (
        <div className="card"><div className="tw">
          <table className="d2-tbl">
            <thead><tr>
              <th>Player</th><th>Account</th><th>Last deposit</th>
              <th style={{ textAlign: "center" }}>Logged in</th><th style={{ textAlign: "center" }}>Deposited</th>
              <th className="r">Deposit yesterday</th>{showAgentCol && <th>Assigned to</th>}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player_key} className="br" style={{ "--b": bc, cursor: "default" }}>
                  <td><b className="mono">{pid(r)}</b>{r.filled_by && r.filled_by !== r.agent && <span className="dim" style={{ fontSize: 11 }}> · by {r.filled_by}</span>}
                    <div className="d2-sub"><BrandBadge brand={brand} color={bc} /><span className="dim">Tier {tier}</span></div></td>
                  <td style={{ color: lcStatusColor(r.group_name) }}>{r.group_name || "—"}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{lastDep(r)}</td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" className="chk sq" checked={!!r.login} disabled={readOnly} onChange={() => toggle(r, "login")} aria-label="Logged in" /></td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" className="chk sq" checked={!!r.deposited} disabled={readOnly} onChange={() => toggle(r, "deposited")} aria-label="Deposited" /></td>
                  <td className="r mono">{r.prev_deposit ? fmtRM(r.prev_deposit) : <span className="dim">—</span>}</td>
                  {showAgentCol && <td>{r.agent}</td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={showAgentCol ? 7 : 6} className="dim" style={{ padding: 30, textAlign: "center", cursor: "default" }}>No assigned players{q ? " match" : agent ? ` for ${agent}` : ""}.</td></tr>}
            </tbody>
          </table>
        </div></div>
      )}

      {d && setUp && manager && unassigned.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3><span className="warn">⚠ {unassigned.length} unassigned</span><span className="dim" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>New in the tier's latest roster, no owner. Auto-deals daily after the feed; deal now if you like.</span>
            <span className="grow" /><button className="btn sm" onClick={autoAssign} disabled={readOnly}>Auto-assign evenly</button></h3>
          <div className="tw"><table className="d2-tbl">
            <thead><tr><th>Player</th><th>Account</th><th className="r">Deposit</th><th>Assign to</th></tr></thead>
            <tbody>
              {unassigned.map((u) => (
                <tr key={u.player_key} className="br" style={{ "--b": bc, cursor: "default" }}>
                  <td className="mono">{pid(u)}</td>
                  <td style={{ color: lcStatusColor(u.group_name) }}>{u.group_name || "—"}</td>
                  <td className="r mono">{u.ingest_deposit != null ? fmtRM(u.ingest_deposit) : "—"}</td>
                  <td><Select value="" placeholder="Pick agent…" disabled={readOnly} options={agentNames.map((a) => ({ value: a, label: a }))} onChange={(a) => assign(u.player_key, a)} style={{ width: 150 }} /></td>
                </tr>))}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}
