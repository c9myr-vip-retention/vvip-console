// Admin form: add many entries on many dates in one go (mini calendar: click several dates, shift-click a range), or edit one item.
import React, { useMemo, useState } from "react";
import { Modal, Select, MultiSelect, toast } from "../ui";
import { BRAND_COLORS, BRAND_ORDER } from "../tokens.js";
import { sched } from "./api.js";
import { DAYS, MONTHS, addDays, daysIn, dow, fmtDay, monthOf, shiftMonth, todayMYT, weekStart, ymd } from "./dates.js";
import { timeOptions } from "./dates.js";

const MAX = 500;
const SHIFTS = { AM: ["Morning", "09:00", "17:00"], PM: ["Afternoon", "13:00", "21:00"], NT: ["Night", "21:00", "05:00"], OFF: ["Day off", "", ""] };
const TIMES = timeOptions();
const REPEATS = [{ value: "none", label: "Doesn't repeat" }, { value: "daily", label: "Every day" }, { value: "weekly", label: "Every week" }];

const blank = (type_key) => ({ type_key, title: "", start_time: "12:00", end_time: "23:59", brands: [], who: [], note: "", repeat: "none", off: 0 });

function MiniCal({ selected, month, onMonth, onPick }) {
  const today = todayMYT(), lead = dow(ymd(month, 1)), n = daysIn(month);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => ymd(month, i + 1))];
  return (
    <div className="sch-cal">
      <div className="sch-calh">
        <button type="button" className="sch-btn sm" onClick={() => onMonth(-1)}>‹</button>
        <span className="sch-grow" style={{ textAlign: "center" }}>{MONTHS[month.m]} {month.y}</span>
        <button type="button" className="sch-btn sm" onClick={() => onMonth(1)}>›</button>
      </div>
      <div className="sch-grid">
        {DAYS.map((d) => <span key={d}>{d.slice(0, 2)}</span>)}
        {cells.map((d, i) => d
          ? <button type="button" key={d} className={(selected.has(d) ? "sel " : "") + (d === today ? "now" : "")} onClick={(e) => onPick(d, e.shiftKey)}>{+d.slice(8)}</button>
          : <i key={"b" + i} />)}
      </div>
    </div>
  );
}

