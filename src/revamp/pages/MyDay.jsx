// My day (agent home), top to bottom: a greeting, a strip of numbers (players to contact, open, due today, overdue, done today), then two columns.
// Left: what I am working on now (live timer) and my task list. Right: today's schedule, then the daily work (contact next, check-in, grace).
import React, { useEffect, useMemo, useState } from "react";
import { Seg, BrandBadge } from "../ui/index.jsx";
import { api as sched } from "../schedule/api.js";
import { Brands, typeOf } from "../schedule/forms.jsx";
import { HIDE_SHIFTS, byTime, expand, timeStr } from "../schedule/logic.js";
import { useLive, useLiveTick } from "../live.js";
import { api, TEAMS, BRAND_ORDER, dispName, dispId, keyMetric, ckey, fmt } from "../../App.jsx";
import { brandColor } from "../tokens.js";
import { contactTodo } from "../shellHelpers.js";
import useTaskOverlays from "../tasks/useTaskOverlays.jsx";
import {
  useTasksData, meOf, canEdit, todayMY, useNow, useTaskActions, ConflictBanner, DueBadge, CheckProg,
  dueInfo, elapsedSec, fmtElapsed, BUCKETS, bucketOf, byDue,
} from "../tasks/common.jsx";

const HT = [["active", "Active"], ["over", "Overdue"], ["today", "Due today"], ["done", "Done"]];
const BUCKET_ORDER = ["over", "today", "week", "next", "later", "none", "done"];
const dateLine = () => new Date(Date.now() + 8 * 3600e3).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const greet = () => { const h = new Date(Date.now() + 8 * 3600e3).getUTCHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

/** Right-column summary card: title + count, a few rows, "Open" goes to the full page. */
function Side({ title, extra, go, ctx, children }) {
  return (
    <div className="card">
      <h3>{title}{extra ? <> <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>{extra}</span></> : null}<span className="grow" /><button className="btn sm" onClick={() => ctx.goto && ctx.goto(go)}>Open →</button></h3>
      <div className="body" style={{ paddingTop: 4 }}>{children}</div>
    </div>
  );
}
const SideRow = ({ onClick, name, brand, sub, right }) => (
  <div className="lrow" onClick={onClick}>
    <div style={{ minWidth: 0, flex: 1 }}><b>{name}</b><div style={{ marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}><BrandBadge brand={brand} color={brandColor(brand)} />{sub && <span className="dim" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>}</div></div>
    {right}
  </div>
);

/** One number of the strip. onClick makes it a button; tone "alert" turns the border red. */
const Tile = ({ label, value, sub, onClick, tone }) => (
  <div className={"card kpi" + (onClick ? " tile" : "") + (tone === "alert" ? " alert" : "")} onClick={onClick} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}>
    <div className="l">{label}</div>
    <div className="v" style={tone === "alert" ? { color: "var(--neg)" } : undefined}>{value}</div>
    <div className="d dim">{sub}</div>
  </div>
);

/** What is on the schedule today (reload events, meetings, maintenance...). Updates by itself when somebody changes the schedule. */
function TodayCard({ ctx, today }) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useLive(["schedule"], () => setTick((n) => n + 1));
  useEffect(() => {
    let off = false;
    sched.schedule(today, today).then((r) => !off && setData(r), () => !off && setData({ items: [], types: [] }));
    return () => { off = true; };
  }, [today, tick]);
  const list = useMemo(() => (data ? expand((data.items || []).filter((i) => !i.off && (!HIDE_SHIFTS || i.type_key !== "shift")), today, today).sort(byTime) : []), [data, today]);
  const types = (data && data.types) || [];
  return (
    <div className="card">
      <h3>Today on the schedule<span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}> {data ? list.length : ""}</span><span className="grow" /><button className="btn sm" onClick={() => ctx.goto && ctx.goto("sched")}>Open →</button></h3>
      <div className="body" style={{ paddingTop: 4 }}>
        {data === null && <div className="dim" style={{ padding: "14px 0" }}>Loading…</div>}
        {data && !list.length && <div className="dim" style={{ padding: "14px 0" }}>Nothing scheduled for today.</div>}
        {list.slice(0, 6).map((o) => {
          const t = typeOf(types, o.item.type_key);
          return (
            <div key={o.key} className="lrow" onClick={() => ctx.goto && ctx.goto("sched")}>
              <span className="pill np" style={{ "--c": t.color }}>{t.name}</span>
              <div style={{ minWidth: 0, flex: 1 }}><b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{o.item.title}</b>
                {o.item.brands.length > 0 && <div style={{ marginTop: 2 }}><Brands list={o.item.brands} max={4} /></div>}</div>
              <span className="dim mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{timeStr(o.item)}</span>
            </div>
          );
        })}
        {list.length > 6 && <div className="wmore" onClick={() => ctx.goto && ctx.goto("sched")}>Show all {list.length}</div>}
      </div>
    </div>
  );
}

