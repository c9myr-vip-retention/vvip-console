// Schedule. One board for reload events, meetings, maintenance, reports, training and any custom type. (Shifts live in the HR portal: every
// shift screen is hidden while HIDE_SHIFTS is true in ../schedule/logic.js.)
// Everyone reads it (week, lanes, month). Admin adds items for many dates and people at once, edits, drags one-offs to another day,
// manages types and decides swap requests. An agent sees own shifts highlighted and can request a swap on a shift they are on.
// Repeats are stored once by the Worker; this page expands them (see ../schedule/logic.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, MultiSelect, Select, Seg, toast } from "../ui";
import { api } from "../schedule/api.js";
import { useLive } from "../live.js";
import { can } from "../perms.js";
import { AddModal, SwapsModal, TypeModal, ViewModal } from "../schedule/forms.jsx";
import { ManageModal } from "../schedule/manage.jsx";
import { BulkModal } from "../schedule/bulk.jsx";
import { TEAMS } from "../../App.jsx";
import { Lanes, Month, WeekBoard } from "../schedule/views.jsx";
import Roster from "../schedule/roster.jsx";
import {
  DEFAULT_SHIFTS, HIDE_SHIFTS, addDays, addMonths, byTime, expand, fmtD, mondayOf, monthLabel, monthStart, nowLabel, nowMinutes, onDuty, todayMyt, weekLabel,
} from "../schedule/logic.js";
import "../schedule/schedule.css";