export default function AddForm({ types, people, edit, startDate, startType, onClose, onDone }) {
  const [dates, setDates] = useState(() => new Set([edit ? edit.date : startDate]));
  const [month, setMonth] = useState(() => monthOf(edit ? edit.date : startDate));
  const [last, setLast] = useState(null);
  const [entries, setEntries] = useState(() => [edit ? { ...edit } : blank(startType || "reload")]);
  const [busy, setBusy] = useState(false);

  const typeOpts = useMemo(() => types.map((t) => ({ value: t.key, label: t.name, dot: t.color })), [types]);
  const brandOpts = BRAND_ORDER.map((b) => ({ value: b, label: b, dot: BRAND_COLORS[b] }));
  const peopleOpts = people.map((p) => ({ value: p.username, label: p.username }));

  const sorted = [...dates].sort();
  const valid = entries.filter((e) => e.title.trim());
  const total = sorted.length * valid.length;
  const setEntry = (i, patch) => setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const pick = (d, shift) => {
    if (edit) { setDates(new Set([d])); return; }
    const next = new Set(dates);
    if (shift && last) { const [a, z] = [last, d].sort(); for (let x = a; x <= z; x = addDays(x, 1)) next.add(x); }
    else if (next.has(d)) next.delete(d); else next.add(d);
    setLast(d); setDates(next);
  };
  const quick = (k) => {
    const next = new Set(dates), wk = (n) => [0, 1, 2, 3, 4].map((i) => addDays(weekStart(todayMYT()), 7 * n + i));
    if (k === "clear") next.clear();
    if (k === "wk0") wk(0).forEach((d) => next.add(d));
    if (k === "wk1") wk(1).forEach((d) => next.add(d));
    if (k === "wd" || k === "we") for (let i = 1; i <= daysIn(month); i++) { const d = ymd(month, i); if ((k === "wd") === (dow(d) < 5)) next.add(d); }
    setDates(next);
  };

  const commit = async () => {
    if (!valid.length) return toast("Give each entry a title");
    if (!sorted.length) return toast("Pick at least one date");
    if (valid.some((e) => e.type_key === "shift" && !e.who.length)) return toast("Pick who works each shift");
    if (total > MAX) return toast(`Too many items (${total}). Max ${MAX} at once`);
    setBusy(true);
    try {
      if (edit) {
        const e = valid[0];
        await sched.update(edit.id, { type_key: e.type_key, date: sorted[0], title: e.title.trim(), start_time: e.start_time || "", end_time: e.end_time || "", brands: e.brands, who: e.who, note: e.note.trim(), repeat: e.repeat, off: e.off ? 1 : 0 });
        toast("Saved");
      } else {
        const items = sorted.flatMap((date) => valid.map((e) => ({
          type_key: e.type_key, date, title: e.title.trim(), start_time: e.start_time || "", end_time: e.end_time || "",
          brands: e.brands, who: e.who, note: e.note.trim(), repeat: e.repeat, off: e.off ? 1 : 0,
        })));
        const r = await sched.add(items);
        toast(`Added ${r.created} item${r.created === 1 ? "" : "s"}: ${valid.length} entr${valid.length === 1 ? "y" : "ies"} on ${sorted.length} date${sorted.length === 1 ? "" : "s"}`);
      }
      onDone(sorted[0]);
    } catch (e) { toast(e.message); setBusy(false); }
  };
  const del = async () => {
    if (!window.confirm(`Delete “${edit.title}”${edit.repeat !== "none" ? " and all its repeats" : ""}?`)) return;
    try { await sched.remove(edit.id); toast("Deleted"); onDone(edit.date); } catch (e) { toast(e.message); }
  };

  return (
    <Modal
      title={edit ? "Edit schedule item" : "Add to schedule"} onClose={onClose} width="min(940px,95vw)"
      footer={<>
        {edit && <button className="sch-btn danger" style={{ marginRight: "auto" }} onClick={del}>Delete</button>}
        <button className="sch-btn" onClick={onClose}>Cancel</button>
        <button className="sch-btn pri" disabled={busy} onClick={commit}>{edit ? "Save changes" : `Add ${total} item${total === 1 ? "" : "s"}`}</button>
      </>}>
      <div className="sch-form" style={{ maxHeight: "70vh", overflow: "auto" }}>
        <div>
          <div className="sch-h">{edit ? "Date" : "Dates · click several, shift-click for a range"}</div>
          <MiniCal selected={dates} month={month} onMonth={(n) => setMonth((m) => shiftMonth(m, n))} onPick={pick} />
          {!edit && <div className="sch-quick">
            <button type="button" className="sch-btn sm" onClick={() => quick("wk0")}>This week</button>
            <button type="button" className="sch-btn sm" onClick={() => quick("wk1")}>Next week</button>
            <button type="button" className="sch-btn sm" onClick={() => quick("wd")}>Weekdays this month</button>
            <button type="button" className="sch-btn sm" onClick={() => quick("we")}>Weekends this month</button>
          </div>}
          <div style={{ marginTop: 10 }}>
            {sorted.length
              ? <><b>{sorted.length} date{sorted.length === 1 ? "" : "s"}</b>: {sorted.slice(0, 6).map((d) => `${DAYS[dow(d)]} ${fmtDay(d)}`).join(" · ")}{sorted.length > 6 ? ` · +${sorted.length - 6} more` : ""}
                {!edit && <> <button type="button" className="sch-btn sm" onClick={() => quick("clear")}>Clear</button></>}</>
              : <span className="dim">No dates picked yet.</span>}
          </div>
        </div>
        <div>
          <div className="sch-h">{edit ? "Entry" : "Entries · add as many as you need"}</div>
          {entries.map((e, i) => (
            <div className="sch-ent" key={i}>
              <div className="sch-enth">
                <b>{edit ? "Entry" : `Entry ${i + 1}`}</b><span className="sch-grow" />
                {!edit && <><span className="dim">Quick fill</span>{Object.entries(SHIFTS).map(([k, [title, s, en]]) =>
                  <button type="button" key={k} className="sch-btn sm" onClick={() => setEntry(i, { type_key: "shift", title, start_time: s, end_time: en, off: k === "OFF" ? 1 : 0 })}>{title}</button>)}</>}
                {entries.length > 1 && <button type="button" className="sch-btn sm danger" onClick={() => setEntries((es) => es.filter((_, j) => j !== i))}>✕</button>}
              </div>
              <div className="sch-two">
                <label>Type<Select value={e.type_key} options={typeOpts} onChange={(v) => setEntry(i, { type_key: v })} /></label>
                <label>Title<input className="input" value={e.title} placeholder="e.g. Weekend Reload 10%" onChange={(ev) => setEntry(i, { title: ev.target.value, off: ev.target.value.trim().toLowerCase() === "day off" ? 1 : 0 })} /></label>
              </div>
              <div className="sch-two">
                <label>Start<Select value={e.start_time} options={TIMES} onChange={(v) => setEntry(i, { start_time: v })} /></label>
                <label>End<Select value={e.end_time} options={TIMES} onChange={(v) => setEntry(i, { end_time: v })} /></label>
              </div>
              <div className="sch-two">
                <label>Brands<MultiSelect value={e.brands} options={brandOpts} onChange={(v) => setEntry(i, { brands: v })} label="Any brand" /></label>
                <label>People<MultiSelect value={e.who} options={peopleOpts} onChange={(v) => setEntry(i, { who: v })} label="Anyone" /></label>
              </div>
              <label>Note<input className="input" value={e.note} placeholder="Rules, caps, anything the team should know" onChange={(ev) => setEntry(i, { note: ev.target.value })} /></label>
              <label>Repeat<Select value={e.repeat} options={REPEATS} onChange={(v) => setEntry(i, { repeat: v })} /></label>
            </div>
          ))}
          {!edit && <button type="button" className="sch-addq" onClick={() => setEntries((es) => [...es, blank(es[es.length - 1].type_key)])}>+ Add another entry</button>}
        </div>
      </div>
      {!edit && <div className="sch-sum">{valid.length} entr{valid.length === 1 ? "y" : "ies"} × {sorted.length} date{sorted.length === 1 ? "" : "s"} = {total} item{total === 1 ? "" : "s"} will be added.</div>}
    </Modal>
  );
}