/** Contact next / Check-in / Grace to claim: the agent's daily-work summary, from the board in ctx plus the two read-only endpoints those pages use. */
function DailyCards({ ctx }) {
  const me = ctx.me || {};
  const snap = ctx.board?.snapshot_date;
  const todo = useMemo(() => contactTodo(ctx.teamData, ctx.contacts, snap, me.username), [ctx.teamData, ctx.contacts, snap, me.username]);
  const next = todo.slice(0, 3);
  const brands = ctx.teamBrands || TEAMS[ctx.viewTeam] || BRAND_ORDER;
  const brand = brands.includes("SK69") ? "SK69" : brands[0];
  const [chk, setChk] = useState(null);       // login-check payload, { error } or null while loading
  const [gr, setGr] = useState(null);         // grace-tasks payload, { error } or null
  const dailyTick = useLiveTick(["checkin", "feed", "contact"]);   // a tick or new data: the three cards reload by themselves
  useEffect(() => {
    if (!snap || !me.username || !brand) return;
    let off = false;
    api(`/api/rtn/login-check?${new URLSearchParams({ brand, tier: "V", agent: me.username })}`).then((d) => !off && setChk(d)).catch((e) => !off && setChk({ error: e.message || "Not available" }));
    api("/api/rtn/grace-tasks").then((d) => !off && setGr(d)).catch((e) => !off && setGr({ error: e.message || "Not available" }));
    return () => { off = true; };
  }, [snap, me.username, brand, dailyTick]);
  const byKey = useMemo(() => { const m = {}; (ctx.teamData || []).forEach((r) => (m[ckey(r)] = r)); return m; }, [ctx.teamData]);
  if (!snap) return null;
  const crows = chk && chk.rows ? chk.rows : [];
  const unchecked = crows.filter((r) => !r.login), checked = crows.length - unchecked.length;
  const claims = (gr && gr.rows ? gr.rows : []).filter((r) => r.status === "reloaded" && byKey[`${r.player_key}|${r.brand}|${r.tier_segment}`]);
  const empty = (t) => <div className="dim" style={{ padding: "14px 0" }}>{t}</div>;
  return (
    <>
      <Side title="Contact next" extra={next.length ? `top ${next.length} of ${todo.length}` : "all done"} go="queue" ctx={ctx}>
        {next.map((r) => <SideRow key={ckey(r)} onClick={() => ctx.goto("queue")} name={dispName(r)} brand={r.brand} sub={`Tier ${r.tier_segment}`} right={<span className="mono" style={{ fontWeight: 600 }}>{keyMetric(r)}</span>} />)}
        {!next.length && empty("Nobody left to contact. Nice work.")}
      </Side>
      <Side title="Check-in" extra={chk && !chk.error ? `${checked} of ${crows.length} logged in` : ""} go="checkin" ctx={ctx}>
        {chk === null && empty("Loading…")}
        {chk && chk.error && empty("Not available right now.")}
        {chk && !chk.error && unchecked.slice(0, 3).map((r) => <SideRow key={r.player_key} onClick={() => ctx.goto("checkin")} name={dispId({ brand, uid: r.uid, username: r.username }) || r.player_key} brand={brand} sub="not logged in yet" />)}
        {chk && !chk.error && !unchecked.length && empty(crows.length ? "Everyone is checked." : "Nobody assigned to you for check-in.")}
      </Side>
      <Side title="Grace to claim" extra={gr && !gr.error ? `${claims.length} ready` : ""} go="grace" ctx={ctx}>
        {gr === null && empty("Loading…")}
        {gr && gr.error && empty("Not available right now.")}
        {gr && !gr.error && claims.slice(0, 3).map((r) => (
          <SideRow key={`${r.player_key}|${r.brand}`} onClick={() => ctx.goto("grace")} name={dispName(byKey[`${r.player_key}|${r.brand}|${r.tier_segment}`])} brand={r.brand}
            sub={r.req != null ? `needs ${fmt(r.req)} in a day` : ""} right={<span className="pill np" style={{ "--c": "#4CC38A" }}>Ready</span>} />))}
        {gr && !gr.error && !claims.length && empty("Nothing ready to claim.")}
      </Side>
    </>
  );
}

