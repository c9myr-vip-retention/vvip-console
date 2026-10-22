// Bulk schedule: tick which brands run which event, then apply it to every chosen day of a month. Built for brand reload events
// (one item per event per day, carrying the brands that run it), but it works for any schedule type except shifts.
// Rows are brands, columns are events you name here; days come from the month and the days of the week you pick, plus any specific dates you add.
import React, { useMemo, useState } from "react";
import { Modal, Select, toast } from "../ui";
import { brandColor } from "../tokens.js";
import { api } from "./api.js";
import { MultiCal } from "./forms.jsx";
import { DAYS, addDays, addMonths, daysInMonth, dow, fmtDow, monthLabel, monthStart, timeOptionsFor, todayMyt } from "./logic.js";

const timeOpts = (...v) => timeOptionsFor(...v).filter((o) => o.value !== "");
const CHUNK = 400;                                        // the Worker takes at most 500 new items per call
const MAX_EVENTS = 8;
let uid = 1;
const blank = () => ({ id: uid++, title: "", start_time: "12:00", end_time: "23:59", brands: [] });

export function BulkModal({ types, brands, onClose, onDone }) {
  const today = todayMyt(), thisMonth = monthStart(today);
  const [type, setType] = useState(() => (types.find((t) => t.key === "reload") || types[0] || {}).key || "");
  const [month, setMonth] = useState(thisMonth);
  const [dowOn, setDowOn] = useState(() => new Set());
  const [cols, setCols] = useState(() => [blank()]);
  const [extra, setExtra] = useState(() => new Set()), [calOpen, setCalOpen] = useState(false), [calMonth, setCalMonth] = useState(thisMonth), [last, setLast] = useState(null);   // specific dates on top of the weekday ones
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");

  const dates = useMemo(() => {
    const all = new Set(Array.from({ length: daysInMonth(month) }, (_, i) => addDays(month, i)).filter((d) => dowOn.has(dow(d))));
    extra.forEach((d) => all.add(d));
    return [...all].sort();
  }, [month, dowOn, extra]);
  const pickDate = (d, range) => {
    setErr("");
    const next = new Set(extra);
    if (range && last) { const [a, z] = last < d ? [last, d] : [d, last]; for (let x = a; x <= z; x = addDays(x, 1)) next.add(x); }
    else if (next.has(d)) next.delete(d); else next.add(d);
    setLast(d); setExtra(next);
  };
  const span = dates.length ? (dates[0].slice(0, 7) === dates[dates.length - 1].slice(0, 7) ? monthLabel(dates[0]) : `${dates.length} days`) : monthLabel(month);
  const live = cols.filter((c) => c.title.trim() && c.brands.length);
  const total = live.length * dates.length;
  const setCol = (id, patch) => setCols((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const tick = (id, b) => setCols((l) => l.map((c) => (c.id !== id ? c : { ...c, brands: c.brands.includes(b) ? c.brands.filter((x) => x !== b) : [...c.brands, b] })));   // from the latest state, so quick clicks never overwrite each other

  const apply = async () => {
    if (!type) return setErr("Pick a type");
    if (!dates.length) return setErr("Pick at least one day of the week, or add specific dates");
    if (!live.length) return setErr("Give an event a name and tick at least one brand for it");
    setBusy(true); setErr("");
    try {
      // an event already on the board for that type, day and name is left alone, so applying twice never doubles it
      const have = new Set(((await api.schedule(dates[0], dates[dates.length - 1])).items || []).filter((i) => i.type_key === type).map((i) => `${i.date}|${i.title.trim().toLowerCase()}`));
      const adds = []; let skipped = 0;
      for (const c of live) for (const d of dates) {
        if (have.has(`${d}|${c.title.trim().toLowerCase()}`)) { skipped++; continue; }
        adds.push({ type_key: type, date: d, title: c.title.trim(), start_time: c.start_time || null, end_time: c.end_time || null, brands: c.brands, who: [], note: "", repeat: "none" });
      }
      for (let i = 0; i < adds.length; i += CHUNK) await api.addItems(adds.slice(i, i + CHUNK));
      toast(`Added ${adds.length} item${adds.length === 1 ? "" : "s"} for ${span}${skipped ? ` · ${skipped} already there` : ""}`);
      onDone(dates[0]);
    } catch (e) { setErr(e.message || "Could not save"); setBusy(false); }
  };

  const monthOpts = [-1, 0, 1, 2].map((n) => { const m = addMonths(thisMonth, n); return { value: m, label: monthLabel(m) + (n === 0 ? " (this month)" : "") }; });
  const footer = (
    <>
      <span className="dim" style={{ marginRight: "auto" }}>{live.length} event{live.length === 1 ? "" : "s"} × {dates.length} day{dates.length === 1 ? "" : "s"} = <b>{total}</b> item{total === 1 ? "" : "s"} for {span}</span>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn pri" disabled={busy || !total} onClick={apply}>{busy ? "Saving…" : `Add ${total} item${total === 1 ? "" : "s"}`}</button>
    </>
  );
  return (
    <Modal title="Bulk schedule" onClose={onClose} width="min(980px,96vw)" footer={footer}>
      <div className="sch-modal-body" style={{ display: "grid", gap: 12 }}>
        <div className="dim">Name each event once, tick the brands that run it, pick the days of the week, and it is added to every matching day of the month. You can also add specific dates. Made for brand reload events.</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Select value={type} onChange={setType} options={types.map((t) => ({ value: t.key, label: t.name, dot: t.color }))} placeholder="Type" style={{ width: "auto", minWidth: 190 }} />
          <Select value={month} onChange={setMonth} options={monthOpts} style={{ width: "auto", minWidth: 190 }} />
          <div className="chiprow" role="group" aria-label="Days of the week">
            {DAYS.map((d, i) => (
              <button key={d} type="button" className={"btn sm" + (dowOn.has(i) ? " pri" : "")} aria-pressed={dowOn.has(i)}
                onClick={() => setDowOn((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}>{d}</button>
            ))}
          </div>
          <button className="btn sm" disabled={cols.length >= MAX_EVENTS} onClick={() => setCols((l) => [...l, blank()])}>+ Add event</button>
          <button className={"btn sm" + (calOpen || extra.size ? " pri" : "")} aria-expanded={calOpen} onClick={() => setCalOpen((o) => !o)}>{extra.size ? `Specific dates · ${extra.size}` : "+ Specific dates"}</button>
        </div>
        {calOpen && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <MultiCal dates={extra} month={calMonth} onMonth={setCalMonth} onPick={pickDate} />
            <div style={{ flex: 1, minWidth: 220, display: "grid", gap: 8 }}>
              <div className="dim">These dates are added on top of the days of the week above, in any month.</div>
              {extra.size === 0 ? <div className="dim">No specific dates yet.</div> : (
                <div className="chiprow">
                  {[...extra].sort().map((d) => <button key={d} type="button" className="btn sm" title="Remove this date" onClick={() => pickDate(d)}>{fmtDow(d)} {d.slice(0, 4)} ✕</button>)}
                </div>
              )}
              {extra.size > 0 && <div><button className="btn sm" onClick={() => { setExtra(new Set()); setLast(null); }}>Clear specific dates</button></div>}
            </div>
          </div>
        )}
        <div className="sch-roster-wrap" style={{ maxHeight: "46vh", overflow: "auto" }}>
          <table className="sch-roster sch-gt">
            <thead>
              <tr>
                <th className="sch-rn">Brand</th>
                {cols.map((c) => (
                  <th key={c.id} className="sch-gh">
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <input className="input" value={c.title} maxLength={200} placeholder="e.g. Friday Reload 12%" aria-label="Event name" onChange={(e) => setCol(c.id, { title: e.target.value })} />
                        {cols.length > 1 && <button type="button" className="btn sm danger" aria-label="Remove this event" onClick={() => setCols((l) => l.filter((x) => x.id !== c.id))}>✕</button>}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Select value={c.start_time} onChange={(v) => setCol(c.id, { start_time: v })} options={timeOpts(c.start_time)} />
                        <Select value={c.end_time} onChange={(v) => setCol(c.id, { end_time: v })} options={timeOpts(c.end_time)} />
                      </div>
                    </div>
                    <span className="dim">{c.brands.length} brand{c.brands.length === 1 ? "" : "s"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b}>
                  <th className="sch-rn"><span className="sch-rnb"><span className="sch-bd" style={{ background: brandColor(b) }} />{b}</span></th>
                  {cols.map((c) => (
                    <td key={c.id} className="sch-gc">
                      <button type="button" className={"sch-tick" + (c.brands.includes(b) ? " on" : "")} role="checkbox" aria-checked={c.brands.includes(b)} aria-label={`${b}: ${c.title || "event"}`}
                        onClick={() => tick(c.id, b)}>{c.brands.includes(b) ? "✓" : ""}</button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}
