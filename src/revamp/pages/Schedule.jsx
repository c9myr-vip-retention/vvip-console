// Schedule (key "sched"): everyone reads; admin adds / edits / deletes items and types; an agent can request a swap on a shift they are on.
// Backend: worker/work/schedule.js. Repeats are expanded here. Fixtures: src/revamp/schedule/fixtures.js (localStorage.revamp_mock === "1").
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Seg, Select, MultiSelect, Modal, toast, Avatar, BrandBadge } from "../ui";
import { BRAND_COLORS } from "../tokens.js";
import { sched } from "../schedule/api.js";
import AddForm from "../schedule/AddForm.jsx";
import { DAYS, addDays, byTime, dow, fmtDay, minutesNowMYT, occurs, timeStr, toMins, todayMYT, weekStart } from "../schedule/dates.js";
import "../schedule/schedule.css";

const ONE = { shift: "Shift", reload: "Reload", meeting: "Meeting", maint: "Maintenance", report: "Report", training: "Training" };
const SWATCHES = ["#E11D48", "#F97316", "#EAB308", "#14B8A6", "#0EA5E9", "#A855F7"];
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: keep going */ } },
};

function Card({ s, day, T, me, admin, onOpen }) {
  const mine = s.who.includes(me.username);
  const drag = admin && s.repeat === "none";
  const cls = "sch-card" + (mine ? " mine" : "") + (s.off ? " off" : "");
  const style = { "--c": T.color };
  const onDragStart = (e) => e.dataTransfer.setData("text/plain", String(s.id));
  if (s.off) {
    return (
      <button className={cls} style={style} draggable={drag} onDragStart={onDragStart} onClick={() => onOpen(s, day)}>
        <span className="sch-who">{s.who[0] && <Avatar name={s.who[0]} />}<span className="dim">{s.who[0] || "Unassigned"} · Day off</span></span>
      </button>
    );
  }
  if (s.type_key === "shift") {
    return (
      <button className={cls} style={style} draggable={drag} onDragStart={onDragStart} onClick={() => onOpen(s, day)}>
        <span className="sch-row"><span className="sch-type">{s.title}</span><span className="sch-grow" /><span className="mono dim">{timeStr(s)}</span></span>
        <span className="sch-who"><Avatar name={s.who[0] || "?"} /><b>{s.who.join(", ") || "Unassigned"}</b></span>
        {s.note && <span className="sch-note">{s.note}</span>}
      </button>
    );
  }
  return (
    <button className={cls} style={style} draggable={drag} onDragStart={onDragStart} onClick={() => onOpen(s, day)}>
      <span className="sch-row"><span className="sch-type">{ONE[T.key] || T.name}</span><span className="sch-grow" />{s.repeat !== "none" && <span className="dim" title={s.repeat === "daily" ? "Repeats every day" : "Repeats every week"}>↻</span>}</span>
      <b>{s.title}</b>
      <span className="mono dim">{timeStr(s)}</span>
      {s.brands.length > 0 && <span className="sch-row">{s.brands.slice(0, 3).map((b) => <BrandBadge key={b} brand={b} color={BRAND_COLORS[b]} />)}{s.brands.length > 3 && <span className="dim">+{s.brands.length - 3}</span>}</span>}
      {s.who.length > 0 && <span className="sch-who">{s.who.slice(0, 4).map((u) => <Avatar key={u} name={u} />)}{s.who.length > 4 && <span className="dim">+{s.who.length - 4}</span>}</span>}
      {s.note && <span className="sch-note">{s.note}</span>}
    </button>
  );
}

function ViewModal({ s, day, T, me, onClose }) {
  const [asking, setAsking] = useState(false), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const canSwap = s.type_key === "shift" && !s.off && s.who.includes(me.username) && me.can_edit !== false;
  const send = async () => {
    setBusy(true);
    try { await sched.requestSwap(s.id, note.trim()); toast("Swap requested. Your admin will review it"); onClose(); }
    catch (e) { toast(e.message); setBusy(false); }
  };
  return (
    <Modal title={s.title} onClose={onClose} width="min(520px,94vw)"
      footer={<><button className="sch-btn" onClick={onClose}>Close</button>
        {canSwap && !asking && <button className="sch-btn pri" onClick={() => setAsking(true)}>Request swap</button>}
        {asking && <button className="sch-btn pri" disabled={busy} onClick={send}>Send request</button>}</>}>
      <div><span className="sch-type" style={{ "--c": T.color }}>{T.name}</span> {s.repeat !== "none" && <span className="dim">↻ repeats {s.repeat === "daily" ? "every day" : "every week"}</span>}</div>
      <div className="sch-fields">
        <span className="k">When</span><span>{DAYS[dow(day)]} {fmtDay(day)} · {timeStr(s)}</span>
        {s.brands.length > 0 && <><span className="k">Brands</span><span className="sch-row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{s.brands.map((b) => <BrandBadge key={b} brand={b} color={BRAND_COLORS[b]} />)}</span></>}
        {s.who.length > 0 && <><span className="k">People</span><span className="sch-who" style={{ flexWrap: "wrap" }}>{s.who.map((u) => <span key={u} className="sch-who"><Avatar name={u} />{u}</span>)}</span></>}
        {s.note && <><span className="k">Note</span><span>{s.note}</span></>}
      </div>
      {asking && <label style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 14 }}><span className="dim">Why do you need a swap? (optional)</span>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></label>}
    </Modal>
  );
}

