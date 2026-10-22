// Shift groups: one tick per person to say who works Day, Mid, Night or a custom shift this month, then apply it to the whole month.
// Rows are people, columns are shifts (the list from Manage > Shift times, plus one custom column). Days off and leave already on the roster are kept.
import React, { useEffect, useMemo, useState } from "react";
import { Avatar, Modal, Select, toast } from "../ui";
import { api } from "./api.js";
import { DAYS, addDays, addMonths, daysInMonth, dow, monthLabel, monthStart, timeOptionsFor, todayMyt } from "./logic.js";
import { paintCells, shiftCells } from "./paint.js";

const hh = (t) => (t ? String(Number(t.slice(0, 2))) + (t.slice(3) !== "00" ? ":" + t.slice(3) : "") : "");
const timeOpts = (...v) => timeOptionsFor(...v).filter((o) => o.value !== "");

export function GroupsModal({ people, shifts, onClose, onDone }) {
  const today = todayMyt(), thisMonth = monthStart(today);
  const [month, setMonth] = useState(thisMonth);
  const [dowOn, setDowOn] = useState(() => new Set([0, 1, 2, 3, 4, 5, 6]));
  const [keepOff, setKeepOff] = useState(true);
  const [custom, setCustom] = useState({ name: "Custom", start_time: "10:00", end_time: "18:00" });
  const [asg, setAsg] = useState({});                       // username -> 's:<key>' | 'custom' | ''
  const [items, setItems] = useState(null), [q, setQ] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");

  const groups = useMemo(() => [
    ...shifts.map((s) => ({ id: "s:" + s.key, title: s.name, start_time: s.start_time, end_time: s.end_time })),
    { id: "custom", title: custom.name.trim() || "Custom", start_time: custom.start_time, end_time: custom.end_time, custom: true },
  ], [shifts, custom]);

  const from = month, to = addDays(addMonths(month, 1), -1);
  useEffect(() => {
    let live = true;
    setItems(null); setErr("");
    api.schedule(from, to).then((r) => { if (live) setItems(r.items || []); }, (e) => { if (live) { setItems([]); setErr(e.message); } });
    return () => { live = false; };
  }, [from]);   // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => shiftCells(items || [], from, to), [items, from, to]);   // eslint-disable-line react-hooks/exhaustive-deps
  const names = useMemo(() => {
    const s = new Set(people.filter((p) => p.role !== "viewer").map((p) => p.username));
    for (const k of cells.keys()) s.add(k.split("|")[0]);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [people, cells]);

  // Start from what the roster already says: each person's most common shift this month
  useEffect(() => {
    if (items === null) return;
    const tally = {};
    for (const [k, list] of cells) for (const o of list) {
      if (o.item.off) continue;
      const u = k.split("|")[0], key = `${o.item.title}|${o.item.start_time || ""}|${o.item.end_time || ""}`;
      (tally[u] = tally[u] || {})[key] = (tally[u][key] || 0) + 1;
    }
    const next = {};
    let cust = null;
    for (const [u, t] of Object.entries(tally)) {
      const [key] = Object.entries(t).sort((a, b) => b[1] - a[1])[0], [title, st, en] = key.split("|");
      const hit = shifts.find((s) => s.name.toLowerCase() === title.toLowerCase());
      if (hit) next[u] = "s:" + hit.key;
      else { cust = cust || { name: title, start_time: st || "10:00", end_time: en || "18:00" }; if (cust.name === title) next[u] = "custom"; }
    }
    setAsg(next);
    if (cust) setCustom(cust);
  }, [items]);   // eslint-disable-line react-hooks/exhaustive-deps

  const dates = useMemo(() => Array.from({ length: daysInMonth(month) }, (_, i) => addDays(month, i)).filter((d) => dowOn.has(dow(d))), [month, dowOn]);
  const picked = names.filter((u) => asg[u]);
  const total = picked.length * dates.length;
  const countOf = (g) => names.filter((u) => asg[u] === g).length;
  const shown = names.filter((u) => !q.trim() || u.toLowerCase().includes(q.trim().toLowerCase()));

  const apply = async () => {
    if (!picked.length) return setErr("Tick at least one person");
    if (!dates.length) return setErr("Pick at least one day of the week");
    if (groups.some((g) => g.custom && countOf(g.id) && !custom.name.trim())) return setErr("Give the custom shift a name");
    setBusy(true); setErr("");
    try {
      let set = 0, kept = 0, blocked = 0;
      for (const g of groups) {
        const who = names.filter((u) => asg[u] === g.id);
        if (!who.length) continue;
        const r = await paintCells(cells, who.flatMap((u) => dates.map((d) => `${u}|${d}`)), { title: g.title, start_time: g.start_time, end_time: g.end_time, off: 0 }, { keepOff });
        set += r.added + r.updated; kept += r.skipped; blocked += r.blocked;
      }
      toast(`Set ${set} shift${set === 1 ? "" : "s"} for ${monthLabel(month)}${kept ? ` · ${kept} days off or leave kept` : ""}${blocked ? ` · ${blocked} skipped (repeating or shared shift)` : ""}`);
      onDone();
    } catch (e) { setErr(e.message || "Could not save"); setBusy(false); }
  };

  const monthOpts = [-1, 0, 1].map((n) => { const m = addMonths(thisMonth, n); return { value: m, label: monthLabel(m) + (n === 0 ? " (this month)" : "") }; });
  const footer = (
    <>
      <span className="dim" style={{ marginRight: "auto" }}>{picked.length} people × {dates.length} days = <b>{total}</b> shift{total === 1 ? "" : "s"} for {monthLabel(month)}</span>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn pri" disabled={busy || !total} onClick={apply}>{busy ? "Saving…" : `Apply to ${monthLabel(month).split(" ")[0]}`}</button>
    </>
  );
  return (
    <Modal title="Shift groups" onClose={onClose} width="min(980px,96vw)" footer={footer}>
      <div className="sch-modal-body" style={{ display: "grid", gap: 12 }}>
        <div className="dim">Tick who works each shift this month, then apply it to every chosen day. Shifts change every month, so set it again next month. Use the Roster to mark individual day offs.</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Select value={month} onChange={setMonth} options={monthOpts} style={{ width: "auto", minWidth: 190 }} />
          <div className="chiprow" role="group" aria-label="Days of the week">
            {DAYS.map((d, i) => (
              <button key={d} type="button" className={"btn sm" + (dowOn.has(i) ? " pri" : "")} aria-pressed={dowOn.has(i)}
                onClick={() => setDowOn((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}>{d}</button>
            ))}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row" }}><input type="checkbox" className="chk" checked={keepOff} onChange={(e) => setKeepOff(e.target.checked)} /> Keep days off and leave</label>
          <input className="input" placeholder="Find a person…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 170, marginLeft: "auto" }} />
        </div>
        {items === null && <div className="dim">Reading {monthLabel(month)}…</div>}
        <div className="sch-roster-wrap" style={{ maxHeight: "46vh", overflow: "auto" }}>
          <table className="sch-roster sch-gt">
            <thead>
              <tr>
                <th className="sch-rn">Person</th>
                {groups.map((g) => (
                  <th key={g.id} className="sch-gh">
                    {g.custom ? (
                      <div style={{ display: "grid", gap: 4 }}>
                        <input className="input" value={custom.name} maxLength={30} aria-label="Custom shift name" onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
                        <div style={{ display: "flex", gap: 4 }}>
                          <Select value={custom.start_time} onChange={(v) => setCustom({ ...custom, start_time: v })} options={timeOpts(custom.start_time)} />
                          <Select value={custom.end_time} onChange={(v) => setCustom({ ...custom, end_time: v })} options={timeOpts(custom.end_time)} />
                        </div>
                      </div>
                    ) : <><b>{g.title}</b><span className="dim">{hh(g.start_time)}–{hh(g.end_time)}</span></>}
                    <span className="dim">{countOf(g.id)} people</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u}>
                  <th className="sch-rn"><span className="sch-rnb"><Avatar name={u} />{u}</span></th>
                  {groups.map((g) => (
                    <td key={g.id} className="sch-gc">
                      <button type="button" className={"sch-tick" + (asg[u] === g.id ? " on" : "")} role="radio" aria-checked={asg[u] === g.id} aria-label={`${u}: ${g.title}`}
                        onClick={() => setAsg((a) => ({ ...a, [u]: a[u] === g.id ? "" : g.id }))}>{asg[u] === g.id ? "✓" : ""}</button>
                    </td>
                  ))}
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={groups.length + 1} className="dim" style={{ padding: 20, textAlign: "center" }}>Nobody matches.</td></tr>}
            </tbody>
          </table>
        </div>
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}
