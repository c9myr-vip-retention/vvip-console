// Live board for the admin Dashboard: one card per agent on the team in view. Shows who is on shift right now (from the Schedule).
// Clock-in, accepting chats, the off-chat timer and violations are "NA" until that tracking is built.
import React, { useEffect, useMemo, useState } from "react";
import { Avatar } from "../ui";
import { useLive } from "../live.js";
import { api } from "../schedule/api.js";
import { tapi, useNow, fmtElapsed, CheckProg } from "../tasks/common.jsx";
import { HIDE_SHIFTS, addDays, nowLabel, nowMinutes, occursOn, onDuty, todayMyt } from "../schedule/logic.js";

const NA = <span className="dim" title="Tracking not built yet">NA</span>;
const parseUtc = (s) => Date.parse(String(s).replace(" ", "T") + "Z");
const liveSec = (o) => (o.spent_seconds || 0) + (o.started_at ? Math.max(0, (Date.now() - parseUtc(o.started_at)) / 1000) : 0);
const mins = (t) => { if (!t) return null; const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };

/** What the schedule says about one person right now: { tone, text }. */
function shiftOf(items, user, today, minute, onNow) {
  const mine = items.filter((i) => i.type_key === "shift" && i.who.includes(user));
  if (onNow.has(user)) { const s = mine.find((i) => onDuty([i], today, minute).length); return { tone: "on", text: `On shift ${s.start_time}–${s.end_time}` }; }
  const todays = mine.filter((i) => occursOn(i, today));
  const off = todays.find((i) => i.off);
  if (off) return { tone: "off", text: off.title };
  const s = todays.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))[0];
  if (!s) return { tone: "none", text: "No shift today" };
  const a = mins(s.start_time), b = mins(s.end_time);
  return a !== null && minute < a ? { tone: "later", text: `Shift ${s.start_time}–${s.end_time}` } : { tone: "done", text: `Shift ended ${b !== null && b <= a ? "" : s.end_time}`.trim() };
}