function TypeModal({ onClose, onDone }) {
  const [name, setName] = useState(""), [color, setColor] = useState(SWATCHES[0]), [busy, setBusy] = useState(false);
  const create = async () => {
    if (!name.trim()) return toast("Give the type a name");
    setBusy(true);
    try { const r = await sched.addType({ name: name.trim(), color }); toast(`Created “${r.type.name}”`); onDone(r.type); }
    catch (e) { toast(e.message); setBusy(false); }
  };
  return (
    <Modal title="New schedule type" onClose={onClose} width="min(440px,94vw)"
      footer={<><button className="sch-btn" onClick={onClose}>Cancel</button><button className="sch-btn pri" disabled={busy} onClick={create}>Create type</button></>}>
      <div className="sch-form" style={{ gridTemplateColumns: "1fr" }}>
        <label>Name<input className="input" autoFocus value={name} placeholder="e.g. Leave, Promotions, Audits" onChange={(e) => setName(e.target.value)} /></label>
        <label>Colour<div className="sch-swatches">{SWATCHES.map((c) => <button key={c} type="button" aria-label={c} className={"sch-swatch" + (c === color ? " on" : "")} style={{ "--c": c }} onClick={() => setColor(c)} />)}</div></label>
      </div>
    </Modal>
  );
}

