// Revamp app shell: sidebar (from NAV), top bar, snapshot bar and the page area. Mounted by App.jsx when the rollout flag is on.
// Pages come from ./registry.js and receive ONE prop, ctx (docs/design/BUILD-CONTRACT.md section 4).
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./revamp.css";
import { PAGES } from "./registry.js";
import { NAV_ICONS } from "./tokens.js";
import { can, navFor } from "./perms.js";
import { Select, DatePick, ToastHost, Avatar, Seg } from "./ui/index.jsx";
import { work } from "./api/work.js";
import { contactTodo } from "./shellHelpers.js";

/** Ingest timestamps are UTC 'YYYY-MM-DD HH:MM:SS'; show the clock in Malaysia time (GMT+8). */
const mytHm = (ts) => {
  const d = new Date(String(ts).replace(" ", "T") + "Z");
  return isNaN(d) ? "" : new Date(d.getTime() + 8 * 3600e3).toISOString().slice(11, 16);
};

// Pages that need the loaded board; they are rendered only once a snapshot exists.
const BOARD_PAGES = new Set(["dash", "delta", "queue", "checkin", "grace", "players", "assign"]);
// Pages that show the snapshot bar (day selector) above them.
const SNAP_PAGES = new Set(["dash", "delta", "perf", "queue", "checkin", "grace", "players", "assign", "mine"]);
const todayMY = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const shiftIso = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10); };   // n days back

/** One broken page must not blank the shell (eight people are building pages in parallel). */
class PageBoundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error("[revamp] page crashed:", err); }
  componentDidUpdate(prev) { if (prev.pageKey !== this.props.pageKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card"><div className="body">
        <b className="neg">This page failed to load.</b>
        <div className="dim" style={{ marginTop: 6 }}>{String(this.state.err?.message || this.state.err)}</div>
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => this.setState({ err: null })}>Try again</button>
      </div></div>
    );
  }
}

