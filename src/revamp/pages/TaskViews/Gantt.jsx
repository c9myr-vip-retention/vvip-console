// Gantt view: one bar per task from its start (created_at, or due date minus the estimate) to its due date.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Seg } from "../../ui/index.jsx";
import { work } from "../../api/work.js";
import { mockEnabled, MOCK_PROJECTS } from "../../taskviews/fixtures.js";
import { STATUS, byDue, dow, fmtDay, todayNum, toNum, toStr } from "../../taskviews/shared.js";
import "../../taskviews/taskviews.css";

const LAB = 260;
const SCALES = { day: 30, week: 14, month: 6 };                              // pixels per day
const startOfMonth = (n) => { const d = new Date(n * 864e5); return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 864e5); };
const nextMonth = (n) => { const d = new Date(n * 864e5); return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 864e5); };
const mon = (d, o) => fmtDay(d, o);

function span(t, today) {
  const due = t.due_date ? toNum(t.due_date) : null;
  const created = t.created_at ? toNum(t.created_at) : null;
  const est = Math.max(1, Math.ceil((t.est_minutes || 480) / 480));
  if (due === null) { const s = t.status === "done" && t.completed_at ? toNum(t.completed_at) : today; return { s, e: s + 2, nodue: t.status !== "done" }; }
  let s = created !== null ? created : due - est;
  if (s > due) s = due;
  return { s, e: due, nodue: false };
}
function barColor(t, today, e) {
  if (t.status === "done") return "#4CC38A";
  if (e < today) return "#F2727F";
  return STATUS[t.status]?.color || "#8B94A7";
}

/** Header units: [{ s, e (exclusive), label, we, now }] and the group row above them. */
function axis(scale, lo, hi, today) {
  const units = [];
  if (scale === "day") for (let d = lo; d <= hi; d++) units.push({ s: d, e: d + 1, label: new Date(d * 864e5).getUTCDate(), sub: "MTWTFSS"[dow(d)], we: dow(d) >= 5, now: d === today, g: startOfMonth(d) });
  else if (scale === "week") for (let d = lo - dow(lo); d <= hi; d += 7) units.push({ s: d, e: d + 7, label: fmtDay(d), we: false, now: today >= d && today < d + 7, g: startOfMonth(d) });
  else for (let d = startOfMonth(lo); d <= hi; d = nextMonth(d)) units.push({ s: d, e: nextMonth(d), label: new Date(d * 864e5).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), we: false, now: today >= d && today < nextMonth(d), g: Math.round(Date.UTC(new Date(d * 864e5).getUTCFullYear(), 0, 1) / 864e5) });
  const groups = [];
  units.forEach((u) => { const last = groups[groups.length - 1]; if (last && last.g === u.g) last.e = u.e; else groups.push({ g: u.g, s: u.s, e: u.e }); });
  return { units, groups, from: units[0].s, to: units[units.length - 1].e };
}