function SwapsModal({ onClose, onChanged }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => sched.swaps().then((r) => setRows(r.swaps)).catch((e) => toast(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id, status) => { try { await sched.decideSwap(id, status); toast(`Swap ${status}`); load(); onChanged(); } catch (e) { toast(e.message); } };
  return (
    <Modal title="Swap requests" onClose={onClose} width="min(620px,94vw)" footer={<button className="sch-btn" onClick={onClose}>Close</button>}>
      {rows === null ? <div className="dim">Loading…</div> : !rows.length ? <div className="dim">No swap requests yet.</div> : rows.map((r) => (
        <div className="sch-swap" key={r.id}>
          <Avatar name={r.from_user} />
          <div className="sch-grow"><b>{r.from_user}</b> · {r.title || "(deleted shift)"} <span className="dim">{r.date && `${DAYS[dow(r.date)]} ${fmtDay(r.date)}`} {r.start_time && `${r.start_time}–${r.end_time}`}</span>
            {r.note && <div className="sch-note">“{r.note}”</div>}</div>
          {r.status === "open"
            ? <><button className="sch-btn sm" onClick={() => decide(r.id, "approved")}>Approve</button><button className="sch-btn sm danger" onClick={() => decide(r.id, "declined")}>Decline</button></>
            : <span className="dim">{r.status}</span>}
        </div>
      ))}
    </Modal>
  );
}

export default function Schedule({ ctx }) {
  const me = ctx?.me || {};
  const admin = !!me.manage_users;
  const [week, setWeek] = useState(() => weekStart(todayMYT()));
  const [view, setView] = useState(() => store.get("sch_view", "board"));
  const [group, setGroup] = useState(() => store.get("sch_group", "type"));
  const [hidden, setHidden] = useState(() => store.get("sch_hidden", []));
  const [mineOnly, setMineOnly] = useState(false);
  const [data, setData] = useState({ types: [], items: [] });
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);       // {kind:'add'|'edit'|'view'|'type'|'swaps', ...}
  const [dropDay, setDropDay] = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const today = todayMYT();

  const load = useCallback(async () => {
    try { setData(await sched.load(week, addDays(week, 6))); setError(""); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, [week]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { sched.people().then((r) => setPeople(r.people)).catch(() => {}); }, []);
  // if the people list is unavailable, still offer everyone already named on the schedule
  const pickable = useMemo(() => people.length ? people : [...new Set([me.username, ...data.items.flatMap((s) => s.who)].filter(Boolean))].sort().map((username) => ({ username })), [people, data.items, me.username]);
  useEffect(() => store.set("sch_view", view), [view]);
  useEffect(() => store.set("sch_group", group), [group]);
  useEffect(() => store.set("sch_hidden", hidden), [hidden]);

  const typeOf = useCallback((k) => data.types.find((t) => t.key === k) || { key: k, name: k, color: "#8B94A7" }, [data.types]);
  const visible = useCallback((s) => !hidden.includes(s.type_key) && (!mineOnly || s.who.includes(me.username)), [hidden, mineOnly, me.username]);
  const on = useCallback((day) => data.items.filter((s) => visible(s) && occurs(s, day)).sort(byTime), [data.items, visible]);

  const shownTypes = data.types.filter((t) => !hidden.includes(t.key));
  const counts = useMemo(() => Object.fromEntries(data.types.map((t) => [t.key, days.reduce((n, d) => n + data.items.filter((s) => s.type_key === t.key && !s.off && occurs(s, d)).length, 0)])), [data.types, data.items, days]);
  const typeOptions = data.types.map((t) => ({ value: t.key, label: `${t.name} · ${counts[t.key]}`, dot: t.color }));

  const onDuty = useMemo(() => {
    const now = minutesNowMYT(), yesterday = addDays(today, -1);
    return data.items.filter((s) => s.type_key === "shift" && !s.off).filter((s) => {
      const a = toMins(s.start_time), b = toMins(s.end_time);
      if (a === null || b === null) return occurs(s, today);
      if (a < b) return occurs(s, today) && a <= now && now < b;
      return (occurs(s, today) && now >= a) || (occurs(s, yesterday) && now < b);   // overnight: started today, or started yesterday and still running
    });
  }, [data.items, today]);
  const todayOther = useMemo(() => data.items.filter((s) => s.type_key !== "shift" && visible(s) && occurs(s, today)).sort(byTime), [data.items, visible, today]);

  const open = (s, day) => setModal(admin ? { kind: "edit", item: s } : { kind: "view", item: s, day });
  const after = (date) => { setModal(null); if (date) setWeek(weekStart(date)); load(); };

  const drop = async (day, e) => {
    e.preventDefault(); setDropDay(null);
    const id = +e.dataTransfer.getData("text/plain"), s = data.items.find((x) => x.id === id);
    if (!s || s.date === day) return;
    try { await sched.update(id, { date: day }); toast(`Moved to ${DAYS[dow(day)]} ${fmtDay(day)}`); load(); } catch (er) { toast(er.message); }
  };
  const dz = (day) => admin ? { onDragOver: (e) => { e.preventDefault(); setDropDay(day); }, onDragLeave: () => setDropDay(null), onDrop: (e) => drop(day, e) } : {};

  const copyWeek = async () => {
    const prev = addDays(week, -7);
    const src = (await sched.load(prev, addDays(prev, 6))).items.filter((s) => s.repeat === "none" && s.date >= prev && s.date < week);
    if (!src.length) return toast("Nothing to copy: repeating items already carry over");
    try {
      await sched.add(src.map((s) => ({ type_key: s.type_key, date: addDays(s.date, 7), title: s.title, start_time: s.start_time, end_time: s.end_time, brands: s.brands, who: s.who, note: s.note, repeat: "none", off: s.off })));
      toast(`Copied ${src.length} one-off item${src.length === 1 ? "" : "s"} from last week`); load();
    } catch (e) { toast(e.message); }
  };

  const addBtn = (day, type) => admin && <button className="sch-addq" onClick={() => setModal({ kind: "add", date: day, type })}>{type ? "+" : "+ Add"}</button>;
  const card = (s, day) => <Card key={`${s.id}:${day}`} s={s} day={day} T={typeOf(s.type_key)} me={me} admin={admin} onOpen={open} />;

  const warn = (day) => {
    if (hidden.includes("shift")) return "";
    const sh = data.items.filter((s) => s.type_key === "shift" && !s.off && occurs(s, day));
    if (!sh.length) return "No cover";
    return sh.some((s) => { const a = toMins(s.start_time), b = toMins(s.end_time); return a !== null && b !== null && (b < a || a >= 21 * 60); }) ? "" : "No night cover";
  };

  let body;
  if (view === "lanes") {
    const lanes = group === "person"
      ? [...new Set(data.items.filter(visible).flatMap((s) => s.who))].sort().map((u) => ({ key: u, label: u, test: (s) => s.who.includes(u) }))
      : shownTypes.map((t) => ({ key: t.key, label: t.name, dot: t.color, test: (s) => s.type_key === t.key }));
    body = (
      <div className="sch-lanes">
        <div className="sch-lh" />
        {days.map((d) => <div key={d} className={"sch-lh" + (d === today ? " today" : "")}>{DAYS[dow(d)]} {fmtDay(d)}{d === today ? " · today" : ""}</div>)}
        {lanes.map((l) => (
          <React.Fragment key={l.key}>
            <div className="sch-lt">{l.dot ? <i className="sch-dot" style={{ "--c": l.dot }} /> : <Avatar name={l.label} />}{l.label}</div>
            {days.map((d) => (
              <div key={d} className={"sch-lc" + (d === today ? " today" : "")} {...dz(d)}>
                {on(d).filter(l.test).map((s) => card(s, d))}
                {group === "type" && addBtn(d, l.key)}
              </div>
            ))}
          </React.Fragment>
        ))}
        {!lanes.length && <div style={{ gridColumn: "1 / -1" }} className="dim">{group === "person" ? "Nobody is named on an item this week." : "Every schedule is switched off. Use the Schedules menu to show some."}</div>}
      </div>
    );
  } else {
    body = (
      <div className="sch-board">
        {days.map((d) => {
          const items = on(d), w = warn(d);
          return (
            <div key={d} className={"sch-col" + (d === today ? " today" : "") + (dropDay === d ? " drop" : "")} {...dz(d)}>
              <div className="sch-ch">{DAYS[dow(d)]} <span>{fmtDay(d)}</span>{d === today && <em>today</em>}</div>
              <div className={"sch-sub" + (w ? " warn" : "")}>{w || `${items.filter((s) => !s.off).length} scheduled`}</div>
              <div className="sch-cb">
                {items.map((s) => card(s, d))}
                {!items.length && !admin && <div className="sch-empty">Nothing scheduled</div>}
                {addBtn(d)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const mod = modal;
  return (
    <div className="sch">
      <div className="sch-top">
        <h1>Schedule</h1>
        <Seg value={view} onChange={setView} options={[{ value: "board", label: "Board" }, { value: "lanes", label: "Lanes" }]} />
        {view === "lanes" && <Select value={group} onChange={setGroup} options={[{ value: "type", label: "Rows: by schedule" }, { value: "person", label: "Rows: by person" }]} style={{ width: 160 }} />}
        <span className="sch-grow" />
        <MultiSelect label="Schedules" options={typeOptions}
          value={shownTypes.map((t) => t.key)} onChange={(v) => setHidden(data.types.map((t) => t.key).filter((k) => !v.includes(k)))} />
        {!admin && <label className="sch-check"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Only my items</label>}
        <button className="sch-btn sm" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}>‹</button>
        <span className="sch-week">{fmtDay(days[0])} – {fmtDay(days[6])} {days[6].slice(0, 4)}</span>
        <button className="sch-btn sm" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}>›</button>
        {week !== weekStart(today) && <button className="sch-btn sm" onClick={() => setWeek(weekStart(today))}>This week</button>}
        {admin && <>
          <button className="sch-btn" onClick={() => setModal({ kind: "swaps" })}>Swap requests</button>
          <button className="sch-btn" onClick={copyWeek}>Copy last week</button>
          <button className="sch-btn" onClick={() => setModal({ kind: "type" })}>+ New type</button>
          <button className="sch-btn pri" onClick={() => setModal({ kind: "add", date: days.includes(today) ? today : days[0] })}>+ Add to schedule</button>
        </>}
      </div>

      <div className="sch-duty">
        <b>On duty now</b>
        {onDuty.length ? onDuty.map((s) => <span key={s.id} className="sch-who"><Avatar name={s.who[0]} />{s.who[0]} <span className="sch-type" style={{ "--c": typeOf("shift").color }}>{s.title}</span></span>) : <span className="dim">nobody</span>}
        <span className="sch-grow" />
        {todayOther.length > 0 && <span className="dim">Today: {todayOther.slice(0, 3).map((s) => `${s.start_time || "all day"} ${s.title}`).join(" · ")}</span>}
      </div>

      <p className="sch-hint">{admin ? "Click an item to edit it. Drag a one-off item to another day to move it. “+ Add to schedule” takes several dates and several entries at once." : me.can_edit === false ? "Read-only. Items with your name are outlined." : "Items with your name are outlined. Open one of your shifts to request a swap."}</p>

      {error && <div className="sch-duty" style={{ borderColor: "var(--neg-line)" }}>Could not load the schedule: {error} <button className="sch-btn sm" onClick={load}>Retry</button></div>}
      {loading ? <div className="dim">Loading…</div> : body}

      {mod?.kind === "add" && <AddForm types={data.types} people={pickable} startDate={mod.date} startType={mod.type} onClose={() => setModal(null)} onDone={after} />}
      {mod?.kind === "edit" && <AddForm types={data.types} people={pickable} edit={mod.item} onClose={() => setModal(null)} onDone={after} />}
      {mod?.kind === "view" && <ViewModal s={mod.item} day={mod.day} T={typeOf(mod.item.type_key)} me={me} onClose={() => setModal(null)} />}
      {mod?.kind === "type" && <TypeModal onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {mod?.kind === "swaps" && <SwapsModal onClose={() => setModal(null)} onChanged={load} />}
    </div>
  );
}
