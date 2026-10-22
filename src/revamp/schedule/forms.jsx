// Schedule dialogs: add / edit (many dates x many entries), view + swap request, new type, swap requests (admin).
import React, { useEffect, useMemo, useState } from "react";
import { Avatar, BrandBadge, Modal, MultiSelect, Select, toast } from "../ui";
import { brandColor, BRAND_ORDER } from "../tokens.js";
import { api } from "./api.js";
import {
  DAYS, SHIFT_PRESETS, REPEAT_OPTIONS, addDays, addMonths, dayNum, fmtD, fmtDow, monthGrid, monthLabel, monthStart,
  quickDates, timeOptionsFor, timeStr, todayMyt,
} from "./logic.js";

const MAX_PER_CALL = 500;
const FULL = { width: "100%", justifyContent: "space-between", padding: "8px 11px", fontSize: 13 };
const brandOpts = () => BRAND_ORDER.map((b) => ({ value: b, label: b, dot: brandColor(b) }));
export const typeOf = (types, key) => types.find((t) => t.key === key) || { key, name: key, color: "#8B94A7" };
export const Who = ({ names, max = 4 }) => (
  <span className="who">{names.slice(0, max).map((u) => <Avatar key={u} name={u} />)}{names.length > max && <span className="dim">+{names.length - max}</span>}</span>
);
export const Brands = ({ list, max = 3 }) => (
  <span className="sch-brands">{list.slice(0, max).map((b) => <BrandBadge key={b} brand={b} color={brandColor(b)} />)}{list.length > max && <span className="dim">+{list.length - max}</span>}</span>
);

