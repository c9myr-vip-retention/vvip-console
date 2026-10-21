// Shared helpers for the work-setup pages (projects, flows, templates, analytics, efficiency, bin).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { work, http } from "../api/work.js";
import { Modal, Avatar } from "../ui";
import * as mock from "./fixtures.js";

export const isMock = () => { try { return localStorage.getItem("revamp_mock") === "1"; } catch { return false; } };
// One API object for the pages: the real client, or the fixtures when localStorage.revamp_mock === "1".
// efficiency also takes an optional days window, which the shared client does not expose, so it calls http() directly.
const efficiency = (user, days) => (isMock() ? mock.api.efficiency(user, days) : http(`/api/work/efficiency?${new URLSearchParams({ ...(user ? { user } : {}), ...(days ? { days } : {}) })}`));
export const api = new Proxy({}, { get: (_, k) => (...a) => (k === "efficiency" ? efficiency(...a) : isMock() && mock.api[k] ? mock.api[k](...a) : work[k](...a)) });

export const isAdmin = (ctx) => !!(ctx && ctx.me && ctx.me.manage_users);
export const canEdit = (ctx) => !!(ctx && ctx.me && (ctx.me.manage_users || ctx.me.can_edit));

/** Load once and on reload(). Returns { data, loading, error, reload }. Ignores out-of-date responses. */
export function useLoad(fn, deps = []) {
  const [s, set] = useState({ data: null, loading: true, error: "" });
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    set((p) => ({ ...p, loading: true, error: "" }));
    Promise.resolve().then(fn).then(
      (data) => n === seq.current && set({ data, loading: false, error: "" }),
      (e) => n === seq.current && set((p) => ({ ...p, loading: false, error: e.message || "Could not load" })),
    );
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [run]);
  return { ...s, reload: run };
}

export const useStatus = () => { const [msg, setMsg] = useState(""); return [msg, setMsg]; };

// Timestamps are UTC 'YYYY-MM-DD HH:MM:SS'; show them in Malaysia time (GMT+8).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toMyt = (ts) => { const d = new Date(String(ts).replace(" ", "T") + "Z"); return isNaN(d) ? null : new Date(d.getTime() + 8 * 3600e3); };
const mytKey = (d) => d.toISOString().slice(0, 10);
export function fmtWhen(ts) {
  const d = toMyt(ts);
  if (!d) return "—";
  const now = new Date(Date.now() + 8 * 3600e3), day = mytKey(d);
  if (day === mytKey(now)) {
    const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, "0");
    return `Today, ${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
  }
  if (day === mytKey(new Date(now.getTime() - 864e5))) return "Yesterday";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
export const fmtDay = (date) => { const d = new Date(date + "T00:00:00Z"); return isNaN(d) ? date : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const fmtMin = (m) => (m === null || m === undefined ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
export const pctText = (v) => (v === null || v === undefined ? "—" : `${v}%`);

export const person = (name) => <span className="who"><Avatar name={name} /> <span>{name || "—"}</span></span>;

export function Notice({ error, loading, empty }) {
  if (error) return <div className="card"><div className="body neg">{error}</div></div>;
  if (loading) return <div className="dim" style={{ padding: 14 }}>Loading…</div>;
  return empty ? <div className="dim" style={{ padding: 14 }}>{empty}</div> : null;
}

export function AdminOnly({ what }) {
  return <div className="card"><div className="body dim">{what} is for admins only.</div></div>;
}

/** Yes/No confirmation (used before every delete). danger=true colours the confirm button. */
export function Confirm({ title, text, action = "Delete", onCancel, onConfirm, busy }) {
  return (
    <Modal title={title} onClose={onCancel} width="min(440px,94vw)"
      footer={<><button className="btn" onClick={onCancel}>Cancel</button> <button className="btn danger" disabled={busy} onClick={onConfirm}>{action}</button></>}>
      <div>{text}</div>
    </Modal>
  );
}

// ---------- plain SVG / CSS charts (no chart library) ----------
/** Line chart. series: [{ color, label, values: number[] }]; labels: one x label per point. max: fixed y maximum (e.g. 100 for %). */
export function LineChart({ series, labels = [], height = 150, max: fixedMax }) {
  const box = useRef(null), [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setW(Math.max(200, Math.round(el.clientWidth))));
    ro.observe(el); setW(Math.max(200, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  const H = height, P = { l: 30, r: 10, t: 8, b: 6 };
  const all = series.flatMap((s) => s.values.filter((v) => v !== null && v !== undefined));
  const max = fixedMax || Math.max(1, ...all), n = Math.max(2, ...series.map((s) => s.values.length));
  const x = (i) => P.l + ((W - P.l - P.r) * i) / (n - 1), y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  const every = Math.ceil(labels.length / 7);   // at most ~7 x labels
  return (
    <div ref={box} style={{ width: "100%" }}>
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 5" />
            <text x={0} y={y(t) + 3} fontSize="10" fill="var(--dim)">{t}</text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [x(i), y(v)]));
          const d = pts.map((p, i) => (p ? `${pts[i - 1] ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}` : "")).join(" ");
          return (
            <g key={s.label || s.color}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={s.color}><title>{`${s.label || ""} ${labels[i] || ""}: ${s.values[i]}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      <div style={{ position: "relative", height: 16, marginTop: 4, fontSize: 11.5, color: "var(--dim)" }}>
        {labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && (i === labels.length - 1 || labels.length - 1 - i >= every / 2) && (
          <span key={i} style={{ position: "absolute", left: x(i), transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars. rows: [{ label, value, text?, color? }]; value is 0..max (max defaults to the largest). */
export function BarRows({ rows, max, empty = "No data in this range." }) {
  if (!rows.length) return <div className="dim">{empty}</div>;
  const m = max || Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-r" key={r.label} style={{ gridTemplateColumns: "150px 1fr 96px" }}>
          <span title={r.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          <div className="tr"><i style={{ width: `${Math.min(100, (100 * r.value) / m)}%`, ...(r.color ? { background: r.color } : {}) }} /></div>
          <span className="mono" style={{ whiteSpace: "nowrap", textAlign: "right" }}>{r.text ?? r.value}</span>
        </div>
      ))}
    </div>
  );
}

export const rateColor = (v) => (v === null || v === undefined ? "var(--slate)" : v >= 80 ? "var(--pos)" : v >= 60 ? "var(--warn)" : "var(--neg)");

export function Donut({ pct, color = "var(--pos)" }) {
  const c = 2 * Math.PI * 54, v = pct === null || pct === undefined ? 0 : pct;
  return (
    <svg viewBox="0 0 140 140" width="160" height="160" role="img" aria-label={`${pctText(pct)} on time`}>
      <circle cx="70" cy="70" r="54" fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 70 70)" />
      <text x="70" y="78" textAnchor="middle" fontSize="26" fill="var(--txt)" fontFamily="IBM Plex Mono, monospace">{pctText(pct)}</text>
    </svg>
  );
}

export const newTask = (detail) => window.dispatchEvent(new CustomEvent("rv-new-task", { detail }));
export const openTask = (id) => window.dispatchEvent(new CustomEvent("rv-open-task", { detail: { id } }));