export default function Gantt({ tasks, people, me, onOpen, onChange, projects: projectsProp }) {
  const today = todayNum();
  const [scale, setScale] = useState("week");
  const [group, setGroup] = useState("project");
  const [projects, setProjects] = useState(projectsProp || (mockEnabled() ? MOCK_PROJECTS : []));
  const box = useRef(null);

  useEffect(() => {
    if (projectsProp) { setProjects(projectsProp); return; }
    if (mockEnabled()) return;
    let off = false;
    work.projects({ archived: 0 }).then((r) => { if (!off) setProjects(r.projects || []); }).catch(() => {});
    return () => { off = true; };
  }, [projectsProp]);
  const pname = (id) => (id ? projects.find((p) => p.id === id)?.name || `Project ${id}` : "No project");

  const items = useMemo(() => (tasks || []).map((t) => ({ t, ...span(t, today) })), [tasks, today]);
  const { units, groups, from, to } = useMemo(() => {
    let lo = Math.min(today, ...items.map((i) => i.s)) - 2, hi = Math.max(today, ...items.map((i) => i.e)) + 7;
    lo = Math.max(lo, today - 60); hi = Math.min(hi, today + 240);
    hi = Math.max(hi, lo + Math.ceil(1120 / SCALES[scale]));               // fill the width instead of leaving a blank strip
    return axis(scale, lo, hi, today);
  }, [items, scale, today]);
  const ppd = SCALES[scale], hh = scale === "day" ? 34 : 22, W = (to - from) * ppd, X = (d) => (d - from) * ppd;

  const rows = useMemo(() => {
    const map = new Map();
    items.forEach((i) => { const k = group === "project" ? i.t.project_id || 0 : i.t.assignee || "—"; if (!map.has(k)) map.set(k, []); map.get(k).push(i); });
    return [...map.entries()].map(([k, list]) => ({ k, label: group === "project" ? pname(k) : k, list: list.sort((a, b) => byDue(a.t, b.t)) }))
      .sort((a, b) => (a.k === 0 || a.k === "—") - (b.k === 0 || b.k === "—") || String(a.label).localeCompare(b.label));
  }, [items, group, projects]);

  useEffect(() => { const el = box.current; if (el) el.scrollLeft = Math.max(0, LAB + X(today) - el.clientWidth / 2 + LAB / 2); }, [scale, from]);  // eslint-disable-line

  const gridBg = scale === "month" ? undefined : { backgroundImage: "linear-gradient(90deg,var(--ln,#232A37) 1px,transparent 1px)", backgroundSize: `${ppd * (scale === "day" ? 1 : 7)}px 100%` };
  return (
    <div className="tv tv-gantt-view">
      <div className="tv-bar">
        <Seg value={scale} onChange={setScale} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
        <Seg value={group} onChange={setGroup} options={[{ value: "project", label: "By project" }, { value: "person", label: "By person" }]} />
      </div>
      <div className="tv-gantt" ref={box}>
        <div className="tv-gi" style={{ width: LAB + W }}>
          <div className="tv-gh">
            <div className="tv-gr" style={{ height: 22, borderBottom: 0 }}>
              <div className="tv-glab" style={{ height: 22, borderBottom: "1px solid var(--ln,#232A37)" }}>Task · {fmtDay(from, { day: "numeric", month: "short" })} to {fmtDay(to - 1, { day: "numeric", month: "short", year: "numeric" })}</div>
              <div className="tv-gtrk tv-ghtop" style={{ width: W }}>
                {groups.map((g) => <div key={g.s} className="tv-ghcell" style={{ left: X(g.s), width: (g.e - g.s) * ppd }}>
                  {scale === "month" ? new Date(g.g * 864e5).getUTCFullYear() : new Date(g.g * 864e5).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</div>)}
              </div>
            </div>
            <div className="tv-gr" style={{ height: hh }}>
              <div className="tv-glab" style={{ height: hh }} />
              <div className="tv-gtrk tv-ghbot" style={{ width: W, height: hh, borderBottom: 0 }}>
                {units.map((u) => <div key={u.s} className={`tv-ghcell${u.we ? " we" : ""}${u.now ? " now" : ""}`} style={{ left: X(u.s), width: (u.e - u.s) * ppd }}>{u.sub ? <>{u.sub}<br />{u.label}</> : u.label}</div>)}
              </div>
            </div>
          </div>
          {rows.map((g) => (
            <React.Fragment key={g.k}>
              <div className="tv-gr tv-gg"><div className="tv-glab">{g.label}<span className="c">{g.list.length}</span></div><div className="tv-gtrk" style={{ width: W }} /></div>
              {g.list.map(({ t, s, e, nodue }) => {
                const l = Math.max(s, from), r = Math.min(e + 1, to), w = Math.max(ppd, (r - l) * ppd - 2);
                return (
                  <div className="tv-gr" key={t.id} data-id={t.id}>
                    <div className="tv-glab" onClick={() => onOpen && onOpen(t.id)} title={t.title}>
                      {t.high_priority ? <span className="tv-fire" style={{ margin: 0 }}>!</span> : null}<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                    </div>
                    <div className="tv-gtrk" style={{ width: W, ...gridBg }}>
                      <div className={`tv-bar-t${nodue ? " nodue" : ""}`} onClick={() => onOpen && onOpen(t.id)} data-bar={t.id}
                        style={{ left: X(l), width: w, background: barColor(t, today, e) }}
                        title={`${t.title}\n${t.assignee || ""} · ${fmtDay(s)} to ${t.due_date ? fmtDay(e) : "no deadline"} · ${STATUS[t.status]?.name || t.status}`}>
                        {w > 110 ? (group === "person" ? pname(t.project_id) : t.assignee) : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          {today >= from && today < to && <div className="tv-today" style={{ left: LAB + X(today) + ppd / 2 }} />}
        </div>
      </div>
      <div className="tv-legend">
        {[["#5F9AD6", "In progress"], ["#8B94A7", "Pending"], ["#E39A4B", "Deferred"], ["#4CC38A", "Completed"], ["#F2727F", "Overdue"]].map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}
        <span><i style={{ border: "1px dashed var(--tx,#E7EAF0)" }} />Always going (no deadline)</span>
      </div>
    </div>
  );
}
