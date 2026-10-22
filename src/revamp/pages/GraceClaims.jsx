// Grace claims: players who reached the required Grace deposit in one day and have not claimed yet (live GraceTasks logic,
// GET /api/rtn/grace-tasks), plus the Grace players list with the activated / not activated filter (GET /api/rtn/grace-status).
import React, { useEffect, useMemo, useState } from "react";
import { Seg, Select, toast } from "../ui";
import { api, Drawer, GT_STATUS, BRANDS, ckey, fmt, tap, dispName, looksNumeric } from "../../App.jsx";
import { useDailyBase } from "../daily/hooks.js";
import { sortRows, contactedPayload, isActioned } from "../daily/logic.js";
import { Banners, SearchBox, BrandMenu, ClassPill, StatusTag, GraceTag, PlayerName, bcolor } from "../daily/widgets.jsx";
import { Head, Empty, PCell } from "../daily2/common.jsx";
import { useLive } from "../live.js";

const GSEG = [["reloaded", "Ready to claim"], ["same_day", "Check same-day"], ["in_progress", "Window open"], ["not_reloaded", "Did not reload"], ["unknown", "No amount"], ["all", "All"]];

export default function GraceClaims({ ctx }) {
  const base = useDailyBase(ctx);
  const { snap, data, me, readOnly, team, brandOrder, contactMap, cooldownSet, saveContact } = base;
  const [view, setView] = useState("claims");          // claims | players
  const [note, setNote] = useState(false);
  const [q, setQ] = useState("");
  const [brands, setBrands] = useState([]);
  const [dr, setDr] = useState(null);                  // { list, index }: the player panel

  /* ---------- claims (grace-tasks) ---------- */
  const [res, setRes] = useState(null);                // null = loading, { rows, notes } or { error }
  const [filter, setFilter] = useState("reloaded");
  const [loadAll, setLoadAll] = useState(false);       // also list Grace rows for players that are not in the board (other teams / not in this snapshot)
  const loadClaims = (quiet) => { if (quiet !== true) setRes(null); api("/api/rtn/grace-tasks").then(setRes).catch((e) => { if (quiet !== true) setRes({ error: e.message || "Could not read the Grace table" }); }); };
  useEffect(() => { loadClaims(); }, [snap]);   // eslint-disable-line react-hooks/exhaustive-deps
  useLive(["feed", "contact"], () => loadClaims(true));
  const byKey = useMemo(() => { const m = {}; data.forEach((r) => (m[ckey(r)] = r)); return m; }, [data]);
  const allRows = res && res.rows ? res.rows : [];
  const inBoard = (r) => !!byKey[`${r.player_key}|${r.brand}|${r.tier_segment}`];
  const counts = { reloaded: 0, same_day: 0, in_progress: 0, not_reloaded: 0, unknown: 0, all: 0 };
  allRows.forEach((r) => { counts[r.status]++; counts.all++; });
  const needle = q.trim().toLowerCase();
  const matches = (p, key) => !needle || (p ? `${dispName(p)} ${p.username || ""} ${p.uid || ""} ${p.addressing || ""}` : String(key || "")).toLowerCase().includes(needle);
  const inGroup = (r) => filter === "all" || r.status === filter;
  const hiddenCount = allRows.filter((r) => !inBoard(r) && inGroup(r)).length;
  const shown = allRows.filter((r) => (loadAll || inBoard(r)) && inGroup(r) && (!brands.length || brands.includes(r.brand)) && matches(byKey[`${r.player_key}|${r.brand}|${r.tier_segment}`], r.player_key));
  const players = shown.map((r) => byKey[`${r.player_key}|${r.brand}|${r.tier_segment}`]);     // undefined for rows that are not in the board
  const panelList = players.filter(Boolean);
  const brandCount = (b) => allRows.filter((r) => r.brand === b && (loadAll || inBoard(r)) && inGroup(r)).length;

  /* ---------- Grace players (grace-status: activated / not activated) ---------- */
  const [act, setAct] = useState("all");               // all | act | not
  const [gst, setGst] = useState(null);                // { "username|BRAND": { a, v, e } }
  const [gerr, setGerr] = useState("");
  useEffect(() => {
    if (view !== "players") return;
    let alive = true;
    setGerr("");
    api("/api/rtn/grace-status").then((d) => { if (alive) setGst(d.status || {}); })
      .catch((e) => { if (alive) { setGst(null); setGerr(e.message || "Could not read the Grace table"); } });
    return () => { alive = false; };
  }, [view, snap]);
  const graceOf = (r) => (gst ? gst[`${String(r.player_key).toLowerCase()}|${r.brand}`] || null : null);
  const gpool = useMemo(() => data.filter((r) => r._cls === "GRACE" || (r._graceDays != null && r._graceDays >= 0)), [data]);
  const grows = useMemo(() => {
    const list = gpool.filter((r) => {
      if (brands.length && !brands.includes(r.brand)) return false;
      if (!matches(r)) return false;
      if (act !== "all") { const g = graceOf(r); if (!g || (act === "act" ? g.a !== 1 : g.a !== 0)) return false; }
      return true;
    });
    return sortRows(list, [], { cooldownSet, graceWatch: true, graceOf, graceSt: gst });
    // eslint-disable-next-line
  }, [gpool, brands, needle, act, gst, cooldownSet]);
  const gCount = (k) => gpool.filter((r) => { const g = graceOf(r); return k === "all" ? true : g && (k === "act" ? g.a === 1 : g.a === 0); }).length;
  const gBrandCount = (b) => gpool.filter((r) => r.brand === b).length;

  const [busy, setBusy] = useState(null);
  const mark = async (r) => {
    if (readOnly || busy) return;
    setBusy(ckey(r));
    try { await saveContact(contactedPayload(r, snap, contactMap[ckey(r)], me)); toast("Marked contacted"); }
    catch (e) { toast("Could not save: " + (e.message || "error")); }
    setBusy(null);
  };

  const cell = (d, t) => (
    <span key={d.d} className={"d2-gcell" + (d.d === t.start ? " dash" : t.req != null && d.dep >= t.req ? " hit" : "") + (d.dep === null ? " na" : "")}
      title={d.d === t.start ? `${d.d} · activation day: the deposit could be before or after the activation time, so it is not counted as certain` : d.d}>{d.dep === null ? "–" : fmt(d.dep)}</span>);

  const viewOpts = [{ value: "claims", label: "Claims", count: counts.reloaded }, { value: "players", label: "Grace players", count: gpool.length }];
  return (
    <>
      <Head title="Grace claims" sub="Players who reached the required deposit in one day and haven't claimed their bonus yet.">
        <Seg value={view} options={viewOpts} onChange={(v) => { setView(v); setDr(null); }} />
        <button className={"btn sm" + (note ? " on" : "")} onClick={() => setNote((n) => !n)}>ⓘ How it works</button>
        {view === "claims" && <button className="btn sm" onClick={loadClaims}>Refresh</button>}
      </Head>
      <Banners base={base} />
      {note && (
        <div className="card" style={{ marginBottom: 12 }}><div className="body d2-note">
          Window = the <b>activated date</b> to the <b>expiry date</b>, both read from the Lark Grace table. The required deposit must be reached <b>in one single day</b>; days are never added together (RM50 + RM50 on two days does not count). Only days <b>after the activation day</b> count; a deposit on the activation day itself (dashed cell) could be before the activation time, so it is shown separately as "same day, check time". The required deposit follows from the bonus (Tier 3: 100→18, 200→28, 300→38, 500→58 · Tier V: 600→68 … 1000→108).
          {" "}Deposits come from the console's daily feed, one day behind; a "–" day has not arrived yet. The claim never expires, so a row stays until Lark says Claimed.
          {res?.notes?.late > 0 && <> {res.notes.late} row(s) were activated after their expiry date.</>}
          {res?.notes?.noPlayer > 0 && <> {res.notes.noPlayer} Grace row(s) have no matching player in the console.</>}
        </div></div>
      )}

      {view === "claims" && (
        <>
          <div className="bar">
            <Seg value={filter} onChange={setFilter} options={GSEG.map(([value, label]) => ({ value, label, count: counts[value] }))} />
          </div>
          <div className="bar">
            <SearchBox value={q} onChange={setQ} />
            <BrandMenu brandOrder={brandOrder} value={brands} onChange={setBrands} countOf={brandCount} />
            <span className="grow" />
            <span className="dim">Showing {shown.length} of {counts[filter]}</span>
            {hiddenCount > 0 && !loadAll && <button className="btn sm" onClick={() => setLoadAll(true)} title="Also list Grace players that are not in the current board">Load all ({hiddenCount} more)</button>}
            {loadAll && <button className="btn sm" onClick={() => setLoadAll(false)}>Board players only</button>}
          </div>
          {res === null && <Empty>Reading the Lark Grace table…</Empty>}
          {res && res.error && <div className="dl-note">{res.error}</div>}
          {res && !res.error && (
            <div className="card"><div className="tw">
              <table className="d2-tbl">
                <thead><tr><th>Player</th><th>Window</th><th>Deposit per day</th><th className="r">Best day</th><th className="r">Required</th><th className="r">Bonus</th><th>Status</th></tr></thead>
                <tbody>
                  {shown.map((t, i) => {
                    const p = players[i], st = GT_STATUS[t.status];
                    return (
                      <tr key={`${t.player_key}|${t.brand}|${t.end}`} className="br" style={{ "--b": bcolor(t.brand) }} {...(p ? tap(() => setDr({ list: panelList, index: players.slice(0, i).filter(Boolean).length }), null) : {})}>
                        <td>{p
                          ? <PCell id={dispName(p)} brand={t.brand} tier={t.tier_segment} name={!looksNumeric(p.addressing) ? p.addressing : ""} extra={p._tg ? <span className="tgf"> ✈</span> : null} />
                          : <span title="Not in the current board, so there is no player panel"><PCell id={t.player_key} brand={t.brand} tier={t.tier_segment} name="" /></span>}</td>
                        <td className="mono" title={t.late ? "Activated after the expiry date" : "Activated date → expiry date, from Lark"}>{t.start.slice(5)} → {t.end.slice(5)}{t.late ? " ⚠" : ""}</td>
                        <td>{t.days.map((d) => cell(d, t))}</td>
                        <td className="r mono" title="Highest single day after activation">{t.status === "unknown" ? "—" : fmt(t.best)}{t.sameDay > 0 && <div className="d2-gsd" title="Deposited on the activation day itself; time of day unknown">{fmt(t.sameDay)} same day</div>}</td>
                        <td className="r mono">{t.req == null ? "—" : fmt(t.req)}</td>
                        <td className="r mono">{t.bonus == null ? "—" : fmt(t.bonus)}</td>
                        <td><span className="pill np" style={{ "--c": st.color }} title={t.text}>{st.label}</span></td>
                      </tr>);
                  })}
                  {shown.length === 0 && <tr><td colSpan="7" className="dim" style={{ padding: 30, textAlign: "center", cursor: "default" }}>Nothing in this group.</td></tr>}
                </tbody>
              </table>
            </div></div>
          )}
        </>
      )}

      {view === "players" && (
        <>
          <div className="bar">
            <Select value={act} onChange={setAct} style={{ width: 210 }} options={[
              { value: "all", label: `All Grace players · ${gCount("all")}` },
              { value: "not", label: `Not activated · ${gst ? gCount("not") : "…"}` },
              { value: "act", label: `Activated · ${gst ? gCount("act") : "…"}` }]} />
            <SearchBox value={q} onChange={setQ} />
            <BrandMenu brandOrder={brandOrder} value={brands} onChange={setBrands} countOf={gBrandCount} />
            <span className="grow" />
            <span className="dim">{grows.length} players · soonest deadline first, not activated before activated</span>
          </div>
          {gerr && <div className="dl-note">Grace activation state unavailable: {gerr}. The list still works; the activated / not activated split is hidden until the Grace table can be read.</div>}
          <div className="card"><div className="tw">
            <table className="d2-tbl">
              <thead><tr><th>Player</th><th>Class</th><th className="r">Days left</th><th>Activation</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {grows.map((r, i) => {
                  const g = gst ? graceOf(r) : null, con = contactMap[ckey(r)], done = isActioned(con);
                  return (
                    <tr key={ckey(r)} className="br" style={{ "--b": bcolor(r.brand), opacity: done ? 0.6 : 1 }} {...tap(() => setDr({ list: grows, index: i }), null)}>
                      <td><PCell id={<PlayerName r={r} />} brand={r.brand} tier={r.tier_segment} name={!looksNumeric(r.addressing) ? r.addressing : ""} /></td>
                      <td><ClassPill k={r._cls} /></td>
                      <td className="r mono">{r._graceDays != null ? `${r._graceDays}d` : "—"}</td>
                      <td>{g ? <GraceTag g={{ on: !!g.a, title: g.v }} /> : <span className="dim">{gst ? "no Grace row" : "…"}</span>}</td>
                      <td><StatusTag con={con} /></td>
                      <td className="r" onClick={(e) => e.stopPropagation()}>
                        {!done && <button className="btn sm pri" disabled={readOnly || busy === ckey(r)} onClick={() => mark(r)}>✓ Contacted</button>}
                      </td>
                    </tr>);
                })}
                {grows.length === 0 && <tr><td colSpan="6" className="dim" style={{ padding: 30, textAlign: "center", cursor: "default" }}>No Grace players match.</td></tr>}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {dr && dr.list[dr.index] && (
        <div className="rv-live"><Drawer list={dr.list} index={dr.index} setIndex={(i) => setDr((o) => ({ ...o, index: i }))} snap={snap} me={me} team={team} readOnly={readOnly}
          contact={contactMap[ckey(dr.list[dr.index])]} onSave={ctx.saveContact} onClear={ctx.clearContact} onClose={() => setDr(null)} /></div>
      )}
    </>
  );
}
