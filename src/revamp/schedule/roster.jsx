// Roster: people down the side, days across the top, one shift per cell (like the Lark roster sheet).
// Admin picks a brush (a shift, Day off, a leave, or the eraser) and clicks or drags across cells. Everyone else reads it.
// Only one-off, single-person shifts are painted over; a repeating or shared shift is edited from the Week view instead.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, toast } from "../ui";
import { api } from "./api.js";
import { DAYS, dayNum, dow, fmtD, isOvernight } from "./logic.js";
import { paintCells, paintSummary, shiftCells } from "./paint.js";

const LEAVES = [{ id: "off", label: "Day off", title: "Day off" }, { id: "al", label: "Annual leave", title: "Annual leave" }, { id: "sl", label: "Sick leave", title: "Sick leave" }];
const hh = (t) => (t ? String(Number(t.slice(0, 2))) + (t.slice(3) !== "00" ? ":" + t.slice(3) : "") : "");
const kind = (it) => (it.off ? (/annual/i.test(it.title) ? "#8B5CF6" : /sick/i.test(it.title) ? "#EF4444" : "#8A93A6") : isOvernight(it) ? "#2F9E6B" : Number((it.start_time || "12").slice(0, 2)) < 12 ? "#D9A441" : "#4F86E0");
const brushColor = (b) => (b.off ? kind({ off: 1, title: b.title }) : kind({ start_time: b.start_time, end_time: b.end_time }));

export default function Roster({ days, today, items, people, shifts, admin, me, onChanged }) {
  const [brush, setBrush] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const drag = useRef(false), selRef = useRef(sel), brushRef = useRef(brush);
  selRef.current = sel; brushRef.current = brush;

  const cells = useMemo(() => shiftCells(items, days[0], days[days.length - 1]), [items, days]);
  const names = useMemo(() => {
    const s = new Set(people.filter((p) => p.role !== "viewer" || p.on_leaderboard).map((p) => p.username));
    for (const k of cells.keys()) s.add(k.split("|")[0]);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [people, cells]);

  const brushes = useMemo(() => [
    ...shifts.map((s) => ({ id: "s:" + s.key, label: `${s.name} ${hh(s.start_time)}–${hh(s.end_time)}`, title: s.name, start_time: s.start_time, end_time: s.end_time, off: 0 })),
    ...LEAVES.map((l) => ({ id: l.id, label: l.label, title: l.title, start_time: null, end_time: null, off: 1 })),
    { id: "erase", label: "Clear cell", erase: true },
  ], [shifts]);
  const cur = brushes.find((b) => b.id === brush) || null;

  const apply = async (keys) => {
    const b = brushRef.current && brushes.find((x) => x.id === brushRef.current);
    if (!b || !keys.length || busy) return;
    setBusy(true);
    try {
      const r = await paintCells(cells, keys, b);
      const n = r.added + r.updated + r.cleared;
      if (n || r.same) toast(paintSummary(r, b.erase)); else if (r.blocked) toast("Those shifts repeat or are shared. Open them in the Week view to change them.");
      if (n) onChanged();
    } catch (e) { toast(e.message || "Could not save"); onChanged(); }
    setBusy(false);
  };

  useEffect(() => {
    const up = () => { if (!drag.current) return; drag.current = false; const keys = [...selRef.current]; setSel(new Set()); apply(keys); };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  });   // re-bound each render so apply() always sees the latest cells

  const down = (k) => (e) => { if (!admin || !brush || e.button !== 0) return; e.preventDefault(); drag.current = true; setSel(new Set([k])); };
  const enter = (k) => () => { if (drag.current) setSel((s) => (s.has(k) ? s : new Set(s).add(k))); };
  const weekdays = (p) => days.filter((d) => dow(d) < 5).map((d) => `${p}|${d}`);
  const cover = (d) => names.filter((p) => (cells.get(`${p}|${d}`) || []).some((o) => !o.item.off)).length;

  return (
    <>
      {admin && (
        <div className="sch-palette">
          <span className="dim">Pick a brush, then click or drag across the grid:</span>
          {brushes.map((b) => (
            <button key={b.id} type="button" className={"btn sm" + (brush === b.id ? " pri" : "")} onClick={() => setBrush(brush === b.id ? null : b.id)} aria-pressed={brush === b.id}>
              {!b.erase && <span className="sch-bd" style={{ background: brushColor(b) }} />}{b.label}
            </button>
          ))}
          {busy && <span className="dim">Saving…</span>}
        </div>
      )}
      <div className="sch-roster-wrap">
        <table className="sch-roster">
          <thead>
            <tr>
              <th className="sch-rn">{admin && brush ? <span className="dim" title="Click a name to fill that person's weekdays">name = fill Mon–Fri</span> : "Team"}</th>
              {days.map((d) => <th key={d} className={"sch-rd" + (d === today ? " today" : "") + (dow(d) > 4 ? " we" : "")}><b>{dayNum(d)}</b><span>{DAYS[dow(d)]}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {names.map((p) => (
              <tr key={p} className={p === me ? "mine" : ""}>
                <th className="sch-rn">
                  {admin && brush ? <button type="button" className="sch-rnb" onClick={() => apply(weekdays(p))} title={`Fill ${p}'s weekdays with the brush`}><Avatar name={p} />{p}</button>
                    : <span className="sch-rnb"><Avatar name={p} />{p}</span>}
                </th>
                {days.map((d) => {
                  const k = `${p}|${d}`, list = cells.get(k) || [], it = list[0] && list[0].item, on = sel.has(k);
                  return (
                    <td key={d} className={"sch-rc" + (d === today ? " today" : "") + (dow(d) > 4 ? " we" : "") + (on ? " sel" : "") + (admin && brush ? " paint" : "")}
                      style={it ? { "--c": kind(it) } : undefined} onMouseDown={down(k)} onMouseEnter={enter(k)}
                      title={it ? `${p} · ${fmtD(d)} · ${it.title}${it.off ? "" : ` ${it.start_time || ""}–${it.end_time || ""}`}${list.length > 1 ? ` (+${list.length - 1} more)` : ""}` : `${p} · ${fmtD(d)} · nothing set`}
                      tabIndex={admin && brush ? 0 : -1} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && admin && brush) { e.preventDefault(); apply([k]); } }}>
                      {it && (it.off
                        ? <span className="sch-rt">{/annual/i.test(it.title) ? "AL" : /sick/i.test(it.title) ? "SL" : "OFF"}</span>
                        : <><span className="sch-rt">{it.title}</span><span className="sch-rh">{hh(it.start_time)}–{hh(it.end_time)}</span></>)}
                      {list.length > 1 && <span className="sch-rm">+{list.length - 1}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!names.length && <tr><td colSpan={days.length + 1} className="dim" style={{ padding: 24, textAlign: "center" }}>No people yet.</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <th className="sch-rn dim">On shift</th>
              {days.map((d) => <td key={d} className={"sch-rcv" + (d === today ? " today" : "")}>{cover(d)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="dim" style={{ marginTop: 8 }}>
        {admin ? (cur ? (cur.erase ? "Eraser on: click or drag over cells to clear them." : `Painting “${cur.label}”. Click or drag over cells; click a name to fill that person's Mon–Fri.`) : "Pick a brush above to start painting.")
          : "Read-only. Your row is highlighted."}
        {" "}Repeating or shared shifts are not painted over: open them in the Week view.
      </div>
    </>
  );
}