/* ---------- multi-date month calendar (the kit's DatePick picks one date; here several are needed) ---------- */
function MultiCal({ dates, month, onMonth, onPick, single }) {
  const grid = monthGrid(month), today = todayMyt();
  return (
    <div className="sch-cal">
      <div className="sch-cal-h">
        <button type="button" className="btn sm" onClick={() => onMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <b>{monthLabel(month)}</b>
        <button type="button" className="btn sm" onClick={() => onMonth(addMonths(month, 1))} aria-label="Next month">›</button>
      </div>
      <div className="sch-cal-g">
        {DAYS.map((d) => <span key={d} className="sch-cal-dow">{d[0]}</span>)}
        {grid.map((d) => (
          <button key={d} type="button" onClick={(e) => onPick(d, e.shiftKey)}
            className={"sch-cd" + (dates.has(d) ? " on" : "") + (d === today ? " today" : "") + (d.slice(0, 7) !== month.slice(0, 7) ? " out" : "")}>
            {dayNum(d)}
          </button>
        ))}
      </div>
      <div className="dim sch-cal-tip">{single ? "Pick the new date." : "Click several dates. Shift-click picks a range."}</div>
    </div>
  );
}

const blankEntry = (type_key = "reload") => ({ type_key, title: "", start_time: "12:00", end_time: "23:59", brands: [], who: [], note: "", repeat: "none" });
const fromItem = (it) => ({ type_key: it.type_key, title: it.title, start_time: it.start_time || "", end_time: it.end_time || "", brands: [...it.brands], who: [...it.who], note: it.note || "", repeat: it.repeat });

function EntryForm({ e, i, n, types, people, edit, onChange, onRemove }) {
  const set = (k) => (v) => onChange({ ...e, [k]: v });
  const T = timeOptionsFor(e.start_time, e.end_time);
  const quick = (k) => { const [title, start_time, end_time] = SHIFT_PRESETS[k]; onChange({ ...e, type_key: "shift", title, start_time, end_time }); };
  return (
    <div className="ent">
      <div className="ent-h">
        <b>{edit ? "Entry" : `Entry ${i + 1}`}</b><span className="grow" />
        {!edit && (
          <Select value="" placeholder="Quick fill a shift…" onChange={quick} style={{ width: 190 }}
            options={[{ value: "AM", label: "Morning 09:00–17:00" }, { value: "PM", label: "Afternoon 13:00–21:00" }, { value: "NT", label: "Night 21:00–05:00" }, { value: "OFF", label: "Day off" }]} />
        )}
        {n > 1 && <button type="button" className="btn sm danger" onClick={onRemove} aria-label="Remove this entry">✕</button>}
      </div>
      <div className="row2">
        <label>Type<Select value={e.type_key} onChange={set("type_key")} options={types.map((t) => ({ value: t.key, label: t.name, dot: t.color }))} /></label>
        <label>Title<input className="input" value={e.title} maxLength={200} placeholder="e.g. Weekend Reload 10%" onChange={(x) => set("title")(x.target.value)} /></label>
      </div>
      <div className="row2">
        <label>Start<Select value={e.start_time} onChange={set("start_time")} options={T} /></label>
        <label>End<Select value={e.end_time} onChange={set("end_time")} options={T} /></label>
      </div>
      <div className="row2">
        <label>Brands<MultiSelect label={e.brands.length ? "Brands" : "Any brand"} value={e.brands} onChange={set("brands")} options={brandOpts()} style={FULL} /></label>
        <label>People{e.type_key === "shift" && <span className="warn"> · required</span>}
          <MultiSelect label={e.who.length ? "People" : "Anyone"} value={e.who} onChange={set("who")} options={people.map((p) => ({ value: p.username, label: p.username }))} style={FULL} /></label>
      </div>
      <div className="row2">
        <label>Note<input className="input" value={e.note} maxLength={1000} placeholder="Rules, caps, anything the team should know" onChange={(x) => set("note")(x.target.value)} /></label>
        <label>Repeat<Select value={e.repeat} onChange={set("repeat")} options={REPEAT_OPTIONS} /></label>
      </div>
    </div>
  );
}

/** Add (many dates x many entries) or edit one item. */
export function AddModal({ types, people, item, date0, type0, onClose, onDone }) {
  const today = todayMyt(), edit = !!item;
  const [dates, setDates] = useState(() => new Set([item ? item.date : date0 || today]));
  const [month, setMonth] = useState(() => monthStart(item ? item.date : date0 || today));
  const [last, setLast] = useState(null);
  const [entries, setEntries] = useState(() => [item ? fromItem(item) : blankEntry(type0)]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [confirm, setConfirm] = useState(false);

  const pickDate = (d, range) => {
    setErr("");
    if (edit) return setDates(new Set([d]));
    const next = new Set(dates);
    if (range && last) { const [a, z] = last < d ? [last, d] : [d, last]; for (let x = a; x <= z; x = addDays(x, 1)) next.add(x); }
    else if (next.has(d)) next.delete(d); else next.add(d);
    setLast(d); setDates(next);
  };
  const quick = (k) => { const next = new Set(dates); quickDates(k, today, month).forEach((d) => next.add(d)); setDates(next); };
  const sorted = useMemo(() => [...dates].sort(), [dates]);
  const filled = entries.filter((e) => e.title.trim());
  const total = sorted.length * filled.length;
  const upd = (i) => (e) => setEntries((l) => l.map((x, j) => (j === i ? e : x)));

  const save = async () => {
    if (!filled.length) return setErr("Give each entry a title");
    if (!sorted.length) return setErr("Pick at least one date");
    if (filled.some((e) => e.type_key === "shift" && !e.who.length)) return setErr("Pick who works each shift");
    if (total > MAX_PER_CALL) return setErr(`That is ${total} items. The most in one go is ${MAX_PER_CALL}. Pick fewer dates.`);
    const body = (e) => ({ type_key: e.type_key, title: e.title.trim(), start_time: e.start_time || null, end_time: e.end_time || null, brands: e.brands, who: e.who, note: e.note.trim(), repeat: e.repeat });
    setBusy(true); setErr("");
    try {
      if (edit) { await api.updateItem(item.id, { ...body(filled[0]), date: sorted[0] }); toast("Saved"); }
      else { const r = await api.addItems(sorted.flatMap((date) => filled.map((e) => ({ ...body(e), date })))); toast(`Added ${r.created} item${r.created === 1 ? "" : "s"}: ${filled.length} entr${filled.length === 1 ? "y" : "ies"} on ${sorted.length} date${sorted.length === 1 ? "" : "s"}`); }
      onDone(sorted[0]);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    try { await api.deleteItem(item.id); toast("Item deleted"); onDone(null); } catch (e) { setErr(e.message); setBusy(false); setConfirm(false); }
  };

  const footer = confirm ? (
    <>
      <span style={{ marginRight: "auto" }}>{item.repeat !== "none" ? "Delete this item and every repeat of it?" : "Delete this item?"}</span>
      <button className="btn" onClick={() => setConfirm(false)}>Keep it</button>
      <button className="btn danger" disabled={busy} onClick={del}>Delete</button>
    </>
  ) : (
    <>
      {edit && <button className="btn danger" style={{ marginRight: "auto" }} onClick={() => setConfirm(true)}>Delete</button>}
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn pri" disabled={busy || (!edit && total > MAX_PER_CALL)} onClick={save}>{edit ? "Save changes" : `Add ${total} item${total === 1 ? "" : "s"}`}</button>
    </>
  );
  return (
    <Modal title={edit ? "Edit schedule item" : "Add to schedule"} onClose={onClose} width="min(920px,95vw)" footer={footer}>
      <div className="sch-modal-body">
        <div className="sa-grid">
          <div>
            <div className="sch-h">{edit ? "Date" : "Dates"}</div>
            <MultiCal dates={dates} month={month} onMonth={setMonth} onPick={pickDate} single={edit} />
            {!edit && <div style={{ marginTop: 10 }}><Select value="" placeholder="Quick pick dates…" onChange={quick}
              options={[{ value: "wk0", label: "This week (Mon–Fri)" }, { value: "wk1", label: "Next week (Mon–Fri)" }, { value: "wd", label: "Weekdays this month" }, { value: "we", label: "Weekends this month" }]} /></div>}
            <div className="sch-picked">
              {sorted.length
                ? <><b>{sorted.length} date{sorted.length === 1 ? "" : "s"}</b>: {sorted.slice(0, 6).map((d) => fmtDow(d)).join(" · ")}{sorted.length > 6 ? ` · +${sorted.length - 6} more` : ""}
                  {!edit && <> <button type="button" className="btn sm" onClick={() => setDates(new Set())}>Clear</button></>}</>
                : <span className="dim">No dates picked yet.</span>}
            </div>
          </div>
          <div>
            <div className="sch-h">{edit ? "Entry" : "Entries · add as many as you need"}</div>
            {entries.map((e, i) => <EntryForm key={i} e={e} i={i} n={entries.length} edit={edit} types={types} people={people} onChange={upd(i)} onRemove={() => setEntries((l) => l.filter((_, j) => j !== i))} />)}
            {!edit && <button type="button" className="addq" style={{ width: "100%" }} onClick={() => setEntries((l) => [...l, blankEntry(l.length ? l[l.length - 1].type_key : undefined)])}>+ Add another entry</button>}
          </div>
        </div>
        {!edit && <div className="dim" style={{ marginTop: 12 }}>{filled.length} entr{filled.length === 1 ? "y" : "ies"} × {sorted.length} date{sorted.length === 1 ? "" : "s"} = {total} item{total === 1 ? "" : "s"} will be added.</div>}
        {err && <div className="neg" style={{ marginTop: 10 }}>{err}</div>}
      </div>
    </Modal>
  );
}

/** Read-only view of one occurrence. A person on a shift can ask for a swap from here. */
export function ViewModal({ occ, types, me, canEdit, swapState, onClose, onSwapped }) {
  const { item, date } = occ, T = typeOf(types, item.type_key);
  const mine = item.who.includes(me), swappable = item.type_key === "shift" && mine && !item.off && canEdit;
  const [asking, setAsking] = useState(false), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const send = async () => {
    setBusy(true); setErr("");
    try { await api.requestSwap(item.id, `For ${fmtDow(date)}.${note.trim() ? " " + note.trim() : ""}`); toast("Swap request sent to the admin"); onSwapped(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  const footer = asking
    ? <><button className="btn" onClick={() => setAsking(false)}>Back</button><button className="btn pri" disabled={busy} onClick={send}>Send request</button></>
    : <><button className="btn" onClick={onClose}>Close</button>
        {swappable && (swapState === "open"
          ? <button className="btn" disabled>Swap requested</button>
          : <button className="btn pri" onClick={() => setAsking(true)}>Request swap</button>)}</>;
  return (
    <Modal title={item.title} onClose={onClose} width="min(560px,94vw)" footer={footer}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><span className="pill np" style={{ "--c": T.color }}>{T.name}</span> {item.repeat !== "none" && <span className="dim">↻ repeats {item.repeat === "daily" ? "every day" : "every week"}</span>}</div>
        <div className="fields">
          <span className="k">When</span><span>{fmtDow(date)} · {timeStr(item)}</span>
          {item.brands.length > 0 && <><span className="k">Brands</span><Brands list={item.brands} max={8} /></>}
          {item.who.length > 0 && <><span className="k">People</span><span className="who">{item.who.map((u) => <span key={u} className="who"><Avatar name={u} />{u}</span>)}</span></>}
          {item.note && <><span className="k">Note</span><span>{item.note}</span></>}
          {swapState && swapState !== "open" && <><span className="k">Swap</span><span>Your last request was {swapState}</span></>}
        </div>
        {asking && (
          <label>Why do you need a swap? (optional)
            <textarea className="input" rows={3} value={note} maxLength={400} autoFocus onChange={(e) => setNote(e.target.value)} placeholder={`For ${fmtD(date)}. The admin decides and changes the roster.`} />
          </label>
        )}
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

const SWATCHES = ["#E11D48", "#F97316", "#EAB308", "#14B8A6", "#0EA5E9", "#A855F7", "#EC4899", "#84CC16"];
export function TypeModal({ onClose, onCreated }) {
  const [name, setName] = useState(""), [color, setColor] = useState(SWATCHES[0]), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const save = async () => {
    if (!name.trim()) return setErr("Give the type a name");
    setBusy(true); setErr("");
    try { const r = await api.addType({ name: name.trim(), color }); toast(`Created "${r.type.name}"`); onCreated(r.type); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title="New schedule type" onClose={onClose} width="min(460px,94vw)"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={busy} onClick={save}>Create type</button></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <label>Name<input className="input" autoFocus value={name} maxLength={40} placeholder="e.g. Leave, Promotions, Audits" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} /></label>
        <label>Colour
          <div className="chiprow">{SWATCHES.map((c) => <button key={c} type="button" className={"swatch" + (c === color ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}</div>
        </label>
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

/** Admin: swap requests, newest open first. Approving records the decision; the roster is changed by editing the shift. */
export function SwapsModal({ onClose, onChanged }) {
  const [state, setState] = useState({ list: null, error: "" }), [busy, setBusy] = useState(0);
  const load = () => api.swaps().then((r) => setState({ list: r.swaps, error: "" }), (e) => setState({ list: [], error: e.message }));
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const decide = async (id, status) => {
    setBusy(id);
    try { await api.decideSwap(id, status); toast(status === "approved" ? "Swap approved" : "Swap declined"); await load(); onChanged(); }
    catch (e) { toast(e.message); }
    setBusy(0);
  };
  const list = state.list;
  return (
    <Modal title="Swap requests" onClose={onClose} width="min(640px,94vw)" footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="dim" style={{ marginBottom: 10 }}>Approving records the decision and tells the agent. To change who works the shift, edit the shift on the board.</div>
      {state.error && <div className="neg">{state.error}</div>}
      {list === null && <div className="dim">Loading…</div>}
      {list && !list.length && !state.error && <div className="dim">No swap requests yet.</div>}
      <div className="sch-swaps">
        {(list || []).map((s) => (
          <div key={s.id} className="sch-swap">
            <Avatar name={s.from_user} />
            <div className="grow">
              <div><b>{s.from_user}</b> · {s.item.title}</div>
              <div className="dim">{s.item.repeat !== "none" ? "Repeats " + (s.item.repeat === "daily" ? "every day" : "every week") : fmtDow(s.item.date)}{s.item.start_time ? " · " + timeStr(s.item) : ""}</div>
              {s.note && <div className="sch-swap-note">{s.note}</div>}
            </div>
            {s.status === "open"
              ? <span className="sch-swap-act"><button className="btn sm" disabled={busy === s.id} onClick={() => decide(s.id, "declined")}>Decline</button><button className="btn sm pri" disabled={busy === s.id} onClick={() => decide(s.id, "approved")}>Approve</button></span>
              : <span className={s.status === "approved" ? "pos" : "dim"}>{s.status === "approved" ? "Approved" : "Declined"}</span>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
