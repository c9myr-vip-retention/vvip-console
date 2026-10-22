// Live board for the admin Dashboard: one card per agent on the team in view. Shows who is on shift right now (from the Schedule).
// Clock-in, accepting chats, the off-chat timer and violations are "NA" until that tracking is built.
import React, { useEffect, useMemo, useState } from "react";
import { Avatar } from "../ui";
import { api } from "../schedule/api.js";
import { addDays, nowLabel, nowMinutes, occursOn, onDuty, todayMyt } from "../schedule/logic.js";

const NA = <span className="dim" title="Tracking not built yet">NA</span>;
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

  useEffect(() => { api.people().then((r) => setPeople(r.people || []), () => setPeople([])); }, []);
  useEffect(() => {
    let live = true;
    api.schedule(addDays(today, -1), today).then((r) => { if (live) { setItems(r.items || []); setErr(""); } }, (e) => { if (live) { setItems([]); setErr(e.message || "Could not read the schedule"); } });
    return () => { live = false; };
  }, [tick, today]);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 60000); return () => clearInterval(id); }, []);

  const agents = useMemo(() => (people || []).filter((p) => p.role === "agent" && p.team === viewTeam).map((p) => p.username).sort((a, b) => a.localeCompare(b)), [people, viewTeam]);
  const onNow = useMemo(() => new Set((items ? onDuty(items, today, minute) : []).flatMap((i) => i.who)), [items, today, minute]);   // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => agents.map((u) => ({ u, on: onNow.has(u), shift: items ? shiftOf(items, u, today, minute, onNow) : null })), [agents, items, onNow, today, minute]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nOn = rows.filter((r) => r.on).length;
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (pick === "all" || (pick === "on") === r.on) && (!needle || r.u.toLowerCase().includes(needle)))
    .sort((a, b) => (b.on - a.on) || a.u.localeCompare(b.u));

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
          <div className="dim">Who is on shift now, from the Schedule. Clock-in and chat status come later.</div>
        </div>
        <span className="grow" />
        <input className="input" placeholder="Search staff…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 190 }} aria-label="Search staff" />
      </div>
      <div className="dst-chips">
        <Chip id="all" n={rows.length} label="Tracked" />
        <Chip id="on" n={nOn} label="On shift now" />
        <Chip id="acc" label="Accepting" na />
        <Chip id="nacc" label="Not accepting" na />
        <Chip id="viol" label="In violation now" na />
        <Chip id="off" n={rows.length - nOn} label="Offline" />
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
              </div>
            ))}
          </div>
        )}
    </section>
  );
}