export default function MyDay({ ctx }) {
  const me = useMemo(() => meOf(ctx), [ctx.me]);   // eslint-disable-line react-hooks/exhaustive-deps
  const { tasks, people, projects, loading, error, reload } = useTasksData();
  const { overlays, openTask, newTask } = useTaskOverlays({ me, people, projects, tasks, onChange: reload });
  const { run, busy, conflict, clearConflict } = useTaskActions(reload);
  const [ht, setHt] = useState("active");
  const today = todayMY();

  const mine = useMemo(() => tasks.filter((t) => t.assignee === me.username), [tasks, me.username]);
  const active = mine.filter((t) => t.status !== "done");
  const ongoing = mine.find((t) => t.status === "progress");
  const over = active.filter((t) => t.due_date && t.due_date < today).sort(byDue);
  const dueToday = active.filter((t) => t.due_date === today).sort(byDue);
  const next = active.filter((t) => t.status === "pending").sort(byDue)[0];
  useNow(!!ongoing);

  const pname = (id) => projects.find((p) => p.id === id)?.name || "No project";
  const filt = (k) => k === "over" ? over : k === "today" ? dueToday : k === "done" ? mine.filter((t) => t.status === "done") : active;
  const list = filt(ht);
  const groups = BUCKET_ORDER.map((k) => [k, BUCKETS.find((b) => b[0] === k)[1], list.filter((t) => bucketOf(t) === k).sort(byDue)]).filter((g) => g[2].length);
  const ed = canEdit(me);
  const snap = ctx.board?.snapshot_date;
  const toContact = useMemo(() => contactTodo(ctx.teamData, ctx.contacts, snap, me.username).length, [ctx.teamData, ctx.contacts, snap, me.username]);
  const doneToday = mine.filter((t) => t.status === "done" && t.completed_at && new Date(Date.parse(t.completed_at.replace(" ", "T") + "Z") + 8 * 3600e3).toISOString().slice(0, 10) === today).length;

  const row = (t) => (
    <div key={t.id} className="frow" onClick={() => openTask(t.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openTask(t.id)}>
      <div className="grow">
        <div className={"t" + (t.status === "done" ? " done-t" : "")}>{t.high_priority ? <span className="fire">🔥 </span> : null}{t.title}</div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>{pname(t.project_id)}</span>
          {t.checklist_total > 0 && <span>{t.checklist_done}/{t.checklist_total} steps</span>}
          {t.status === "progress" && <span style={{ color: "var(--blue)" }}>● Ongoing · <span className="mono">{fmtElapsed(elapsedSec(t))}</span></span>}
        </div>
      </div>
      <DueBadge info={dueInfo(t)} />
      {ed && t.status === "progress" && <button className="btn sm pri" disabled={busy} onClick={(e) => { e.stopPropagation(); run(t, "complete"); }}>✓ Complete</button>}
      {ed && t.status === "pending" && <button className="btn sm" disabled={busy} onClick={(e) => { e.stopPropagation(); run(t, "start"); }}>▶ Start</button>}
    </div>
  );
  return (
    <div>
      <div className="hello top">
        <div>
          <h1>{greet()}, {me.username}</h1>
          <p>{dateLine()}{ctx.viewTeam && ctx.viewTeam !== "ALL" ? ` · Team ${ctx.viewTeam}` : ""}</p>
        </div>
        <span className="grow" />
        {ed && <button className="btn pri" onClick={() => newTask({})}>+ New task</button>}
      </div>
      {error && <div className="banner crit">{error}</div>}
      <ConflictBanner conflict={conflict} onOpen={(id) => { clearConflict(); openTask(id); }} onClose={clearConflict} />

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", marginBottom: 14 }}>
        {snap && <Tile label="Players to contact" value={toContact} sub={toContact ? "waiting for you" : "all done"} onClick={() => ctx.goto && ctx.goto("queue")} />}
        <Tile label="Open tasks" value={active.length} sub="assigned to me" onClick={() => setHt("active")} />
        <Tile label="Due today" value={dueToday.length} sub={dueToday.length ? "finish these today" : "nothing due"} onClick={() => setHt("today")} />
        <Tile label="Overdue" value={over.length} sub={over.length ? "needs attention" : "all on time"} tone={over.length ? "alert" : ""} onClick={() => setHt("over")} />
        <Tile label="Done today" value={doneToday} sub="completed tasks" onClick={() => setHt("done")} />
      </div>

      {ongoing ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="body" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span className="pill" style={{ "--c": "#5F9AD6" }}>ONGOING</span>
              <b className="grow" style={{ cursor: "pointer", minWidth: 200 }} onClick={() => openTask(ongoing.id)}>{ongoing.title}</b>
              <span className="timer mono" style={{ fontSize: 22 }}>{fmtElapsed(elapsedSec(ongoing))}</span>
              {ed && <button className="btn" disabled={busy} onClick={() => run(ongoing, "pause")}>Pause</button>}
              {ed && <button className="btn pri" disabled={busy} onClick={() => run(ongoing, "complete")}>Complete</button>}
            </div>
            <CheckProg t={ongoing} />
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 14, borderStyle: "dashed" }}>
          <div className="body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="grow"><b>No ongoing task</b><div className="dim">You can have many tasks assigned, but only one ongoing at a time.</div></div>
            {ed && next && <button className="btn pri" disabled={busy} onClick={() => run(next, "start")}>Start “{next.title.length > 40 ? next.title.slice(0, 40) + "…" : next.title}”</button>}
          </div>
        </div>
      )}

      {loading ? <div className="pageload">Loading…</div> : (
        <div className="grid" style={{ alignItems: "start", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
          <div className="card">
            <h3>My tasks<span className="grow" /><button className="btn sm" onClick={() => ctx.goto && ctx.goto("tasks")}>Full task views →</button></h3>
            <div className="bar" style={{ padding: "10px 14px 0" }}>
              <Seg value={ht} onChange={setHt} options={HT.map(([k, l]) => ({ value: k, label: l, count: filt(k).length }))} />
            </div>
            {groups.length === 0 && (
              <div className="body" style={{ padding: "28px 20px", textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
                <b>{ht === "done" ? "Nothing completed yet" : ht === "active" && !mine.length ? "No tasks yet" : "Nothing here. Nice."}</b>
                <span className="dim">{ht === "active" && !mine.length ? "Tasks assigned to you, and ones you make for yourself, show up here." : "Switch the tab above to see the rest of your list."}</span>
                {ed && ht === "active" && !mine.length && <button className="btn pri" onClick={() => newTask({})}>+ New task</button>}
              </div>
            )}
            {groups.map(([k, label, items]) => (
              <div key={k}>
                <div className="ddh" style={{ padding: "12px 14px 4px" }}>{label} · {items.length}</div>
                {items.map(row)}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <TodayCard ctx={ctx} today={today} />
            <DailyCards ctx={ctx} />
          </div>
        </div>
      )}
      {overlays}
    </div>
  );
}