/** Alerts bell. Dismissals share the live console's localStorage key so both shells agree. */
function Bell({ notices, snap, onGo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [gone, setGone] = useState(() => { try { return JSON.parse(localStorage.getItem("notif_dismissed") || "{}"); } catch (e) { return {}; } });
  const k = (id) => `${snap}:${id}`;
  const dismiss = (ids) => setGone((d) => {
    const n = { ...d }; ids.forEach((id) => { n[k(id)] = 1; });
    try { localStorage.setItem("notif_dismissed", JSON.stringify(n)); } catch (e) { /* private mode */ }
    return n;
  });
  const vis = notices.filter((n) => !gone[k(n.id)]);
  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div className="bellwrap" ref={ref}>
      <button className="bell" title="Alerts" aria-label="Alerts" onClick={() => setOpen((o) => !o)}>🔔{vis.length > 0 && <b>{vis.length}</b>}</button>
      {open && (
        <div className="pop">
          <div className="ph">Alerts{vis.length > 0 && <button className="dim" onClick={() => dismiss(vis.map((n) => n.id))}>clear all</button>}</div>
          {vis.length === 0 && <div className="pe">Nothing needs attention ✓</div>}
          {vis.map((n) => (
            <div key={n.id} className="pi" onClick={() => { if (n.tab) { onGo(n); setOpen(false); } }}>
              <span>{n.icon}</span>
              <div>{n.text}{n.detail && <><br /><span className="dim">{n.detail}</span></>}</div>
              <button className="px" title="Dismiss" onClick={(e) => { e.stopPropagation(); dismiss([n.id]); }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Day selector: Today / Yesterday / −7d plus a calendar limited to days that have a snapshot. */
function SnapBar({ ctx }) {
  const { dates, viewDate, setViewDate, isPast, board } = ctx;
  if (!dates || !dates.length) return null;
  const list = dates.map((d) => d.snapshot_date);
  const newest = list[0], oldest = list[list.length - 1], cur = viewDate || board?.snapshot_date || newest;
  const pick = (iso) => { const before = list.filter((s) => s <= iso); setViewDate(list.includes(iso) ? iso : (before[0] || oldest)); };
  const y = shiftIso(newest, 1), w = shiftIso(newest, 7);
  const v = cur === newest ? "t" : cur === y ? "y" : cur === w ? "w" : "";
  return (
    <>
      <div className="snapline">
        {list.length > 1 && <Seg value={v} onChange={(x) => (x === "t" ? setViewDate(newest) : pick(x === "y" ? y : w))}
          options={[{ value: "t", label: "Today" }, { value: "y", label: "Yesterday" }, { value: "w", label: "−7d" }]} />}
        <DatePick value={cur} onChange={(d) => d && pick(d)} avail={list} onlyAvail min={oldest} max={newest} clearable={false} />
        {board?.synced_at && mytHm(board.synced_at) && <span className="dim">synced {mytHm(board.synced_at)} GMT+8</span>}
      </div>
      {isPast && <div className="banner warn">Viewing a past snapshot: read-only. Switch to Today to take action.</div>}
    </>
  );
}

export default function Shell({ ctx, tab, notices, loading, loadErr, onSignOut }) {
  const { me, viewTeam, board } = ctx;
  const isAdmin = can(me, "teams.all");                       // admin-style views: every team, the team switcher
  const nav = useMemo(() => navFor(me), [me]);                // the pages this role may open
  const keys = useMemo(() => nav.flatMap(([, items]) => items.map(([k]) => k)), [nav]);
  const key = keys.includes(tab) ? tab : keys[0];
  const Page = PAGES[key];
  const mainRef = useRef(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [key]);

  // Sidebar badges. Contact: players still to contact (an agent sees their own). Tasks: my open tasks, red when any is overdue.
  const snap = board?.snapshot_date;
  const contactN = useMemo(
    () => contactTodo(ctx.teamData, ctx.contacts, snap, isAdmin ? null : me.username).length,
    [snap, ctx.contacts, ctx.teamData, isAdmin, me.username]);
  const [tk, setTk] = useState({ open: 0, over: 0 });
  useEffect(() => {
    let dead = false;
    const run = () => {
      if (localStorage.getItem("revamp_mock") === "1") return;
      work.tasks({ assignee: can(me, "tasks.view_all") ? me.username : undefined }).then((r) => {
        if (dead) return;
        const mine = (r.tasks || []).filter((t) => t.status !== "done" && t.assignee === me.username);
        const today = todayMY();
        setTk({ open: mine.length, over: mine.filter((t) => t.due_date && t.due_date < today).length });
      }).catch(() => { if (!dead) setTk({ open: 0, over: 0 }); });   // work API not deployed / not allowed: no badge
    };
    run();
    const id = setInterval(run, 60000);
    return () => { dead = true; clearInterval(id); };
  }, [key, isAdmin, me.username]);
  const badge = (k) => {
    if (k === "queue" && contactN) return <span className="cnt">{contactN}</span>;
    if (k === "tasks" && tk.open) return <span className={"cnt" + (tk.over ? " red" : "")}>{tk.open}</span>;
    return null;
  };

  const viewerRO = !me.can_edit;
  const needsBoard = BOARD_PAGES.has(key);
  const ready = !needsBoard || !!snap;

  return (
    <div className="rv">
      <div className="app">
        <aside className="side">
          <div className="brandmark"><i>♠</i><div>C9MYR<small>VIP Retention Console</small></div></div>
          <div className="sidenav">
          {nav.map(([h, items]) => (
            <React.Fragment key={h}>
              <div className="nav-h">{h}</div>
              {items.map(([k, label]) => (
                <button key={k} className={"nav" + (key === k ? " on" : "")} onClick={() => ctx.goto(k)} aria-current={key === k ? "page" : undefined}>
                  <span className="ic">{NAV_ICONS[k]}</span><span className="lbl">{label}</span>{badge(k)}
                </button>
              ))}
            </React.Fragment>
          ))}
          </div>
          <div className="me"><Avatar name={me.username} /><div><div>{me.username}</div><span className={"role-tag " + (isAdmin ? "admin" : "")}>{me.role_name || me.role || (isAdmin ? "admin" : "agent")}</span></div></div>
        </aside>
        <div className="colmain">
          <header className="topbar">
            <span className="ttl sel-team">
              {isAdmin
                ? <>TEAM <Select className="sm" value={viewTeam} onChange={(t) => ctx.setViewTeam(t)} options={ctx.teamKeys.map((t) => ({ value: t, label: t }))} style={{ width: "auto", minWidth: 64 }} /> · VIP RTN</>
                : `TEAM ${me.team || "B"} · VIP RTN`}
            </span>
            <span className="dim">Daily action console</span>
            <span className="grow" />
            {snap && <Bell notices={notices} snap={snap} onGo={(n) => ctx.goto(n.tab, n.keys ? { keys: n.keys, label: n.focusLabel } : null)} />}
            <button className="btn sm" onClick={() => ctx.loadBoard(ctx.viewDate)}>{loading ? "…" : "Refresh"}</button>
            <button className="btn sm" onClick={onSignOut}>{me.username} · Sign out</button>
          </header>
          <main className="main" ref={mainRef}>
            {loadErr && <div className="banner crit">Could not load data: {loadErr}</div>}
            {!loadErr && board && !snap && !loading && needsBoard && <div className="banner">No snapshots yet — run the sheet feeders (runFeedNow) and refresh.</div>}
            {viewerRO && !ctx.isPast && ["queue", "delta", "checkin", "grace", "players"].includes(key) && (
              <div className="banner warn">👁 View-only account — you can see everything but can't edit the queue. Ask a manager for edit access.</div>)}
            {snap && SNAP_PAGES.has(key) && <SnapBar ctx={ctx} />}
            <PageBoundary pageKey={key}>
              {ready ? <Page key={key} ctx={ctx} /> : (!loadErr && <div className="pageload">{loading || !board ? "Loading…" : ""}</div>)}
            </PageBoundary>
          </main>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