export default function DashStaff({ viewTeam }) {
  const [people, setPeople] = useState(null), [items, setItems] = useState(null), [err, setErr] = useState("");
  const [q, setQ] = useState(""), [pick, setPick] = useState("all");      // all | on | off
  const [tick, setTick] = useState(0);
  const today = todayMyt(), minute = nowMinutes();

  const [ongoing, setOngoing] = useState({});            // username -> the task they have running right now
  useEffect(() => { api.people().then((r) => setPeople(r.people || []), () => setPeople([])); }, []);
  useEffect(() => {
    let live = true;
    tapi.workload().then((r) => { if (live) setOngoing(Object.fromEntries((r.people || []).filter((x) => x.ongoing).map((x) => [x.username, x.ongoing]))); }, () => { if (live) setOngoing({}); });
    return () => { live = false; };
  }, [tick]);
  useNow(Object.keys(ongoing).length > 0);                 // the timers tick once a second
  useEffect(() => {
    let live = true;
    if (HIDE_SHIFTS) { setItems([]); return undefined; }                  // shifts live in the HR portal: nothing to read here
    api.schedule(addDays(today, -1), today).then((r) => { if (live) { setItems(r.items || []); setErr(""); } }, (e) => { if (live) { setItems([]); setErr(e.message || "Could not read the schedule"); } });
    return () => { live = false; };
  }, [tick, today]);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 60000); return () => clearInterval(id); }, []);
  useLive(["tasks", "schedule"], () => setTick((n) => n + 1));

  const agents = useMemo(() => (people || []).filter((p) => (p.on_leaderboard || p.role === "agent") && p.team === viewTeam).map((p) => p.username).sort((a, b) => a.localeCompare(b)), [people, viewTeam]);
  const onNow = useMemo(() => new Set((items ? onDuty(items, today, minute) : []).flatMap((i) => i.who)), [items, today, minute]);   // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => agents.map((u) => ({ u, on: onNow.has(u), shift: HIDE_SHIFTS ? { tone: "none", text: "Shift: NA" } : items ? shiftOf(items, u, today, minute, onNow) : null })), [agents, items, onNow, today, minute]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nOn = rows.filter((r) => r.on).length, nTask = rows.filter((r) => ongoing[r.u]).length;
  const needle = q.trim().toLowerCase();
  const match = (r) => (pick === "all" ? true : pick === "task" ? !!ongoing[r.u] : (pick === "on") === r.on);
  const shown = rows.filter((r) => match(r) && (!needle || r.u.toLowerCase().includes(needle)))
    .sort((a, b) => (!!ongoing[b.u] - !!ongoing[a.u]) || (b.on - a.on) || a.u.localeCompare(b.u));

  const Chip = ({ id, n, label, na }) => (
    <button type="button" className={"dst-chip" + (pick === id ? " on" : "") + (na ? " na" : "")} disabled={na} aria-pressed={pick === id}
      title={na ? "Tracking not built yet" : undefined} onClick={() => setPick(pick === id ? "all" : id)}>
      <b className="mono">{na ? "NA" : n}</b><span>{label}</span>
    </button>
  );

  return (
    <section className="dst" aria-label="Live board">
      <div className="dst-head">
        <div>
          <div className="dim dst-eyebrow">RIGHT NOW · GMT+8 · {nowLabel()}</div>
          <h2 style={{ margin: "2px 0 0" }}>Live board <span className="dim" style={{ fontSize: 13, fontWeight: 400 }}>· Team {viewTeam}</span></h2>
          <div className="dim">{HIDE_SHIFTS ? "Shift times live in the HR portal. Shift, clock-in and chat status come later." : "Who is on shift now, from the Schedule. Clock-in and chat status come later."}</div>
        </div>
        <span className="grow" />
        <input className="input" placeholder="Search staff…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 190 }} aria-label="Search staff" />
      </div>
      <div className="dst-chips">
        <Chip id="all" n={rows.length} label="Tracked" />
        <Chip id="task" n={nTask} label="On a task now" />
        <Chip id="on" n={nOn} label="On shift now" na={HIDE_SHIFTS} />
        <Chip id="acc" label="Accepting" na />
        <Chip id="nacc" label="Not accepting" na />
        <Chip id="viol" label="In violation now" na />
        <Chip id="off" n={rows.length - nOn} label="Offline" na={HIDE_SHIFTS} />
      </div>
      {err && <div className="banner warn">{err}</div>}
      {people === null || items === null ? <div className="dim" style={{ padding: 10 }}>Loading…</div>
        : !rows.length ? <div className="dim" style={{ padding: 10 }}>No agents on Team {viewTeam} yet.</div>
        : !shown.length ? <div className="dim" style={{ padding: 10 }}>Nobody matches.</div>
        : (
          <div className="dst-grid">
            {shown.map((r) => (
              <div key={r.u} className="card dst-card">
                <div className="who"><Avatar name={r.u} /><b>{r.u}</b></div>
                <div className="dst-big mono">{NA}</div>
                <div className="dim">accepting chats for · off-chat for</div>
                <div className="dst-pills">
                  <span className="pill np" style={{ "--c": "#8B94A7" }}>● Accepting chats: {NA}</span>
                  <span className={"pill np dst-sh " + r.shift.tone}>{r.shift.text}</span>
                </div>
                <div className="dst-pills"><span className="dim dst-tag">Clocked in: {NA}</span></div>
                {ongoing[r.u] ? (
                  <div className="dst-task on">
                    <div className="dim dst-tl">Ongoing task</div>
                    <div className="dst-tt"><b title={ongoing[r.u].title}>{ongoing[r.u].title}</b><span className="timer mono">{fmtElapsed(liveSec(ongoing[r.u]))}</span></div>
                    <CheckProg t={ongoing[r.u]} />
                  </div>
                ) : <div className="dst-task"><span className="dim">No ongoing task</span></div>}
              </div>
            ))}
          </div>
        )}
    </section>
  );
}
