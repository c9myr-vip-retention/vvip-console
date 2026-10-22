// Contact: the priority list, nothing else. Re-houses the live Queue worklist (bands, drawer, mark contacted, export, grace, drill).
import React, { useEffect, useMemo, useState } from "react";
import { Seg, toast } from "../ui";
import { Drawer, WL_BANDS, WL_NONE, exportQueue, ckey, fmt } from "../../App.jsx";
import { useDailyBase, useDailyFilters } from "../daily/hooks.js";
import { filterRows, sortPriority, buildBands, stageOf, isActioned, contactedPayload } from "../daily/logic.js";
import Legend from "../daily/Legend.jsx";
import { Banners, PageHead, SearchBox, AgentSelect, BrandMenu, FilterMenu, PlayerRow } from "../daily/widgets.jsx";

const BAND_TOP = 10;   // same as the live worklist

export default function Page({ ctx }) {
  const base = useDailyBase(ctx);
  const { snap, data, me, isAdmin, readOnly, team, brandOrder, contactMap, cooldownSet, saveContact } = base;
  const [stage, setStage] = useState("todo");
  const F = useDailyFilters(base, { stage, mine: !isAdmin });
  const { f, setF, patch, setTog, clearAll, graceTag, graceErr, graceNeeded, env } = F;
  const [dr, setDr] = useState(null);   // { list, i }: the on-screen order frozen when the panel opens, so saving a contact (which moves the row between stages) never swaps the player under the panel
  const [allOpen, setAllOpen] = useState({});
  const [busy, setBusy] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

  // Counts per stage (every other filter applied) and per brand (to-contact players, all other filters applied).
  const pool = useMemo(() => filterRows(data, f, { ...env, stage: null }), [data, f, env.contactMap, env.cooldownSet, env.graceOf, env.me]);
  const cnt = useMemo(() => {
    const c = { todo: 0, wait: 0, done: 0, all: pool.length };
    pool.forEach((r) => { c[stageOf(contactMap[ckey(r)])]++; });
    return c;
  }, [pool, contactMap]);
  const brandPool = useMemo(() => filterRows(data, f, { ...env, stage: "todo" }, { brand: true }), [data, f, env.contactMap, env.cooldownSet, env.graceOf, env.me]);
  const classCount = (k) => data.filter((x) => (!f.brands.length || f.brands.includes(x.brand)) && x._cls === k).length;

  const rows = F.rows;
  const bands = useMemo(() => buildBands(sortPriority(rows)), [rows]);
  const order = useMemo(() => [...bands.ACT, ...bands.TODAY, ...bands.WINBACK, ...bands.NONE], [bands]);   // the drawer walks the on-screen order
  useEffect(() => { setDr(null); }, [f, stage]);

  const mark = async (r) => {
    if (readOnly || busy) return;
    setBusy(ckey(r));
    try { await saveContact(contactedPayload(r, snap, contactMap[ckey(r)], me)); toast("Marked contacted"); }
    catch (e) { toast("Could not save: " + (e.message || "error")); }
    setBusy(null);
  };
  const open = (r) => setDr({ list: order, i: order.indexOf(r) });
  const row = (r) => (
    <PlayerRow key={ckey(r)} r={r} con={contactMap[ckey(r)]} cool={cooldownSet.has(ckey(r))} graceTag={graceTag(r)}
      readOnly={readOnly} busy={busy === ckey(r)} onOpen={() => open(r)} onMark={() => mark(r)} />
  );
  const bandBlock = (key, label, desc, color, list, collapsedByDefault) => {
    if (!list.length) return null;
    const done = list.filter((r) => isActioned(contactMap[ckey(r)])).length;
    const collapsed = collapsedByDefault && !allOpen[key + "_c"];
    const shown = allOpen[key] ? list : list.slice(0, BAND_TOP);
    return (
      <div className="dl-band" key={key}>
        <div className="dl-bh" style={{ "--cc": color }}>
          <b>{label}</b><span className="dim" style={{ flex: 1 }}>{desc}</span>
          <span className="dim">{fmt(done)} of {fmt(list.length)} done</span>
          <span className="pr"><i style={{ width: `${list.length ? (100 * done) / list.length : 0}%` }} /></span>
          <button className="btn sm" title={`Export these ${list.length} players as CSV (and copy names)`} onClick={() => exportQueue(list, snap, label, contactMap)}>⤓ CSV</button>
        </div>
        {collapsed
          ? <div className="dl-more" {...{ onClick: () => setAllOpen((s) => ({ ...s, [key + "_c"]: true })) }}>Show {fmt(list.length)} players</div>
          : <>
              {shown.map(row)}
              {list.length > BAND_TOP && <div className="dl-more" onClick={() => setAllOpen((s) => ({ ...s, [key]: !s[key] }))}>{allOpen[key] ? "Show less" : `Show all ${fmt(list.length)}`}</div>}
            </>}
      </div>
    );
  };

  const stageOpts = [
    { value: "todo", label: "To contact", count: cnt.todo }, { value: "wait", label: "Waiting", count: cnt.wait },
    { value: "done", label: "Done", count: cnt.done }, { value: "all", label: "All", count: cnt.all },
  ];

  return (
    <>
      <PageHead title="Contact" sub="Players to reach today, most important first." />
      <Banners base={base} />
      {graceNeeded && graceErr && <div className="dl-note">Grace activation state unavailable: {graceErr}. The list still works; the activated / not activated split is hidden until the Grace table can be read.</div>}
      <div className="bar">
        <Seg value={stage} options={stageOpts} onChange={setStage} />
        <SearchBox value={f.q} onChange={(q) => patch({ q })} />
        <AgentSelect show={isAdmin} value={f.agent} onChange={(agent) => patch({ agent })} team={team} />
        <BrandMenu brandOrder={brandOrder} value={f.brands} onChange={(brands) => patch({ brands })}
          countOf={(b) => brandPool.filter((x) => x.brand === b).length} />
        <FilterMenu f={f} setF={setF} setTog={setTog} clearAll={clearAll} classCount={classCount} showMine={!isAdmin} />
        {f.focusKeys && <button className="btn sm on" title="Clear focus" onClick={() => patch({ focusKeys: null, focusLabel: "" })}>🔔 {f.focusLabel} · {f.focusKeys.size} ✕</button>}
        <span className="grow" style={{ flex: 1 }} />
        <span className="dim">{fmt(rows.length)} shown</span>
        <button className="btn sm" title="What do these terms mean?" aria-pressed={showLegend} onClick={() => setShowLegend((v) => !v)}>?</button>
        <button className="btn sm" title="Download the filtered list as CSV and copy usernames" onClick={() => exportQueue(order, snap, null, contactMap)}>⤓ Export</button>
      </div>
      {showLegend && <Legend />}
      {order.length === 0
        ? <div className="card"><div className="body dim" style={{ textAlign: "center", padding: 34 }}>Nothing here with these filters.</div></div>
        : <>
            {WL_BANDS.map((b) => bandBlock(b.key, b.label, b.desc, b.color, bands[b.key]))}
            {bandBlock("NONE", WL_NONE.label, `Quiet or healthy. ${WL_NONE.desc}.`, WL_NONE.color, bands.NONE, true)}
          </>}
      {dr && dr.list[dr.i] && (
        <div className="rv-live"><Drawer list={dr.list} index={dr.i} setIndex={(i) => setDr((d) => ({ ...d, i }))} snap={snap} me={me} team={team} readOnly={readOnly}
          contact={contactMap[ckey(dr.list[dr.i])]} onSave={ctx.saveContact} onClear={ctx.clearContact} onClose={() => setDr(null)} /></div>
      )}
    </>
  );
}
