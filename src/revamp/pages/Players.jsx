// Players: search and browse everyone. Re-houses the live Queue table view (paste list, multi-sort, row selection, bulk mark/assign, export).
import React, { Fragment, useEffect, useMemo, useState } from "react";
import { Select, BrandBadge } from "../ui";
import { Drawer, exportQueue, parsePasteList, copyText, ckey, dispId, dispName, looksNumeric, tap, fmt } from "../../App.jsx";
import { useDailyBase, useDailyFilters, useBulkContact } from "../daily/hooks.js";
import { sortRows, assignPayload } from "../daily/logic.js";
import { Banners, PageHead, SearchBox, AgentSelect, BrandMenu, FilterMenu, BrandCards, ClassPill, StatusTag, GraceTag, PlayerName, bcolor } from "../daily/widgets.jsx";

export default function Page({ ctx }) {
  const base = useDailyBase(ctx);
  const { snap, data, me, isAdmin, readOnly, team, brandOrder, contactMap, cooldownSet } = base;
  const F = useDailyFilters(base, { stage: null, mine: false });
  const { f, setF, patch, setTog, clearAll, graceTag, graceOf, graceSt, graceErr, graceNeeded, env, poolNoBrand } = F;

  const [sorts, setSorts] = useState([]);                 // ordered multi-column sort; [] = default priority order
  const [sel, setSel] = useState(() => new Set());
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [dr, setDr] = useState(null);                     // { list, i } frozen when the player panel opens
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteMsg, setPasteMsg] = useState(null);
  const [copied, setCopied] = useState("");
  const [assignTo, setAssignTo] = useState("");

  const rows = useMemo(() => sortRows(F.rows, sorts, { cooldownSet, graceWatch: f.tg.gwatch, graceOf, graceSt }),
    [F.rows, sorts, cooldownSet, f.tg.gwatch, graceSt]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, totalPages), start = (cur - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  useEffect(() => { setPage(1); setDr(null); }, [f, sorts, pageSize]);
  useEffect(() => { if (!assignTo && team.length) setAssignTo(team[0].username); }, [team]);

  const classCount = (k) => data.filter((x) => (!f.brands.length || f.brands.includes(x.brand)) && x._cls === k).length;
  const toggleBrand = (b) => patch({ brands: f.brands.includes(b) ? f.brands.filter((x) => x !== b) : [...f.brands, b] });
  const toggleSel = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allSel = rows.length > 0 && rows.every((r) => sel.has(ckey(r)));
  const someSel = rows.some((r) => sel.has(ckey(r)));

  const tickPasted = () => {
    const res = parsePasteList(pasteText, data);
    setSel((s) => { const n = new Set(s); res.keys.forEach((k) => n.add(k)); return n; });
    setPasteMsg({ ok: res.keys.size, total: res.total, missing: res.missing, invalid: res.invalid });
  };
  const selRows = () => { const by = {}; data.forEach((r) => (by[ckey(r)] = r)); return [...sel].map((k) => by[k]).filter(Boolean); };
  const copyNames = async () => {   // per-brand identity: Zyra copies the UID, TC the username (same rule as the live console)
    const names = selRows().map((r) => String(dispId(r) || "").trim()).filter(Boolean);
    if (!names.length) return;
    const ok = await copyText(names.join("\n"));
    setCopied(ok ? "ok" : "fail"); setTimeout(() => setCopied(""), ok ? 1400 : 2600);
  };
  // One request wave and one screen update for the whole ticked list; players that failed stay ticked.
  const { busy, canUndo, saveMany, markSel, undoSel } = useBulkContact(base, selRows, setSel);
  const assignSel = () => assignTo && saveMany(`Assign to ${assignTo}:`, (r) => assignPayload(r, snap, contactMap[ckey(r)], assignTo));

  const Th = ({ k, children }) => {
    const i = sorts.findIndex((s) => s.k === k), s = i >= 0 ? sorts[i] : null;
    const click = () => setSorts((arr) => {   // descending, then ascending, then off; columns accumulate
      const j = arr.findIndex((x) => x.k === k);
      if (j < 0) return [...arr, { k, dir: -1 }];
      if (arr[j].dir === -1) return arr.map((x, n) => (n === j ? { k, dir: 1 } : x));
      return arr.filter((_, n) => n !== j);
    });
    return <th className="s r" onClick={click}>{children}{s ? (s.dir === -1 ? " ▼" : " ▲") : ""}{s && sorts.length > 1 ? <sup>{i + 1}</sup> : ""}</th>;
  };
  const graceGroup = (r) => (f.tg.gwatch && graceSt ? (graceOf(r) ? graceOf(r).a : 2) : null);
  const GROUP = ["Not activated · still to chase", "Activated", "No live Grace row in Lark"];

  return (
    <>
      <PageHead title="Players" sub="Search and browse everyone." />
      <Banners base={base} />
      <BrandCards brandOrder={brandOrder} rows={data} selected={f.brands} onToggle={toggleBrand} staleBrands={base.staleBrands} lagBrands={base.lagBrands} />
      <div className="bar">
        <SearchBox value={f.q} onChange={(q) => patch({ q })} />
        <AgentSelect show={isAdmin} value={f.agent} onChange={(agent) => patch({ agent })} team={team} />
        <BrandMenu brandOrder={brandOrder} value={f.brands} onChange={(brands) => patch({ brands })} countOf={(b) => poolNoBrand.filter((x) => x.brand === b).length} />
        <FilterMenu f={f} setF={setF} setTog={setTog} clearAll={clearAll} classCount={classCount} showMine={!isAdmin} />
        <button className={"btn sm" + (pasteOpen ? " on" : "")} title="Paste a list of username + brand lines to tick those players" onClick={() => setPasteOpen((o) => !o)}>Paste list</button>
        {sorts.length > 0 && <button className="btn sm" title="Reset to the default priority order" onClick={() => setSorts([])}>Clear sort ({sorts.length})</button>}
        {f.focusKeys && <button className="btn sm on" title="Clear focus" onClick={() => patch({ focusKeys: null, focusLabel: "" })}>🔔 {f.focusLabel} · {f.focusKeys.size} ✕</button>}
        <span style={{ flex: 1 }} />
        <span className="dim">{fmt(rows.length)} shown</span>
        <button className="btn sm" title="Download the filtered list as CSV and copy usernames" onClick={() => exportQueue(rows, snap, null, contactMap)}>⤓ Export {fmt(rows.length)}</button>
      </div>
      {graceNeeded && graceErr && <div className="dl-note">Grace activation state unavailable: {graceErr}. The list still works; the activated / not activated split is hidden until the Grace table can be read.</div>}

      {sel.size > 0 && (
        <div className="dl-sel">
          <b>{sel.size} selected</b>
          <button className="btn sm" onClick={copyNames}>{copied === "ok" ? "✓ Copied" : copied === "fail" ? "Copy blocked: open in Chrome" : "Copy usernames"}</button>
          {!readOnly && <button className="btn sm pri" disabled={busy} onClick={markSel}>{busy ? "Working…" : "✓ Mark contacted"}</button>}
          {canUndo && <button className="btn sm" disabled={busy} onClick={undoSel} title="Take back the contact for every ticked player that has one">↩ Undo contacted</button>}
          {isAdmin && !readOnly && (
            <>
              <span style={{ flex: 1 }} /><span className="dim">Assign to</span>
              <Select value={assignTo} options={team.map((t) => ({ value: t.username, label: t.username }))} onChange={setAssignTo} style={{ width: 150 }} />
              <button className="btn sm" disabled={busy || !assignTo} onClick={assignSel}>Assign</button>
            </>
          )}
          <span style={{ flex: isAdmin ? 0 : 1 }} />
          <button className="btn sm" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      {pasteOpen && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="dl-paste">
            <b>Paste a list</b>
            <span className="dim">One player per line: username or UID, then the brand (short code or full name), for example swecin spin, kader007 my, 931229 rush. Ticks are added to the current selection.</span>
            <textarea className="input" placeholder={"swecin spin\nkader007 my\n931229 rush"} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteMsg(null); }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn sm pri" disabled={!pasteText.trim()} onClick={tickPasted}>Tick players</button>
              <button className="btn sm" onClick={() => { setPasteText(""); setPasteMsg(null); }}>Clear text</button>
              {pasteMsg && (() => {
                const shown = new Set(rows.map(ckey)), hidden = [...sel].filter((k) => !shown.has(k)).length;
                return <span className="dim">Ticked {pasteMsg.ok} of {pasteMsg.total}.{hidden > 0 && ` ${hidden} selected player${hidden > 1 ? "s are" : " is"} hidden by the current filters.`}</span>;
              })()}
            </div>
            {pasteMsg?.missing.length > 0 && <div className="dim"><b>Not found</b> (not in this team's snapshot, or wrong brand): {pasteMsg.missing.join(", ")}</div>}
            {pasteMsg?.invalid.length > 0 && <div className="dim"><b>Could not read:</b> {pasteMsg.invalid.join("; ")}</div>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="tw">
          <table className="dl-tbl">
            <thead><tr>
              <th style={{ width: 34 }}>
                <input type="checkbox" className="chk sq" title={`Tick all ${rows.length} players in the current filter (all pages)`} checked={allSel}
                  ref={(el) => { if (el) el.indeterminate = someSel && !allSel; }}
                  onChange={() => setSel((s) => { const n = new Set(s); rows.forEach((r) => (allSel ? n.delete(ckey(r)) : n.add(ckey(r)))); return n; })} />
              </th>
              <th>Player</th><th>Type</th>
              <Th k="_graceDays">Grace</Th><Th k="_dsld">Days quiet</Th><Th k="daily_deposit">Deposit today</Th><Th k="win_loss">Win / loss</Th>
              <th title="Sort by 48h cooldown">Status</th>
            </tr></thead>
            <tbody>
              {pageRows.map((r, i) => {
                const k = ckey(r), con = contactMap[k], gg = graceGroup(r);
                const divider = gg !== null && (i === 0 || graceGroup(pageRows[i - 1]) !== gg);
                return (
                  <Fragment key={k}>
                    {divider && <tr className="div"><td colSpan={8}>{GROUP[gg]}</td></tr>}
                    <tr className={"br" + (sel.has(k) ? " sel" : "")} style={{ "--b": bcolor(r.brand), cursor: "pointer" }} {...tap(() => setDr({ list: pageRows, i }), null)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="chk sq" checked={sel.has(k)} onChange={() => toggleSel(k)} title="Select" /></td>
                      <td>
                        <PlayerName r={r} />
                        <div className="dim" style={{ marginTop: 3, display: "flex", gap: 6, alignItems: "center", fontSize: 11.5 }}>
                          <BrandBadge brand={r.brand} color={bcolor(r.brand)} /><span>Tier {r.tier_segment}{!looksNumeric(r.addressing) ? ` · ${r.addressing}` : ""}</span>
                        </div>
                      </td>
                      <td><ClassPill k={r._cls} />{cooldownSet.has(k) && <span className="dl-cd" title="Contacted within the last 48h: do not re-contact">48h</span>}</td>
                      <td>{r._graceDays != null && r._graceDays >= 0 ? <>{r._graceDays}d <GraceTag g={graceTag(r)} /></> : <span className="dim">—</span>}</td>
                      <td className="r mono">{r._dsld ?? "—"}</td>
                      <td className="r mono">{r.daily_deposit ? fmt(r.daily_deposit) : "—"}</td>
                      <td className={"r mono " + ((r.win_loss ?? 0) < 0 ? "neg" : (r.win_loss ?? 0) > 0 ? "pos" : "")}>{r.win_loss ? fmt(r.win_loss) : "—"}</td>
                      <td><StatusTag con={con} /></td>
                    </tr>
                  </Fragment>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="dim" style={{ padding: 30, textAlign: "center" }}>No players match. Adjust the filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="dl-pg">
          <span className="pgsel">Show per page <Select className="sm" value={pageSize} onChange={(v) => setPageSize(Number(v))} style={{ width: "auto", minWidth: 72 }}
            options={[...[20, 50, 100, 200].map((n) => ({ value: n, label: String(n) })), { value: 100000, label: "All" }]} /></span>
          <span>Showing {rows.length ? start + 1 : 0}–{Math.min(start + pageSize, rows.length)} of {fmt(rows.length)}</span>
          <span className="dim">Lifetime PNL, Telegram and withdrawals are in the player panel.</span>
          <span style={{ flex: 1 }} />
          <span className="seg">
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹</button>
            <button className="on">{cur} / {totalPages}</button>
            <button disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>›</button>
          </span>
        </div>
      </div>

      {dr && dr.list[dr.i] && (
        <div className="rv-live"><Drawer list={dr.list} index={dr.i} setIndex={(i) => setDr((d) => ({ ...d, i }))} snap={snap} me={me} team={team} readOnly={readOnly}
          contact={contactMap[ckey(dr.list[dr.i])]} onSave={ctx.saveContact} onClear={ctx.clearContact} onClose={() => setDr(null)} /></div>
      )}
    </>
  );
}