const VIEWS = [{ value: "week", label: "Week" }, { value: "lanes", label: "Lanes" }, { value: "month", label: "Month" }, { value: "roster", label: "Roster" }].filter((v) => !(HIDE_SHIFTS && v.value === "roster"));
const noShift = (list, key) => (HIDE_SHIFTS ? list.filter((x) => (x[key] || x.key) !== "shift") : list);
const getPref = (k, d) => { try { return localStorage.getItem("revamp_sched_" + k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem("revamp_sched_" + k, v); } catch { /* storage blocked: the page still works */ } };

export default function Schedule({ ctx }) {
  const me = ctx?.me?.username || "", admin = can(ctx?.me, "schedule.manage"), ownEdit = can(ctx?.me, "schedule.edit_own"), canSwaps = can(ctx?.me, "schedule.swaps"), canEdit = can(ctx?.me, "schedule.swap_request");
  api.setMe(ctx?.me);
  const brands = [...new Set([...(TEAMS[ctx?.viewTeam] || []), ...Object.values(TEAMS).flat()])];   // every team's brands, the team in view first
  const today = todayMyt();

  const [view, setView] = useState(() => (VIEWS.some((v) => v.value === getPref("view", "")) ? getPref("view", "week") : "week"));
  const [anchor, setAnchor] = useState(today);
  const [hidden, setHidden] = useState([]);                 // type keys switched off in the filter
  const [scope, setScope] = useState("all");                // 'all' | 'mine'
  const [data, setData] = useState({ types: [], items: [], my_swaps: [], shifts: DEFAULT_SHIFTS });
  const [state, setState] = useState({ loading: true, error: "" });
  const [people, setPeople] = useState([]);
  const [openSwaps, setOpenSwaps] = useState(0);
  const [modal, setModal] = useState(null);                 // {kind:'add'|'edit'|'view'|'type'|'swaps'|'manage'|'bulk', ...}
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useLive(["schedule"], reload);                      // someone changed the schedule: the board updates on its own
  const seq = useRef(0);

  const mon = mondayOf(anchor), monthFirst = monthStart(anchor);
  const days = useMemo(() => Array.from({ length: view === "roster" ? 14 : 7 }, (_, i) => addDays(mon, i)), [mon, view]);
  const range = useMemo(() => {
    const from = view === "month" ? mondayOf(monthFirst) : mon, to = view === "month" ? addDays(from, 41) : addDays(mon, view === "roster" ? 13 : 6);
    return { from, to };
  }, [view, mon, monthFirst]);
  // fetch a little wider than the view: yesterday + today for "on duty now" (night shifts), last week for "Copy last week"
  const fetchFrom = [range.from, addDays(today, -1), view === "week" && admin ? addDays(mon, -7) : range.from].sort()[0];
  const fetchTo = [range.to, today].sort().pop();

  useEffect(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api.schedule(fetchFrom, fetchTo).then(
      (r) => { if (n === seq.current) { setData({ types: noShift(r.types || [], "key"), items: noShift(r.items || [], "type_key"), my_swaps: r.my_swaps || [], shifts: r.shifts || DEFAULT_SHIFTS }); setState({ loading: false, error: "" }); } },
      (e) => { if (n === seq.current) setState({ loading: false, error: e.message || "Could not load the schedule" }); },
    );
  }, [fetchFrom, fetchTo, tick]);
  useEffect(() => { if (admin || ownEdit) api.people().then((r) => setPeople(r.people || []), () => {}); }, [admin, ownEdit]);
  useEffect(() => { if (canSwaps && !HIDE_SHIFTS) api.swaps().then((r) => setOpenSwaps((r.swaps || []).filter((s) => s.status === "open").length), () => {}); }, [canSwaps, tick]);

  const types = data.types, items = data.items;
  const visibleTypes = types.filter((t) => !hidden.includes(t.key));
  const shown = useMemo(
    () => items.filter((it) => !hidden.includes(it.type_key) && (scope === "all" || it.who.includes(me))),
    [items, hidden, scope, me],
  );
  const occs = useMemo(() => expand(shown, range.from, range.to), [shown, range]);

  // On duty now: every shift, whatever the filters say
  const duty = useMemo(() => onDuty(items, today, nowMinutes()), [items, today]);
  const todayList = useMemo(() => expand(shown.filter((i) => i.type_key !== "shift"), today, today).sort(byTime), [shown, today]);

  const swapState = (id) => { const l = data.my_swaps.filter((s) => s.item_id === id); return l.length ? l[l.length - 1].status : ""; };
  const mayEdit = (it) => admin || (ownEdit && (it.created_by === me || it.who.includes(me)));   // everything, or only items they created or are on
  const open = (occ) => setModal(mayEdit(occ.item) ? { kind: "edit", item: occ.item } : { kind: "view", occ });
  const done = (firstDate) => { setModal(null); if (firstDate) setAnchor(firstDate); reload(); };
  const move = async (id, date) => {
    const it = items.find((i) => i.id === id);
    if (!it || it.date === date) return;
    if (it.repeat !== "none") return toast("Open a repeating item to change its date");
    try { await api.updateItem(id, { date }); toast(`Moved to ${fmtD(date)}`); reload(); } catch (e) { toast(e.message); }
  };
  const copyLastWeek = async () => {
    const prev = addDays(mon, -7), have = new Set(items.filter((i) => i.date >= mon && i.date <= addDays(mon, 6)).map((i) => [i.type_key, i.title, i.date, i.start_time, i.who.join()].join("|")));
    const src = items.filter((i) => i.repeat === "none" && i.date >= prev && i.date < mon).map((i) => ({ ...i, date: addDays(i.date, 7) }))
      .filter((i) => !have.has([i.type_key, i.title, i.date, i.start_time, i.who.join()].join("|")));
    if (!src.length) return toast("Nothing to copy: repeating items already carry over");
    try {
      await api.addItems(src.map((i) => ({ type_key: i.type_key, date: i.date, title: i.title, start_time: i.start_time, end_time: i.end_time, brands: i.brands, who: i.who, note: i.note, repeat: "none" })));
      toast(`Copied ${src.length} one-off item${src.length === 1 ? "" : "s"} from last week (repeating items already carry over)`); reload();
    } catch (e) { toast(e.message); }
  };

  const shift = (n) => setAnchor(view === "month" ? addMonths(monthFirst, n) : addDays(anchor, (view === "roster" ? 14 : 7) * n));
  const atNow = view === "month" ? monthFirst === monthStart(today) : mon === mondayOf(today);
  const label = view === "month" ? monthLabel(monthFirst) : view === "roster" ? `${fmtD(mon)} – ${fmtD(addDays(mon, 13))} ${addDays(mon, 13).slice(0, 4)}` : weekLabel(mon);
  const setV = (v) => { setView(v); setPref("view", v); };

  const typeOpts = types.map((t) => ({ value: t.key, label: t.name, dot: t.color }));
  const picked = types.filter((t) => !hidden.includes(t.key)).map((t) => t.key);
  const onTypes = (keys) => setHidden(types.map((t) => t.key).filter((k) => !keys.includes(k)));

  return (
    <>
      <div className="top">
        <h1>Schedule</h1>
        <Seg value={view} onChange={setV} options={VIEWS} />
        <span className="grow" />
        <button className="btn sm" onClick={() => shift(-1)} aria-label="Previous">‹</button>
        <b className="sch-range">{label}</b>
        <button className="btn sm" onClick={() => shift(1)} aria-label="Next">›</button>
        {!atNow && <button className="btn sm" onClick={() => setAnchor(today)}>{view === "month" ? "This month" : "This week"}</button>}
        {(admin || ownEdit) && (
          <>
            {admin && !HIDE_SHIFTS && canSwaps && <button className="btn sm" onClick={() => setModal({ kind: "swaps" })}>Swap requests{openSwaps ? ` · ${openSwaps}` : ""}</button>}
            {admin && view === "week" && <button className="btn sm" onClick={copyLastWeek}>Copy last week</button>}
            {admin && <button className="btn sm" onClick={() => setModal({ kind: "type" })}>+ New schedule type</button>}
            <button className="btn sm" onClick={() => setModal({ kind: "bulk" })}>Bulk schedule</button>
            {admin && <button className="btn sm" onClick={() => setModal({ kind: "manage" })}>{HIDE_SHIFTS ? "Manage types & delete" : "Manage shifts & delete"}</button>}
            <button className="btn pri" onClick={() => setModal({ kind: "add", date: view === "month" ? today : days.includes(today) ? today : mon })}>+ Add to schedule</button>
          </>
        )}
      </div>

      {!HIDE_SHIFTS && <div className="card" style={{ marginBottom: 14 }}>
        <div className="body sch-duty">
          <b>On duty now · {nowLabel()}</b>
          {duty.length ? duty.map((s) => <span key={s.id} className="who"><Avatar name={s.who[0]} />{s.who[0]} <span className="pill np" style={{ "--c": (types.find((t) => t.key === "shift") || {}).color || "#5F9AD6" }}>{s.title}</span></span>) : <span className="dim">nobody</span>}
          <span className="grow" />
          {todayList.length > 0 && <span className="dim">Today: {todayList.slice(0, 3).map((o) => `${o.item.start_time || "all day"} ${o.item.title}`).join(" · ")}</span>}
        </div>
      </div>}

      <div className="sch-tools">
        <MultiSelect label="Schedules" value={picked} onChange={onTypes} options={typeOpts} />
        <Select className="sm" value={scope} onChange={setScope} style={{ width: "auto", minWidth: 190 }} options={[{ value: "all", label: "Whole team" }, { value: "mine", label: "Only items with my name" }]} />
        <span className="dim sch-hint">
          {admin ? "Click an item to edit it. Drag a one-off item to another day to move it. “+ Add to schedule” takes several dates and entries at once; “Bulk schedule” sets brand events for a whole month."
            : HIDE_SHIFTS ? "Read-only." : "Read-only. Items with your name are highlighted. Open one of your shifts to request a swap."}
        </span>
      </div>

      {state.error && <div className="card"><div className="body neg">{state.error}</div></div>}
      {!state.error && state.loading && !types.length && <div className="dim" style={{ padding: 14 }}>Loading…</div>}
      {!state.error && !state.loading && !types.length && <div className="card"><div className="body dim">No schedule types yet. {admin ? "Add one with “+ New schedule type”." : "Ask an admin to add one."}</div></div>}
      {types.length > 0 && !state.error && (
        view === "week" ? <WeekBoard days={days} today={today} occs={occs} types={types} me={me} admin={admin || ownEdit} hideShifts={HIDE_SHIFTS || hidden.includes("shift")} onOpen={open} onAdd={(d) => setModal({ kind: "add", date: d })} onMove={move} />
        : view === "lanes" ? <Lanes days={days} today={today} occs={occs} types={visibleTypes} me={me} admin={admin || ownEdit} onOpen={open} onAdd={(d, t) => setModal({ kind: "add", date: d, type: t })} onMove={move} />
        : view === "roster" ? <Roster days={days} today={today} items={items} people={people} shifts={data.shifts} admin={admin} me={me} onChanged={reload} />
        : <Month month={monthFirst} today={today} occs={occs} types={types} me={me} onOpen={open} onDay={(d) => { setAnchor(d); setV("week"); }} />
      )}

      {modal?.kind === "add" && <AddModal types={types} people={people} shifts={HIDE_SHIFTS ? [] : data.shifts} brands={brands} date0={modal.date} type0={modal.type} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === "edit" && <AddModal types={types} people={people} shifts={HIDE_SHIFTS ? [] : data.shifts} brands={brands} item={modal.item} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === "view" && <ViewModal occ={modal.occ} types={types} me={me} canEdit={canEdit} swapState={swapState(modal.occ.item.id)} onClose={() => setModal(null)} onSwapped={() => done(null)} />}
      {modal?.kind === "type" && <TypeModal onClose={() => setModal(null)} onCreated={() => done(null)} />}
      {modal?.kind === "manage" && <ManageModal types={types} shifts={data.shifts} onShifts={(l) => setData((d) => ({ ...d, shifts: l }))} onClose={() => setModal(null)} onDeleted={reload} onTypes={reload} />}
      {modal?.kind === "bulk" && <BulkModal types={types} brands={brands} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === "swaps" && <SwapsModal onClose={() => setModal(null)} onChanged={reload} />}
    </>
  );
}
