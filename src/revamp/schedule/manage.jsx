// Admin "Manage" dialog for the Schedule page: shift times (the Quick fill list) and deleting many schedule items at once.
import React, { useEffect, useState } from "react";
import { Modal, Select, Seg, toast } from "../ui";
import { api } from "./api.js";
import { addDays, addMonths, fmtD, mondayOf, monthStart, timeOptionsFor, todayMyt } from "./logic.js";

const timeOpts = (...v) => timeOptionsFor(...v).filter((o) => o.value !== "");
const over = (s, e) => s && e && e <= s;

function ShiftRow({ s, onSaved, onRemoved }) {
  const [f, setF] = useState({ name: s.name, start_time: s.start_time, end_time: s.end_time }), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const dirty = f.name.trim() !== s.name || f.start_time !== s.start_time || f.end_time !== s.end_time;
  const save = async () => {
    setBusy(true); setErr("");
    try { const r = await api.updateShift(s.key, f); toast(`Saved "${r.shift.name}"`); onSaved(r.shift); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await api.deleteShift(s.key); toast(`Removed "${s.name}" from the list`); onRemoved(s.key); } catch (e) { setErr(e.message); setBusy(false); }
  };
  const T = timeOpts(f.start_time, f.end_time);
  return (
    <div className="ent">
      <div className="row2" style={{ gridTemplateColumns: "1.4fr 1fr 1fr auto auto", alignItems: "end" }}>
        <label>Name<input className="input" value={f.name} maxLength={30} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Start<Select value={f.start_time} onChange={(v) => setF({ ...f, start_time: v })} options={T} /></label>
        <label>End<Select value={f.end_time} onChange={(v) => setF({ ...f, end_time: v })} options={T} /></label>
        <button className="btn pri" disabled={busy || !dirty} onClick={save}>Save</button>
        <button className="btn danger" disabled={busy} onClick={remove} aria-label={`Remove ${s.name}`}>Remove</button>
      </div>
      {over(f.start_time, f.end_time) && <div className="dim" style={{ marginTop: 6 }}>Ends the next day (counts as night cover).</div>}
      {err && <div className="neg" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function ShiftTimes({ shifts, onChange }) {
  const [f, setF] = useState({ name: "", start_time: "09:00", end_time: "17:00" }), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const add = async () => {
    if (!f.name.trim()) return setErr("Give the new shift a name");
    setBusy(true); setErr("");
    try { const r = await api.addShift({ ...f, name: f.name.trim() }); toast(`Added "${r.shift.name}"`); onChange([...shifts, r.shift]); setF({ ...f, name: "" }); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const T = timeOpts(f.start_time, f.end_time);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="dim">These fill the “Quick fill a shift” list when you add to the schedule. A change applies to shifts you add from now on. Shifts already on the board keep their times: open one on the board to change it.</div>
      {shifts.map((s) => (
        <ShiftRow key={s.key + s.name + s.start_time + s.end_time} s={s}
          onSaved={(n) => onChange(shifts.map((x) => (x.key === n.key ? n : x)))} onRemoved={(k) => onChange(shifts.filter((x) => x.key !== k))} />
      ))}
      {!shifts.length && <div className="dim">No shifts in the list. Add one below.</div>}
      <div className="sch-h">Add a new shift</div>
      <div className="ent">
        <div className="row2" style={{ gridTemplateColumns: "1.4fr 1fr 1fr auto", alignItems: "end" }}>
          <label>Name<input className="input" value={f.name} maxLength={30} placeholder="e.g. Mid, Weekend, Late night" onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} /></label>
          <label>Start<Select value={f.start_time} onChange={(v) => setF({ ...f, start_time: v })} options={T} /></label>
          <label>End<Select value={f.end_time} onChange={(v) => setF({ ...f, end_time: v })} options={T} /></label>
          <button className="btn pri" disabled={busy} onClick={add}>+ Add shift</button>
        </div>
        {over(f.start_time, f.end_time) && <div className="dim" style={{ marginTop: 6 }}>Ends the next day (counts as night cover).</div>}
      </div>
      {err && <div className="neg">{err}</div>}
    </div>
  );
}

const SCOPES = (today) => {
  const mon = mondayOf(today), ms = monthStart(today);
  return {
    past: { label: "Before today", from: "", to: addDays(today, -1) },
    week: { label: "This week", from: mon, to: addDays(mon, 6) },
    month: { label: "This month", from: ms, to: addDays(addMonths(ms, 1), -1) },
    future: { label: "From today on", from: today, to: "" },
    all: { label: "All dates", from: "", to: "" },
  };
};

function DeleteItems({ types, onDone }) {
  const today = todayMyt(), scopes = SCOPES(today);
  const [scope, setScope] = useState("past"), [type, setType] = useState("all"), [sum, setSum] = useState(null), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const q = () => ({ type_key: type === "all" ? undefined : type, from: scopes[scope].from || undefined, to: scopes[scope].to || undefined });
  useEffect(() => {
    let live = true;
    setSum(null); setConfirm(false); setErr("");
    api.deleteMany({ ...q(), preview: true }).then((r) => live && setSum(r), (e) => live && setErr(e.message));
    return () => { live = false; };
  }, [scope, type]);   // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => {
    setBusy(true); setErr("");
    try { const r = await api.deleteMany(q()); toast(`Deleted ${r.deleted} item${r.deleted === 1 ? "" : "s"}`); onDone(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  const what = `${type === "all" ? "schedule items" : (types.find((t) => t.key === type) || {}).name || "items"} · ${scopes[scope].label.toLowerCase()}`;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="dim">Remove many schedule items in one go: shifts, reloads, meetings and the rest. They match by the date the item was set for. A repeating item is matched by its first date and is removed from every week.</div>
      <div className="row2">
        <label>Which items<Select value={type} onChange={setType} options={[{ value: "all", label: "All types" }, ...types.map((t) => ({ value: t.key, label: t.name, dot: t.color }))]} /></label>
        <label>Which dates<Select value={scope} onChange={setScope} options={Object.entries(scopes).map(([value, s]) => ({ value, label: s.label }))} /></label>
      </div>
      <div className="ent">
        {sum === null && !err ? <span className="dim">Counting…</span>
          : sum ? <span><b>{sum.count}</b> item{sum.count === 1 ? "" : "s"} match{sum.count === 1 ? "es" : ""}{sum.repeating ? <> · <b>{sum.repeating}</b> repeating (removed from every week)</> : null}.</span> : null}
      </div>
      {err && <div className="neg">{err}</div>}
      {confirm ? (
        <div className="ent" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ marginRight: "auto" }}>Delete {sum.count} item{sum.count === 1 ? "" : "s"} ({what})? This cannot be undone from the board.</span>
          <button className="btn" onClick={() => setConfirm(false)}>Keep them</button>
          <button className="btn danger" disabled={busy} onClick={run}>Yes, delete {sum.count}</button>
        </div>
      ) : (
        <div><button className="btn danger" disabled={!sum || !sum.count} onClick={() => setConfirm(true)}>Delete {sum && sum.count ? sum.count : ""} item{sum && sum.count === 1 ? "" : "s"}…</button></div>
      )}
    </div>
  );
}

export function ManageModal({ types, shifts, tab0 = "shifts", onShifts, onClose, onDeleted }) {
  const [tab, setTab] = useState(tab0);
  return (
    <Modal title="Manage schedule" onClose={onClose} width="min(760px,95vw)" footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="sch-modal-body" style={{ display: "grid", gap: 14 }}>
        <Seg value={tab} onChange={setTab} options={[{ value: "shifts", label: "Shift times" }, { value: "delete", label: "Delete items" }]} />
        {tab === "shifts" ? <ShiftTimes shifts={shifts} onChange={onShifts} /> : <DeleteItems types={types} onDone={onDeleted} />}
      </div>
    </Modal>
  );
}
