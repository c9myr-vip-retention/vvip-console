// Assignments (admin): hand players to agents and keep the contact target on track.
// Re-houses the live Assigned view: contact parity + double-contact guard (ParityBar, DupeCard), the daily deal (auto-assign, next batch,
// dry run) and the live per-agent lists. Manual / even assignment writes contact_log rows through ctx.saveContact, like the live Queue.
import React, { useEffect, useMemo, useState } from "react";
import { Seg, Select, toast } from "../ui";
import { api, AssignedView, AAStyle, ParityBar, DupeCard, DryRunCard, ckey, fmt, fmtK, tap } from "../../App.jsx";
import { useDailyBase } from "../daily/hooks.js";
import { stageOf, isActioned, assignPayload, buildBands, sortPriority } from "../daily/logic.js";
import { Banners, ClassPill, SearchBox, PlayerName, bcolor } from "../daily/widgets.jsx";
import { Head, Live, PCell, Empty } from "../daily2/common.jsx";

const SHOW = 60;

/** The overview body: parity, yesterday, double-contacted, load by agent, unassigned players. Embedded by Team workload too. */
export function AssignmentsPanel({ ctx }) {
  const base = useDailyBase(ctx);
  const { snap, data, contacts, contactMap, team, readOnly, me } = base;
  const viewTeam = ctx.viewTeam || "B";
  const [deal, setDeal] = useState(null);              // GET /api/rtn/auto-assign
  const [batch, setBatch] = useState(1);
  const [dealBusy, setDealBusy] = useState(false);
  const [dealErr, setDealErr] = useState("");
  const [rate, setRate] = useState(null);              // GET /api/rtn/contact-rate (month's parity)
  const [dry, setDry] = useState(null);
  const [dryBusy, setDryBusy] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);

  useEffect(() => { setBatch(1); }, [viewTeam]);
  useEffect(() => {
    let alive = true;
    setDealBusy(true); setDealErr("");
    api(`/api/rtn/auto-assign?team=${encodeURIComponent(viewTeam)}&batch=${batch}`)
      .then((d) => { if (alive) setDeal(d); }).catch((e) => { if (alive) setDealErr(e.message); })
      .finally(() => { if (alive) setDealBusy(false); });
    return () => { alive = false; };
  }, [viewTeam, batch]);
  useEffect(() => {
    let alive = true;
    api(`/api/rtn/contact-rate?team=${encodeURIComponent(viewTeam)}`).then((d) => { if (alive) setRate(d); }).catch(() => { if (alive) setRate(null); });
    return () => { alive = false; };
  }, [viewTeam]);
  const runDry = () => {
    setDryBusy(true); setDry(null);
    api("/api/rtn/auto-assign/run?dry=1", { method: "POST" }).then(setDry).catch((e) => setDry({ error: e.message })).finally(() => setDryBusy(false));
  };

  // Agents of this team (the live Assigned view calls them PICs).
  const agents = useMemo(() => {
    const names = new Set((deal?.pics || []));
    team.filter((t) => t.role !== "admin").forEach((t) => names.add(t.username));
    return [...names].sort();
  }, [deal, team]);
  const cap = deal?.cap || 15;

  const mine = (a) => data.filter((r) => contactMap[ckey(r)]?.assigned_to === a);
  const per = agents.map((a) => {
    const m = mine(a);
    return { a, n: m.length, todo: m.filter((r) => stageOf(contactMap[ckey(r)]) === "todo").length, wait: m.filter((r) => stageOf(contactMap[ckey(r)]) === "wait").length, done: m.filter((r) => stageOf(contactMap[ckey(r)]) === "done").length };
  });

  // Unassigned = nobody owns it yet and it is on the action list (the quiet / healthy band is left alone).
  const unassigned = useMemo(() => {
    const free = data.filter((r) => !contactMap[ckey(r)]?.assigned_to && !isActioned(contactMap[ckey(r)]));
    const b = buildBands(sortPriority(free));
    return [...b.ACT, ...b.TODAY, ...b.WINBACK];
  }, [data, contactMap]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [to, setTo] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [work, setWork] = useState(null);              // { done, total } while assigning
  useEffect(() => { if (!to && agents.length) setTo(agents[0]); }, [agents, to]);
  const needle = q.trim().toLowerCase();
  const list = needle ? unassigned.filter((r) => `${r.username || ""} ${r.uid || ""} ${r.addressing || ""} ${r.brand}`.toLowerCase().includes(needle)) : unassigned;
  const shown = showAll ? list : list.slice(0, SHOW);
  const allTicked = list.length > 0 && list.every((r) => sel.has(ckey(r)));
  const toggleAll = () => setSel((s) => { const n = new Set(s); if (allTicked) list.forEach((r) => n.delete(ckey(r))); else list.forEach((r) => n.add(ckey(r))); return n; });
  const toggle = (r) => setSel((s) => { const n = new Set(s); const k = ckey(r); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const run = async (jobs) => {   // jobs: [[row, agent]]
    if (readOnly || work || !jobs.length) return;
    setWork({ done: 0, total: jobs.length });
    let ok = 0, bad = "";
    for (const [r, a] of jobs) {
      try { await base.saveContact(assignPayload(r, snap, contactMap[ckey(r)], a)); ok++; }
      catch (e) { bad = e.message || "error"; }
      setWork((w) => w && { ...w, done: w.done + 1 });
    }
    setWork(null); setSel(new Set());
    toast(bad ? `Assigned ${ok} of ${jobs.length}. Stopped on: ${bad}` : `Assigned ${ok} player${ok === 1 ? "" : "s"}`);
  };
  const assignSel = () => { if (!to) return; run(unassigned.filter((r) => sel.has(ckey(r))).map((r) => [r, to])); };
  const evenly = () => {   // deal the selection (or everyone unassigned) round-robin, always to the agent with the lightest load
    if (!agents.length) return;
    const load = Object.fromEntries(per.map((p) => [p.a, p.n]));
    const pool = sel.size ? unassigned.filter((r) => sel.has(ckey(r))) : unassigned;
    const jobs = pool.map((r) => { const a = agents.reduce((m, x) => (load[x] < load[m] ? x : m), agents[0]); load[a]++; return [r, a]; });
    run(jobs);
  };

  // Yesterday (everyone): from the contact log of the previous snapshot.
  const yday = ctx.dates && ctx.dates[1] && ctx.dates[1].snapshot_date;
  const yc = contacts.filter((c) => c.snapshot_date === yday && (c.assigned_to || c.updated_by));
  const yCon = yc.filter((c) => ["CONTACTED", "RESPONDED", "NO_RESPONSE", "RECOVERED"].includes(c.status)).length;
  const yRes = yc.filter((c) => ["RESPONDED", "RECOVERED"].includes(c.status)).length;
  const yRec = yc.filter((c) => c.status === "RECOVERED").length;
  const dupes = rate ? (rate.overcontact_total || (rate.overcontact || []).length) : 0;

  return (
    <>
      <div className="bar">
        {deal && <span className="dim">{deal.team ? `Team ${deal.team} · ` : ""}{deal.snapshot} · {deal.batch > 1 ? `${deal.batch} batches · ` : ""}cap {deal.cap} per agent</span>}
        <span className="grow" />
        {deal && deal.batch < (deal.max_batch || 4) && (
          <button className="btn" disabled={dealBusy} onClick={() => setBatch((b) => b + 1)} title={`Add another ${deal.batch_size || 30} players to today's list`}>+ Open next batch ({deal.batch_size || 30})</button>)}
        <button className="btn" onClick={runDry} disabled={dryBusy} title="Work out today's assignment for every team and show the counts. Saves nothing.">{dryBusy ? "…" : "Dry run"}</button>
      </div>
      {dealErr && <div className="d2-err">Couldn't load today's deal: {dealErr}</div>}
      <Live>
        <AAStyle />
        {dry && <DryRunCard dry={dry} onClose={() => setDry(null)} />}
        {dupOpen && rate && <DupeCard rows={rate.overcontact || []} total={rate.overcontact_total || 0} onClose={() => setDupOpen(false)} />}
        <ParityBar d={rate} onDupes={() => setDupOpen(true)} />
      </Live>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="l">Yesterday · {yday || "—"}</div>
          <div className="d" style={{ marginTop: 10 }}>Contacted <b>{yCon}</b> · Responded <b>{yRes}</b> · <span className="pos">Recovered <b>{yRec}</b></span></div></div>
        <div className={"card kpi tile" + (dupes ? " alert" : "")} {...tap(() => rate && setDupOpen(true), null)}>
          <div className="l">Double-contacted</div><div className={"v" + (dupes ? " warn" : "")}>{dupes}</div><div className="d dim">{dupes ? "Tap to see who" : "Nobody this week"}</div></div>
        <div className="card kpi"><div className="l">Unassigned on the action list</div><div className="v">{unassigned.length}</div><div className="d dim">{agents.length} agent{agents.length === 1 ? "" : "s"} on this team</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>By agent</h3>
        <div className="tw"><table className="d2-tbl">
          <thead><tr><th>Agent</th><th className="r">Assigned</th><th className="r">To contact</th><th className="r">Waiting</th><th className="r">Done</th><th>Load (cap {cap})</th></tr></thead>
          <tbody>
            {per.map((r) => (
              <tr key={r.a} style={{ cursor: "default" }}>
                <td>{r.a}</td><td className="r mono">{r.n}</td><td className="r mono">{r.todo}</td><td className="r mono">{r.wait}</td><td className="r mono pos">{r.done}</td>
                <td className="d2-load"><div className={"d2-prog" + (r.n > cap ? " over" : "")}><i style={{ width: `${Math.min(100, (100 * r.n) / cap)}%` }} /></div></td>
              </tr>))}
            {!per.length && <tr><td colSpan="6" className="dim" style={{ padding: 24, textAlign: "center", cursor: "default" }}>No agents set up on Team {viewTeam} yet. Add them in Settings (role agent, team {viewTeam}).</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h3>Unassigned players · {unassigned.length}</h3>
        <div className="bar" style={{ padding: "0 14px", margin: "10px 0 6px" }}>
          <SearchBox value={q} onChange={setQ} />
          <span className="dim">Assign selected to</span>
          <Select value={to} onChange={setTo} options={agents.map((a) => ({ value: a, label: a }))} style={{ width: 150 }} />
          <button className="btn sm" disabled={readOnly || !sel.size || !to || !!work} onClick={assignSel}>Assign{sel.size ? ` ${sel.size}` : ""}</button>
          <span className="grow" />
          {work && <span className="dim">Assigning {work.done} of {work.total}…</span>}
          <button className="btn sm pri" disabled={readOnly || !unassigned.length || !agents.length || !!work} onClick={evenly}
            title={sel.size ? "Deal the ticked players evenly across the agents" : "Deal every unassigned player evenly across the agents"}>Auto-assign evenly{sel.size ? ` (${sel.size})` : ""}</button>
        </div>
        <div className="tw"><table className="d2-tbl">
          <thead><tr><th style={{ width: 34 }}><input type="checkbox" className="chk sq" checked={allTicked} onChange={toggleAll} aria-label="Tick all" /></th>
            <th>Player</th><th>Type</th><th className="r">Value</th><th className="r">Days quiet</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={ckey(r)} className="br" style={{ "--b": bcolor(r.brand), cursor: "default" }}>
                <td><input type="checkbox" className="chk sq" checked={sel.has(ckey(r))} onChange={() => toggle(r)} aria-label="Tick player" /></td>
                <td><PCell id={<PlayerName r={r} />} brand={r.brand} tier={r.tier_segment} /></td>
                <td><ClassPill k={r._cls} /></td>
                <td className="r mono">{fmtK(Math.abs(Number(r.pnl) || 0))}</td>
                <td className="r mono">{r._dsld ?? "—"}</td>
              </tr>))}
            {!list.length && <tr><td colSpan="5" className="dim" style={{ padding: 26, textAlign: "center", cursor: "default" }}>Everyone who needs contact is assigned.</td></tr>}
          </tbody>
        </table></div>
        {list.length > SHOW && <div className="wmore" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show less" : `Show all ${fmt(list.length)}`}</div>}
      </div>
    </>
  );
}

export default function Assignments({ ctx }) {
  const base = useDailyBase(ctx);
  const [view, setView] = useState("overview");
  if (!base.isAdmin) return <Empty>Assignments is for managers.</Empty>;
  return (
    <>
      <Head title="Assignments" sub="Hand players to agents and keep the contact target on track.">
        <Seg value={view} onChange={setView} options={[{ value: "overview", label: "Overview" }, { value: "lists", label: "Daily lists per agent" }]} />
      </Head>
      <Banners base={base} />
      {view === "overview" ? <AssignmentsPanel ctx={ctx} /> : (
        <Live>
          <AssignedView rows={base.data} contactMap={base.contactMap} contacts={base.contacts} team={base.team} viewTeam={ctx.viewTeam} me={base.me} snap={base.snap}
            dates={ctx.dates} setViewDate={ctx.setViewDate} onSaveContact={ctx.saveContact} onClearContact={ctx.clearContact} readOnly={base.readOnly} />
        </Live>
      )}
    </>
  );
}
