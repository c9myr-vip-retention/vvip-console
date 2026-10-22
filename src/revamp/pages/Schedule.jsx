// Schedule. One board for shifts, reload events, meetings, maintenance, reports, training and any custom type.
// Everyone reads it (week, lanes, month). Admin adds items for many dates and people at once, edits, drags one-offs to another day,
// manages types and decides swap requests. An agent sees own shifts highlighted and can request a swap on a shift they are on.
// Repeats are stored once by the Worker; this page expands them (see ../schedule/logic.js).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, MultiSelect, Select, Seg, toast } from "../ui";
import { api } from "../schedule/api.js";
import { can } from "../perms.js";
import { AddModal, SwapsModal, TypeModal, ViewModal } from "../schedule/forms.jsx";
import { ManageModal } from "../schedule/manage.jsx";
import { GroupsModal } from "../schedule/groups.jsx";
import { Lanes, Month, WeekBoard } from "../schedule/views.jsx";
import Roster from "../schedule/roster.jsx";
import {
  DEFAULT_SHIFTS, addDays, addMonths, byTime, expand, fmtD, mondayOf, monthLabel, monthStart, nowLabel, nowMinutes, onDuty, todayMyt, weekLabel,
} from "../schedule/logic.js";
import "../schedule/schedule.css";

const VIEWS = [{ value: "week", label: "Week" }, { value: "lanes", label: "Lanes" }, { value: "month", label: "Month" }, { value: "roster", label: "Roster" }];
const getPref = (k, d) => { try { return localStorage.getItem("revamp_sched_" + k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem("revamp_sched_" + k, v); } catch { /* storage blocked: the page still works */ } };

export default function Schedule({ ctx }) {
  const me = ctx?.me?.username || "", admin = can(ctx?.me, "schedule.manage"), canSwaps = can(ctx?.me, "schedule.swaps"), canEdit = can(ctx?.me, "schedule.swap_request");
  api.setMe(ctx?.me);
  const today = todayMyt();

  const [view, setView] = useState(() => (["week", "lanes", "month", "roster"].includes(getPref("view", "")) ? getPref("view", "week") : "week"));
  const [anchor, setAnchor] = useState(today);
  const [hidden, setHidden] = useState([]);                 // type keys switched off in the filter
  const [scope, setScope] = useState("all");                // 'all' | 'mine'
  const [data, setData] = useState({ types: [], items: [], my_swaps: [], shifts: DEFAULT_SHIFTS });
  const [state, setState] = useState({ loading: true, error: "" });
  const [people, setPeople] = useState([]);
  const [openSwaps, setOpenSwaps] = useState(0);
  const [modal, setModal] = useState(null);                 // {kind:'add'|'edit'|'view'|'type'|'swaps'|'manage'|'groups', ...}
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
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
      (r) => { if (n === seq.current) { setData({ types: r.types || [], items: r.items || [], my_swaps: r.my_swaps || [], shifts: r.shifts || DEFAULT_SHIFTS }); setState({ loading: false, error: "" }); } },
      (e) => { if (n === seq.current) setState({ loading: false, error: e.message || "Could not load the schedule" }); },
    );
  }, [fetchFrom, fetchTo, tick]);
  useEffect(() => { if (admin) api.people().then((r) => setPeople(r.people || []), () => {}); }, [admin]);
  useEffect(() => { if (canSwaps) api.swaps().then((r) => setOpenSwaps((r.swaps || []).filter((s) => s.status === "open").length), () => {}); }, [canSwaps, tick]);

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
  const open = (occ) => setModal(admin ? { kind: "edit", item: occ.item } : { kind: "view", occ });
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
        {admin && (
          <>
            <button className="btn sm" onClick={() => setModal({ kind: "swaps" })}>Swap requests{openSwaps ? ` · ${openSwaps}` : ""}</button>
            {view === "week" && <button className="btn sm" onClick={copyLastWeek}>Copy last week</button>}
            <button className="btn sm" onClick={() => setModal({ kind: "type" })}>+ New schedule type</button>
            <button className="btn sm" onClick={() => setModal({ kind: "groups" })}>Shift groups</button>
            <button className="btn sm" onClick={() => setModal({ kind: "manage" })}>Manage shifts &amp; delete</button>
            <button className="btn pri" onClick={() => setModal({ kind: "add", date: view === "month" ? today : days.includes(today) ? today : mon })}>+ Add to schedule</button>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="body sch-duty">
          <b>On duty now · {nowLabel()}</b>
          {duty.length ? duty.map((s) => <span key={s.id} className="who"><Avatar name={s.who[0]} />{s.who[0]} <span className="pill np" style={{ "--c": (types.find((t) => t.key === "shift") || {}).color || "#5F9AD6" }}>{s.title}</span></span>) : <span className="dim">nobody</span>}
          <span className="grow" />
          {todayList.length > 0 && <span className="dim">Today: {todayList.slice(0, 3).map((o) => `${o.item.start_time || "all day"} ${o.item.title}`).join(" · ")}</span>}
        </div>
      </div>

      <div className="sch-tools">
        <MultiSelect label="Schedules" value={picked} onChange={onTypes} options={typeOpts} />
        <Select className="sm" value={scope} onChange={setScope} style={{ width: "auto", minWidth: 190 }} options={[{ value: "all", label: "Whole team" }, { value: "mine", label: "Only items with my name" }]} />
        <span className="dim sch-hint">
          {admin ? "Click an item to edit it. Drag a one-off item to another day to move it. “+ Add to schedule” takes several dates and several entries at once."
            : "Read-only. Items with your name are highlighted. Open one of your shifts to request a swap."}
        </span>
      </div>

      {state.error && <div className="card"><div className="body neg">{state.error}</div></div>}
      {!state.error && state.loading && !types.length && <div className="dim" style={{ padding: 14 }}>Loading…</div>}
      {types.length > 0 && !state.error && (
        view === "week" ? <WeekBoard days={days} today={today} occs={occs} types={types} me={me} admin={admin} hideShifts={hidden.includes("shift")} onOpen={open} onAdd={(d) => setModal({ kind: "add", date: d })} onMove={move} />
        : view === "lanes" ? <Lanes days={days} today={today} occs={occs} types={visibleTypes} me={me} admin={admin} onOpen={open} onAdd={(d, t) => setModal({ kind: "add", date: d, type: t })} onMove={move} />
        : view === "roster" ? <Roster days={days} today={today} items={items} people={people} shifts={data.shifts} admin={admin} me={me} onChanged={reload} />
        : <Month month={monthFirst} today={today} occs={occs} types={types} me={me} onOpen={open} onDay={(d) => { setAnchor(d); setV("week"); }} />
      )}

      {modal?.kind === "add" && <AddModal types={types} people={people} shifts={data.shifts} date0={modal.date} type0={modal.type} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === "edit" && <AddModal types={types} people={people} shifts={data.shifts} item={modal.item} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === "view" && <ViewModal occ={modal.occ} types={types} me={me} canEdit={canEdit} swapState={swapState(modal.occ.item.id)} onClose={() => setModal(null)} onSwapped={() => done(null)} />}
      {modal?.kind === "type" && <TypeModal onClose={() => setModal(null)} onCreated={() => done(null)} />}
      {modal?.kind === "manage" && <ManageModal types={types} shifts={data.shifts} onShifts={(l) => setData((d) => ({ ...d, shifts: l }))} onClose={() => setModal(null)} onDeleted={reload} />}
      {modal?.kind === "groups" && <GroupsModal people={people} shifts={data.shifts} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === "swaps" && <SwapsModal onClose={() => setModal(null)} onChanged={reload} />}
    </>
  );
}
