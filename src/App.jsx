import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { buildMessage, buildInstruction, buildHooks, buildAngles, buildHistoryHooks } from "./messageLibrary";
import { phrase, newPatterns } from "./reportPhrases";
import RevampShell from "./revamp/Shell.jsx";
import { scopeLiveCss } from "./revamp/scopeCss.js";
import { NativeSelect } from "./revamp/ui/index.jsx";

/* ════════════════════════════════════════════════════════════════════
   GROUP B · VIP RTN CONSOLE  v2.1
   Triage → Approach → Assign → Outcome. Phase-1 classification live;
   sequence cards activate as daily history accumulates.
   ════════════════════════════════════════════════════════════════════ */

export const API_BASE = import.meta.env.VITE_API_BASE || "https://groupb-tracker-api.viprtn.workers.dev";   // VITE_API_BASE only for a local preview

export const BRANDS = {
  LPK777: { p: "#7C3AED", a: "#D4AF37", txt: "#E9D5FF", prov: "TC" },
  ACE33:  { p: "#6D28D9", a: "#D946EF", txt: "#F5D0FE", prov: "TC" },
  BM69:   { p: "#4338CA", a: "#FFD23F", txt: "#C7D2FE", prov: "ZY" },
  HOT321: { p: "#BE185D", a: "#FF2E88", txt: "#FBCFE8", prov: "ZY" },
  RM68:   { p: "#047857", a: "#D4AF37", txt: "#A7F3D0", prov: "ZY" },
  SK69:   { p: "#1D4ED8", a: "#22D3EE", txt: "#BFDBFE", prov: "ZY" },
  JK32:   { p: "#D6219A", a: "#A3E635", txt: "#FBCFE8", prov: "ZY" },
  ZAS36:  { p: "#0369A1", a: "#38BDF8", txt: "#BAE6FD", prov: "ZY" },
  // Team A
  JOM99:  { p: "#8B5CF6", a: "#FBBF24", txt: "#DDD6FE", prov: "TC" },
  EZ96:   { p: "#0D9488", a: "#2DD4BF", txt: "#99F6E4", prov: "ZY" },
  PP96:   { p: "#A21CAF", a: "#F0ABFC", txt: "#F5D0FE", prov: "TC" },
  BIG321: { p: "#EA580C", a: "#FB923C", txt: "#FED7AA", prov: "ZY" },
  FUN36:  { p: "#0891B2", a: "#67E8F9", txt: "#A5F3FC", prov: "ZY" },
  JUS22:  { p: "#65A30D", a: "#BEF264", txt: "#D9F99D", prov: "ZY" },
  YES82:  { p: "#DC2626", a: "#FCA5A5", txt: "#FECACA", prov: "ZY" },
  SA:     { p: "#7E22CE", a: "#C4B5FD", txt: "#DDD6FE", prov: "ZY" },   // onboarded 2026-09-10
  // Team C
  SPIN321:{ p: "#6366F1", a: "#FCD34D", txt: "#C7D2FE", prov: "TC" },
  MY36:   { p: "#9333EA", a: "#E9D5FF", txt: "#F3E8FF", prov: "TC" },
  VS96:   { p: "#2563EB", a: "#93C5FD", txt: "#BFDBFE", prov: "ZY" },
  ONG66:  { p: "#CA8A04", a: "#FDE047", txt: "#FEF08A", prov: "ZY" },
  RUSH33: { p: "#E11D48", a: "#FB7185", txt: "#FECDD3", prov: "ZY" },
  MAX39:  { p: "#059669", a: "#6EE7B7", txt: "#A7F3D0", prov: "ZY" },
  OMG67:  { p: "#C026D3", a: "#F0ABFC", txt: "#F5D0FE", prov: "TC" },   // TC, not ZY — confirmed 2026-07-19; ships no uid, and was serving Zyra reward names
  AC69:   { p: "#B45309", a: "#FBBF24", txt: "#FDE68A", prov: "ZY" },
  OG:     { p: "#0F766E", a: "#5EEAD4", txt: "#99F6E4", prov: "ZY" },   // onboarded 2026-09-10
};
export const BRAND_ORDER = ["LPK777", "ACE33", "BM69", "HOT321", "RM68", "SK69", "JK32", "ZAS36"];

// Brand → team map (keep in sync with TEAM_BRANDS in worker/index.js).
export const TEAMS = {
  A: ["JOM99", "EZ96", "PP96", "BIG321", "FUN36", "JUS22", "YES82", "SA"],
  B: ["LPK777", "BM69", "HOT321", "RM68", "SK69", "ACE33", "JK32", "ZAS36"],
  C: ["SPIN321", "MY36", "VS96", "ONG66", "RUSH33", "MAX39", "OMG67", "AC69", "OG"],
};
export const TEAM_KEYS = ["A", "B", "C"];

// Colour channels (batch 1): each hue family carries one meaning. Quiet-days classes are one
// cold ramp (darker = silent longer); TOP_LOSS/TOP_DEP match money neg/pos; GRACE is the only yellow.
export const CLASSES = {
  GRACE:    { label: "GRACE",       color: "#E8C547", desc: "Tier deadline ≤3 days — act today" },
  TOP_LOSS: { label: "TOP LOSS",    color: "#F2727F", desc: "Top-20 net loss today (per brand)" },
  TOP_DEP:  { label: "TOP DEPOSIT", color: "#4CC38A", desc: "Top-20 deposit + winning today" },
  BLOCKED:  { label: "DEP-BLOCKED", color: "#B58CFF", desc: "Playing but not funding, DSLD ≥7" },
  DSLD30:   { label: "DSLD 30+",    color: "#4A87DB", desc: "No deposit 30+ days" },
  DSLD14:   { label: "DSLD 14+",    color: "#6FA3DE", desc: "No deposit 14–29 days" },
  DSLD7:    { label: "DSLD 7+",     color: "#A9C8E8", desc: "No deposit 7–13 days" },
  WATCH:    { label: "WATCH",       color: "#8893A7", desc: "Quiet 3–6 days — observe, no contact" },
  HEALTHY:  { label: "HEALTHY",     color: "#64748B", desc: "No action — restraint is the action" },
};
export const CLASS_ORDER = ["GRACE","TOP_LOSS","TOP_DEP","BLOCKED","DSLD30","DSLD14","DSLD7","WATCH","HEALTHY"];
export const RISK = { GRACE:3, TOP_LOSS:3, BLOCKED:2, DSLD30:2, DSLD14:2, DSLD7:2, TOP_DEP:1, WATCH:1, HEALTHY:0 };
export const STATUSES = ["ASSIGNED","CONTACTED","RESPONDED","RECOVERED","NO_RESPONSE","SKIPPED"];
// Status = a pipeline: grey, teal, green as the player moves forward. No response is an outcome, not an alarm.
export const ST_COLOR = { ASSIGNED:"#8A94A6", CONTACTED:"#56B6C2", RESPONDED:"#3FA7A0", RECOVERED:"#4CC38A", NO_RESPONSE:"#7A8294", SKIPPED:"#64748B" };

/* ── helpers ─────────────────────────────────────────────────────── */
export async function api(path, options = {}) {
  const token = localStorage.getItem("session_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}
/* Copy text to the clipboard, and report honestly whether it worked.
   navigator.clipboard exists ONLY in a secure context (https / localhost) and is routinely
   blocked inside in-app browsers (Lark, WeChat) and iframes — there it is simply undefined,
   or its promise rejects. The old call sites got this wrong two different ways:
     • `navigator.clipboard?.writeText(x)` — the `?.` swallowed the failure, then the button
       still flashed "✓ Copied". It lied: the user pasted nothing.
     • `navigator.clipboard.writeText(x)`  — threw a TypeError inside the click handler, so
       the click appeared to do nothing at all.
   Now: try the real API, fall back to a hidden textarea + execCommand (works over http and
   in most in-app browsers), and return true/false so callers can tell the truth. */
export async function copyText(text) {
  const s = String(text ?? "");
  if (!s) return false;
  try {
    if (window.isSecureContext && navigator.clipboard) { await navigator.clipboard.writeText(s); return true; }
  } catch (e) { /* blocked or rejected — fall through to the legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, s.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) { return false; }
}
/* Copy text that isn't ready yet — for buttons that must fetch before they can copy.
   SAFARI ONLY ALLOWS A CLIPBOARD WRITE THAT STARTS INSIDE THE CLICK. The daily-report button
   awaited two /board fetches first, so by the time it copied, Safari had already expired the
   user activation and refused — and refused the execCommand fallback too, which is why the
   earlier fix changed nothing for a Safari user. (Chrome is lenient here, which is why only
   the Mac users saw it.)
   ClipboardItem accepts a PROMISE, so we hand the clipboard a placeholder synchronously and
   let the fetches resolve into it. Callers must NOT await anything before calling this. */
export async function copyTextPromise(promise) {
  try {
    if (window.isSecureContext && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const blob = promise.then((t) => new Blob([String(t ?? "")], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return true;
    }
  } catch (e) { /* Safari can still refuse — fall through and try the plain path */ }
  try { return await copyText(await promise); } catch (e) { return false; }
}
export const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-MY", { maximumFractionDigits: 0 }));
export const fmtRM = (n) => (n == null ? "—" : "RM " + fmt(n));

// Tolerant number parse: some brands (e.g. RM68) feed comma-decimal text ("78,06", "-1.234,56")
// that lands in D1 as TEXT. Left raw it poisons sums (→ "RM NaN") and value-based classification.
export const toNum = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (s.includes(",")) { if (s.includes(".")) s = s.replace(/\./g, ""); s = s.replace(",", "."); } // European decimals
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
// Numeric columns to normalize at classify time (leave counts/ids/dates as-is).
export const NUMERIC_FIELDS = ["daily_deposit", "daily_deposit_count", "daily_withdraw", "daily_withdraw_count",
  "monthly_deposit", "monthly_deposit_count", "monthly_withdraw", "monthly_withdraw_count",
  "lifetime_deposit", "lifetime_withdraw", "bet", "valid_bet", "win_loss", "pnl", "member_days", "status_days"];
export const fmtK = (n) => { const v = Number(n) || 0, a = Math.abs(v); return a >= 1e6 ? "RM " + (v / 1e6).toFixed(1) + "M" : a >= 1e3 ? "RM " + Math.round(v / 1e3) + "k" : "RM " + Math.round(v); };
export const days = (a, b) => (!a || !b ? null : Math.floor((new Date(b) - new Date(a)) / 86400000));
export const ckey = (r) => `${r.player_key}|${r.brand}|${r.tier_segment}`;
/* Keyboard access for clickable rows/cards that aren't <button>s: Tab reaches them, Enter/Space acts.
   Table rows pass role=null to keep table semantics. Keys inside nested inputs are left alone. */
export const tap = (fn, role = "button") => ({ onClick: fn, tabIndex: 0, ...(role ? { role } : {}),
  onKeyDown: (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fn(e); } } });
export const HIST_CACHE = new Map(); // ckey -> player daily series (per session, drawer memory hooks)
export const looksNumeric = (s) => !s || /^[\d.]+$/.test(String(s).trim());
/* Only render/open http(s) links — blocks javascript:/data: URLs that could run as stored XSS */
export const safeHttpUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : null);
/* Account id: Zyra brands key on the UID, TC brands on the username. Machine-readable — use
   this for exports and anything pasted into BO, never for showing an agent who a player is. */
export const dispId = (r) => (BRANDS[r.brand]?.prov === "ZY" ? (r.uid || r.username) : (r.username || r.uid));
/* The player's real name, when the feed carries one. `addressing` holds it ("Mr. Goh",
   "Akak Weng Sam"); it can also be blank, "-", or junk, so those are rejected. */
export const realName = (r) => {
  const a = String((r && r.addressing) || "").trim();
  return a && a !== "-" && !looksNumeric(a) ? a : null;
};
/* Display identity. Every brand now sends a uid, so the old rule showed agents a bare account
   number ("280923470") for a player they know as "Mr. Goh" — TC brands used to fall back to a
   readable username, and that stopped when the feeder started sending uid for them too.
   Prefer the real name and fall back to the account id. Display only: player_key is untouched. */
/* Headline is always the account id an agent can act on — the username for TC brands, the uid
   for Zyra. The player's name is real but it is a CS-maintained salutation that gets edited
   often (one player changed name 12 times in 30 days), so it belongs underneath as context,
   never as the identifier. */
export const dispName = (r) => dispId(r);
/* Telegram availability flag — shown next to a player's name wherever it appears */
export const TgFlag = ({ on }) => (on ? <span className="tg-flag" title="On Telegram">✈</span> : null);
/* Convert UTC ingest timestamp -> Malaysia clock HH:MM */
export const mytClock = (ts) => {
  if (!ts) return "";
  const d = new Date(String(ts).replace(" ", "T") + "Z");
  return isNaN(d) ? "" : new Date(d.getTime() + 8 * 3600e3).toISOString().slice(11, 16);
};

/* ── Blast export: filtered queue → CSV download + usernames to clipboard ── */
export function exportQueue(rows, snap, label, contactMap) {
  if (!rows.length) return;
  const cm = contactMap || {};
  // CSV-safe: neutralise Excel formula injection (leading = + - @), then quote/escape as needed.
  const csv = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;   // guard formulas, not negative numbers
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const cols = ["brand", "tier", "username", "uid", "addressing", "class", "dsld",
    "deposit_today", "win_loss", "pnl", "grace_end", "last_deposit", "monthly_deposit",
    "lifetime_deposit", "telegram", "assigned_to", "status", "note"];
  const lines = rows.map((r) => {
    const c = cm[`${r.player_key}|${r.brand}|${r.tier_segment}`] || {};
    return [r.brand, r.tier_segment, r.username || "", r.uid || "", r.addressing || "",
      r._cls, r._dsld ?? "", r.daily_deposit ?? "", r.win_loss ?? "", r.pnl ?? "",
      r.grace_end_date || "", r.last_deposit_date || "", r.monthly_deposit ?? "",
      r.lifetime_deposit ?? "", r._tg || "", c.assigned_to || "", c.status || "", c.note || ""
    ].map(csv).join(",");
  });
  // Leading BOM so Excel reads UTF-8 (Chinese / Malay names render correctly).
  const blob = new Blob(["﻿" + cols.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const tag = (label || "blast").replace(/[^\w]+/g, "-");   // segment name → safe filename part
  a.download = `rtn_${tag}_${snap}_${rows.length}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  // Clipboard: name + Telegram link (tab-separated) per row for blast tooling; name only if no link.
  // Account id, not the display name — this feeds blast tooling and has to match BO.
  copyText(rows.map((r) => r._tg ? `${dispId(r)}\t${r._tg}` : dispId(r)).join("\n"));
}

/* ── Paste-list select: "username brand" lines → ckeys to tick in the Table ──
   Brand may be the full name (SPIN321) or the short code (spin). The player token may be the
   username, the uid or the player_key. One pair per line; separators: space, tab, comma, ; or |. */
export const BRAND_ALIAS = (() => {
  const m = {};
  for (const b of Object.keys(BRANDS)) { m[b.toLowerCase()] = b; m[b.toLowerCase().replace(/\d+$/, "")] = b; }
  return m;
})();
export function parsePasteList(text, rows) {
  const idx = new Map();   // "token|BRAND" -> row
  for (const r of rows) for (const t of [r.username, r.uid, r.player_key]) {
    const s = String(t || "").trim().toLowerCase();
    if (s && !idx.has(`${s}|${r.brand}`)) idx.set(`${s}|${r.brand}`, r);
  }
  const keys = new Set(), missing = [], invalid = [];
  const seen = new Set();
  String(text || "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/[\s,;|]+/).filter(Boolean);
    let bi = -1;
    parts.forEach((p, j) => { if (BRAND_ALIAS[p.toLowerCase().replace(/[^a-z0-9]/g, "")]) bi = j; });   // last alias wins
    const pi = parts.findIndex((_, j) => j !== bi);
    if (parts.length < 2 || bi < 0 || pi < 0) { invalid.push(`line ${i + 1}: ${line}`); return; }
    const brand = BRAND_ALIAS[parts[bi].toLowerCase().replace(/[^a-z0-9]/g, "")];
    const player = parts[pi].toLowerCase();
    if (seen.has(`${player}|${brand}`)) return;
    seen.add(`${player}|${brand}`);
    const hit = idx.get(`${player}|${brand}`);
    if (hit) keys.add(ckey(hit)); else missing.push(`${parts[pi]} ${brand}`);
  });
  return { keys, missing, invalid, total: seen.size + invalid.length };
}

/* ── Phase-1 classification (Behavior Book precedence) ──────────── */
export function classifyAll(rows, snap) {
  // Derive player net (pnl) where the feed omitted it — only BM69 sends pnl, but every brand sends
  // lifetime figures, and pnl is exactly lifetime_withdraw - lifetime_deposit (verified against fed values).
  // This makes value-based logic (whales, Priority, at-risk, sorting) work across all 6 brands.
  // Normalize numeric columns first (comma-decimal text → real numbers) so sums and value logic don't break.
  rows = rows.map((r) => {
    const o = { ...r };
    for (const f of NUMERIC_FIELDS) if (o[f] != null && o[f] !== "") o[f] = toNum(o[f]);
    return o;
  });
  rows = rows.map((r) => (r.pnl != null && r.pnl !== ""
    ? r
    : { ...r, pnl: toNum(r.lifetime_withdraw) - toNum(r.lifetime_deposit) }));
  const topLoss = new Set(), topDep = new Set(), whaleCut = {};
  for (const b of new Set(rows.map((r) => r.brand))) {   // every brand present, not just Team B
    const br = rows.filter((r) => r.brand === b);
    br.filter((r) => (r.win_loss ?? 0) < 0).sort((x, y) => (x.win_loss ?? 0) - (y.win_loss ?? 0))
      .slice(0, 20).forEach((r) => topLoss.add(ckey(r)));
    br.filter((r) => (r.daily_deposit ?? 0) > 0 && (r.win_loss ?? 0) > 0)
      .sort((x, y) => (y.daily_deposit ?? 0) - (x.daily_deposit ?? 0))
      .slice(0, 20).forEach((r) => topDep.add(ckey(r)));
    const pnls = br.map((r) => r.pnl ?? 0).sort((a, c) => a - c); // most negative = biggest loser = top value
    whaleCut[b] = pnls.length ? pnls[Math.floor(pnls.length * 0.25)] : 0;
  }
  return rows.map((r) => {
    const dsld = days(r.last_deposit_date, snap);
    const graceDays = r.grace_end_date ? days(snap, r.grace_end_date) : null;
    // FRAGILE = reactivated within ~14 days (fresh return — soften the ask). The feeder's
    // labels are "Reactivated 1-2/3-6/7-13/14-20/21-29 Days"; the first three = last 14 days.
    // (Was startsWith("Reactivated 1-6"), which matched none of the real labels, so FRAGILE
    // never fired — no soft-touch messaging and no "whales reactivated today" banner.)
    const fragile = /^Reactivated (1-2|3-6|7-13) Days/.test(r.group_name || "");
    const whale = r.tier_segment === "V" && (r.pnl ?? 0) < 0 && (r.pnl ?? 0) <= whaleCut[r.brand];
    // COOLING = a whale quiet 5–6 days: the last window to PREVENT churn before it goes cold (7d).
    // A flag (not a class) so it surfaces regardless of _cls. Days 5–6 (not just 6) survives a
    // one-day feeder lag. Top priority in ACT NOW. See docs/ACT_NOW_PRIORITY_SPEC.md.
    const cooling = whale && dsld != null && dsld >= 5 && dsld <= 6;
    let cls = "HEALTHY";
    if (graceDays !== null && graceDays >= 0 && graceDays <= 3) cls = "GRACE";
    else if (topLoss.has(ckey(r))) cls = "TOP_LOSS";
    else if (topDep.has(ckey(r))) cls = "TOP_DEP";
    else if ((r.valid_bet ?? 0) > 0 && (r.daily_deposit ?? 0) === 0 && dsld >= 7) cls = "BLOCKED";
    else if (dsld >= 30) cls = "DSLD30";
    else if (dsld >= 14) cls = "DSLD14";
    else if (dsld >= 7) cls = "DSLD7";
    else if (dsld >= 3) cls = "WATCH";
    return { ...r, _cls: cls, _risk: RISK[cls], _dsld: dsld, _graceDays: graceDays, _fragile: fragile, _whale: whale, _cooling: cooling };
  });
}

/* ── Worklist bands (action-first grouping of the queue) ───────────── */
export const WL_BANDS = [
  { key: "ACT",     label: "ACT NOW",  color: "var(--band-act)", desc: "Cooling whales, deadlines & big losses — handle personally, today" },
  { key: "TODAY",   label: "TODAY",    color: "var(--band-today)", desc: "Today's movers — losses, big deposits, funding gaps" },
  { key: "WINBACK", label: "WIN-BACK", color: "var(--band-win)", desc: "Gone quiet — bring them back" },
];
export const WL_NONE = { key: "NONE", label: "NO ACTION", color: "#64748B", desc: "restraint is the action" };


/* The one key number for the right-aligned amount column */
// Day counts spelled out ("6 days", not "6d") so newer agents read them without decoding.
export const dayCount = (n) => (n == null ? "? days" : `${n} ${n === 1 ? "day" : "days"}`);
export function keyMetric(p) {
  switch (p._cls) {
    case "GRACE":    return dayCount(p._graceDays);
    case "TOP_LOSS": return `RM ${fmt(Math.abs(p.win_loss ?? 0))}`;
    case "TOP_DEP":  return `RM ${fmt(p.daily_deposit)}`;
    case "BLOCKED":  return dayCount(p._dsld);
    case "DSLD30": case "DSLD14": case "DSLD7": return dayCount(p._dsld);
    case "WATCH":    return dayCount(p._dsld);
    default:         return "";
  }
}

/* ════════════════════════ DROPDOWN (hover/click filter menus) ════════════════════════ */
export function Dropdown({ label, value, items, onPick, multi }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const openNow = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setOpen(true); };
  const closeSoon = () => { timer.current = setTimeout(() => setOpen(false), 250); };
  const closeNow = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setOpen(false); };
  return (
    <div className="dd" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button className={"dd-btn" + (value ? " set" : "")}
        onClick={() => (open ? closeNow() : openNow())}>
        {label}{value ? `: ${value}` : ""} ▾
      </button>
      {open && (
        <div className="dd-menu">
          {items.map((it) => (
            <div key={it.key} className={"dd-item" + (it.on ? " on" : "")}
              onClick={() => { onPick(it); if (!multi) closeNow(); }}>
              {multi && <span className="dd-box" />}
              {it.dot && <span className="chip-dot" style={{ background: it.dot }} />}
              <span>{it.label}</span>
              {it.n != null && <span className="dd-n mono">{it.n}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════ LOGIN ════════════════════════ */
export function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() {
    setErr(""); setBusy(true);
    try {
      if (mode === "init") {
        await api("/api/users/init", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
        setMode("login"); setErr("Admin created — log in now.");
      } else {
        const d = await api("/api/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
        localStorage.setItem("session_token", d.token); onLogin(d);
      }
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div className="login-wrap"><div className="login-card">
      <div className="login-mark">♠</div><h1>C9MYR</h1>
      <div className="login-slogan">Winning Together! Growing Forever!</div>
      <div className="login-sub">VIP RETENTION CONSOLE</div>
      <input placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} />
      <input placeholder="Password" type="password" value={p} onChange={(e) => setP(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()} />
      {err && <div className="login-err">{err}</div>}
      <button className="btn-gold" disabled={busy || !u || !p} onClick={submit}>
        {busy ? "..." : mode === "init" ? "Create admin account" : "Sign in"}
      </button>
      <div className="login-switch" {...tap(() => { setMode(mode === "login" ? "init" : "login"); setErr(""); })}>
        {mode === "login" ? "First time setup? Create admin" : "Back to sign in"}
      </div>
    </div></div>
  );
}

/* ════════════════════════ DRAWER ════════════════════════ */
// Deterministic "smart read" — assembles a plain-English situation + recommended tone from the player's
// OWN data. No LLM: instant, RG-safe, explainable. It advises the AGENT; the customer message still
// comes from the approach angles below. Upgrade path later = a live model (Workers AI) for richer prose.
export function whaleSummary(p) {
  const s = [];
  const risk = p._cool2 ? p._cool2.risk : null;
  if (risk != null) {
    s.push(`${risk >= 75 ? "High" : risk >= 50 ? "Elevated" : "Rising"} churn-risk — ${risk}/100.`);
    s.push(`Normally deposits every ~${p._cool2.gap}d, now silent ${p._cool2.dsld}d — ${p._cool2.cooling}× their own rhythm.`);
    if (p._cool2.forecast) s.push(`Worth ~RM${Number(p._cool2.forecast).toLocaleString()} over the next 30 days — about RM${Number(p._cool2.var || 0).toLocaleString()} at risk.`);
  } else if (p._fragile) {
    s.push("Just reactivated — a fresh return, still fragile.");
  } else if (p._react) {
    s.push(`Lapsed ${p._react.dsld}d. Reactivation odds ${p._react.odds}/100 — ${p._react.odds >= 55 ? "worth chasing" : p._react.odds >= 35 ? "an even shot" : "a long shot"}.`);
  } else if (p._dsld != null && p._dsld >= 14) {
    s.push(`Cold — no deposit in ${p._dsld} days.`);
  } else if (p._dsld != null && p._dsld >= 7) {
    s.push(`Quiet — ${p._dsld} days since last deposit.`);
  }
  if (p._whale) s.push(s.length ? "Top-value Tier V whale — handle personally." : "Top-value Tier V whale, on rhythm — steady.");
  let tone = null;
  if (p._cool2 || p._cooling) tone = "Quiet relief check-in — acknowledge the gap, zero deposit push, never “win it back” (RG guard).";
  else if (p._react) tone = "Win-back — warm re-open, remind them what they enjoyed, no pressure, never “win it back”.";
  else if (p._fragile) tone = "Soft touch — smaller ask, warm tone.";
  else if (p._cls === "TOP_LOSS") tone = "Relief / rebate — cushion after a rough run, no urgency.";
  return { read: s.join(" ") || (CLASSES[p._cls] ? CLASSES[p._cls].desc : "Steady — no action needed today."), tone };
}

export function Drawer({ list, index, setIndex, snap, me, team, contact, onSave, onClear, onClose, readOnly }) {
  const p = list[index];
  const c = BRANDS[p.brand] || {};
  const ap = buildMessage(p);
  const [assign, setAssign] = useState(contact?.assigned_to || "");
  const [status, setStatus] = useState(contact?.status || "");
  const [note, setNote] = useState(contact?.note || "");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [showTmpl, setShowTmpl] = useState(false);
  const [showDetails, setShowDetails] = useState(false); // Zone C reference data collapsed by default
  const [hist, setHist] = useState(null); // player's daily series for deep memory hooks
  const [notes, setNotes] = useState(null); // relationship ledger (person-level)
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [followup, setFollowup] = useState("");  // CRM: next follow-up date (YYYY-MM-DD)
  const [fuMsg, setFuMsg] = useState("");        // "" | "ok" | "err" — follow-up save feedback
  const [tgUrl, setTgUrl] = useState(null);      // Telegram archive link (null = not on Telegram)
  const [tgEdit, setTgEdit] = useState(false);   // editing the Telegram link
  const [tgDraft, setTgDraft] = useState("");
  const [tgSaving, setTgSaving] = useState(false);
  const [tgErr, setTgErr] = useState(false);     // Telegram save failed
  const [crmHist, setCrmHist] = useState(null);  // past contacts from contact_log
  const [bonus, setBonus] = useState(null);     // widget bonus lookup: null = not asked, "loading", { programs… } or { error }
  const [livechat, setLivechat] = useState(null); // LiveChat session log (QA audit trail)
  const [lcDraft, setLcDraft] = useState("");
  const [lcBusy, setLcBusy] = useState(false);
  const isMgr = !!me?.manage_users;              // managers can delete audit entries
  useEffect(() => {
    setAssign(contact?.assigned_to || ""); setStatus(contact?.status || "");
    setNote(contact?.note || ""); setCopied(false); setSaved(false); setShowTmpl(false); setShowDetails(false);
  }, [index]);
  // Focus moves into the drawer on open and back to whatever opened it (the queue row) on close,
  // so keyboard users land where they left off.
  const drawerRef = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    drawerRef.current?.focus();
    return () => { if (opener && opener.focus && document.contains(opener)) opener.focus(); };
  }, []);
  // Esc closes the drawer, except while typing (so a note draft isn't lost by reflex).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    let alive = true;
    const key = ckey(p);
    setNoteDraft(""); setNotes(null); setBonus(null);
    const pq = `player_key=${encodeURIComponent(p.player_key)}&brand=${encodeURIComponent(p.brand)}`;
    // deep history hooks (session-cached)
    if (HIST_CACHE.has(key)) { setHist(HIST_CACHE.get(key)); }
    else {
      setHist(null);
      api(`/api/rtn/history?${pq}&tier_segment=${encodeURIComponent(p.tier_segment)}`)
        .then((d) => { if (alive) { HIST_CACHE.set(key, d.series || []); setHist(d.series || []); } })
        .catch(() => { if (alive) setHist([]); });
    }
    // relationship ledger (always fresh — notes are mutable)
    api(`/api/rtn/notes?${pq}`)
      .then((d) => { if (alive) setNotes(d.notes || []); })
      .catch(() => { if (alive) setNotes([]); });
    // CRM: follow-up date + Telegram link + contact history (one call)
    setFollowup(""); setTgUrl(null); setCrmHist(null); setTgEdit(false); setTgDraft(""); setFuMsg(""); setTgErr(false);
    setLivechat(null); setLcDraft("");
    api(`/api/rtn/crm?${pq}`)
      .then((d) => {
        if (!alive) return;
        setFollowup(d.crm?.next_followup || ""); setTgUrl(d.telegram_url || null); setCrmHist(d.history || []);
        setLivechat(d.livechat || []);
      })
      .catch(() => { if (alive) setCrmHist([]); });
    return () => { alive = false; };
  }, [index]);
  // Asked on demand (one click), not on every drawer open: each lookup is ~11 Lark reads shared with the widget.
  async function checkBonuses() {
    const key = ckey(p);
    setBonus("loading");
    try {
      const d = await api(`/api/rtn/bonus-lookup?username=${encodeURIComponent(p.player_key)}&brand=${encodeURIComponent(p.brand)}`);
      if (ckey(list[index]) === key) setBonus(d);
    } catch (e) { setBonus({ error: e.message || "Lookup failed" }); }
  }
  async function saveCrm(extra = {}) {
    const payload = { player_key: p.player_key, brand: p.brand,
      next_followup: extra.next_followup ?? followup };
    try { await api("/api/rtn/crm", { method: "POST", body: JSON.stringify(payload) }); setFuMsg("ok"); setTimeout(() => setFuMsg(""), 1200); }
    catch (e) { setFuMsg("err"); }
  }
  async function saveTelegram() {
    const url = tgDraft.trim();
    setTgSaving(true);
    try {
      await api("/api/rtn/telegram", { method: "POST", body: JSON.stringify({ player_key: p.player_key, brand: p.brand, url }) });
      setTgUrl(url || null); setTgEdit(false); setTgErr(false);
    } catch (e) { setTgErr(true); /* keep draft so the link isn't lost */ }
    setTgSaving(false);
  }
  async function logLivechat() {
    const u = lcDraft.trim();
    if (!u || lcBusy) return;
    setLcBusy(true);
    try {
      const d = await api("/api/rtn/livechat", { method: "POST", body: JSON.stringify({ player_key: p.player_key, brand: p.brand, url: u }) });
      setLivechat(d.livechat || []); setLcDraft("");
      // A logged chat is a contact: auto-assign to this agent + mark CONTACTED (never downgrade a later status).
      if (!readOnly && me?.username) {
        const nextStatus = (!status || status === "ASSIGNED") ? "CONTACTED" : status;
        setAssign(me.username); setStatus(nextStatus);
        try { await save({ assigned_to: me.username, status: nextStatus }); } catch (e) { /* chat still logged */ }
      }
    } catch (e) { /* keep draft so the link isn't lost */ }
    setLcBusy(false);
  }
  async function removeLivechat(id) {
    try {
      await api(`/api/rtn/livechat/${id}`, { method: "DELETE" });
      setLivechat((ls) => (ls || []).filter((l) => l.id !== id));
    } catch (e) { /* no-op */ }
  }
  async function addNote() {
    const text = noteDraft.trim();
    if (!text || noteBusy) return;
    setNoteBusy(true);
    try {
      await api("/api/rtn/notes", { method: "POST", body: JSON.stringify({ player_key: p.player_key, brand: p.brand, note: text }) });
      setNoteDraft("");
      const d = await api(`/api/rtn/notes?player_key=${encodeURIComponent(p.player_key)}&brand=${encodeURIComponent(p.brand)}`);
      setNotes(d.notes || []);
    } catch (e) { /* keep draft so the CS doesn't lose their text */ }
    setNoteBusy(false);
  }
  async function removeNote(id) {
    try {
      await api(`/api/rtn/notes/${id}`, { method: "DELETE" });
      setNotes((ns) => (ns || []).filter((n) => n.id !== id));
    } catch (e) { /* no-op */ }
  }
  async function save(extra = {}) {
    const payload = { snapshot_date: snap, player_key: p.player_key, brand: p.brand,
      tier_segment: p.tier_segment, class: p._cls,
      assigned_to: extra.assigned_to ?? assign, status: extra.status ?? status, note: extra.note ?? note };
    await onSave(payload); setSaved(true); setTimeout(() => setSaved(false), 1200);
  }
  async function clear() {
    if (!window.confirm("Clear this contact completely? It removes the assignment, status, and note, and the player drops out of Performance counts. This cannot be undone.")) return;
    await onClear({ snapshot_date: snap, player_key: p.player_key, brand: p.brand, tier_segment: p.tier_segment });
    setAssign(""); setStatus(""); setNote("");
    setCleared(true); setTimeout(() => setCleared(false), 1400);
  }
  const row = (k, v) => {
    if (v == null || v === "" || v === "—") return null;   // hide empty fields instead of a bare "—"
    return <div className="drow"><span>{k}</span><span className="dv mono">{v}</span></div>;
  };
  return (
    <div className="drawer-veil" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ "--bp": c.p, "--ba": c.a }}
        ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="drawer-name">
        {/* FULL-WIDTH HEADER */}
        <button className="x" onClick={onClose} aria-label="Close player">✕</button>
        <div className="drawer-head">
          <div>
            <div className="drawer-brand" style={{ color: c.txt }}>{p.brand} · Tier {p.tier_segment}{p._whale ? " · ♛ WHALE" : ""}</div>
            {/* Name first — that is who the agent is talking to. The account id stays right
                underneath because they still need it to look the player up in BO. */}
            <div className="drawer-name" id="drawer-name">{dispName(p)}</div>
            {/* Name sits under the id, for both providers. */}
            <div className="drawer-sub">{realName(p) || ""}</div>
          </div>
        </div>

        <div className="drawer-class">
          <span className="cls-pill big" style={{ "--cc": CLASSES[p._cls].color }}>{CLASSES[p._cls].label}</span>
          {(p._cool2 || p._cooling) && <span className="cooling big" title="Churn-risk from a deposit-rhythm break — act now">❄ CHURN RISK{p._cool2 ? ` ${p._cool2.risk}` : ""}</span>}
          {p._fragile && <span className="frag big">FRAGILE</span>}
          <div className="drawer-why">{p._cool2 ? `Churn risk ${p._cool2.risk}/100 — quiet ${p._cool2.dsld}d vs a ~${p._cool2.gap}d normal (${p._cool2.cooling}× their rhythm). Gentle check-in, never a deposit push.` : p._cooling ? "Whale quiet 5–6 days — the last window to prevent churn before they go cold. Gentle check-in, never a deposit push." : CLASSES[p._cls].desc}</div>
        </div>

        {/* VALUE AT A GLANCE — promoted from full-details so it reads instantly */}
        <div className="vstrip">
          <div className="vcell"><div className="vlab">Lifetime PNL</div><div className="vval">{fmt(p.pnl)}</div></div>
          <div className="vcell"><div className="vlab">Month deposit</div><div className="vval">{fmtRM(p.monthly_deposit)}</div></div>
          <div className="vcell"><div className="vlab">Deposit today</div><div className="vval">{fmtRM(p.daily_deposit)}</div></div>
          <div className="vcell"><div className="vlab">DSLD</div><div className="vval">{p._dsld ?? "—"}</div></div>
        </div>

        {/* DAILY MONEY — last 14 snapshots, coloured like the SPV sheet: withdraw > deposit = won */}
        {hist && hist.length > 0 && (() => {
          const days = hist.filter((h) => h.snapshot_date <= snap).slice(-14);
          const played = days.filter((h) => (h.daily_deposit || 0) > 0 || (h.daily_withdraw || 0) > 0);
          const lostN = played.filter((h) => (h.daily_withdraw || 0) <= (h.daily_deposit || 0)).length;
          const dep = days.reduce((s, h) => s + (h.daily_deposit || 0), 0);
          const wd = days.reduce((s, h) => s + (h.daily_withdraw || 0), 0);
          const k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : Math.round(n));
          return (
            <div className="dm">
              <div className="dm-head"><span>Daily money · last {days.length} days</span>
                <span className="dm-lg"><i className="dm-w" />won <i className="dm-l" />lost <i className="dm-n" />no play<MoneyCalendar hist={hist} snap={snap} /></span></div>
              <div className="dm-grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
                {days.map((h) => {
                  const d = h.daily_deposit || 0, w = h.daily_withdraw || 0, on = d > 0 || w > 0;
                  const cls = !on ? "dm-n" : w > d ? "dm-w" : "dm-l";
                  return (
                    <div key={h.snapshot_date} className={"dm-c " + cls}
                      title={`${shiftDate(h.snapshot_date, -1)} · deposit ${fmt(d)} · withdraw ${fmt(w)} · game ${fmt(h.win_loss)}`}>
                      <span className="dm-d">{shiftDate(h.snapshot_date, -1).slice(8)}</span>
                      <span>{on ? k(d) : "–"}</span><span>{on ? k(w) : ""}</span>
                    </div>
                  );
                })}
              </div>
              <div className="dm-sum">Top = deposit, bottom = withdraw · {days.length} days: deposited {fmt(dep)}, withdrew {fmt(wd)} · lost {lostN} of {played.length} days played</div>
            </div>
          );
        })()}

        {/* TWO-COLUMN BODY — A (who/notes) left · B (approach/action) right */}
        <div className="drawer-cols">
        {/* ZONE A — identity + signal */}
        <div className="zone zone-a">

        {/* WHO THEY ARE — memory hooks (real facts to make it personal) */}
        {(() => {
          const hk = [...buildHooks(p), ...(hist ? buildHistoryHooks(hist, snap) : [])];
          return hk.length > 0 ? (
            <>
              <div className="dsec">Who they are{hist === null ? " ·" : ""}</div>
              <div className="hooks">
                {hk.map((h, i) => {
                  const warn = h.tone === "warn"; // semantic churn flag from the library (not coupled to the icon)
                  return (
                    <div className={"hook" + (warn ? " warn" : "")} key={i}>
                      <span className="hook-i">{warn ? "⚠" : h.icon}</span><span>{h.text}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null;
        })()}

        {/* WIDGET BONUSES — the same Lark bonus tables the Customer Approaching widget reads (read-only) */}
        <div className="dsec">Bonuses (from widget)</div>
        <div className="ledger">
          {bonus === null && <button className="btn-ghost bonus-btn" onClick={checkBonuses}>Check what this player can claim</button>}
          {bonus === "loading" && <div className="ledger-empty">Asking the widget… this can take up to ~30 s.</div>}
          {bonus && bonus !== "loading" && bonus.error && (
            <div className="ledger-empty">{bonus.error} <button className="btn-ghost bonus-btn" onClick={checkBonuses}>Retry</button></div>)}
          {bonus && bonus !== "loading" && !bonus.error && (<>
            {bonus.notVip && <div className="ledger-empty">Not in the widget's P&L master list — flagged "Not VIP" there.</div>}
            {!bonus.notVip && (bonus.tier || bonus.customerName) && (
              <div className="ledger-empty">{[bonus.customerName, bonus.tier && `Tier ${bonus.tier}`].filter(Boolean).join(" · ")}</div>)}
            {bonus.programs.length === 0 && !bonus.notVip && <div className="ledger-empty">Nothing claimable right now.</div>}
            {bonus.programs.map((g) => (
              <div className="ledger-note" key={g.key}>
                <span className="ln-pin">🎁</span>
                <div className="ln-body">
                  <div className="ln-text"><b>{g.label}</b> — {g.value}
                    {g.key === "grace" && <span className={"bonus-tag " + (g.activated ? "on" : "off")}>{g.activated ? "ACTIVATED" : "NOT ACTIVATED"}</span>}</div>
                  {g.expiryMs ? <div className="ln-meta">expires {new Date(g.expiryMs).toISOString().slice(0, 10)}</div> : null}
                </div>
              </div>
            ))}
            {bonus.otherBrands.length > 0 && <div className="ledger-empty">Same username also exists under: {bonus.otherBrands.join(", ")}</div>}
            {bonus.warnings.length > 0 && <div className="ledger-empty">Some tables did not answer ({bonus.warnings.join(", ")}) — the list may be incomplete.</div>}
            <button className="btn-ghost bonus-btn" onClick={checkBonuses}>Refresh</button>
          </>)}
        </div>

        {/* RELATIONSHIP LEDGER — person-level memory that resurfaces every contact */}
        <div className="dsec">Relationship notes</div>
        <div className="ledger">
          {notes === null && <div className="ledger-empty">Loading…</div>}
          {notes !== null && notes.length === 0 && (
            <div className="ledger-empty">No notes yet. Jot one human fact — it resurfaces on every future contact.</div>
          )}
          {notes !== null && notes.map((n) => (
            <div className="ledger-note" key={n.id}>
              <span className="ln-pin">📌</span>
              <div className="ln-body">
                <div className="ln-text">{n.note}</div>
                <div className="ln-meta">{n.created_by || "—"} · {String(n.created_at || "").slice(0, 10)}</div>
              </div>
              {!readOnly && <button className="ln-x" onClick={() => removeNote(n.id)} title="Remove note">✕</button>}
            </div>
          ))}
          {!readOnly && (
            <div className="ledger-add">
              <input
                placeholder="Add a personal fact… (e.g. prefers Telegram · daughter's wedding in May)"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                maxLength={2000}
              />
              <button className="btn-ghost" disabled={noteBusy || !noteDraft.trim()} onClick={addNote}>
                {noteBusy ? "…" : "Add"}
              </button>
            </div>
          )}
        </div>

        {/* TELEGRAM — opens the player's Livechat link; CS pastes/edits it here (replaces the Lark Base list) */}
        <div className="dsec">Telegram</div>
        {readOnly ? (
          tgUrl
            ? (safeHttpUrl(tgUrl)
                ? <a className="tg-btn" href={safeHttpUrl(tgUrl)} target="_blank" rel="noopener noreferrer">✈ Open Telegram chat ↗</a>
                : <button className="tg-btn off" disabled title="Link blocked — not an http(s) URL">⚠ Unsafe link blocked</button>)
            : <button className="tg-btn off" disabled title="This player has no Telegram link yet">🔒 Not on Telegram</button>
        ) : tgEdit ? (
          <div className="tg-edit">
            <input className="tg-input" autoFocus value={tgDraft} placeholder="Paste Livechat / Telegram link…"
              onChange={(e) => setTgDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTelegram(); if (e.key === "Escape") setTgEdit(false); }} />
            <button className="btn-gold" disabled={tgSaving} onClick={saveTelegram}>{tgSaving ? "…" : "Save"}</button>
            <button className="btn-ghost" onClick={() => setTgEdit(false)}>Cancel</button>
            {tgErr && <span className="errmsg">⚠ Not saved — retry</span>}
          </div>
        ) : (
          <div className="tg-row">
            {tgUrl
              ? (safeHttpUrl(tgUrl)
                  ? <a className="tg-btn" href={safeHttpUrl(tgUrl)} target="_blank" rel="noopener noreferrer">✈ Open Telegram chat ↗</a>
                  : <span className="tg-btn off" title="Link blocked — not an http(s) URL">⚠ Unsafe link blocked</span>)
              : <span className="tg-btn off">🔒 Not on Telegram yet</span>}
            <button className="tg-edit-btn" title={tgUrl ? "Edit the link" : "Add a Telegram link"}
              onClick={() => { setTgDraft(tgUrl || ""); setTgEdit(true); }}>{tgUrl ? "✎ Edit" : "+ Add link"}</button>
          </div>
        )}

        {/* LIVECHAT HISTORY — QA audit log: each session = who logged it · when · link */}
        <div className="dsec">LiveChat history{livechat && livechat.length > 0 && <span className="lc-count">{livechat.length}</span>}<span className="lc-tag">QA</span></div>
        <div className="lc-list">
          {livechat === null && <div className="ledger-empty">Loading…</div>}
          {livechat !== null && livechat.length === 0 && <div className="ledger-empty">No LiveChat logged yet.</div>}
          {livechat !== null && livechat.map((l) => (
            <div className="lc-row" key={l.id}>
              <span className="lc-agent">{l.agent || "—"}</span>
              <span className="lc-date mono">{String(l.created_at || "").slice(0, 16)}</span>
              {safeHttpUrl(l.url)
                ? <a className="lc-open" href={safeHttpUrl(l.url)} target="_blank" rel="noopener noreferrer">Open ↗</a>
                : <span className="lc-open off" title="Blocked — not an http(s) link">⚠</span>}
              {isMgr && !readOnly && <button className="lc-x" title="Remove (managers only)" onClick={() => removeLivechat(l.id)}>✕</button>}
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="lc-add">
            <input placeholder="Paste LiveChat archive link…" value={lcDraft}
              onChange={(e) => setLcDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logLivechat()} />
            <button className="btn-ghost" disabled={lcBusy || !lcDraft.trim()} onClick={logLivechat}>{lcBusy ? "…" : "Log"}</button>
          </div>
        )}

        {/* NEXT FOLLOW-UP — reminder date so the player doesn't slip */}
        <div className="dsec">Next follow-up{fuMsg === "ok" && <span className="savedmsg"> Saved ✓</span>}{fuMsg === "err" && <span className="errmsg"> ⚠ Not saved — retry</span>}</div>
        <input type="date" className="crm-date" value={followup || ""} readOnly={readOnly}
          onChange={(e) => { setFollowup(e.target.value); saveCrm({ next_followup: e.target.value }); }} />

        {/* CONTACT HISTORY — past contacts for this player (read-only) */}
        <div className="dsec">Contact history</div>
        <div className="crm-hist">
          {crmHist === null && <div className="ledger-empty">Loading…</div>}
          {crmHist !== null && crmHist.length === 0 && (
            <div className="ledger-empty">No past contacts logged yet.</div>
          )}
          {crmHist !== null && crmHist.map((h, i) => (
            <div className="ch-row" key={i}>
              <div className="ch-top">
                <span className="ch-date mono">{h.contacted_at || h.snapshot_date}</span>
                {h.status && <span className="ch-status">{h.status.replace("_", " ")}</span>}
                {h.assigned_to && <span className="ch-who">{h.assigned_to}</span>}
              </div>
              {h.note && <div className="ch-note">{h.note}</div>}
            </div>
          ))}
        </div>
        </div>{/* end ZONE A */}

        {/* ZONE B — action (most prominent) */}
        <div className="zone zone-b">
        {/* SMART READ — deterministic plain-English synthesis of this player's signals (no LLM) */}
        {(() => { const sm = whaleSummary(p); return (
          <div className="smart">
            <div className="smart-l">✦ Smart read</div>
            <div className="smart-r">{sm.read}</div>
            {sm.tone && <div className="smart-t">→ {sm.tone}</div>}
          </div>
        ); })()}
        {/* APPROACH (the Book) */}
        <div className="dsec">Approach — {ap.title}</div>
        {ap.warnings.length > 0 && <div className="rg-warn">⚠ {ap.warnings.join("  ·  ")}</div>}
        {(() => {
          const angles = buildAngles(p);
          if (angles.length === 0) {
            // No-contact class: restraint is the action — show the note, no copy.
            return <div className="tmpl">{ap.message}</div>;
          }
          return (
            <>
              <div className="angles-hint">Pick a way in and write it in your own words — use the facts above to make it personal.</div>
              <div className="angles">
                {angles.map((a, i) => (
                  <div className="angle" key={i}>
                    <span className="angle-i">{a.icon}</span>
                    <div className="angle-tx">
                      <div className="angle-l">{a.label}</div>
                      <div className="angle-h">{a.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="tmpl-toggle" onClick={() => setShowTmpl((s) => !s)}>
                {showTmpl ? "▴ Hide example" : "▾ Stuck? Show a full example message"}
              </button>
              {showTmpl && (
                <>
                  <div className="tmpl">{ap.message}</div>
                  <button className="btn-ghost wide" onClick={async () => {
                    const ok = await copyText(ap.message);
                    setCopied(ok ? "ok" : "fail"); setTimeout(() => setCopied(false), ok ? 1200 : 2600);
                  }}>{copied === "ok" ? "✓ Copied" : copied === "fail" ? "Copy blocked — select the text above" : "Copy example"}</button>
                </>
              )}
            </>
          );
        })()}

        {/* WORKFLOW */}
        <div className="dsec">Action log{readOnly ? " — read-only" : ""}</div>
        <div className="wf-row">
          <NativeSelect value={assign} disabled={readOnly} onChange={(e) => { setAssign(e.target.value); save({ assigned_to: e.target.value, status: status || "ASSIGNED" }); if (!status) setStatus("ASSIGNED"); }}>
            <option value="">Assign to…</option>
            {team.map((t) => <option key={t.username} value={t.username}>{t.username}</option>)}
          </NativeSelect>
        </div>
        <div className="wf-status">
          {[["set", ["ASSIGNED", "CONTACTED", "RESPONDED"]], ["auto", ["RECOVERED", "NO_RESPONSE", "SKIPPED"]]].map(([grp, list]) => (
          <div key={grp} className={grp === "set" ? "seg-st" : "st-auto"} role="group" aria-label={grp === "set" ? "Set status" : "Automatic statuses"}>
          {grp === "auto" && <span className="st-auto-l">Auto</span>}
          {list.filter((s) => s !== "SKIPPED" || status === "SKIPPED").map((s) => {
            // Automatic statuses: RECOVERED (deposit after contact) and NO_RESPONSE (6h idle) are
            // set by the cron; SKIPPED is retired. Agents set only ASSIGNED / CONTACTED / RESPONDED.
            const locked = s === "RECOVERED" || s === "NO_RESPONSE" || s === "SKIPPED";
            const why = s === "RECOVERED" ? "Automatic — set when the player deposits after contact"
              : s === "NO_RESPONSE" ? "Automatic — set when a contact sits 6h with no response"
              : "Disabled";
            return (
              <button key={s} className={"st-btn" + (status === s ? " on" : "") + (locked ? " locked" : "")}
                style={{ "--sc": ST_COLOR[s] }} disabled={readOnly || locked} aria-pressed={status === s}
                title={locked ? why : ""}
                onClick={() => {
                  // Setting a status always leaves an owner: fall back to the logged-in agent when
                  // nobody was picked. Never overwrite an assignee a manager chose on purpose.
                  const who = assign || me?.username || "";
                  if (!assign && who) setAssign(who);
                  setStatus(s); save({ status: s, assigned_to: who });
                }}>{s.replace("_", " ")}</button>
            );
          })}
          </div>
          ))}
        </div>
        <textarea className="wf-note" placeholder="Note (optional — what happened?)" readOnly={readOnly}
          value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (contact?.note || "") && save()} />
        {saved && <div className="savedmsg">Saved ✓</div>}
        {!readOnly && !!me?.can_delete && (contact?.assigned_to || contact?.status || contact?.note) && (
          <button className="btn-ghost wide danger" onClick={clear}>Clear / undo this contact</button>
        )}
        {cleared && <div className="clearedmsg">Contact cleared ✓</div>}
        </div>{/* end ZONE B */}
        </div>{/* end two-column body */}

        {/* ZONE C — reference data (recessed, collapsed by default) */}
        <div className="zone zone-c">
        <button className="details-toggle" onClick={() => setShowDetails((s) => !s)}>
          {showDetails ? "▴ Hide full details" : "▾ Full details"}
        </button>
        {showDetails && (<div className="details-body">

        {/* DATA */}
        <div className="dgrid">
          <div className="dcard"><div className="dlab">DSLD</div><div className="dval mono">{p._dsld ?? "—"}</div></div>
          <div className="dcard"><div className="dlab">Grace in</div><div className="dval mono">{p._graceDays != null && p._graceDays >= 0 ? p._graceDays + "d" : "—"}</div></div>
          <div className="dcard"><div className="dlab">Deposit today</div><div className="dval mono">{fmt(p.daily_deposit)}</div></div>
          <div className="dcard"><div className="dlab">W/L today</div><div className={"dval mono " + ((p.win_loss ?? 0) < 0 ? "neg" : "pos")}>{fmt(p.win_loss)}</div></div>
        </div>
        <div className="dsec">Today ({snap})</div>
        {row("Deposits", `${fmt(p.daily_deposit_count)}× · ${fmtRM(p.daily_deposit)}`)}
        {row("Withdrawals", `${fmt(p.daily_withdraw_count)}× · ${fmtRM(p.daily_withdraw)}`)}
        {row("Bet / Valid bet", `${fmt(p.bet)} / ${fmt(p.valid_bet)}`)}
        <div className="dsec">Month & lifetime</div>
        {row("Monthly dep / wd", `${fmtRM(p.monthly_deposit)} / ${fmtRM(p.monthly_withdraw)}`)}
        {row("Lifetime dep / wd", `${fmtRM(p.lifetime_deposit)} / ${fmtRM(p.lifetime_withdraw)}`)}
        {row("Lifetime PNL (player net)", fmt(p.pnl))}
        <div className="dsec">Status & tier</div>
        {row("Status", `${p.status || "—"} (${fmt(p.status_days)}d) · ${p.group_name || ""}`)}
        {row("Tier move", `${p.previous_tier || "—"} → ${p.tier || "—"} (${p.tier_movement || "—"})`)}
        {row("Grace ends", p.grace_end_date || "—")}
        {row("Entered tier", p.entry_date || "—")}
        {row("Last deposit", p.last_deposit_date || "—")}
        {row("Registered", `${p.register_date || "—"} · ${fmt(p.member_days)}d member`)}
        </div>)}
        </div>{/* end ZONE C */}

        <div className="next-row">
          <button className="btn-ghost" disabled={index <= 0} onClick={() => setIndex(index - 1)}>← Prev</button>
          <span className="mono dim">{index + 1} / {list.length}</span>
          <button className="btn-gold" disabled={index >= list.length - 1} onClick={() => setIndex(index + 1)}>Next player →</button>
        </div>
      </div>
    </div>
  );
}

/* Custom dark calendar for snapshot dates. Days without data are disabled;
   month nav is bounded to the available range. Replaces the native date input. */
export const CAL_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso) { const [y, m, d] = iso.split("-").map(Number); return `${d} ${CAL_MON[m - 1]} ${y}`; }
export function DateCalendar({ cur, newest, oldest, avail, readOnly, onPick }) {
  const [open, setOpen] = useState(false);
  const [mon, setMon] = useState(() => cur.slice(0, 7));  // "YYYY-MM" being shown
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const [my, mm] = mon.split("-").map(Number);
  const iso = (d) => `${my}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const firstDow = new Date(Date.UTC(my, mm - 1, 1)).getUTCDay();
  const daysIn = new Date(Date.UTC(my, mm, 0)).getUTCDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const monMin = oldest.slice(0, 7), monMax = newest.slice(0, 7);
  const shiftMon = (delta) => { const t = new Date(Date.UTC(my, mm - 1 + delta, 1)); setMon(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`); };
  const choose = (d) => { const v = iso(d); if (avail.has(v)) { onPick(v); setOpen(false); } };
  return (
    <div className="cal-wrap" ref={ref}>
      <button className={"datesel" + (readOnly ? " set" : "")} onClick={() => { setMon(cur.slice(0, 7)); setOpen((o) => !o); }}>
        <span className="cal-ico">▦</span> {fmtDate(cur)}
      </button>
      {open && (
        <div className="cal-pop">
          <div className="cal-head">
            <button className="cal-nav" disabled={mon <= monMin} onClick={() => shiftMon(-1)}>‹</button>
            <span className="cal-title">{CAL_MON[mm - 1]} {my}</span>
            <button className="cal-nav" disabled={mon >= monMax} onClick={() => shiftMon(1)}>›</button>
          </div>
          <div className="cal-dow">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} className="cal-cell empty" />;
              const v = iso(d), has = avail.has(v), sel = v === cur;
              return <button key={i} className={"cal-cell" + (sel ? " sel" : "") + (has ? "" : " off")} disabled={!has} onClick={() => choose(d)}>{d}</button>;
            })}
          </div>
          <div className="cal-foot">
            <span className="cal-range">{fmtDate(oldest)} → {fmtDate(newest)}</span>
            <button className="cal-link" onClick={() => { onPick(newest); setOpen(false); }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Money calendar — drawer popup. Same compact look as DateCalendar, but each day is coloured by
   that day's result (withdraw > deposit = won, else lost, 0/0 = no play) and clicking a day shows
   its numbers. Days are REAL game days (snapshot − 1), matching the SPV sheet and Lost & gone. */
export function MoneyCalendar({ hist, snap }) {
  const byDay = useMemo(() => {
    const m = {};
    (hist || []).forEach((h) => { if (h.snapshot_date <= snap) m[shiftDate(h.snapshot_date, -1)] = h; });
    return m;
  }, [hist, snap]);
  const dayKeys = Object.keys(byDay).sort();
  const newest = dayKeys[dayKeys.length - 1] || shiftDate(snap, -1), oldest = dayKeys[0] || newest;
  const [open, setOpen] = useState(false);
  const [mon, setMon] = useState(newest.slice(0, 7));
  const [pick, setPick] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const [my, mm] = mon.split("-").map(Number);
  const iso = (d) => `${my}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const firstDow = new Date(Date.UTC(my, mm - 1, 1)).getUTCDay();
  const daysIn = new Date(Date.UTC(my, mm, 0)).getUTCDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const shiftMon = (delta) => { const t = new Date(Date.UTC(my, mm - 1 + delta, 1)); setMon(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`); setPick(null); };
  const res = (h) => { const d = h.daily_deposit || 0, w = h.daily_withdraw || 0; return d === 0 && w === 0 ? "n" : w > d ? "w" : "l"; };
  const inMon = dayKeys.filter((k) => k.startsWith(mon)).map((k) => byDay[k]);
  const dep = inMon.reduce((s, h) => s + (h.daily_deposit || 0), 0), wd = inMon.reduce((s, h) => s + (h.daily_withdraw || 0), 0);
  const played = inMon.filter((h) => res(h) !== "n"), lostN = played.filter((h) => res(h) === "l").length;
  const ph = pick && byDay[pick];
  return (
    <div className="cal-wrap mc-wrap" ref={ref}>
      <button className="mc-btn" onClick={() => { setMon(newest.slice(0, 7)); setPick(null); setOpen((o) => !o); }}>▦ Month</button>
      {open && (
        <div className="cal-pop mc-pop">
          <div className="cal-head">
            <button className="cal-nav" disabled={mon <= oldest.slice(0, 7)} onClick={() => shiftMon(-1)}>‹</button>
            <span className="cal-title">{CAL_MON[mm - 1]} {my}</span>
            <button className="cal-nav" disabled={mon >= newest.slice(0, 7)} onClick={() => shiftMon(1)}>›</button>
          </div>
          <div className="cal-dow">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} className="cal-cell empty" />;
              const v = iso(d), h = byDay[v];
              return <button key={i} className={"cal-cell" + (h ? " mc-" + res(h) : " off") + (pick === v ? " mc-sel" : "")}
                disabled={!h} onClick={() => setPick(v)}>{d}</button>;
            })}
          </div>
          <div className="mc-detail">
            {ph
              ? <><b>{+pick.slice(8)} {CAL_MON[mm - 1].slice(0, 3)}</b> · dep {fmt(ph.daily_deposit)} · wd {fmt(ph.daily_withdraw)} · game <span className={(ph.win_loss || 0) < 0 ? "neg" : "pos"}>{fmt(ph.win_loss)}</span>
                  <span className={"mc-tag mc-" + res(ph)}>{{ w: "won", l: "lost", n: "no play" }[res(ph)]}</span></>
              : <span className="dim">Tap a day to see its numbers</span>}
          </div>
          <div className="cal-foot mc-foot">
            <span>Deposited <b>{fmt(dep)}</b> · withdrew <b>{fmt(wd)}</b></span>
            <span>lost <b className="neg">{lostN}</b> of {played.length} days</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* Shared snapshot-date bar: Today/Yesterday/−7d quick jumps + the calendar.
   Sits above every data tab; drives the global viewDate (which refetches the board). */
export function SnapshotPicker({ dates, viewDate, setViewDate, isPast }) {
  if (!dates || dates.length === 0) return null;
  const newest = dates[0].snapshot_date;
  const oldest = dates[dates.length - 1].snapshot_date;
  const avail = new Set(dates.map((d) => d.snapshot_date));
  const cur = viewDate || newest;
  const pick = (val) => {
    if (!val) return;
    if (avail.has(val)) return setViewDate(val);
    const before = dates.map((d) => d.snapshot_date).filter((s) => s <= val);
    setViewDate(before[0] || oldest);
  };
  const shift = (iso, days) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d) - days * 86400000);
    const p = (n) => String(n).padStart(2, "0");
    return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
  };
  return (
    <div className={"snapbar" + (isPast ? " past" : "")}>
      <span className="snapbar-lbl">📅 Snapshot</span>
      {dates.length > 1 && (
        <div className="seg date-quick">
          <button className={cur === newest ? "on" : ""} onClick={() => setViewDate(newest)}>Today</button>
          <button className={cur === shift(newest, 1) ? "on" : ""} onClick={() => pick(shift(newest, 1))}>Yesterday</button>
          <button className={cur === shift(newest, 7) ? "on" : ""} title="7 days ago" onClick={() => pick(shift(newest, 7))}>−7d</button>
        </div>
      )}
      <DateCalendar cur={cur} newest={newest} oldest={oldest} avail={avail} readOnly={isPast} onPick={setViewDate} />
    </div>
  );
}

/* ════════════════════════ QUEUE ════════════════════════ */
export function Queue({ data, brandOrder = BRAND_ORDER, snap, me, team, viewTeam, contacts, health, onSaveContact, onClearContact, readOnly, dates, viewDate, setViewDate, drill, clearDrill }) {
  const [brands, setBrands] = useState(() => new Set());   // multi-select; empty = all brands
  const [tier, setTier] = useState("ALL");
  const [classes, setClasses] = useState(() => new Set()); // multi-select; empty = all classes
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [graceWatch, setGraceWatch] = useState(false);
  // Grace Period challenge state straight from the Lark Grace table (same rows the widget reads): activated vs waiting.
  // Loaded only while GRACE WATCH is on — one read per brand on the server, cached 5 min.
  const [graceSt, setGraceSt] = useState(null);      // { "username|BRAND": { a: 0|1, v, e } }
  const [graceErr, setGraceErr] = useState("");
  const [graceFilter, setGraceFilter] = useState(""); // "" | "not" (Grace not activated yet) | "act" (Grace activated) — like the ✈ On TG toggle
  const graceNeeded = graceWatch || !!graceFilter || classes.has("GRACE");   // any view that shows Grace state loads it
  useEffect(() => {
    if (!graceNeeded) return;
    let alive = true;
    setGraceErr("");
    api("/api/rtn/grace-status").then((d) => { if (alive) setGraceSt(d.status || {}); })
      .catch((e) => { if (alive) { setGraceSt(null); setGraceErr(e.message || "Could not read the Grace table"); } });
    return () => { alive = false; };
  }, [graceNeeded, snap]);
  const graceOf = (r) => (graceSt ? graceSt[`${String(r.player_key).toLowerCase()}|${r.brand}`] || null : null);
  const [zeroDep, setZeroDep] = useState(false);           // KPI drill: players with 0 deposit this month
  const [onTg, setOnTg] = useState(false);                 // show only players with a Telegram link (non-TG stay reachable when off)
  const [openOnly, setOpenOnly] = useState(false);         // hide players inside the 48h contact cooldown — only players open to contact now
  const [noTgOnly, setNoTgOnly] = useState(false);         // inverse: show only players WITHOUT a link (the "capture links" view)
  const [focusKeys, setFocusKeys] = useState(null);        // alert-bell deep-link: focus a specific player set (ckeys)
  const [focusLabel, setFocusLabel] = useState("");
  const [agentFilter, setAgentFilter] = useState("");      // Contacted view: filter by contacting agent
  const [sorts, setSorts] = useState([]);    // ordered multi-column sort; [] = default priority order
  const toggleBrand = (b) => setBrands((s) => { const n = new Set(s); n.has(b) ? n.delete(b) : n.add(b); return n; });
  const toggleClass = (c) => setClasses((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const [pageSize, setPageSize] = useState(50);   // Table view: rows per page
  const [page, setPage] = useState(1);
  const [selIdx, setSelIdx] = useState(null);
  const [view, setView] = useState("worklist");    // "worklist" (default) | "table" | "contacted"
  // Close the drawer when the filtered list changes, so the open index can't point at a different player.
  useEffect(() => { setSelIdx(null); }, [brands, tier, classes, q, mine, graceWatch, graceFilter, zeroDep, onTg, noTgOnly, openOnly, focusKeys, sorts, view, agentFilter, pageSize, page]);
  const [noneOpen, setNoneOpen] = useState(false);  // NO ACTION band expanded?
  const [bandAll, setBandAll] = useState({});        // { [bandKey]: true } = show all rows vs top 10
  const [showLegend, setShowLegend] = useState(false);
  const [sel, setSel] = useState(() => new Set());   // ckeys ticked for username copy
  const [copiedSel, setCopiedSel] = useState(false);
  const [markBusy, setMarkBusy] = useState(false);
  const toggleSel = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const [pasteOpen, setPasteOpen] = useState(false);   // Table: "Paste list" panel
  const [pasteText, setPasteText] = useState("");
  const [pasteMsg, setPasteMsg] = useState(null);      // { ok, missing, invalid, hidden }
  const tickPasted = () => {
    const res = parsePasteList(pasteText, data);
    setSel((s) => { const n = new Set(s); res.keys.forEach((k) => n.add(k)); return n; });
    setPasteMsg({ ok: res.keys.size, total: res.total, missing: res.missing, invalid: res.invalid });
  };
  const copySelectedUsernames = async () => {
    const byKey = {}; data.forEach((r) => (byKey[ckey(r)] = r));
    // Per-brand identity: Zyra copies the UID, TC copies the username — same rule as dispId and Export.
    const names = [...sel].map((k) => byKey[k]).filter(Boolean).map((r) => String(dispId(r) || "").trim()).filter(Boolean);
    if (!names.length) return;
    const ok = await copyText(names.join("\n"));
    setCopiedSel(ok ? "ok" : "fail"); setTimeout(() => setCopiedSel(false), ok ? 1400 : 2600);
  };
  // Bulk-mark the selected players CONTACTED (today), keeping the current owner (or the actor if none).
  const markSelectedContacted = async () => {
    if (readOnly || markBusy) return;
    const byKey = {}; data.forEach((r) => (byKey[ckey(r)] = r));
    const rows = [...sel].map((k) => byKey[k]).filter(Boolean);
    if (!rows.length) return;
    if (!window.confirm(`Mark ${rows.length} player${rows.length > 1 ? "s" : ""} as CONTACTED today? This logs a contact for each.`)) return;
    setMarkBusy(true);
    for (const r of rows) {
      const c = contactMap[ckey(r)];
      try {
        await onSaveContact({ snapshot_date: snap, player_key: r.player_key, brand: r.brand, tier_segment: r.tier_segment,
          status: "CONTACTED", assigned_to: c?.assigned_to || me?.username || null, class: c?.class || r._cls || null, note: c?.note || null });
      } catch (e) { /* keep going; a failed row stays unmarked */ }
    }
    setMarkBusy(false); setSel(new Set());
  };

  const contactMap = useMemo(() => {
    const m = {};
    contacts.filter((c) => c.snapshot_date === snap).forEach((c) => (m[`${c.player_key}|${c.brand}|${c.tier_segment}`] = c));
    return m;
  }, [contacts, snap]);
  const cooldownSet = useMemo(() => {   // 48h cooldown: contacted within the last 48h — do NOT re-contact (anti-spam). Distinct from churn-risk ❄ COOLING.
    const s = new Set();
    const cutoff = Date.now() - 48 * 3600 * 1000;
    contacts.forEach((c) => {
      if (c.status && c.status !== "SKIPPED" && new Date(c.updated_at + "Z").getTime() > cutoff)
        s.add(`${c.player_key}|${c.brand}|${c.tier_segment}`);
    });
    return s;
  }, [contacts]);

  const staleBrands = useMemo(
    () => health.filter((h) => h.last_fed !== snap).map((h) => ({ ...h })), [health, snap]);
  // Content-freshness: a brand whose newest deposit date trails the freshest brand is lagging
  // (ingest ran but the sheet hadn't updated yet) — the case plain snapshot-date checks miss.
  const lagBrands = useMemo(() => {
    // Only real YYYY-MM-DD values. A junk value like the header text
    // "last_deposit_date" sorts after every real date, so without this filter one
    // bad row becomes the "lead" and makes every honest brand look like it lags
    // (MAX39, 2026-08-02). Belt-and-braces alongside the ingest guard.
    const withDep = health.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.newest_dep || ""));
    if (withDep.length < 2) return [];
    const lead = withDep.reduce((m, h) => (h.newest_dep > m ? h.newest_dep : m), "");
    return withDep.filter((h) => h.newest_dep < lead).map((h) => ({ brand: h.brand, newest_dep: h.newest_dep, lead }));
  }, [health]);

  // Deep-link: from a KPI card (brand+tier, 0-deposit) or the alert bell (a specific player set).
  useEffect(() => {
    if (!drill) return;
    setClasses(new Set()); setGraceWatch(false); setMine(false); setView("worklist");
    if (drill.keys) {                                   // bell → focus exactly these players
      setFocusKeys(new Set(drill.keys)); setFocusLabel(drill.label || "flagged");
      setBrands(new Set()); setTier("ALL"); setZeroDep(false);
    } else {                                            // KPI card → brand+tier + 0-deposit
      setFocusKeys(null); setFocusLabel("");
      setBrands(new Set([drill.brand])); setTier(drill.tier); setZeroDep(true);
    }
    clearDrill();
  }, [drill]);

  const filtered = useMemo(() => {
    let r = data;
    if (focusKeys) r = r.filter((x) => focusKeys.has(ckey(x)));   // bell deep-link: only the flagged players
    if (brands.size) r = r.filter((x) => brands.has(x.brand));
    if (tier !== "ALL") r = r.filter((x) => x.tier_segment === tier);
    if (graceWatch) r = r.filter((x) => x._graceDays != null && x._graceDays >= 0);
    else if (classes.size) r = r.filter((x) => classes.has(x._cls));
    if (graceFilter && graceSt) r = r.filter((x) => { const g = graceOf(x); return !!g && (graceFilter === "act" ? g.a === 1 : g.a === 0); });
    if (mine) r = r.filter((x) => contactMap[ckey(x)]?.assigned_to === me.username);
    if (zeroDep) r = r.filter((x) => !(Number(x.monthly_deposit) > 0));
    if (onTg) r = r.filter((x) => !!x._tg);
    if (noTgOnly) r = r.filter((x) => !x._tg);
    if (openOnly) r = r.filter((x) => !cooldownSet.has(ckey(x)));  // only players outside the 3-day contact cooldown
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((x) => (x.username || "").toLowerCase().includes(s) ||
        (x.uid || "").toLowerCase().includes(s) || (x.addressing || "").toLowerCase().includes(s));
    }
    return [...r].sort((a, b) => {
      if (graceWatch) {
        // not activated first (the ones still to chase), then activated, then players with no live Grace row; soonest deadline within each
        const ga = graceSt ? (graceOf(a) ? graceOf(a).a : 2) : 0, gb = graceSt ? (graceOf(b) ? graceOf(b).a : 2) : 0;
        return (ga - gb) || ((a._graceDays ?? 999) - (b._graceDays ?? 999));
      }
      if (sorts.length) {                          // multi-column sort: each column in order, biggest first by default
        for (const s of sorts) {
          let av, bv;
          if (s.k === "_contacted") {               // Status column: sort by 48h cooldown — open-to-contact weighted high, floats up on first click
            av = cooldownSet.has(ckey(a)) ? 0 : 1;
            bv = cooldownSet.has(ckey(b)) ? 0 : 1;
          } else { av = a[s.k] ?? -Infinity; bv = b[s.k] ?? -Infinity; }
          if (av !== bv) return (av < bv ? -1 : 1) * s.dir;
        }
      }
      // default priority order (and final tie-breakers): risk, Tier V first, biggest value first
      if (a._risk !== b._risk) return b._risk - a._risk;
      if (a.tier_segment !== b.tier_segment) return a.tier_segment === "V" ? -1 : 1;
      return (a.pnl ?? 0) - (b.pnl ?? 0);
    });
  }, [data, brands, tier, classes, q, mine, graceWatch, graceSt, graceFilter, zeroDep, onTg, noTgOnly, openOnly, cooldownSet, focusKeys, sorts, contactMap, me]);

  // Grace separator: 0 = not activated yet, 1 = activated, 2 = no live Grace row in Lark. null when not in GRACE WATCH / not loaded.
  const graceGroup = (r) => (graceWatch && graceSt ? (graceOf(r) ? graceOf(r).a : 2) : null);
  const graceCounts = useMemo(() => {
    const c = [0, 0, 0];
    if (graceWatch && graceSt) filtered.forEach((r) => { c[graceGroup(r)]++; });
    return c;
  }, [filtered, graceWatch, graceSt]);
  const GRACE_GROUP_LABEL = ["NOT ACTIVATED — still to chase", "ACTIVATED", "NO LIVE GRACE ROW IN LARK"];
  const graceTag = (r) => {      // shown whenever Grace state is loaded (GRACE WATCH, the GRACE class, or an activated filter)
    const g = graceNeeded && graceSt ? graceOf(r) : null;
    return !g ? null : <span className={"bonus-tag " + (g.a ? "on" : "off")} title={g.v}>{g.a ? "ACTIVATED" : "NOT ACTIVATED"}</span>;
  };

  const counts = useMemo(() => {
    const base = brands.size ? data.filter((x) => brands.has(x.brand)) : data;
    const m = {}; CLASS_ORDER.forEach((k) => (m[k] = 0)); base.forEach((x) => m[x._cls]++);
    m.GRACE_ALL = base.filter((x) => x._graceDays != null && x._graceDays >= 0).length;
    return m;
  }, [data, brands]);

  // ── Contacted view: today's actually-contacted players, grouped by agent then recency ──
  const CONTACTED_ST = ["CONTACTED", "RESPONDED", "RECOVERED", "NO_RESPONSE"];
  const contactedRows = useMemo(() => {
    let rows = filtered.filter((r) => { const c = contactMap[ckey(r)]; return c && CONTACTED_ST.includes(c.status); });
    if (agentFilter) rows = rows.filter((r) => (contactMap[ckey(r)].assigned_to || "") === agentFilter);
    return [...rows].sort((a, b) => {
      const ca = contactMap[ckey(a)], cb = contactMap[ckey(b)];
      const aa = ca.assigned_to || "~", ab = cb.assigned_to || "~";
      if (aa !== ab) return aa < ab ? -1 : 1;               // group by agent
      return (cb.updated_at || "").localeCompare(ca.updated_at || "");   // most recent first
    });
  }, [filtered, contactMap, agentFilter]);
  const contactAgents = useMemo(() => {
    const s = new Set();
    Object.values(contactMap).forEach((c) => { if (c.assigned_to && CONTACTED_ST.includes(c.status)) s.add(c.assigned_to); });
    return [...s].sort();
  }, [contactMap]);
  const pulse = useMemo(() => {
    const p = { total: contactedRows.length, recovered: 0, no_response: 0, pending: 0 };
    contactedRows.forEach((r) => {
      const s = contactMap[ckey(r)]?.status;
      if (s === "RECOVERED") p.recovered++; else if (s === "NO_RESPONSE") p.no_response++; else p.pending++;
    });
    return p;
  }, [contactedRows, contactMap]);

  // Table view pagination — client-side. The full snapshot is already loaded (classification and the
  // Dashboard/report KPIs need every row), so this only pages the RENDER — the heavy part — not the fetch.
  const pagedSource = view === "contacted" ? contactedRows : filtered;   // the list the pager pages (Table + Contacted)
  const totalPages = Math.max(1, Math.ceil(pagedSource.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageStart = (curPage - 1) * pageSize;
  const pageRows = pagedSource.slice(pageStart, pageStart + pageSize);
  const pageNumbers = (() => {
    const out = [], win = 2;
    const lo = Math.max(1, curPage - win), hi = Math.min(totalPages, curPage + win);
    if (lo > 1) { out.push(1); if (lo > 2) out.push("…"); }
    for (let n = lo; n <= hi; n++) out.push(n);
    if (hi < totalPages) { if (hi < totalPages - 1) out.push("…"); out.push(totalPages); }
    return out;
  })();
  useEffect(() => { setPage(1); }, [filtered, contactedRows, pageSize, view]);   // filter/sort/size/view change → page 1
  const pager = (
    <div className="pager">
      <label className="pager-size">Show per page
        <NativeSelect value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          <option value={100000}>All</option>
        </NativeSelect>
      </label>
      <span className="pager-info">Showing {pagedSource.length ? pageStart + 1 : 0}–{Math.min(pageStart + pageSize, pagedSource.length)} of {fmt(pagedSource.length)}</span>
      <div className="pager-nav">
        <button disabled={curPage <= 1} onClick={() => setPage(1)} title="First">«</button>
        <button disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} title="Previous">‹</button>
        {pageNumbers.map((n, i) => n === "…"
          ? <span key={"g" + i} className="pager-gap">…</span>
          : <button key={n} className={n === curPage ? "on" : ""} onClick={() => setPage(n)}>{n}</button>)}
        <button disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)} title="Next">›</button>
        <button disabled={curPage >= totalPages} onClick={() => setPage(totalPages)} title="Last">»</button>
      </div>
    </div>
  );

  // Action-first bands, built from the SAME filtered+sorted list as the table.
  // ACT NOW = GRACE + TOP_LOSS that are whales or among the 10 largest losses today.
  const bands = useMemo(() => {
    const losers = filtered.filter((r) => r._cls === "TOP_LOSS");
    const bigLoss = new Set([...losers].sort((a, b) => (a.win_loss ?? 0) - (b.win_loss ?? 0)).slice(0, 10).map(ckey));
    // ACT NOW TOP_LOSS: (whale AND lost >= RM 2,000 today) OR among the 10 worst losses today
    const isActLoss = (r) => r._cls === "TOP_LOSS" &&
      ((r._whale && (r.win_loss ?? 0) <= -2000) || bigLoss.has(ckey(r)));
    const lossMag = (r) => ((r.win_loss ?? 0) < 0 ? -(r.win_loss ?? 0) : 0);
    const amt = (r) => (r._cls === "TOP_DEP" ? (r.daily_deposit ?? 0) : lossMag(r)); // key RM amount
    const byAmt = (a, b) => amt(b) - amt(a);                                          // biggest first
    const byAct = (a, b) => {                                  // cooling whales first, then GRACE (soonest), then amount
      if (a._cooling !== b._cooling) return a._cooling ? -1 : 1;
      if (a._cooling) { if (a._dsld !== b._dsld) return b._dsld - a._dsld; return (a.pnl ?? 0) - (b.pnl ?? 0); }  // 6d before 5d, then most valuable
      const ag = a._cls === "GRACE", bg = b._cls === "GRACE";
      if (ag !== bg) return ag ? -1 : 1;
      if (ag) return (a._graceDays ?? 9999) - (b._graceDays ?? 9999);
      return byAmt(a, b);
    };
    const byWinback = (a, b) => {                              // longest gone first, then most-negative PNL
      const da = a._dsld ?? -1, db = b._dsld ?? -1;
      if (da !== db) return db - da;
      return (a.pnl ?? 0) - (b.pnl ?? 0);
    };
    const g = { ACT: [], TODAY: [], WINBACK: [], NONE: [] };
    filtered.forEach((r) => {
      if (r._cooling || r._cls === "GRACE" || isActLoss(r)) g.ACT.push(r);
      else if (r._cls === "TOP_LOSS" || r._cls === "TOP_DEP" || r._cls === "BLOCKED") g.TODAY.push(r);
      else if (r._cls === "DSLD30" || r._cls === "DSLD14" || r._cls === "DSLD7") g.WINBACK.push(r);
      else g.NONE.push(r);                                    // WATCH, HEALTHY
    });
    g.ACT.sort(byAct);
    g.TODAY.sort(byAmt);
    g.WINBACK.sort(byWinback);
    g.NONE.sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));
    return g;
  }, [filtered]);
  // The worklist in on-screen order (bands top to bottom). The drawer walks this list, so
  // "Next player" goes down the band being worked, not through the raw filtered order.
  const wlOrder = useMemo(() => [...bands.ACT, ...bands.TODAY, ...bands.WINBACK, ...bands.NONE], [bands]);

  const progress = useMemo(() => {
    const actionable = filtered.filter((x) => x._risk >= 2);
    const done = actionable.filter((x) => {
      const c = contactMap[ckey(x)];
      return c && c.status && c.status !== "ASSIGNED";
    });
    return { total: actionable.length, done: done.length };
  }, [filtered, contactMap]);

  // header click cycles: descending → ascending → remove. Columns ACCUMULATE (multi-column sort).
  const Th = ({ k, children, right }) => {
    const idx = sorts.findIndex((s) => s.k === k);
    const s = idx >= 0 ? sorts[idx] : null;
    return (
      <th className={right ? "r sortable" : "sortable"}
        onClick={() => setSorts((arr) => {
          const i = arr.findIndex((x) => x.k === k);
          if (i < 0) return [...arr, { k, dir: -1 }];
          if (arr[i].dir === -1) return arr.map((x, j) => (j === i ? { k, dir: 1 } : x));
          return arr.filter((_, j) => j !== i);
        })}>
        {children}{s ? (s.dir === -1 ? " ↓" : " ↑") : ""}{s && sorts.length > 1 ? <sup className="sort-ord">{idx + 1}</sup> : ""}
      </th>
    );
  };

  // Worklist row: the whole card opens the drawer (original behavior).
  const wlRow = (r, rep, lvl) => {
    const con = contactMap[ckey(r)];
    return (
      <div key={ckey(r)} className={"wl-row " + lvl + (con?.status && con.status !== "ASSIGNED" ? " done" : "")} {...tap(() => setSelIdx(wlOrder.indexOf(r)))}>
        <span className="b-dot" style={{ background: BRANDS[r.brand]?.p }} />
        <div className="wl-main">
          <div className="wl-name"><span className="wl-pname">{dispName(r)}</span>
            {r._whale && <span className="whale" title="Top-value Tier V — personal handling only">♛</span>}<TgFlag on={r._tg} />
            {(r._cool2 || r._cooling) && <span className="cooling" title="Churn-risk from a deposit-rhythm break — act now">❄{r._cool2 ? ` RISK ${r._cool2.risk}` : " COOLING"}</span>}
            {r._fragile && <span className="frag">FRAGILE</span>}
            <span className="wl-bt">{r.brand} · Tier {r.tier_segment}</span>{graceTag(r)}
          </div>
          <div className={"wl-instr" + (rep ? " rep" : "")}>{buildInstruction(r)}</div>
        </div>
        {con?.status && <span className="wl-done">✓ <span className="st-tag" style={{ "--sc": ST_COLOR[con.status] }}>{con.status.replace("_", " ")}</span></span>}
        <span className={"wl-amt" + (r._cls === "TOP_LOSS" ? " neg" : r._cls === "TOP_DEP" ? " pos" : "")}>{keyMetric(r)}</span>
      </div>
    );
  };

  return (
    <>
      {readOnly && (
        <div className="ro-banner">👁 Viewing {snap} — read-only. Switch to today to take action.</div>
      )}
      {!readOnly && staleBrands.length > 0 && (
        <div className="stale-banner">⚠ STALE DATA — not fed today: {staleBrands.map((s) => `${s.brand} (last ${s.last_fed})`).join(" · ")}. Run that sheet's feeder before working its queue.</div>
      )}
      {!readOnly && lagBrands.length > 0 && (
        <div className="stale-banner">⚠ DATA LAGGING — deposits behind other brands: {lagBrands.map((s) => `${s.brand} (through ${s.newest_dep})`).join(" · ")}. Others are current through {lagBrands[0].lead}. Re-run that sheet's feeder to refresh before trusting its 0-deposit list.</div>
      )}

      <div className="rail" style={(view === "logincheck" || view === "gracetasks") ? { display: "none" } : undefined}>
        {(() => {
          // Two balanced, centered rows. Fewer on top: 7 brands -> 3 above, 4 below.
          const split = Math.floor(brandOrder.length / 2);
          const renderPlaque = (b) => {
            const c = BRANDS[b] || {};
            const rows = data.filter((r) => r.brand === b);
            const dep = rows.reduce((s, r) => s + (r.daily_deposit || 0), 0);
            const parts = [];
            const n = (k) => rows.filter((r) => r._cls === k).length;
            [["TOP_LOSS", "loss"], ["GRACE", "grace"], ["BLOCKED", "blocked"], ["DSLD30", "cold"]]
              .forEach(([k, word]) => { const v = n(k); if (v) parts.push({ k, v, word }); });
            const stale = staleBrands.find((s) => s.brand === b);
            const lag = lagBrands.find((s) => s.brand === b);
            const on = brands.has(b);
            return (
              <div key={b} className={"plaque" + (on ? " on" : "") + (rows.length === 0 ? " empty" : "")}
                style={{ "--bp": c.p, "--ba": c.a }} {...tap(() => toggleBrand(b))} aria-pressed={on}>
                <div className="plaque-name" style={{ color: c.txt }}>{b}{stale && <span className="stale-chip">STALE</span>}{!stale && lag && <span className="stale-chip">LAG</span>}</div>
                <div className="plaque-num">{fmt(rows.length)}<span> players</span></div>
                <div className="plaque-dep">{fmtRM(dep)}</div>
                {parts.length > 0 && <div className="plaque-alert">{parts.map((p) => (
                  <span key={p.k} style={{ "--cc": CLASSES[p.k].color }}><i /><b>{fmt(p.v)}</b> {p.word}</span>))}</div>}
              </div>
            );
          };
          return [brandOrder.slice(0, split), brandOrder.slice(split)].map((row, i) => (
            <div className="rail-row" key={i}>{row.map(renderPlaque)}</div>
          ));
        })()}
      </div>

      <div className="filters-row" style={(view === "logincheck" || view === "gracetasks") ? { display: "none" } : undefined}>
        <Dropdown label="Brand" multi
          value={brands.size === 0 ? "" : brands.size <= 2 ? [...brands].join(", ") : `${brands.size} selected`}
          onPick={(it) => { if (it.key === "all") setBrands(new Set()); else toggleBrand(it.key); }}
          items={[
            { key: "all", label: "All brands", n: data.length, on: brands.size === 0 },
            ...brandOrder.map((b) => ({ key: b, label: b, dot: BRANDS[b]?.p,
              n: data.filter((x) => x.brand === b).length, on: brands.has(b) })),
          ]} />
        <Dropdown label="Class" multi
          value={graceWatch ? "GRACE WATCH" : classes.size === 0 ? "" : classes.size <= 2 ? [...classes].map((c) => CLASSES[c].label).join(", ") : `${classes.size} selected`}
          onPick={(it) => {
            if (it.key === "GW") { setClasses(new Set()); setGraceWatch(true); }
            else if (it.key === "all") { setClasses(new Set()); setGraceWatch(false); }
            else { setGraceWatch(false); toggleClass(it.key); }
          }}
          items={[
            { key: "all", label: "All classes", n: (brands.size ? data.filter((x) => brands.has(x.brand)) : data).length, on: classes.size === 0 && !graceWatch },
            ...CLASS_ORDER.map((k) => ({ key: k, label: CLASSES[k].label, dot: CLASSES[k].color, n: counts[k], on: classes.has(k) && !graceWatch })),
            { key: "GW", label: "GRACE WATCH (all grace, by days left)", dot: CLASSES.GRACE.color, n: counts.GRACE_ALL, on: graceWatch },
          ]} />
      </div>

      <div className="toolbar">
        <div className="seg view-seg">
          <button className={view === "worklist" ? "on" : ""} onClick={() => setView("worklist")}>Worklist</button>
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>Table</button>
          <button className={view === "contacted" ? "on" : ""} onClick={() => setView("contacted")}>Contacted</button>
          <button className={view === "assigned" ? "on" : ""} onClick={() => setView("assigned")}>Assigned</button>
          <span className="seg-div" />
          <button className={view === "logincheck" ? "on" : ""} onClick={() => setView("logincheck")}>Login Check</button>
          <button className={view === "gracetasks" ? "on" : ""} onClick={() => setView("gracetasks")}>Grace Tasks</button>
        </div>
        {view !== "assigned" && view !== "logincheck" && view !== "gracetasks" && (<>
        <button className="btn-ghost legend-q" title="What do these terms mean?" onClick={() => setShowLegend((v) => !v)}>?</button>
        <input className="search" placeholder="Search player / uid / name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          {["ALL", "3", "V"].map((t) => (
            <button key={t} className={tier === t ? "on" : ""} onClick={() => setTier(t)}>
              {t === "ALL" ? "All tiers" : t === "3" ? "Tier 3" : "Tier V"}</button>))}
        </div>
        <button className={"btn-ghost" + (mine ? " active" : "")} onClick={() => setMine(!mine)}>My queue</button>
        <button className={"btn-ghost" + (zeroDep ? " active" : "")} title="Only players with 0 deposit this month" onClick={() => setZeroDep(!zeroDep)}>0 dep this month</button>
        <button className={"btn-ghost" + (onTg ? " active" : "")} title="Show only players with a Telegram link (non-TG players are still here when off — copy the username and IM them)" onClick={() => { setOnTg(!onTg); setNoTgOnly(false); }}>✈ On TG</button>
        <button className={"btn-ghost" + (graceFilter === "not" ? " active" : "")} title="Only players whose Grace Period challenge is NOT activated yet (read from the Lark Grace table)" onClick={() => setGraceFilter(graceFilter === "not" ? "" : "not")}>Grace: not activated</button>
        <button className={"btn-ghost" + (graceFilter === "act" ? " active" : "")} title="Only players whose Grace Period challenge is already activated (read from the Lark Grace table)" onClick={() => setGraceFilter(graceFilter === "act" ? "" : "act")}>Grace: activated</button>
        <button className={"btn-ghost" + (openOnly ? " active" : "")} title="Only players open to contact — hides anyone inside the 48h contact cooldown. Churn-risk (COOLING) players stay. They drop off as you contact them." onClick={() => setOpenOnly(!openOnly)}>Open to contact</button>
        <button className="btn-ghost" title="Download filtered list as CSV + copy usernames for blast tooling"
          onClick={() => exportQueue(filtered, snap, null, contactMap)}>Export {filtered.length}</button>
        {view === "table" && (
          <button className={"btn-ghost" + (pasteOpen ? " active" : "")} title="Paste a list of username + brand lines to tick those players"
            onClick={() => setPasteOpen((o) => !o)}>Paste list</button>
        )}
        {sorts.length > 0 && (
          <button className="btn-ghost" title="Reset table to the default priority (risk) order"
            onClick={() => setSorts([])}>Clear sort{sorts.length > 1 ? ` (${sorts.length})` : ""}</button>
        )}
        <div className="progress mono" title="Actionable (risk ≥ act) players with a logged outcome today">
          Actioned {progress.done}/{progress.total}
          <span className="pbar"><span style={{ width: progress.total ? (100 * progress.done / progress.total) + "%" : 0 }} /></span>
        </div>
        <div className="count mono">{filtered.length} shown</div>
        </>)}
      </div>

      {(brands.size > 0 || classes.size > 0 || graceWatch || graceFilter || tier !== "ALL" || q || zeroDep || onTg || noTgOnly) && (
        <div className="active-filters">
          <span className="af-label">Filters</span>
          {focusKeys && (
            <span className="fchip focus-chip">🔔 {focusLabel} · {focusKeys.size}
              <button className="fchip-x" title="Clear focus" onClick={() => { setFocusKeys(null); setFocusLabel(""); }}>✕</button></span>
          )}
          {zeroDep && (
            <span className="fchip">0 deposit this month
              <button className="fchip-x" title="Clear 0-deposit filter" onClick={() => setZeroDep(false)}>✕</button></span>
          )}
          {onTg && (
            <span className="fchip">✈ On TG only
              <button className="fchip-x" title="Show non-TG players again" onClick={() => setOnTg(false)}>✕</button></span>
          )}
          {graceFilter && (
            <span className="fchip">{graceFilter === "act" ? "Grace activated" : "Grace not activated"}
              <button className="fchip-x" title="Clear Grace filter" onClick={() => setGraceFilter("")}>✕</button></span>
          )}
          {noTgOnly && (
            <span className="fchip">✈ No link only
              <button className="fchip-x" title="Show all players again" onClick={() => setNoTgOnly(false)}>✕</button></span>
          )}
          {[...brands].map((b) => (
            <span key={b} className="fchip">{b}
              <button className="fchip-x" title="Remove this brand" onClick={() => toggleBrand(b)}>✕</button></span>
          ))}
          {graceWatch && (
            <span className="fchip">GRACE WATCH
              <button className="fchip-x" title="Clear class filter" onClick={() => setGraceWatch(false)}>✕</button></span>
          )}
          {[...classes].map((c) => (
            <span key={c} className="fchip">{CLASSES[c].label}
              <button className="fchip-x" title="Remove this class" onClick={() => toggleClass(c)}>✕</button></span>
          ))}
          {tier !== "ALL" && (
            <span className="fchip">Tier {tier}
              <button className="fchip-x" title="Clear tier filter" onClick={() => setTier("ALL")}>✕</button></span>
          )}
          {q && (
            <span className="fchip">"{q}"
              <button className="fchip-x" title="Clear search" onClick={() => setQ("")}>✕</button></span>
          )}
        </div>
      )}

      {showLegend && (
        <div className="legend">
          <div><b>DSLD</b> — Days Since Last Deposit. Higher = longer since they funded.</div>
          <div><b>Lifetime PNL</b> — the player's net result. Negative = they've lost overall = your highest-value customer.</div>
          <div><b>Tier 3 vs Tier V</b> — Tier 3 = VVIP 1–3 (volume). Tier V = VVIP 4–7 (top whales, personal handling).</div>
          <div><b>♛ Whale</b> — top-value Tier V player. Handle personally, never a generic blast.</div>
          <div><b>FRAGILE</b> — reactivated in the last 14 days. Soften everything: smaller ask, warmer tone.</div>
        </div>
      )}

      {graceNeeded && graceErr && (
        <div className="stale-banner">Grace activation state unavailable: {graceErr}. The list still works; the activated / not activated split is hidden until the Grace table can be read.</div>
      )}
      {view === "table" && pasteOpen && (
        <div className="paste-box">
          <div className="paste-help">One player per line: <b>username or UID + brand</b> (e.g. <span className="mono">swecin spin</span>). Brand can be the short code or the full name. Ticks are added to the current selection.</div>
          <textarea className="paste-ta" rows={6} value={pasteText} placeholder={"swecin spin\nkader007 my\n931229 rush"}
            onChange={(e) => { setPasteText(e.target.value); setPasteMsg(null); }} />
          <div className="paste-actions">
            <button className="btn-gold" disabled={!pasteText.trim()} onClick={tickPasted}>Tick players</button>
            <button className="btn-ghost" onClick={() => { setPasteText(""); setPasteMsg(null); }}>Clear text</button>
            {pasteMsg && (() => {
              const shown = new Set(filtered.map(ckey));
              const hidden = [...sel].filter((k) => !shown.has(k)).length;
              return <span className="paste-res">Ticked {pasteMsg.ok} of {pasteMsg.total}.{hidden > 0 && ` ${hidden} selected player${hidden > 1 ? "s are" : " is"} hidden by the current filters.`}</span>;
            })()}
          </div>
          {pasteMsg && pasteMsg.missing.length > 0 && <div className="paste-bad"><b>Not found</b> (not in this team's snapshot, or wrong brand): {pasteMsg.missing.join(", ")}</div>}
          {pasteMsg && pasteMsg.invalid.length > 0 && <div className="paste-bad"><b>Could not read:</b> {pasteMsg.invalid.join("; ")}</div>}
        </div>
      )}

      {sel.size > 0 && (
        <div className="sel-bar">
          <span className="sel-n">{sel.size} selected</span>
          <button className="btn-gold sel-copy" onClick={copySelectedUsernames}>{copiedSel === "ok" ? "✓ Copied" : copiedSel === "fail" ? "Copy blocked — open in Chrome" : "Copy usernames"}</button>
          {!readOnly && <button className="btn-mark" onClick={markSelectedContacted} disabled={markBusy}>{markBusy ? "Marking…" : "✓ Mark contacted"}</button>}
          <button className="btn-ghost" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      {view === "logincheck" ? (
        <LoginCheck me={me} team={team} viewDate={viewDate} viewTeam={viewTeam} />
      ) : view === "gracetasks" ? (
        <GraceTasks data={data} snap={snap} me={me} team={team} contactMap={contactMap}
          onSaveContact={onSaveContact} onClearContact={onClearContact} readOnly={readOnly} />
      ) : view === "assigned" ? (
        <AssignedView rows={data} contactMap={contactMap} contacts={contacts} team={team} viewTeam={viewTeam} me={me} snap={snap}
          dates={dates} setViewDate={setViewDate} onSaveContact={onSaveContact} onClearContact={onClearContact} readOnly={readOnly} />
      ) : view === "table" ? (
      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th className="tcheck" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" className="wl-check" title={`Tick all ${filtered.length} players in the current filter (all pages)`}
                checked={filtered.length > 0 && filtered.every((r) => sel.has(ckey(r)))}
                ref={(el) => { if (el) el.indeterminate = filtered.some((r) => sel.has(ckey(r))) && !filtered.every((r) => sel.has(ckey(r))); }}
                onChange={() => setSel((s) => {
                  const n = new Set(s);
                  if (filtered.every((r) => n.has(ckey(r)))) filtered.forEach((r) => n.delete(ckey(r)));
                  else filtered.forEach((r) => n.add(ckey(r)));
                  return n;
                })} />
            </th><th>Class</th><th>Player</th><th>Brand</th><th>Tier</th>
            <Th k="_tgrank"><span title="Telegram — available players sort to the top">✈ TG</span></Th>
            <Th k="_dsld" right>DSLD</Th>
            <Th k="daily_deposit" right>Deposit today</Th>
            <Th k="daily_withdraw" right>Withdrawal today</Th>
            <Th k="win_loss" right>Win/Loss today</Th>
            <Th k="pnl" right><span title="Player net result lifetime — negative = player has lost (your highest-value customers)">Lifetime PNL ⓘ</span></Th>
            <Th k="_graceDays" right>Grace</Th>
            <Th k="_contacted"><span title="Sort by 48h cooldown — open-to-contact players float to the top; click again to group those still in cooldown">Status</span></Th>
          </tr></thead>
          <tbody>
            {pageRows.map((r, i) => {
              const con = contactMap[ckey(r)];
              const cool = cooldownSet.has(ckey(r));
              const gg = graceGroup(r);
              const divider = gg !== null && (i === 0 || graceGroup(pageRows[i - 1]) !== gg);
              return (
                <Fragment key={ckey(r)}>
                {divider && <tr className="grace-div"><td colSpan={13}><span className={"gd-" + gg}>{GRACE_GROUP_LABEL[gg]}</span> <b>{graceCounts[gg]}</b></td></tr>}
                <tr className={(cool ? "cool" : "") + (sel.has(ckey(r)) ? " sel" : "")} {...tap(() => setSelIdx(i), null)}>
                  <td className="tcheck" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="wl-check" checked={sel.has(ckey(r))} onChange={() => toggleSel(ckey(r))} title="Select to copy username" />
                  </td>
                  <td><span className="cls-pill" style={{ "--cc": CLASSES[r._cls].color }}>{CLASSES[r._cls].label}</span>
                    {(r._cool2 || r._cooling) && <span className="cooling" title="Churn-risk from a deposit-rhythm break — act now">❄{r._cool2 ? ` RISK ${r._cool2.risk}` : " COOLING"}</span>}
                    {r._fragile && <span className="frag">FRAGILE</span>}
                    {r._whale && <span className="whale" title="Top-value Tier V — personal handling only">♛</span>}
                    {cool && <span className="coolbadge" title="Contacted within the last 48h — cooldown, do not re-contact (anti-spam)">COOLDOWN</span>}</td>
                  <td className="tname" onClick={(e) => e.stopPropagation()}><div className="pname">{dispName(r)}</div>
                    <div className="psub">{!looksNumeric(r.addressing) ? r.addressing : ""}</div></td>
                  <td><span className="b-dot" style={{ background: BRANDS[r.brand]?.p }} />{r.brand}</td>
                  <td className="mono">{r.tier_segment}</td>
                  <td className="tgcol">
                    {r._tg
                      ? <span className="tg-cell" title="On Telegram — open to message">✈</span>
                      : <span className="tg-cell off" title="Not on Telegram">·</span>}
                  </td>
                  <td className="r mono">{r._dsld ?? "—"}</td>
                  <td className="r mono">{fmt(r.daily_deposit)}</td>
                  <td className="r mono">{fmt(r.daily_withdraw)}</td>
                  <td className={"r mono " + ((r.win_loss ?? 0) < 0 ? "neg" : (r.win_loss ?? 0) > 0 ? "pos" : "")}>{fmt(r.win_loss)}</td>
                  <td className="r mono">{fmt(r.pnl)}</td>
                  <td className="r mono">{r._graceDays != null && r._graceDays >= 0 ? r._graceDays + "d" : "—"}{graceTag(r)}</td>
                  <td>{con?.status
                    ? <span className="st-tag" style={{ "--sc": ST_COLOR[con.status] }}>{con.status.replace("_", " ")}{con.assigned_to ? ` · ${con.assigned_to}` : ""}</span>
                    : con?.assigned_to ? <span className="st-tag" style={{ "--sc": ST_COLOR.ASSIGNED }}>{con.assigned_to}</span> : <span className="dim">—</span>}</td>
                </tr>
                </Fragment>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan="13" className="emptyrow">No players match — adjust filters.</td></tr>}
          </tbody>
        </table>
        {pager}
      </div>
      ) : view === "contacted" ? (
      <div className="tbl-wrap ct-wrap">
        <div className="ct-head">
          <div className="ct-pulse">
            <span><b className="mono">{pulse.total}</b> contacted</span>
            <span className="pos"><b className="mono">{pulse.recovered}</b> recovered</span>
            <span className="neg"><b className="mono">{pulse.no_response}</b> no response</span>
            <span><b className="mono">{pulse.pending}</b> pending</span>
          </div>
          <NativeSelect className="ct-agent" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="">All agents</option>
            {contactAgents.map((a) => <option key={a} value={a}>{a}</option>)}
          </NativeSelect>
        </div>
        <table>
          <thead><tr>
            <th>Player</th><th>Brand · Tier</th><th>Contacted by</th><th>Status</th>
            <th>Updated</th><th className="r">Deposit today</th><th>Note</th>
          </tr></thead>
          <tbody>
            {pageRows.map((r, i) => {
              const c = contactMap[ckey(r)];
              return (
                <tr key={ckey(r)} {...tap(() => setSelIdx(i), null)}>
                  <td className="tname"><div className="pname">{dispName(r)}</div>
                    <div className="psub">{!looksNumeric(r.addressing) ? r.addressing : ""}</div></td>
                  <td><span className="b-dot" style={{ background: BRANDS[r.brand]?.p }} />{r.brand} · {r.tier_segment}</td>
                  <td>{c.assigned_to || <span className="dim">unassigned</span>}</td>
                  <td><span className="st-tag" style={{ "--sc": ST_COLOR[c.status] }}>{c.status.replace("_", " ")}</span>
                    {c.updated_by === "auto" && <span className="auto-tag" title="Set automatically by the system">auto</span>}</td>
                  <td className="mono dim">{mytClock(c.updated_at)}</td>
                  <td className="r mono">{fmt(r.daily_deposit)}</td>
                  <td className="ct-note" title={c.note || ""}>{c.note || ""}</td>
                </tr>
              );
            })}
            {contactedRows.length === 0 && <tr><td colSpan="7" className="emptyrow">No contacts logged today{agentFilter ? ` for ${agentFilter}` : ""} — work the queue and they'll appear here.</td></tr>}
          </tbody>
        </table>
        {pager}
      </div>
      ) : (
      <div className="wl">
        {WL_BANDS.map((b) => {
          const rows = bands[b.key];
          if (!rows.length) return null;
          const lvl = b.key.toLowerCase();              // act / today / winback
          const allOpen = !!bandAll[b.key];
          const shown = allOpen ? rows : rows.slice(0, 10);
          const noTg = b.key === "ACT" ? rows.filter((r) => !r._tg).length : 0;   // ACT NOW players with no TG link to capture
          // Same "done" rule as the Actioned counter: a real outcome logged, not just ASSIGNED.
          const done = rows.filter((r) => { const c = contactMap[ckey(r)]; return c && c.status && c.status !== "ASSIGNED"; }).length;
          return (
            <div key={b.key} className={"wl-band wl-" + b.key} style={{ "--cc": b.color }}>
              <div className="wl-head">
                <span className="chip-dot" style={{ background: b.color }} />
                <span className="wl-hname" style={{ color: b.color }}>{b.label}</span>
                <span className="wl-hdesc">{b.desc}</span>
                {noTg > 0 && <button className={"wl-notg" + (noTgOnly ? " on" : "")} title={`${noTg} of these have no Telegram link — click to show only the no-link players (copy usernames, IM them, and capture their links)`}
                  onClick={(e) => { e.stopPropagation(); setNoTgOnly((v) => !v); setOnTg(false); }}>✈ {noTg} no link</button>}
                <span className="wl-prog"><b>{fmt(done)}</b> of {fmt(rows.length)} done</span>
                <button className="wl-export" title={`Export these ${rows.length} ${b.label} players as CSV (and copy names)`}
                  onClick={(e) => { e.stopPropagation(); exportQueue(rows, snap, b.label, contactMap); }}>⤓ CSV</button>
              </div>
              <div className="wl-pbar" role="progressbar" aria-label={`${b.label} progress`} aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={done}>
                <i style={{ width: `${rows.length ? (100 * done) / rows.length : 0}%` }} /></div>
              {shown.map((r, idx, arr) => wlRow(r, idx > 0 && arr[idx - 1]._cls === r._cls, lvl))}
              {rows.length > 10 && (
                <div className="wl-more">
                  <button className="btn-ghost" onClick={() => setBandAll((s) => ({ ...s, [b.key]: !s[b.key] }))}>
                    {allOpen ? "Show less" : `Show all ${rows.length}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {bands.NONE.length > 0 && (
          <div className="wl-band wl-NONE" style={{ "--cc": WL_NONE.color }}>
            <div className="wl-none" {...tap(() => setNoneOpen((v) => !v))}>
              <span className="wl-caret">{noneOpen ? "▾" : "▸"}</span>
              <span className="chip-dot" style={{ background: WL_NONE.color }} />
              <span className="wl-none-line">No action needed — {fmt(bands.NONE.length)} players ({WL_NONE.desc})</span>
            </div>
            {noneOpen && (bandAll.NONE ? bands.NONE : bands.NONE.slice(0, 10)).map((r, idx, arr) => wlRow(r, idx > 0 && arr[idx - 1]._cls === r._cls, "winback"))}
            {noneOpen && bands.NONE.length > 10 && (
              <div className="wl-more">
                <button className="btn-ghost" onClick={() => setBandAll((s) => ({ ...s, NONE: !s.NONE }))}>
                  {bandAll.NONE ? "Show less" : `Show all ${fmt(bands.NONE.length)}`}
                </button>
              </div>
            )}
          </div>
        )}
        {filtered.length === 0 && <div className="bigmsg">No players match — adjust filters.</div>}
      </div>
      )}

      {selIdx !== null && (() => {
        const activeList = view === "worklist" ? wlOrder : pageRows;
        const p = activeList[selIdx];
        return p ? (
          <Drawer list={activeList} index={selIdx} setIndex={setSelIdx}
            snap={snap} me={me} team={team} readOnly={readOnly}
            contact={contactMap[ckey(p)]}
            onSave={onSaveContact} onClear={onClearContact} onClose={() => setSelIdx(null)} />
        ) : null;
      })()}
    </>
  );
}

/* ════════════════════════ DASHBOARD (management view) ════════════════════════ */
/* Retention trend — Active depositors vs Cold (7+ days), compact dual-line area chart. */
// Trend series colours: validated on the dark panel (dataviz validate_palette.js, all checks pass).
// Teal = flow in / active, blue = cold (matches the DSLD class ramp), orange = withdrawals.
export const TREND_C = { active: "#2FA98C", cold: "#4A87DB", dep: "#2FA98C", wd: "#CC7626" };
export const TREND_PLAYERS = [
  { k: "active", label: "Active depositors", short: "Active", val: (r) => fmt(r.active || 0) },
  { k: "cold", label: "Cold (7+ days quiet)", short: "Cold", val: (r) => fmt(r.cold || 0) },
];
export const TREND_MONEY = [
  { k: "dep", label: "Deposits", short: "Dep", val: (r) => fmtRM(r.dep || 0) },
  { k: "wd", label: "Withdrawals", short: "WD", val: (r) => fmtRM(r.wd || 0), dash: true },
];
// One measure family per chart: never two y-scales on one plot. Players and RM get separate charts.
export function TrendChart({ rows, series, axis = fmt, extra = [], label }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(900);
  const [hi, setHi] = useState(null);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 150, padL = 52, padR = 56, padT = 12, padB = 22;
  const n = rows.length;
  const plotW = Math.max(1, w - padL - padR), plotH = H - padT - padB, baseY = padT + plotH;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i) => padL + step * i;
  // Zoomed to the data range (padded) so day-to-day movement is visible; real min/max labelled.
  const vals = rows.flatMap((r) => series.map((sr) => r[sr.k] || 0));
  const vMax = Math.max(...vals), vMin = Math.min(...vals);
  const pad = (vMax - vMin) * 0.14 || 1, lo = vMin - pad, top = vMax + pad;
  const y = (v) => padT + plotH - ((v - lo) / (top - lo || 1)) * plotH;
  const line = (k) => rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[k] || 0).toFixed(1)}`).join("");
  const every = Math.max(1, Math.ceil(n / 8));
  const tipLeft = hi == null ? 0 : Math.min(Math.max(x(hi), 118), w - 118);
  // Direct labels at the line ends, nudged apart when they'd collide.
  const ends = series.map((sr) => ({ ...sr, y: y(rows[n - 1]?.[sr.k] || 0) })).sort((p, q) => p.y - q.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
  return (
    <div className="trend-wrap" ref={wrapRef} onMouseLeave={() => setHi(null)}>
      <svg width={w} height={H} className="trend-svg" role="img" aria-label={label}>
        {[0.33, 0.66].map((f, i) => <line key={"g" + i} x1={padL} y1={padT + plotH * f} x2={w - padR} y2={padT + plotH * f} className="trend-grid" />)}
        <line x1={padL} y1={baseY} x2={w - padR} y2={baseY} className="trend-axis" />
        <text x={padL - 6} y={y(vMax) + 3} className="trend-axlab" textAnchor="end">{axis(vMax)}</text>
        <text x={padL - 6} y={y(vMin) + 3} className="trend-axlab" textAnchor="end">{axis(vMin)}</text>
        {series.map((sr) => <path key={sr.k} d={line(sr.k)} fill="none" stroke={TREND_C[sr.k]} strokeWidth="2"
          strokeDasharray={sr.dash ? "5 3" : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
        {ends.map((e) => <text key={"e" + e.k} x={w - padR + 6} y={e.y + 3} className="trend-end">{e.short}</text>)}
        {rows.map((r, i) => (i % every === 0 || i === n - 1) && (
          <text key={"x" + i} x={x(i)} y={H - 5} className="trend-xlab"
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{r.snapshot_date.slice(5)}</text>))}
        {hi != null && <line x1={x(hi)} y1={padT - 4} x2={x(hi)} y2={baseY} className="trend-guide" />}
        {hi != null && series.map((sr) => <circle key={"d" + sr.k} cx={x(hi)} cy={y(rows[hi][sr.k] || 0)} r="4" fill={TREND_C[sr.k]} stroke="var(--panel)" strokeWidth="2" />)}
        {rows.map((r, i) => <rect key={"h" + i} x={x(i) - (step || plotW) / 2} y={0} width={step || plotW} height={H}
          fill="transparent" onMouseEnter={() => setHi(i)} />)}
      </svg>
      {hi != null && rows[hi] && (
        <div className="trend-tip" style={{ left: tipLeft }}>
          <div className="tip-date">{rows[hi].snapshot_date}</div>
          {series.map((sr) => (
            <div className="tip-row" key={sr.k}>
              <span className="tip-dot" style={{ background: TREND_C[sr.k] }} />
              <span className="tip-lab">{sr.label}</span>
              <span className="tip-val">{sr.val(rows[hi])}</span>
            </div>))}
          {extra.map(([lab, val]) => (
            <div className="tip-row" key={lab}><span className="tip-dot" /><span className="tip-lab">{lab}</span><span className="tip-val">{val(rows[hi])}</span></div>))}
        </div>
      )}
    </div>
  );
}
export function TrendLegend({ series }) {
  return <div className="trend-legend">{series.map((sr) => (
    <span key={sr.k}><i className={sr.dash ? "dash" : ""} style={{ "--c": TREND_C[sr.k] }} />{sr.label}</span>))}</div>;
}

/* KPI headline card with a hover popover showing a breakdown (by brand / band / agent). */
export function KpiCard({ label, value, valClass, sub, acc, pop, muted }) {
  return (
    <div className={"kpi2-wrap" + (pop && pop.length ? " has-pop" : "")} tabIndex={pop && pop.length ? 0 : undefined}
      aria-label={pop && pop.length ? `${label}: ${value}. Breakdown on focus.` : undefined}>
      <div className={"kpi2" + (muted ? " muted" : "")}>
        <div className="k2-lab">{label}</div>
        <div className={"k2-val " + (valClass || "")}>{value}</div>
        <div className="k2-sub">{sub}</div>
      </div>
      {pop && pop.length > 0 && (
        <div className="kpi2-pop">
          {pop.map((r, i) => (
            <div className="kp-row" key={i}>
              {r.c && <span className="kp-dot" style={{ background: r.c }} />}
              <span className="kp-lab">{r.k}</span><span className="kp-val">{r.v}</span>
            </div>))}
        </div>
      )}
    </div>
  );
}

// Nearest available snapshot to "same day, one calendar month before `snap`".
// Returns a snapshot_date string, or null if none within ~5 days (e.g. before history begins).
export function pickLastMonthSnap(snap, dates) {
  if (!snap) return null;
  const all = (dates || []).map((d) => d.snapshot_date).filter(Boolean);
  if (!all.length) return null;
  const [y, m, d] = snap.split("-").map(Number);
  const t = new Date(y, m - 1, 1);          // 1st of this month (avoids day-overflow)
  t.setMonth(t.getMonth() - 1);             // → 1st of previous month
  const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(d, dim));              // same day-of-month, clamped to month length
  const pad = (n) => String(n).padStart(2, "0");
  const target = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  if (all.includes(target)) return target;
  const tMs = new Date(target).getTime();
  let best = null;
  for (const s of all) {
    const dist = Math.abs(new Date(s).getTime() - tMs);
    if (best == null || dist < best.dist) best = { s, dist };
  }
  return best && best.dist <= 5 * 864e5 ? best.s : null;   // within 5 days, else no baseline
}

/* ── ATL Daily Performance & Action report ─────────────────────────────────────
   Order: "<date> - Leader Reporting" title → brand comparison tables (Deposit, Active VIP,
   Retention, Reactivation; Both / Tier 3 / Tier V) → the ATL template → a blank leader
   alignment block. Section 1 (Deposit, Active VIP, Retention, Reactivation — Overall,
   Tier 3, Tier V) is fully automatic: most compare to the previous snapshot; RETENTION compares
   to the SAME DAY LAST MONTH (a cumulative metric barely moves day-to-day). Computed the same way
   as the Performance tab: Deposit from the daily_brand_stats rollup; Active = daily_deposit>0;
   Retention = players with monthly_deposit>0 / tier pool; Reactivation = the 'Reactivated' cohort.
   Sections 2-5 are drafted from the same data + the contact log for the ATL to check (no marker,
   so it pastes clean); free-text lines stay blank. Output is Markdown that pastes cleanly into Lark Docs. */
export function buildDailyReport({ curRows, prevRows, snap, prevSnap, brandOrder, lastMonthRows, lastMonthSnap, depStats, contacts, engagement }) {
  const brands = brandOrder.filter((b) => curRows.some((r) => r.brand === b));
  const int = (n) => Math.round(n).toLocaleString("en-US");
  const money = (n) => "RM" + int(n);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // A snapshot ingested today reflects yesterday's activity, so labels are the snapshot date − 1.
  const shift = (s) => { const [y, m, d] = (s || "").split("-").map(Number); return y ? new Date(y, (m || 1) - 1, (d || 1) - 1) : null; };
  const dCol = (s) => { const x = shift(s); return x ? `${x.getDate()} ${MON[x.getMonth()]}` : ""; };
  const dHdr = (s) => { const x = shift(s); return x ? `${x.getDate()} ${MONF[x.getMonth()]}` : ""; };
  const mean = (arr) => { const v = arr.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

  // Per-brand aggregate for one snapshot's rows, split by tier (3 / V) so every metric
  // can be reported as Tier 3 · Tier V · Both.
  const aggregate = (rows, snapDate) => {
    const m = {};
    brands.forEach((b) => (m[b] = { present: false, dep3: 0, depV: 0, act3: 0, actV: 0, rct3: 0, rctV: 0, t3p: 0, t3d: 0, tvp: 0, tvd: 0 }));
    (rows || []).forEach((r) => {
      const a = m[r.brand]; if (!a) return;
      a.present = true;
      const dd = Number(r.daily_deposit) || 0, md = Number(r.monthly_deposit) || 0;
      const react = (r.group_name || "").startsWith("Reactivated");
      if (r.tier_segment === "V") { a.depV += dd; if (dd > 0) a.actV++; if (react) a.rctV++; a.tvp++; if (md > 0) a.tvd++; }
      else if (r.tier_segment === "3") { a.dep3 += dd; if (dd > 0) a.act3++; if (react) a.rct3++; a.t3p++; if (md > 0) a.t3d++; }
    });
    // Deposit is taken from the daily_brand_stats rollup (the same source the Changes/Movement
    // page reads), which keeps the correct per-tier figure even when a feeder mislabels a tier and
    // corrupts that day's live player_days rows. Falls back to the player-row sum when the rollup
    // has no entry for this brand/day.
    const ds = (depStats && snapDate) ? depStats[snapDate] : null;
    brands.forEach((b) => {
      const a = m[b];
      if (ds && ds[b]) { a.dep3 = ds[b].dep3; a.depV = ds[b].depV; }
      a.depBoth = a.dep3 + a.depV; a.actBoth = a.act3 + a.actV; a.rctBoth = a.rct3 + a.rctV;
      a.t3pct = a.t3p ? (100 * a.t3d) / a.t3p : null;
      a.tvpct = a.tvp ? (100 * a.tvd) / a.tvp : null;
      a.bothpct = (a.t3p + a.tvp) ? (100 * (a.t3d + a.tvd)) / (a.t3p + a.tvp) : null;
    });
    return m;
  };
  const cur = aggregate(curRows, snap);
  const hasPrev = !!prevSnap;
  const prev = hasPrev ? aggregate(prevRows, prevSnap) : null;
  const curL = dCol(snap), prevL = dCol(prevSnap);
  // Retention's comparison baseline: the same day one calendar month back.
  const hasLastMonth = !!lastMonthSnap;
  const lastMonth = hasLastMonth ? aggregate(lastMonthRows, lastMonthSnap) : null;
  const lmL = dCol(lastMonthSnap);

  const L = [];
  const p = (s) => L.push(s);
  const D = "";   // drafted-line marker; off by request (2026-10-16) so the copy pastes clean — set to "✏️ " to bring it back

  // Team-level value of a metric: counts / RM sum across brands, rates are the mean of brand
  // rates (matches the app's team method).
  const rollup = (sel, agg, kind) => kind === "pct"
    ? mean(brands.map((b) => (agg[b] && agg[b].present ? sel(agg[b]) : null)))
    : brands.reduce((x, b) => x + (sel(agg[b]) || 0), 0);
  const arrow = (d) => (d > 0 ? "▲" : "▼");
  const pctChg = (c, pr) => (c == null || pr == null || pr === 0 ? null : ((c - pr) / Math.abs(pr)) * 100);
  const vsPct = (c, pr, lbl) => {
    const v = pctChg(c, pr);
    return v == null ? "" : ` (${Math.abs(v) < 0.005 ? "0.00%" : arrow(v) + Math.abs(v).toFixed(2) + "%"} vs ${lbl})`;
  };
  const vsPts = (c, pr, lbl) => (c == null || pr == null ? ""
    : ` (${Math.abs(c - pr) < 0.005 ? "0.00 pts" : arrow(c - pr) + Math.abs(c - pr).toFixed(2) + " pts"} vs ${lbl})`);
  const pct = (n) => (n == null ? "—" : Number(n).toFixed(2) + "%");

  // ── 1. Daily performance summary (fully automatic) ──
  const block = (t) => {
    const dep = (a) => (t === "3" ? a.dep3 : t === "V" ? a.depV : a.depBoth);
    const act = (a) => (t === "3" ? a.act3 : t === "V" ? a.actV : a.actBoth);
    const rct = (a) => (t === "3" ? a.rct3 : t === "V" ? a.rctV : a.rctBoth);
    const ret = (a) => (t === "3" ? a.t3pct : t === "V" ? a.tvpct : a.bothpct);
    const v = (sel, agg, kind) => (agg ? rollup(sel, agg, kind) : null);
    p(`- Deposit: ${money(v(dep, cur, "num"))}${hasPrev ? vsPct(v(dep, cur, "num"), v(dep, prev, "num"), prevL) : ""}`);
    p(`- Active VIP: ${int(v(act, cur, "num"))}${hasPrev ? vsPct(v(act, cur, "num"), v(act, prev, "num"), prevL) : ""}`);
    p(`- Retention: ${pct(v(ret, cur, "pct"))}${hasLastMonth ? vsPts(v(ret, cur, "pct"), v(ret, lastMonth, "pct"), lmL) : ""}`);
    p(`- Reactivation: ${int(v(rct, cur, "num"))}${hasPrev ? vsPct(v(rct, cur, "num"), v(rct, prev, "num"), prevL) : ""}`);
  };

  // ── Comparison tables (top of the report): per metric, Both then Tier 3 then Tier V. Each table
  // is Brand | <compare date> | <cur date> | Variance | Change %, brands ordered by the combined
  // current value so all three line up. Day-over-day by default; Retention uses the same day last month.
  const cell = (v, fmt) => (v == null ? "—" : fmt(v));
  const vary = (c, pr, kind) => {
    if (c == null || pr == null) return "—";
    const d = c - pr;
    if (kind === "pct") return Math.abs(d) < 0.005 ? "0.00" : arrow(d) + Math.abs(d).toFixed(2);
    return d === 0 ? "0" : arrow(d) + int(Math.abs(d));
  };
  const chg = (c, pr) => {
    const v = pctChg(c, pr);
    return v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  };
  const splitTable = (title, sel3, selV, selBoth, fmt, kind, cmp = prev, cmpL = prevL, cmpHas = hasPrev) => {
    const order = brands.map((b) => ({ b, v: selBoth(cur[b]) }))
      .sort((a, z) => (z.v ?? -Infinity) - (a.v ?? -Infinity)).map((x) => x.b);
    const sub = (label, sel) => {
      p(label); p("");
      if (cmpHas) { p(`| Brand | ${cmpL} | ${curL} | Variance | Change % |`); p("|---|---|---|---|---|"); }
      else { p(`| Brand | ${curL} |`); p("|---|---|"); }
      const line = (name, c, pr) => p(cmpHas
        ? `| ${name} | ${cell(pr, fmt)} | ${cell(c, fmt)} | ${vary(c, pr, kind)} | ${chg(c, pr)} |`
        : `| ${name} | ${cell(c, fmt)} |`);
      order.forEach((b) => line(b, sel(cur[b]), (cmp && cmp[b] && cmp[b].present) ? sel(cmp[b]) : null));
      line("**Total**", rollup(sel, cur, kind), cmpHas ? rollup(sel, cmp, kind) : null);
      p("");
    };
    sub(`### ${title}`, selBoth);
    sub("**Tier 3**", sel3);
    sub("**Tier V**", selV);
  };

  p(`# ${dHdr(snap)} - Leader Reporting`);
  p("");
  if (!hasPrev) { p(`Showing **${curL}** only — no earlier snapshot for comparison.`); p(""); }
  splitTable("Deposit", (a) => a.dep3, (a) => a.depV, (a) => a.depBoth, money, "num");
  splitTable("Active VIP", (a) => a.act3, (a) => a.actV, (a) => a.actBoth, int, "num");
  splitTable("Retention Rate", (a) => a.t3pct, (a) => a.tvpct, (a) => a.bothpct, pct, "pct", lastMonth, lmL, hasLastMonth);
  splitTable("Reactivation", (a) => a.rct3, (a) => a.rctV, (a) => a.rctBoth, int, "num");

  // ── Top deposit movers — biggest day-over-day swing in a player's daily deposit (either way) ──
  if (hasPrev) {
    const mapOf = (rows) => {
      const m = {};
      (rows || []).forEach((r) => { m[r.player_key + "|" + r.brand] = { dep: Number(r.daily_deposit) || 0, name: dispName(r), brand: r.brand }; });
      return m;
    };
    const pM = mapOf(prevRows), cM = mapOf(curRows);
    const movers = [...new Set([...Object.keys(pM), ...Object.keys(cM)])].map((k) => {
      const cv = cM[k]?.dep || 0, pvv = pM[k]?.dep || 0;
      return { name: (cM[k] || pM[k]).name, brand: (cM[k] || pM[k]).brand, cur: cv, prev: pvv, chg: cv - pvv };
    }).filter((m) => m.chg !== 0).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 10);
    if (movers.length) {
      p("### Top Deposit Movers");
      p("");
      p(`Biggest day-over-day deposit swing per player · ${prevL} → ${curL} · ▲ up · ▼ down.`);
      p("");
      p(`| Player | Brand | ${prevL} | ${curL} | Change |`);
      p("|---|---|---|---|---|");
      movers.forEach((m) => p(`| ${m.name} | ${m.brand} | ${int(m.prev)} | ${int(m.cur)} | ${arrow(m.chg)}${int(Math.abs(m.chg))} |`));
      p("");
    }
  }

  // Livechat/Telegram chats per brand, synced from Lark into engagement_daily (09:00 + 14:00 MYT). With no
  // synced rows for the report day the table stays blank to fill by hand, exactly as before.
  const eng = {};
  (engagement || []).forEach((r) => { if (brands.includes(r.brand)) eng[r.brand] = r; });
  const engOn = Object.keys(eng).length > 0;
  const share = (x, t) => (t ? ((100 * x) / t).toFixed(1) + "%" : "—");
  p(`**Livechat & Telegram Engagement** *(${engOn ? `synced from Lark · ${curL}` : "fill in manually"})*`);
  p("");
  p("| Brand | Livechat | Telegram | Total Chat | Livechat % | Telegram % |");
  p("|---|---|---|---|---|---|");
  if (engOn) {
    let tl = 0, tt = 0;
    brands.forEach((b) => {
      const r = eng[b];
      if (!r) { p(`| **${b}** | — | — | — | — | — |`); return; }
      const lc = Number(r.livechat) || 0, tg = Number(r.telegram) || 0;
      tl += lc; tt += tg;
      p(`| **${b}** | ${int(lc)} | ${int(tg)} | ${int(lc + tg)} | ${share(lc, lc + tg)} | ${share(tg, lc + tg)} |`);
    });
    p(`| **Total** | ${int(tl)} | ${int(tt)} | ${int(tl + tt)} | ${share(tl, tl + tt)} | ${share(tt, tl + tt)} |`);
  } else {
    brands.forEach((b) => p(`| **${b}** |  |  |  |  |  |`));
    p("| **Total** |  |  |  |  |  |");
  }
  p("");

  p("## 1. DAILY PERFORMANCE SUMMARY");
  p("");
  p("**Overall Performance**"); block("B"); p("");
  p("**Tier Performance**"); p("");
  p("*Tier 3*"); block("3"); p("");
  p("*Tier V*"); block("V"); p("");

  // ── 2-5. Normal-day analysis (rules, no AI) ──────────────────────────────────
  // Each brand × tier is compared with its NORMAL day — the average of the 7 snapshots before
  // today in the daily_brand_stats rollup, the same source the Deposit table uses — so one
  // good or bad day doesn't read as a trend. A move is only reported when it is big in BOTH
  // money and percent, and moves are ranked by money, not percent. Before anything is written
  // the numbers check themselves; a failed check prints "⚠ check manually" instead of a claim.
  // Every sentence comes from src/reportPhrases.js (several wordings, rotated per day).
  const GAP_RM = 10000, GAP_PCT = 15;     // a deposit move must clear both to be reported
  const EXTREME_PCT = 100;                // a move this big is flagged as unusual, not explained
  const RET_PTS = 3;                      // retention move vs last month worth a line
  const RCT_MIN = 5, RCT_PCT = 20;        // reactivation move vs yesterday worth a line
  const say = (key, vars) => phrase(key, vars, snap);
  const f1 = (n) => Math.abs(n).toFixed(1), f0 = (n) => Math.abs(n).toFixed(0);
  const days7 = Object.keys(depStats || {}).filter((s) => s < snap).sort().slice(-7);
  const depOf = (x, t) => (t === "3" ? x.dep3 : x.depV);
  // Brand × tier units: today (same figure the Deposit table prints) vs the 7-day average.
  const late = brands.filter((b) => !(depStats && depStats[snap] && depStats[snap][b]));
  const short = new Set();
  const units = [];
  brands.filter((b) => !late.includes(b)).forEach((b) => ["3", "V"].forEach((t) => {
    const vals = days7.map((s) => depStats[s] && depStats[s][b]).filter(Boolean).map((x) => depOf(x, t));
    if (vals.length < 5) { short.add(b); return; }     // too little history to call it normal
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
    const today = t === "3" ? cur[b].dep3 : cur[b].depV;
    units.push({ b, t, today, avg, gap: today - avg, pct: pctChg(today, avg) });
  }));
  // Self-check: the brand gaps must add up to the team gap, built separately from daily totals.
  const teamCheck = (t) => {
    const us = units.filter((u) => u.t === t);
    const sumGap = us.reduce((s, u) => s + u.gap, 0);
    const today = us.reduce((s, u) => s + u.today, 0);
    const dayTotals = days7.map((s) => us.reduce((x, u) => x + depOf((depStats[s] && depStats[s][u.b]) || { dep3: 0, depV: 0 }, u.t), 0));
    const avg = dayTotals.reduce((s, x) => s + x, 0) / (dayTotals.length || 1);
    return { today, avg, gap: today - avg, pct: pctChg(today, avg), ok: Math.abs(sumGap - (today - avg)) < 1 };
  };
  const team3 = teamCheck("3"), teamV = teamCheck("V");
  const depOk = units.length > 0 && team3.ok && teamV.ok;
  const extreme = (u) => u.pct != null && Math.abs(u.pct) >= EXTREME_PCT;
  const big = (u, dir) => !extreme(u) && (dir > 0 ? u.gap >= GAP_RM && u.pct >= GAP_PCT : u.gap <= -GAP_RM && u.pct <= -GAP_PCT);
  const ranked = (dir) => units.filter((u) => big(u, dir)).sort((a, z) => (dir > 0 ? z.gap - a.gap : a.gap - z.gap));
  // Both tiers of one brand moving the same way read as one brand line.
  const depLines = (dir) => {
    const out = [], seen = new Set();
    for (const u of ranked(dir)) {
      if (seen.has(u.b)) continue;
      seen.add(u.b);
      const other = units.find((x) => x.b === u.b && x.t !== u.t);
      if (other && big(other, dir)) {
        const today = u.today + other.today, avg = u.avg + other.avg;
        out.push(say(dir > 0 ? "dep_up_both" : "dep_down_both", { brand: u.b, pct: f0(pctChg(today, avg)), today: money(today), avg: money(avg) }));
      } else {
        out.push(say(dir > 0 ? "dep_up_tier" : "dep_down_tier", { brand: u.b, tier: u.t, pct: f0(u.pct), today: money(u.today), avg: money(u.avg), gap: money(Math.abs(u.gap)) }));
      }
    }
    return out;
  };
  const retLines = (dir) => brands.map((b) => {
    const c = cur[b], lm = lastMonth && lastMonth[b] && lastMonth[b].present ? lastMonth[b] : null;
    return lm && c.bothpct != null && lm.bothpct != null ? { b, now: c.bothpct, was: lm.bothpct, d: c.bothpct - lm.bothpct } : null;
  }).filter((x) => x && (dir > 0 ? x.d >= RET_PTS : x.d <= -RET_PTS))
    .sort((a, z) => (dir > 0 ? z.d - a.d : a.d - z.d))
    .map((x) => say(dir > 0 ? "ret_up" : "ret_down", { brand: x.b, pts: f1(x.d), was: x.was.toFixed(1), now: x.now.toFixed(1) }));
  const rctLines = (dir) => (hasPrev ? brands.map((b) => {
    const c = cur[b], pr = prev[b] && prev[b].present ? prev[b] : null;
    return pr ? { b, now: c.rctBoth, was: pr.rctBoth, d: c.rctBoth - pr.rctBoth } : null;
  }).filter((x) => x && (dir > 0 ? x.d >= RCT_MIN : x.d <= -RCT_MIN) && Math.abs(pctChg(x.now, x.was) ?? 100) >= RCT_PCT)
    .sort((a, z) => (dir > 0 ? z.d - a.d : a.d - z.d))
    .map((x) => say(dir > 0 ? "rct_up" : "rct_down", { brand: x.b, was: int(x.was), now: int(x.now), date: prevL })) : []);
  // Up to `cap` lines: the best of each metric first, then fill with the next deposit moves.
  const mix = (lists, cap = 3) => {
    const out = [], q = lists.map((l) => [...l]);
    q.forEach((l) => { if (l.length && out.length < cap) out.push(l.shift()); });
    q.forEach((l) => { while (l.length && out.length < cap) out.push(l.shift()); });
    return out;
  };
  const tierLine = (() => {
    if (!depOk) return null;
    const sign = (x) => `${x.pct >= 0 ? "+" : "−"}${f1(x.pct)}%`;
    const weak = [["3", team3], ["V", teamV]].filter(([, x]) => x.pct <= -5);
    if (!weak.length) return null;
    const [t, x] = weak.sort((a, z) => a[1].gap - z[1].gap)[0];
    const o = t === "3" ? teamV : team3;
    return say(o.pct <= -5 ? "tier_down_other_down" : "tier_down_other_fine",
      { tier: t, pct: f1(x.pct), today: money(x.today), avg: money(x.avg), other: t === "3" ? "V" : "3", otherPct: sign(o) });
  })();
  const odd = depOk ? units.filter(extreme).sort((a, z) => Math.abs(z.gap) - Math.abs(a.gap))
    .map((u) => say("extreme_move", { brand: u.b, tier: u.t, pct: `${u.pct >= 0 ? "+" : "−"}${f0(u.pct)}`, today: money(u.today), avg: money(u.avg) })) : [];
  const CHECK = say("check_failed");
  const pos = depOk ? mix([depLines(1), retLines(1), rctLines(1)], 4) : [CHECK, ...mix([retLines(1), rctLines(1)]).slice(0, 2)];
  const neg = depOk ? mix([depLines(-1), retLines(-1), rctLines(-1)]) : [CHECK, ...mix([retLines(-1), rctLines(-1)]).slice(0, 2)];
  p("## 2. BRAND PERFORMANCE & KEY OBSERVATIONS");
  p("");
  p("**Positive Highlights**"); (pos.length ? pos : [say("none_up")]).forEach((s) => p(`- ${D}${s}`)); p("");
  p("**Areas to Monitor**");
  [...(tierLine ? [tierLine] : []), ...(neg.length ? neg : (tierLine ? [] : [say("none_down")])), ...odd].forEach((s) => p(`- ${D}${s}`));
  if (late.length) p(`- ${D}${say("data_late", { brands: late.join(", ") })}`);
  if (short.size) p(`- ${D}${say("short_history", { brands: [...short].join(", ") })}`);
  p("");

  // ── 3. Actions taken: the contact log for the report day (= the previous snapshot) ──
  const ACTED = ["CONTACTED", "RESPONDED", "NO_RESPONSE", "RECOVERED"];
  const acted = (d) => (contacts || []).filter((c) => c.snapshot_date === d && brands.includes(c.brand) && ACTED.includes(c.status));
  const dayContacts = hasPrev ? acted(prevSnap) : [];
  const nC = dayContacts.length;
  const nResp = dayContacts.filter((c) => c.status === "RESPONDED").length;
  const nRec = dayContacts.filter((c) => c.status === "RECOVERED").length;
  const nNo = dayContacts.filter((c) => c.status === "NO_RESPONSE").length;
  const nNoAuto = dayContacts.filter((c) => c.status === "NO_RESPONSE" && c.updated_by === "auto").length;
  // Normal contact volume: the 7 report days before this one that logged any contact.
  const pastDays = [...new Set((contacts || []).map((c) => c.snapshot_date))].filter((d) => hasPrev && d < prevSnap).sort().slice(-7);
  const pastCounts = pastDays.map((d) => acted(d).length).filter((n) => n > 0);
  const avgC = pastCounts.length >= 3 ? pastCounts.reduce((s, x) => s + x, 0) / pastCounts.length : null;
  const byBrand = (() => { const m = {}; dayContacts.forEach((c) => (m[c.brand] = (m[c.brand] || 0) + 1)); return Object.entries(m).sort((a, z) => z[1] - a[1]); })();
  const cooling = curRows.filter((r) => r._cooling);
  const coolBy = (() => { const m = {}; cooling.forEach((r) => (m[r.brand] = (m[r.brand] || 0) + 1)); return Object.entries(m).sort((a, z) => z[1] - a[1]); })();
  const newCold = curRows.filter((r) => r._dsld === 7).length;
  // Priority = the brand × tier furthest below normal in money; next two follow it.
  const below = depOk ? units.filter((u) => u.gap < 0 && !extreme(u)).sort((a, z) => a.gap - z.gap) : [];
  const pr1 = below[0] || null;
  const losers = (u, n) => (u ? curRows.filter((r) => r.brand === u.b && r.tier_segment === u.t && (r.win_loss ?? 0) < 0)
    .sort((a, z) => a.win_loss - z.win_loss).slice(0, n).map((r) => dispName(r)) : []);
  p("## 3. ACTIONS TAKEN & RESULTS");
  p("");
  p("**ATL Report**");
  if (nC) {
    p(`- Brand: ${D}${byBrand.slice(0, 3).map(([b, n]) => `${b} (${n})`).join(", ")}`);
    p("- VIP / Segment:");
    const vol = !avgC ? "contacts_plain" : nC < avgC * 0.8 ? "contacts_down" : nC > avgC * 1.2 ? "contacts_up" : "contacts_flat";
    p(`- Action Taken: ${D}${say(vol, avgC ? { n: int(nC), avg: int(avgC) } : { n: int(nC) })}`);
    p(`- Result / Outcome: ${nC} contacted · ${nRec} recovered so far · ${nResp} responded · ${nNo} no response${nNoAuto ? ` (${nNoAuto} marked automatically)` : ""}`);
    const fa = [say("further_recover", { rec: nRec })];
    if (nNoAuto && nNoAuto / nC > 0.8) fa.push(say("further_auto"));
    p(`- Further Action Required: ${D}${fa.join(" · ")}`);
  } else {
    p("- Brand:"); p("- VIP / Segment:"); p("- Action Taken:");
    p(`- Result / Outcome: no contacts logged for ${prevL || curL}`);
    p("- Further Action Required:");
  }
  p("");
  p("**Possible Actions**");
  const act3 = [];
  if (pr1 && pr1.gap <= -GAP_RM) {
    const names = losers(pr1, 5);
    if (names.length) act3.push(say("act_losers", { brand: pr1.b, tier: pr1.t, names: names.join(", ") }));
  }
  if (cooling.length) act3.push(say("act_cooling", { n: cooling.length, top: coolBy.slice(0, 3).map(([b, n]) => `${b} (${n})`).join(", ") }));
  if (newCold) act3.push(say("act_newcold", { n: newCold }));
  (act3.length ? act3 : [say("act_none")]).forEach((s) => p(`- ${D}${s}`));
  p("");

  // ── 4. Plan for tomorrow ──
  const tmr = (() => { const [y, m, d] = snap.split("-").map(Number); const x = new Date(y, m - 1, d + 1); return `${x.getDate()} ${MON[x.getMonth()]}`; })();
  const nextUp = below.slice(1, 3).filter((u) => big(u, -1));
  p("## 4. PLAN & IDEAS FOR TOMORROW");
  p("");
  p("**Tomorrow's Plan**");
  if (pr1) {
    // Cooling whales are Tier V, so they only join the plan when the priority itself is Tier V.
    const pCool = pr1.t === "V" ? cooling.filter((r) => r.brand === pr1.b).length : 0;
    const sev = pr1.gap <= -30000 || pr1.pct <= -25 ? "High" : big(pr1, -1) ? "Medium" : "Low";
    p(`- Priority Brand / Segment: ${D}${say("plan_priority", { brand: pr1.b, tier: pr1.t, then: nextUp.length ? ` (then ${nextUp.map((u) => `${u.b} Tier ${u.t}`).join(" and ")})` : "" })}`);
    p(`- Planned Action: ${D}${pCool ? say("plan_action_cool", { brand: pr1.b, tier: pr1.t, whales: `${pCool} cooling whale${pCool > 1 ? "s" : ""}` }) : say("plan_action", { brand: pr1.b, tier: pr1.t })}`);
    p(`- Expected Result / Target: ${D}${say("plan_target", { brand: pr1.b, tier: pr1.t, today: money(pr1.today), avg: money(pr1.avg) })}`);
    p(`- Priority: ${D}${sev}`);
  } else {
    p("- Priority Brand / Segment:"); p("- Planned Action:"); p("- Expected Result / Target:"); p("- Priority: High / Medium / Low");
  }
  p(`- Follow-up Date / Time: ${D}${say("plan_followup", { date: tmr })}`);
  p("");
  p("**Possible Actions**");
  // Only what is NEW today, with names — standing counts (all comebacks this fortnight, all Tier V
  // with no deposit this month) read the same every day and were dropped. A line with nothing new is left out.
  const top3 = (rs, by) => [...rs].sort(by).slice(0, 3).map((r) => `${dispName(r)} (${r.brand})`).join(", ");
  const comebacks = curRows.filter((r) => (r.group_name || "").startsWith("Reactivated"));   // came back on the report day
  const v7 = curRows.filter((r) => r.tier_segment === "V" && r._dsld === 7);                   // went 7 days quiet today
  const deadline = curRows.filter((r) => r._graceDays != null && r._graceDays >= 0 && r._graceDays <= 1);
  const prevDep = {};
  (prevRows || []).forEach((r) => { prevDep[`${r.player_key}|${r.brand}`] = Number(r.daily_deposit) || 0; });
  const cbKeys = new Set(comebacks.map((r) => `${r.player_key}|${r.brand}`));
  const thank = hasPrev ? curRows.filter((r) => !cbKeys.has(`${r.player_key}|${r.brand}`))
    .map((r) => ({ r, up: (Number(r.daily_deposit) || 0) - (prevDep[`${r.player_key}|${r.brand}`] || 0) }))
    .filter((x) => x.up >= 5000).sort((a, z) => z.up - a.up)[0] : null;
  const act4 = [];
  if (avgC && nC < avgC * 0.8) act4.push(say("act4_volume", { avg: int(avgC) }));
  if (deadline.length) act4.push(say("act4_deadline", { n: deadline.length, names: top3(deadline, (a, z) => (a.pnl ?? 0) - (z.pnl ?? 0)) }));
  if (v7.length) act4.push(say("act4_v7", { n: v7.length, names: top3(v7, (a, z) => (a.pnl ?? 0) - (z.pnl ?? 0)) }));
  if (comebacks.length) act4.push(say("act4_comeback", { n: comebacks.length, date: curL, names: top3(comebacks, (a, z) => (z.daily_deposit || 0) - (a.daily_deposit || 0)) }));
  if (thank) act4.push(say("act4_thank", { name: dispName(thank.r), brand: thank.r.brand, gap: money(thank.up), date: curL }));
  (act4.length ? act4 : [say("act4_none")]).forEach((s) => p(`- ${D}${s}`));
  p("");

  // ── 5. Support / feedback: system checks drafted, the rest is the ATL's own input ──
  const reach = brands.map((b) => {
    const rs = curRows.filter((r) => r.brand === b);
    return { b, pct: rs.length ? (100 * rs.filter((r) => r._tg).length) / rs.length : null };
  }).filter((x) => x.pct != null && x.pct < 20).sort((a, z) => a.pct - z.pct);
  const concerns = [];
  if (nNoAuto && nNoAuto / nC > 0.8) concerns.push(say("concern_auto", { auto: nNoAuto, n: nC }));
  if (late.length) concerns.push(say("concern_late", { brands: late.join(", ") }));
  if (!engOn) concerns.push(say("concern_eng_missing", { date: curL }));
  const fresh = newPatterns();     // situations the code met with no wording in the phrase book
  if (fresh.length) concerns.push(say("concern_new", { keys: fresh.join(", ") }));
  // Telegram reach changes slowly, so it is a Monday reminder, not a daily line.
  const monday = (() => { const [y, m, d] = snap.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1; })();
  p("## 5. SUPPORT / IDEAS / FEEDBACK");
  p(`- Support Needed: ${monday && reach.length ? D + say("support_tg", { list: reach.slice(0, 2).map((x) => `${x.b} (${Math.round(x.pct)}% reach)`).join(" and ") }) : ""}`);
  p(`- Challenge / Concern: ${concerns.length ? D + concerns.join(" · ") : ""}`);
  p("- Improvement Idea:");
  p("- Other Comments:");
  p("");
  // ── Leader alignment block: always blank, the ATL fills it in ──
  [["Yesterday Top 3", 3], ["Current Issues", 1], ["Bottlenecks", 1], ["Support Needed", 1], ["Today's Top 3", 3]]
    .forEach(([h, n], i, all) => { p(`**${h}**`); for (let k = 0; k < n; k++) p("- "); if (i < all.length - 1) p(""); });
  return L.join("\n");
}

/* Last resort when the browser refuses the clipboard entirely (Safari with an expired gesture,
   an in-app browser, plain http). The report is already built — show it, pre-selected, so it can
   be copied by hand. Better a second keystroke than a dead button and no report. */
export function ReportFallback({ text, onClose }) {
  const ref = useRef(null);
  const [done, setDone] = useState(false);
  useEffect(() => { const t = ref.current; if (t) { t.focus(); t.select(); } }, []);
  return (
    <div className="aa-ov" onClick={(e) => { if (e.target.classList.contains("aa-ov")) onClose(); }}>
      <div className="aa-modal" style={{ maxWidth: 760 }}>
        <div className="aa-mh"><h3>Daily report — copy it by hand</h3><button className="aa-x" onClick={onClose}>×</button></div>
        <p className="dim" style={{ fontSize: 12.5, margin: "2px 0 10px" }}>
          Your browser blocked the automatic copy. The text is selected below — press <b>⌘C</b> (Mac) or <b>Ctrl+C</b>, then paste into Lark Docs.
        </p>
        <textarea ref={ref} readOnly value={text} spellCheck={false}
          style={{ width: "100%", height: 320, background: "var(--panel2)", color: "var(--txt)", border: "1px solid var(--line)",
                   borderRadius: 8, padding: 10, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, lineHeight: 1.45 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn-gold" onClick={async () => { setDone(await copyText(text)); }}>{done ? "✓ Copied" : "Try copy again"}</button>
          <button className="btn-ghost" onClick={() => { const t = ref.current; if (t) { t.focus(); t.select(); } }}>Select all</button>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ data: allData, brandOrder = BRAND_ORDER, viewTeam = "B", snap, isPast, contacts, me, team, dates, onSaveContact, onClearContact, readOnly }) {
  const [sel, setSel] = useState(null);   // { list, index } — open the player Drawer in place
  const [rptMsg, setRptMsg] = useState(""); // "" | "busy" | "ok" | "err" — daily-report copy status
  const [rptText, setRptText] = useState(null);   // manual-copy fallback when the browser refuses
  const [tierF, setTierF] = useState("ALL");   // 'ALL' | '3' | 'V' — Dashboard tier filter
  // Everything on the dashboard reads `data`; filtering it here flows the tier choice through
  // the KPI cards, Brand Health table and list cards. The clipboard report always uses the full
  // set (allData) since it prints the Tier 3 / Tier V / Both breakdown regardless of this filter.
  const data = useMemo(() => (tierF === "ALL" ? allData : allData.filter((r) => r.tier_segment === tierF)), [allData, tierF]);
  // NOT async, and nothing is awaited before the clipboard call — Safari only permits a write
  // that starts inside the click itself. The fetching happens inside `build`, whose promise is
  // handed straight to the clipboard. If the copy is still refused we show the report in a box
  // so it can always be selected by hand.
  function genReport() {
    setRptMsg("busy");
    const build = (async () => {
      // Every fetch below is independent, so they all start at once and the wait is the slowest
      // one (~4s), not the sum of them (~10s).
      // Previous available snapshot (for the day-over-day comparison), if any.
      const prevSnap = (dates || []).map((d) => d.snapshot_date).filter((s) => s < snap)[0] || null;
      // Same day one month back — powers the Retention Rate month-over-month table.
      const lastMonthSnap = pickLastMonthSnap(snap, dates);
      const boardRows = (d) => (d ? api(`/api/rtn/board?date=${d}`).then((b) => (b.rows || []).filter((r) => brandOrder.includes(r.brand))) : Promise.resolve(null));
      // Deposit figures come from the daily_brand_stats rollup — the same source the Changes/Movement
      // page uses — because a feeder tier-mislabel corrupts that day's live player_days rows (deleting
      // the real tier's rows) while the rollup keeps the correct per-tier total. Pull the months that
      // span the snapshots we report on and index deposit by date -> brand -> tier.
      // snap − 8 days covers the 7-day deposit average used for tomorrow's target.
      const wk = (() => { const [y, m, d] = snap.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, d - 8)); return x.toISOString().slice(0, 10); })();
      const months = [...new Set([snap, prevSnap, lastMonthSnap, wk].filter(Boolean).map((s) => s.slice(0, 7)))];
      // Livechat/Telegram chats for the report day (snapshot − 1). Missing endpoint or no sync yet
      // → null, and the report keeps its blank engagement table.
      const dataDay = (() => { const [y, m, d] = snap.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10); })();
      const [prevRows, lastMonthRows, mv, engagement] = await Promise.all([
        boardRows(prevSnap),
        boardRows(lastMonthSnap),
        Promise.all(months.map((mo) => api(`/api/rtn/movement?month=${mo}`).catch(() => null))),
        api(`/api/rtn/engagement?date=${dataDay}&team=${encodeURIComponent(viewTeam)}`).then((r) => r.rows || null).catch(() => null),
      ]);
      const depStats = {};
      mv.forEach((res) => (res && res.rows || []).forEach((r) => {
        if (!brandOrder.includes(r.brand)) return;
        const d = depStats[r.snapshot_date] || (depStats[r.snapshot_date] = {});
        const b = d[r.brand] || (d[r.brand] = { dep3: 0, depV: 0 });
        if (r.tier_segment === "V") b.depV += Number(r.deposit) || 0;
        else if (r.tier_segment === "3") b.dep3 += Number(r.deposit) || 0;
      }));
      return buildDailyReport({ curRows: allData, prevRows, snap, prevSnap, brandOrder, lastMonthRows, lastMonthSnap, depStats, contacts, engagement });
    })();
    build.catch(() => {});   // the copy path reports the failure; keep this from going unhandled
    copyTextPromise(build).then(
      (ok) => {
        if (ok) { setRptMsg("ok"); setTimeout(() => setRptMsg(""), 2500); return; }
        build.then((md) => { setRptText(md); setRptMsg(""); }, () => { setRptMsg("err"); setTimeout(() => setRptMsg(""), 3500); });
      },
      () => { setRptMsg("err"); setTimeout(() => setRptMsg(""), 3500); }
    );
  }
  const contactMap = useMemo(() => {
    const m = {};
    (contacts || []).forEach((c) => { if (c.snapshot_date === snap) m[ckey(c)] = c; });
    return m;
  }, [contacts, snap]);
  const [trend, setTrend] = useState(null);     // null = loading · [] = none/error
  const [trendErr, setTrendErr] = useState(false);
  const [range, setRange] = useState(14);
  const [trendBrand, setTrendBrand] = useState("ALL");   // "ALL" = whole of Group B, else one brand
  useEffect(() => {
    setTrend(null); setTrendErr(false);
    const bq = trendBrand !== "ALL" ? `&brand=${encodeURIComponent(trendBrand)}` : "";
    api(`/api/rtn/trend?days=${range}${bq}&team=${encodeURIComponent(viewTeam)}`).then((d) => setTrend(d || [])).catch(() => { setTrend([]); setTrendErr(true); });
  }, [range, trendBrand, viewTeam]);

  const sum = (f) => data.reduce((s, r) => s + (r[f] || 0), 0);
  const dep = sum("daily_deposit"), wd = sum("daily_withdraw"), wl = sum("win_loss");
  const players = data.length;
  const activeVips = data.filter((r) => (r.daily_deposit || 0) > 0).length;
  const activeRate = players ? Math.round((activeVips / players) * 100) : 0;
  const coldPile = data.filter((r) => r._dsld != null && r._dsld >= 7).length;
  const coldRate = players ? Math.round((coldPile / players) * 100) : 0;
  const whalesAtRiskN = data.filter((r) => r._whale && r._risk >= 2).length;
  // CS pulse from the contact log (this snapshot). A real contact = a set outcome, not just assigned.
  const REACHED = new Set(["CONTACTED", "RESPONDED", "RECOVERED", "NO_RESPONSE"]);
  const todayC = (contacts || []).filter((c) => c.snapshot_date === snap);
  const recoveredToday = todayC.filter((c) => c.status === "RECOVERED").length;
  const contactedToday = todayC.filter((c) => REACHED.has(c.status)).length;

  const tAsc = trend ? [...trend].sort((a, b) => (a.snapshot_date < b.snapshot_date ? -1 : 1)) : [];
  const prev = tAsc.length > 1 ? tAsc[tAsc.length - 2] : null;
  // Day-over-day deltas only valid on today AND when the trend = whole team (matches the team-total KPIs).
  const base = (!isPast && trendBrand === "ALL" && prev) ? prev : null;
  const delta = (base && base.dep) ? Math.round((100 * (dep - base.dep)) / base.dep) : null;
  const dActive = base ? activeVips - (base.active || 0) : null;
  const dCold = base ? coldPile - (base.cold || 0) : null;

  const byDep = (a, b) => (b.daily_deposit || 0) - (a.daily_deposit || 0);
  const fullDep = [...data].filter((r) => (r.daily_deposit || 0) > 0).sort(byDep);
  const fullWd = [...data].filter((r) => (r.daily_withdraw || 0) > 0).sort((a, b) => (b.daily_withdraw || 0) - (a.daily_withdraw || 0));
  // Newly cold = just crossed 7 days since last deposit today (freshest win-back targets), value first.
  const newlyCold = data.filter((r) => r._dsld === 7).sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));
  const fullWhales = data.filter((r) => r._whale && r._risk >= 2).sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));

  // Per-brand health — worst (lowest active rate) first
  const brandStats = brandOrder.map((b) => {
    const rows = data.filter((r) => r.brand === b);
    if (!rows.length) return null;
    const players = rows.length;
    const active = rows.filter((r) => (r.daily_deposit || 0) > 0).length;
    const cold = rows.filter((r) => r._dsld != null && r._dsld >= 7).length;
    const bdep = rows.reduce((s, r) => s + (r.daily_deposit || 0), 0);
    const bwd = rows.reduce((s, r) => s + (r.daily_withdraw || 0), 0);
    const bwl = rows.reduce((s, r) => s + (r.win_loss || 0), 0);
    const tg = rows.filter((r) => r._tg).length;
    return { brand: b, players, active, activePct: players ? (active / players) * 100 : 0, cold, dep: bdep, wd: bwd, wl: bwl, net: bdep - bwd, tg, tgPct: players ? (tg / players) * 100 : 0 };
  }).filter(Boolean).sort((a, b) => a.activePct - b.activePct);

  // Per-card hover breakdowns
  const bCol = (b) => BRANDS[b]?.p;
  const groupCount = (arr, key) => Object.entries(arr.reduce((m, c) => { const a = c[key] || "unassigned"; m[a] = (m[a] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]);
  const popActive = [...brandStats].sort((a, b) => b.active - a.active).map((s) => ({ c: bCol(s.brand), k: s.brand, v: `${fmt(s.active)} · ${Math.round(s.activePct)}%` }));
  const popDep = [...brandStats].sort((a, b) => b.dep - a.dep).map((s) => ({ c: bCol(s.brand), k: s.brand, v: fmtRM(s.dep) }));
  const popWL = [...brandStats].sort((a, b) => a.wl - b.wl).map((s) => ({ c: bCol(s.brand), k: s.brand, v: fmtRM(s.wl) }));
  const popNet = [{ k: "Deposits", v: fmtRM(dep) }, { k: "Withdrawals", v: fmtRM(wd) }, { k: "Net flow", v: fmtRM(dep - wd) }];
  const cBand = (lo, hi) => data.filter((r) => r._dsld != null && r._dsld >= lo && (hi == null || r._dsld < hi)).length;
  const popCold = [{ k: "7–13 days quiet", v: fmt(cBand(7, 14)) }, { k: "14–29 days", v: fmt(cBand(14, 30)) }, { k: "30+ days", v: fmt(cBand(30, null)) }];
  const popWhales = fullWhales.length ? fullWhales.slice(0, 6).map((r) => ({ c: bCol(r.brand), k: dispName(r), v: fmtRM(r.pnl) })) : [{ k: "None at risk", v: "" }];
  const conRows = todayC.filter((c) => REACHED.has(c.status));
  const teamAgents = [...new Set(conRows.map((c) => c.assigned_to || "unassigned"))];
  const popTeam = teamAgents.length ? teamAgents.map((a) => {
    const con = conRows.filter((c) => (c.assigned_to || "unassigned") === a).length;
    const rec = todayC.filter((c) => c.status === "RECOVERED" && (c.assigned_to || "unassigned") === a).length;
    return { k: a, v: `${con} · ${rec} rec` };
  }) : [{ k: "None logged yet", v: "" }];
  const popEff = [...brandStats].sort((a, b) => (b.active ? b.dep / b.active : 0) - (a.active ? a.dep / a.active : 0))
    .map((s) => ({ c: bCol(s.brand), k: s.brand, v: fmtRM(s.active ? Math.round(s.dep / s.active) : 0) }));
  const depPerActive = activeVips ? Math.round(dep / activeVips) : 0;

  const List = ({ title, rows, amtKey, sub, acc, emptyHint }) => {
    const shown = rows.slice(0, 8);
    const empty = shown.length === 0;
    return (
      <div className={"set-card list-card" + (empty ? " muted" : "")} style={{ "--acc": acc }}>
        <h3>{title}{rows.length > 8 && <span className="dim list-of"> top 8 of {rows.length}</span>}</h3>
        {empty && <div className="dim" style={{ fontSize: 13 }}>None{isPast ? "" : " today"}{emptyHint ? ` — ${emptyHint}` : ""}.</div>}
        {shown.map((r, i) => (
          <div key={ckey(r)} className="lrow" {...tap(() => setSel({ list: shown, index: i }))} title="Open this player">
            <span className="rk">#{i + 1}</span>
            <span className="b-dot" style={{ background: BRANDS[r.brand]?.p }} />
            <span>
              <div className="pname">{dispName(r)}<TgFlag on={r._tg} /></div>
              <div className="psub">{r.brand} · Tier {r.tier_segment}{sub ? ` · ${sub(r)}` : ""}</div>
            </span>
            <span className="amt">{fmtRM(r[amtKey])}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="dash">
      <div className="dash-actions">
        <div className="seg tier-seg" title="Filter the dashboard by tier">
          {[["ALL", "All tiers"], ["3", "Tier 3"], ["V", "Tier V"]].map(([v, l]) => (
            <button key={v} className={tierF === v ? "on" : ""} onClick={() => setTierF(v)}>{l}</button>
          ))}
        </div>
        {(() => {
          const fed = new Set(data.map((r) => r.brand));
          const missing = brandOrder.filter((b) => !fed.has(b));
          return missing.length > 0 ? (
            <span className="dash-warn" title="These brands have no rows in today's snapshot — their feeders haven't run yet. The report will omit them.">
              ⚠ {missing.length} brand{missing.length > 1 ? "s" : ""} not fed today: {missing.join(", ")} — report will be incomplete
            </span>
          ) : null;
        })()}
        <button className="btn-ghost" onClick={genReport} disabled={rptMsg === "busy"} title="Copy the Daily Leadership Alignment report (Team Performance auto-filled) to paste into Lark Docs">
          {rptMsg === "busy" ? "…" : rptMsg === "ok" ? "Copied ✓ — paste into Lark Docs" : rptMsg === "err" ? "Copy failed — retry" : "📄 Daily report → clipboard"}
        </button>
      </div>
      {rptText != null && <ReportFallback text={rptText} onClose={() => setRptText(null)} />}
      {isPast && <div className="viewonly-banner">Viewing {snap} — the KPIs and lists are that day; the trend chart always shows the latest days.</div>}

      <div className="kpis2">
        <KpiCard label="Active VIPs" value={fmt(activeVips)} pop={popActive}
          sub={<>{activeRate}% of {fmt(players)}{dActive != null && <> · <span className={dActive >= 0 ? "k2-up" : "k2-down"}>{dActive >= 0 ? "▲" : "▼"}{fmt(Math.abs(dActive))}</span></>}</>} />
        <KpiCard label="Cold pile (7+)" value={fmt(coldPile)} pop={popCold}
          sub={<>{coldRate}% of pool{dCold != null && <> · <span className={dCold <= 0 ? "k2-up" : "k2-down"}>{dCold >= 0 ? "▲" : "▼"}{fmt(Math.abs(dCold))}</span></>}</>} />
        <KpiCard label="♛ Whales at risk" value={fmt(whalesAtRiskN)} valClass={whalesAtRiskN > 0 ? "neg" : "pos"} sub="act-level & cold" pop={popWhales} />
        <KpiCard label={"Team actions" + (isPast ? "" : " today")} value={`${fmt(contactedToday)} / ${fmt(recoveredToday)}`} muted={contactedToday === 0 && recoveredToday === 0}
          sub={contactedToday === 0 && recoveredToday === 0 ? "awaiting queue logging" : "contacted / recovered · by agent"} pop={popTeam} />
        <KpiCard label={"Deposits" + (isPast ? "" : " today")} value={fmtRM(dep)} pop={popDep}
          sub={delta == null ? "vs prev —" : delta === 0 ? <span className="k2-flat">→ 0% vs prev</span> : <span className={delta > 0 ? "k2-up" : "k2-down"}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}% vs prev</span>} />
        <KpiCard label="Net flow" value={fmtRM(dep - wd)} valClass={dep - wd >= 0 ? "pos" : "neg"} sub="deposits − withdrawals" pop={popNet} />
        {/* Neutral value: W/L is player-signed, so "good" (house ahead) is a negative number. Colouring it green
            clashed with the sign colours used everywhere else (drawer W/L, net flow). The sub line says who is ahead. */}
        <KpiCard label={"Player W/L" + (isPast ? "" : " today")} value={fmtRM(wl)}
          sub={wl < 0 ? `House ahead by ${fmtRM(-wl)}` : wl > 0 ? `Players ahead by ${fmtRM(wl)}` : "Even"} pop={popWL} />
        <KpiCard label="Deposit / active VIP" value={fmtRM(depPerActive)} sub="avg per active VIP" pop={popEff} />
      </div>

      <div className="set-card">
        <h3 className="dash-trend-head">Retention trend{tierF !== "ALL" && <span className="dim" style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>· all tiers (not filtered)</span>}
          <NativeSelect className="trend-brand" value={trendBrand} onChange={(e) => setTrendBrand(e.target.value)}>
            <option value="ALL">All brands</option>
            {brandOrder.map((b) => <option key={b} value={b}>{b}</option>)}
          </NativeSelect>
          <span className="range-toggle">{[7, 14, 30].map((d) => (
            <button key={d} className={range === d ? "on" : ""} onClick={() => setRange(d)}>{d}d</button>))}</span>
        </h3>
        {trend === null ? <div className="dim" style={{ fontSize: 13 }}>Loading…</div>
          : trendErr ? <div className="dim" style={{ fontSize: 13 }}>Couldn't load the trend — try Refresh.</div>
          : tAsc.length <= 1 ? <div className="dim" style={{ fontSize: 13 }}>Trend builds as snapshots stack — at least 2 days needed.</div>
          : (() => {
              const f = tAsc[0], l = tAsc[tAsc.length - 1];
              const chg = f.cold ? Math.round(((l.cold - f.cold) / f.cold) * 100) : 0;
              const avgA = Math.round(tAsc.reduce((s, r) => s + (r.active || 0), 0) / tAsc.length);
              return (<>
                <div className="trend-insight">
                  Cold pile <b className={chg > 0 ? "ins-bad" : chg < 0 ? "ins-good" : ""}>{chg > 0 ? "▲" : chg < 0 ? "▼" : "→"} {fmt(f.cold)} → {fmt(l.cold)} ({chg >= 0 ? "+" : ""}{chg}%)</b> · Active steady ~{fmt(avgA)}/day
                </div>
                <div className="trend-sub">Players</div>
                <TrendLegend series={TREND_PLAYERS} />
                <TrendChart rows={tAsc} series={TREND_PLAYERS} label="Active and cold players by day"
                  extra={[["Players", (r) => fmt(r.players || 0)]]} />
                <div className="trend-sub">Money</div>
                <TrendLegend series={TREND_MONEY} />
                <TrendChart rows={tAsc} series={TREND_MONEY} label="Deposits and withdrawals by day"
                  axis={(v) => "RM " + (Math.abs(v) >= 1000 ? Math.round(v / 1000) + "k" : String(Math.round(v)))}
                  extra={[["PNL (Dep − WD)", (r) => fmtRM((r.dep || 0) - (r.wd || 0))]]} />
              </>);
            })()}
      </div>

      <div className="set-card">
        <h3>Brand health <span className="dim list-of">· worst first · click a row to chart it</span></h3>
        <div className="tbl-x"><table className="perf-tbl brand-tbl">
          <thead><tr><th>Brand</th><th className="r">Players</th><th className="r">✈ TG reach <InfoTip align="right">Share of this snapshot's players who have a Telegram link on file — i.e. how many of today's VIPs you can reach via TG. Amber under 30%.</InfoTip></th><th className="r">Active</th><th className="r">Cold 7+</th><th className="r">Deposits</th><th className="r">Net flow</th></tr></thead>
          <tbody>
            {brandStats.map((s) => (
              <tr key={s.brand} className={"brand-row" + (trendBrand === s.brand ? " sel" : "")} {...tap(() => setTrendBrand(s.brand), null)} title="Show this brand in the retention trend">
                <td><span className="b-dot" style={{ background: BRANDS[s.brand]?.p }} />{s.brand}</td>
                <td className="r">{s.players}</td>
                <td className={"r " + (s.tgPct < 30 ? "warn" : "")}>{s.tg} <span className="dim">({s.tgPct.toFixed(0)}%)</span></td>
                <td className="r">{s.active} <span className="dim">({s.activePct.toFixed(0)}%)</span></td>
                <td className="r">{s.cold}</td>
                <td className="r">{fmtRM(s.dep)}</td>
                <td className={"r " + (s.net >= 0 ? "pos" : "neg")}>{fmtRM(s.net)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="dash-grid">
        <List title="Top depositors" acc="var(--pos)" rows={fullDep} amtKey="daily_deposit" />
        <List title="Top withdrawals" acc="var(--neg)" rows={fullWd} amtKey="daily_withdraw" />
        <List title="Newly cold today" acc={CLASSES.DSLD30.color} rows={newlyCold} amtKey="pnl" emptyHint="nobody newly cold" sub={(r) => CLASSES[r._cls]?.label || "cold"} />
        <List title="♛ High-value at risk" acc="var(--band-act)" rows={fullWhales} amtKey="pnl" sub={(r) => `${CLASSES[r._cls].label} · DSLD ${r._dsld ?? "—"}`} />
      </div>

      {sel && sel.list[sel.index] && (
        <Drawer list={sel.list} index={sel.index} setIndex={(i) => setSel((s) => ({ ...s, index: i }))}
          snap={snap} me={me} team={team} contact={contactMap[ckey(sel.list[sel.index])]}
          onSave={onSaveContact} onClear={onClearContact} onClose={() => setSel(null)} readOnly={readOnly} />
      )}
    </div>
  );
}

/* ════════════════════════ PERFORMANCE (last 30 days) ════════════════════════ */
/* Stage 1a — Team KPI retention scorecard. Manual % entry per brand; pools + players-needed from player_days. */
// KPI engine + leaderboard are DISABLED for the KPI-system revision (2026-07). Flip to true to
// restore the old Base/Bonus/FinalKPI scorecard + KPI Leaderboard. Everything else (retention
// detail, save-rate By CS/Class/Brand, Team snapshot) stays live regardless.
export const KPI_ENABLED = false;
export const KPI_TARGET = { t3: 92, tv: 94.5 };
// BaseKPI band tables (points) — editable config, verbatim from KPI_ENGINE_FULL_SPEC.md.
export const KPI_BANDS = {
  t3:  [[95, 15], [93, 12], [91, 8], [89, 4]],          // % >= threshold -> pts (else 0); max 15
  tv:  [[97.5, 15], [95.5, 12], [93.5, 8], [91.5, 4]],  // max 15
  growth: [[30, 20], [25, 15], [15, 10], [6, 5]],       // MoM % >= threshold -> pts; max 20
  frt: [[10, 30], [11, 25], [13, 20], [15, 10]],        // seconds <= threshold -> pts; max 30
  disc: [[2, 20], [4, 15], [6, 10], [8, 5]],            // mistakes <= threshold -> pts; max 20
};
// Bonus track ("Extra KPI") — unlocks only when BaseKPI > 75. Max 20 (8+6+4+2). Editable config.
export const KPI_BONUS_UNLOCK = 75;       // BaseKPI must EXCEED this to earn AddMarks
export const KPI_BONUS = {
  react:  [[4, 8], [3, 6], [2, 4], [1, 2]],   // reactivated players >= threshold -> pts; max 8
  growth: [[20, 6], [15, 4], [12, 2]],         // MoM % >= threshold -> pts; max 6
  disc:   [[0, 4], [1, 2]],                     // mistakes <= threshold -> pts (else 0); max 4
  frt:    5,                                     // FRT sec < this -> 2, else 0; max 2
};
export const scoreHi = (v, bands) => { for (const b of bands) if (v >= b[0]) return b[1]; return 0; }; // higher better
export const scoreLo = (v, bands) => { for (const b of bands) if (v <= b[0]) return b[1]; return 0; }; // lower better
export const bonusFrt = (sec) => (sec !== "" && sec != null && !isNaN(parseFloat(sec)) && parseFloat(sec) < KPI_BONUS.frt ? 2 : 0);
export const lbByMarks = (a, b) => { const av = parseFloat(a.marks), bv = parseFloat(b.marks); return (isNaN(bv) ? -Infinity : bv) - (isNaN(av) ? -Infinity : av); };
export const MISTAKE_CATS = ["Communication Errors", "Bonus & Promotional Execution", "Data Integrity", "Workflow & Ticket Management", "System & Tool Misuse"];
// Retention auto-computes from cumulative monthly deposits, EXCEPT brands listed here.
// ACE33: its official retention is a "still in grace" metric (~60-day window), NOT a deposit
// metric. A too-low VVIP threshold upgraded many small rollers who then churned but linger in
// grace, bloating the tier pool. So auto-from-deposits reads ~30pts below official (verified
// 2026-06: Tier3 auto 63% vs official 96%). Kept manual until tiering is fixed at source or the
// feed sends a grace flag we can exclude. See memory: ace33-retention-feed-bloat.
export const RETENTION_MANUAL_BRANDS = new Set([]);   // all brands auto-compute; pool self-corrects as non-retained players are downgraded out of tier

/* Small "i" help icon — replaces inline explanatory notes. The explanation shows as a hover/focus
   popup, keeping cards clean. Put it right after a title. align="right" anchors the popup to the
   right edge (for titles near the screen edge, e.g. the right column). */
export function InfoTip({ children, align }) {
  return (
    <span className={"infotip" + (align === "right" ? " r" : "")} tabIndex={0} role="note" aria-label="More info">
      <span className="infotip-i" aria-hidden="true">i</span>
      <span className="infotip-pop">{children}</span>
    </span>
  );
}

/* Reusable manual ranked board (KPI Leaderboard / Team Challenge): name + score, add/edit/remove, ranked. */
export function ManualBoard({ title, note, addPlaceholder, month, endpoint, initial, bare }) {
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState("");
  const sig = JSON.stringify(initial || []);
  useEffect(() => { setRows([...(initial || [])].sort(lbByMarks)); }, [sig]);
  const setMark = (name, v) => setRows((rs) => rs.map((r) => (r.name === name ? { ...r, marks: v } : r)));
  async function save(name) {
    const row = rows.find((r) => r.name === name);
    try {
      await api(endpoint, { method: "POST", body: JSON.stringify({ month, name, marks: row ? row.marks : "" }) });
      setSaved(name); setTimeout(() => setSaved(""), 1000);
    } catch (e) { /* keep edits */ }
    setRows((rs) => [...rs].sort(lbByMarks));
  }
  async function add() {
    const name = newName.trim();
    if (!name) return;
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) { setNewName(""); return; }
    setRows((rs) => [...rs, { name, marks: "" }]); setNewName("");
    try { await api(endpoint, { method: "POST", body: JSON.stringify({ month, name, marks: "" }) }); } catch (e) { /* keep on screen */ }
  }
  async function remove(name) {
    setRows((rs) => rs.filter((r) => r.name !== name));
    try { await api(endpoint, { method: "POST", body: JSON.stringify({ month, name, delete: true }) }); } catch (e) { /* no-op */ }
  }
  const inner = (<>
    {bare ? <div className="kpi-subhead">{title}</div> : <h3>{title}</h3>}
    <div className="perf-note">{note}{saved && <span className="kpi-saved"> Saved ✓</span>}</div>
    <div className="lb-list">
      {rows.length === 0 && <div className="dim" style={{ fontSize: 13 }}>None yet — add one below.</div>}
      {rows.map((r, i) => {
        const hasMark = !isNaN(parseFloat(r.marks));
        return (
          <div className={"lb-row" + (hasMark && i < 3 ? " top" : "")} key={r.name}>
            <span className="lb-rank">{hasMark ? (["🥇", "🥈", "🥉"][i] || (i + 1)) : "·"}</span>
            <span className="lb-name">{r.name}</span>
            <input className="kpi-in lb-mark" type="number" step="0.01" value={r.marks ?? ""}
              onChange={(e) => setMark(r.name, e.target.value)} onWheel={(e) => e.currentTarget.blur()} onBlur={() => save(r.name)} />
            <button className="lb-x" title="Remove" onClick={() => remove(r.name)}>✕</button>
          </div>
        );
      })}
    </div>
    <div className="lb-add">
      <input placeholder={addPlaceholder} value={newName} maxLength={40}
        onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <button className="btn-ghost" disabled={!newName.trim()} onClick={add}>Add</button>
    </div>
  </>);
  return bare ? inner : <div className="set-card lb-card">{inner}</div>;
}

/* Team Challenge — Team B's 4-category competition score (max 100).
   Deposits / Retention / Growth auto-compute from system data; Engagement = auto "VIPs contacted"
   (from contact_log) + manual follow-up counts (saved server-side via /api/rtn/kpi/challenge-eng).
   Deposits & Growth rank PROPORTIONAL to the highest team. With only Team B present it IS the
   highest, so those two show full points, flagged "provisional (*)" until rival teams are added. */
export function TeamChallenge({ teamData, month, lastDep, eng: engData }) {
  const [fu, setFu] = useState({ fuDone: "", fuReq: "" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setFu({ fuDone: engData?.fu_done ?? "", fuReq: engData?.fu_required ?? "" });
  }, [engData?.fu_done, engData?.fu_required]);
  const setFuF = (f, v) => setFu((s) => ({ ...s, [f]: v }));
  async function saveFu() {
    try {
      await api("/api/rtn/kpi/challenge-eng", { method: "POST",
        body: JSON.stringify({ month, fu_done: fu.fuDone, fu_required: fu.fuReq }) });
      setSaved(true); setTimeout(() => setSaved(false), 1200);
    } catch (e) { /* keep edits */ }
  }

  // ── Auto numbers from system data ──
  const base = (teamData.tier3.pool || 0) + (teamData.tierV.pool || 0);             // total VIP base
  const active = (teamData.tier3.deposited || 0) + (teamData.tierV.deposited || 0); // active VIPs (≥1 deposit)
  const deposits = teamData.deposit || 0;                                           // total deposits this month
  const lastDepN = parseFloat(String(lastDep).replace(/,/g, ""));
  const contacted = engData?.contacted ?? 0;                                        // AUTO from contact_log

  // ── Manual follow-up inputs ──
  const fuDone = parseFloat(fu.fuDone), fuReq = parseFloat(fu.fuReq);

  // ── Derived rates ──
  const depPerVip = active > 0 ? deposits / active : null;
  const activeRate = base > 0 ? active / base : null;                          // 0..1
  const contactRate = base > 0 ? Math.min(contacted / base, 1) : null;
  const fuRate = (!isNaN(fuDone) && fuReq > 0) ? Math.min(fuDone / fuReq, 1) : null;
  const growthPct = (!isNaN(lastDepN) && lastDepN > 0) ? (deposits - lastDepN) / lastDepN : null; // fraction

  // ── Category scores (Deposits & Growth: relative → full points as the only team, provisional) ──
  const depScore = depPerVip == null ? 0 : 30;
  const retScore = activeRate == null ? 0 : activeRate * 25;
  const engScore = (contactRate == null ? 0 : contactRate * 15) + (fuRate == null ? 0 : fuRate * 10);
  const growthScore = growthPct == null ? 0 : growthPct > 0 ? 20 : 0;   // negative growth scores 0
  const total = depScore + retScore + engScore + growthScore;

  const money = (n) => "RM " + Math.round(n).toLocaleString("en-US");
  const r1 = (n) => Math.round(n * 10) / 10;
  const pc = (n) => (n == null ? "—" : (n * 100).toFixed(1) + "%");
  const ptCls = (p, max) => (p >= max - 0.0001 ? "ok" : p > 0 ? "warn" : "bad");
  const prov = <span className="tc-prov" title="Provisional — full points until rival teams are added">*</span>;
  const fuInp = (label, f) => (
    <label className="kpi-tinp">{label}
      <input className="kpi-in" type="number" step="1" min="0" value={fu[f]} placeholder="—"
        onChange={(e) => setFuF(f, e.target.value)} onWheel={(e) => e.currentTarget.blur()} onBlur={saveFu} />
    </label>
  );

  return (<>
    <div className="kpi-subhead">Team Challenge
      <InfoTip>
        Team B · 4-category score (max 100) · {month}. Deposits, Retention &amp; Growth auto from data;
        VIPs contacted auto from the contact log; follow-ups entered below. Deposits &amp; Growth are
        <b> provisional ({prov})</b> — full points until rival teams are added, then all teams rank proportionally.
        <span className="it-data">Auto: deposits {money(deposits)} · active VIPs {active.toLocaleString("en-US")} · VIP base {base.toLocaleString("en-US")} · contacted {contacted.toLocaleString("en-US")} · last-month {isNaN(lastDepN) ? "—" : money(lastDepN)}.</span>
      </InfoTip>
      {saved && <span className="kpi-saved"> Saved ✓</span>}
    </div>
    <div className="kpi-team-inputs two">
      {fuInp("Follow-ups done", "fuDone")}
      {fuInp("Follow-ups required", "fuReq")}
    </div>
    <div className="tbl-x"><table className="perf-tbl kpi-base">
      <thead><tr><th>Category</th><th className="r">Value</th><th className="r">Points</th></tr></thead>
      <tbody>
        <tr><td>Deposits / active VIP</td>
          <td className="r mono">{depPerVip == null ? "—" : money(depPerVip)}</td>
          <td className={"r mono " + ptCls(depScore, 30)}>{r1(depScore)} / 30{prov}</td></tr>
        <tr><td>Retention (active rate)</td>
          <td className="r mono">{pc(activeRate)}</td>
          <td className={"r mono " + ptCls(retScore, 25)}>{r1(retScore)} / 25</td></tr>
        <tr><td>Engagement (contact · follow-up)</td>
          <td className="r mono">{contactRate == null && fuRate == null ? "—" : pc(contactRate) + " · " + pc(fuRate)}</td>
          <td className={"r mono " + ptCls(engScore, 25)}>{r1(engScore)} / 25</td></tr>
        <tr><td>Growth (MoM)</td>
          <td className="r mono">{growthPct == null ? "—" : (growthPct >= 0 ? "+" : "") + (growthPct * 100).toFixed(1) + "%"}</td>
          <td className={"r mono " + ptCls(growthScore, 20)}>{r1(growthScore)} / 20{prov}</td></tr>
        <tr className="kpi-total"><td>TOTAL</td><td></td>
          <td className={"r mono " + (total >= 75 ? "ok" : total >= 50 ? "warn" : "bad")}>{r1(total)} / 100</td></tr>
      </tbody>
    </table></div>
  </>);
}

/* Mistake log — per-agent, feeds Discipline KPI. View all; add/delete admin only. */
export function MistakeLog({ data, me, team, onMutate }) {
  const isAdmin = !!me?.manage_users;
  const month = data.month;
  const list = data.mistakes || [];
  const [agent, setAgent] = useState("");
  const [cat, setCat] = useState(MISTAKE_CATS[0]);
  const [points, setPoints] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!agent || busy) return;
    setBusy(true);
    try {
      await api("/api/rtn/mistakes", { method: "POST", body: JSON.stringify({ month, agent, category: cat, points, note }) });
      setNote(""); setPoints("1"); onMutate && onMutate();
    } catch (e) { /* keep form */ }
    setBusy(false);
  }
  async function remove(id) {
    try { await api(`/api/rtn/mistakes/${id}`, { method: "DELETE" }); onMutate && onMutate(); } catch (e) { /* no-op */ }
  }
  const tally = {};
  list.forEach((m) => { const t = (tally[m.agent] = tally[m.agent] || { count: 0, points: 0 }); t.count++; t.points += Number(m.points) || 0; });
  const tallyRows = Object.entries(tally).sort((a, b) => b[1].points - a[1].points);
  return (
    <div className="set-card">
      <h3>Mistake Log
        <InfoTip>Per-agent mistakes · {month || "—"}. Feeds the Discipline KPI (weighted points). {isAdmin ? "Add or remove below." : "Read-only — ask a manager to edit."}</InfoTip>
        {!isAdmin && <span className="ro-tag">view only</span>}
      </h3>
      {isAdmin && (
        <div className="mk-form">
          <NativeSelect value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">Agent…</option>
            {(team || []).filter((t) => t.on_leaderboard).map((t) => <option key={t.username} value={t.username}>{t.username}</option>)}
          </NativeSelect>
          <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)}>
            {MISTAKE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
          <input className="mk-pts" type="number" step="1" min="0" value={points} title="Points / weight"
            onChange={(e) => setPoints(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
          <input className="mk-note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <button className="btn-gold" disabled={!agent || busy} onClick={add}>{busy ? "…" : "Log"}</button>
        </div>
      )}
      {tallyRows.length > 0 && (
        <div className="mk-tally">
          {tallyRows.map(([a, v]) => <span key={a} className="mk-chip">{a}: {v.count} · {v.points} pts</span>)}
        </div>
      )}
      <div className="tbl-x"><table className="perf-tbl mk-tbl">
        <thead><tr><th>Date</th><th>Agent</th><th>Category</th><th className="r">Pts</th><th>Note</th>{isAdmin && <th></th>}</tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="dim" style={{ padding: "10px 2px" }}>No mistakes logged this month.</td></tr>}
          {list.map((m) => (
            <tr key={m.id}>
              <td className="mono">{String(m.created_at || "").slice(0, 10)}</td>
              <td>{m.agent}</td>
              <td>{m.category}</td>
              <td className="r mono">{m.points}</td>
              <td className="mk-notecell">{m.note || ""}</td>
              {isAdmin && <td><button className="lb-x" title="Remove" onClick={() => remove(m.id)}>✕</button></td>}
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

export function KpiScorecard({ onDrill, data, team, children, mistakeList, viewTeam = "B" }) {
  const [kpi, setKpi] = useState(null);
  const [err, setErr] = useState("");
  const [vals, setVals] = useState({});       // brand -> { t3, tv, l3, lv } (strings)
  const [savedBrand, setSavedBrand] = useState("");
  const [editing, setEditing] = useState(null); // "brand|field" being edited (double-click to enter)
  const [openList, setOpenList] = useState(null); // "brand|tier" whose 0-deposit name list is open
  const [frt, setFrt] = useState("");        // team FRT (Stage 1b)
  const [agentFrt, setAgentFrt] = useState({}); // per-agent FRT { username: frt_sec }
  const [kpiFor, setKpiFor] = useState("TEAM"); // Base Score scope: TEAM or a staff username
  const [lastDep, setLastDep] = useState("");
  const [thisDep, setThisDep] = useState("");
  const [savedTeam, setSavedTeam] = useState(false);
  const [copiedNames, setCopiedNames] = useState(false);
  // 0-deposit players for a brand+tier (the win-back call list), highest value first
  const candidatesFor = (brand, tierSeg) => (data || [])
    .filter((r) => r.brand === brand && r.tier_segment === tierSeg && !(Number(r.monthly_deposit) > 0))
    .sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));
  const copyNames = async (list) => {
    // Zyra brands are keyed by UID (the back office looks players up by uid); TC brands have no uid,
    // so their identity is the username. Copy the right one per brand, falling back to the other
    // field only when the preferred one is blank so a row is never dropped silently.
    const names = list.map((r) => {
      const zyra = (BRANDS[r.brand] || {}).prov === "ZY";
      const val = zyra ? (r.uid || r.username) : (r.username || r.uid);
      return String(val || "").trim();
    }).filter(Boolean).join("\n");
    if (!names) return;
    const ok = await copyText(names);
    setCopiedNames(ok ? "ok" : "fail"); setTimeout(() => setCopiedNames(false), ok ? 1400 : 2600);
  };

  const [refreshing, setRefreshing] = useState(false);
  function loadKpi() {
    setRefreshing(true);
    api(`/api/rtn/kpi?team=${encodeURIComponent(viewTeam)}`)
      .then((d) => {
        setKpi(d);
        const v = {};
        (d.retention || []).forEach((r) => {
          v[r.brand] = { t3: r.tier3_pct ?? "", tv: r.tierv_pct ?? "", l3: r.last3_pct ?? "", lv: r.lastv_pct ?? "" };
        });
        setVals(v);
        const ti = d.team_inputs || {};
        setFrt(ti.frt_sec ?? "");
        setLastDep(ti.last_month_deposit ?? ""); setThisDep(ti.this_month_deposit ?? "");
        const af = {};
        (d.agent_inputs || []).forEach((r) => { af[r.agent] = r.frt_sec ?? ""; });
        setAgentFrt(af);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setRefreshing(false));
  }
  useEffect(() => { loadKpi(); }, [viewTeam]);

  // guard states still render the page grid (so the By CS/Class/Brand blocks below show)
  const gridWrap = (top) => (
    <div className="perf-grid">
      <div className="perf-main">{top}{children}</div>
      <div className="perf-side" />
    </div>
  );
  if (err) return gridWrap(<div className="set-card"><div className="bigmsg err">{err}</div></div>);
  if (!kpi) return gridWrap(<div className="set-card"><div className="dim">Loading KPI…</div></div>);
  if (!kpi.month) return gridWrap(<div className="set-card"><div className="dim">No data yet.</div></div>);

  const month = kpi.month;
  const get = (b) => vals[b] || { t3: "", tv: "", l3: "", lv: "" };
  const setField = (b, f, val) => setVals((s) => ({ ...s, [b]: { ...get(b), [f]: val } }));
  async function save(b) {
    const v = get(b);
    try {
      await api("/api/rtn/kpi/retention", { method: "POST",
        body: JSON.stringify({ month, brand: b, tier3_pct: v.t3, tierv_pct: v.tv, last3_pct: v.l3, lastv_pct: v.lv }) });
      setSavedBrand(b); setTimeout(() => setSavedBrand(""), 1200);
    } catch (e) { /* keep edits on screen */ }
  }
  const need = (pool, cur, target) => {
    const c = parseFloat(cur);
    if (!pool || isNaN(c)) return null;
    const gap = target - c;
    return gap > 0 ? Math.ceil((pool * gap) / 100) : 0;
  };
  const cls = (cur, target) => {
    const c = parseFloat(cur);
    if (isNaN(c)) return "";
    if (c >= target) return "ok";
    if (c >= target - 3) return "warn";
    return "bad";
  };
  async function saveTeam(extra = {}) {
    try {
      await api("/api/rtn/kpi/team", { method: "POST",
        body: JSON.stringify({ month, frt_sec: extra.frt ?? frt,
          last_month_deposit: extra.lastDep ?? lastDep, this_month_deposit: extra.thisDep ?? thisDep }) });
      setSavedTeam(true); setTimeout(() => setSavedTeam(false), 1200);
    } catch (e) { /* keep edits on screen */ }
  }

  // Resolved retention % per brand+tier: auto (from cumulative monthly deposits) for most brands,
  // manual entry for brands whose feed is stale (RETENTION_MANUAL_BRANDS).
  const autoPct = (brand, tierKey) => {
    const br = kpi.brands.find((b) => b.brand === brand);
    if (!br) return null;
    return tierKey === "t3" ? br.tier3.pct : br.tierV.pct;
  };
  const isManualBrand = (brand) => RETENTION_MANUAL_BRANDS.has(brand);
  const resolvedCur = (brand, tierKey) => {
    if (isManualBrand(brand)) { const v = parseFloat(get(brand)[tierKey]); return isNaN(v) ? null : v; }
    return autoPct(brand, tierKey);
  };
  // BaseKPI = T3 + TV + Growth + FRT + Discipline (max 100). Team retention = simple mean of brand %s.
  const teamMean = (tierKey) => {
    let sum = 0, n = 0;
    kpi.brands.forEach((br) => { const x = resolvedCur(br.brand, tierKey); if (x != null && !isNaN(x)) { sum += x; n++; } });
    return n ? sum / n : null;
  };
  const teamT3 = teamMean("t3"), teamTV = teamMean("tv");
  const ld = parseFloat(lastDep), tdv = parseFloat(thisDep);
  const growthPct = (ld > 0 && !isNaN(tdv)) ? ((tdv - ld) / ld) * 100 : null;
  const t3Pts = teamT3 == null ? 0 : scoreHi(teamT3, KPI_BANDS.t3);
  const tvPts = teamTV == null ? 0 : scoreHi(teamTV, KPI_BANDS.tv);
  const growthPts = growthPct == null ? 0 : scoreHi(growthPct, KPI_BANDS.growth);
  // FRT is per-agent: team value for TEAM, else the selected agent's own FRT
  const frtVal = kpiFor === "TEAM" ? frt : (agentFrt[kpiFor] ?? "");
  const setFrtVal = (v) => { if (kpiFor === "TEAM") setFrt(v); else setAgentFrt((s) => ({ ...s, [kpiFor]: v })); };
  async function saveFrt() {
    if (kpiFor === "TEAM") { saveTeam(); return; }
    try {
      await api("/api/rtn/kpi/agent-input", { method: "POST", body: JSON.stringify({ month, agent: kpiFor, frt_sec: agentFrt[kpiFor] }) });
      setSavedTeam(true); setTimeout(() => setSavedTeam(false), 1200);
    } catch (e) { /* keep edits */ }
  }
  const frtPts = frtVal === "" || isNaN(parseFloat(frtVal)) ? 0 : scoreLo(parseFloat(frtVal), KPI_BANDS.frt);
  // Discipline is per-agent: count only the selected person's mistakes (or all for TEAM)
  const discList = mistakeList == null ? null : mistakeList.filter((m) => kpiFor === "TEAM" || m.agent === kpiFor);
  const disciplineTotal = discList == null ? null : discList.reduce((s, m) => s + (Number(m.points) || 0), 0);
  const discPts = disciplineTotal == null ? 0 : scoreLo(disciplineTotal, KPI_BANDS.disc);
  const baseKpi = t3Pts + tvPts + growthPts + frtPts + discPts;
  const ptCls = (p, max) => (p >= max ? "ok" : p > 0 ? "warn" : "bad");
  const teamInp = (val, set, save, ph) => (
    <input className="kpi-in" type="number" step="0.01" value={val} placeholder={ph}
      onChange={(e) => set(e.target.value)} onWheel={(e) => e.currentTarget.blur()} onBlur={save} />
  );
  // comma-formatted number input (stores the raw digits, shows 17,230,000)
  const fmtNum = (v) => { if (v === "" || v == null) return ""; const n = Number(String(v).replace(/,/g, "")); return isNaN(n) ? String(v) : n.toLocaleString("en-US"); };
  const depInp = (val, set, save) => (
    <input className="kpi-in" type="text" inputMode="numeric" value={fmtNum(val)}
      onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))} onBlur={save} />
  );
  // each agent's BaseKPI = shared Tier/Growth + their own FRT + their own Discipline
  const agentBaseKpi = (username) => {
    const aFrt = agentFrt[username];
    const fp = (aFrt === "" || aFrt == null || isNaN(parseFloat(aFrt))) ? 0 : scoreLo(parseFloat(aFrt), KPI_BANDS.frt);
    const aMist = (mistakeList || []).filter((m) => m.agent === username).reduce((s, m) => s + (Number(m.points) || 0), 0);
    return t3Pts + tvPts + growthPts + fp + scoreLo(aMist, KPI_BANDS.disc);
  };

  // ── Bonus track (Extra KPI) — unlocks only when BaseKPI > 75; max 20 → FinalKPI = BaseKPI + AddMarks ──
  const reactByAgent = {};
  (kpi.reactivation || []).forEach((r) => { if (r.agent) reactByAgent[r.agent] = r.recovered; });
  const teamReact = Object.values(reactByAgent).reduce((s, n) => s + (n || 0), 0);
  const scopeReact = kpiFor === "TEAM" ? teamReact : (reactByAgent[kpiFor] || 0);
  const bReact = scoreHi(scopeReact, KPI_BONUS.react);
  const bGrowth = growthPct == null ? 0 : scoreHi(growthPct, KPI_BONUS.growth);
  const scopeMist = discList == null ? null : discList.length;          // mistake COUNT (bonus uses count, not points)
  const bDisc = scopeMist == null ? 0 : scoreLo(scopeMist, KPI_BONUS.disc);
  const bFrt = bonusFrt(frtVal);
  const unlocked = baseKpi > KPI_BONUS_UNLOCK;
  const addMarks = unlocked ? bReact + bGrowth + bDisc + bFrt : 0;
  const finalKpi = baseKpi + addMarks;
  // per-agent AddMarks + FinalKPI for the leaderboard — same unlock rule (Growth is team-shared)
  const agentAddMarks = (u) => {
    if (agentBaseKpi(u) <= KPI_BONUS_UNLOCK) return 0;
    const r = scoreHi(reactByAgent[u] || 0, KPI_BONUS.react);
    const g = growthPct == null ? 0 : scoreHi(growthPct, KPI_BONUS.growth);
    const d = scoreLo((mistakeList || []).filter((m) => m.agent === u).length, KPI_BONUS.disc);
    return r + g + d + bonusFrt(agentFrt[u]);
  };
  const agentFinalKpi = (u) => agentBaseKpi(u) + agentAddMarks(u);

  const TierTable = ({ tierKey, label, target }) => {
    const pcol = tierKey === "t3" ? "tier3" : "tierV";
    const lcol = tierKey === "t3" ? "l3" : "lv";
    const tierSeg = tierKey === "t3" ? "3" : "V";
    // Team % = simple average of the 6 brand %s (matches the official scorecard method).
    // Players-needed stays pool-based (it's a real headcount), summed across brands.
    let tPool = 0, tNeed = 0, curSum = 0, curN = 0, lastSum = 0, lastN = 0;
    kpi.brands.forEach((br) => {
      const pool = br[pcol].pool, v = get(br.brand);
      const curR = resolvedCur(br.brand, tierKey), la = parseFloat(v[lcol]), n = need(pool, curR, target);
      tPool += pool;
      if (n != null) tNeed += n;
      if (curR != null && !isNaN(curR)) { curSum += curR; curN++; }
      if (!isNaN(la)) { lastSum += la; lastN++; }
    });
    const teamPct = curN ? curSum / curN : null;
    const teamLast = lastN ? lastSum / lastN : null;
    const teamDelta = teamPct == null ? null : teamPct - target;
    const teamCls = teamPct == null ? "" : teamPct >= target ? "ok" : teamPct >= target - 3 ? "warn" : "bad";
    // Read-only by default (✎ shows it's editable); double-click turns it into an input.
    const editCell = (brandCode, field, val, colored) => {
      const id = brandCode + "|" + field;
      if (editing === id) {
        return (
          <input autoFocus className={"kpi-in " + (colored ? cls(val, target) : "")} type="number" step="0.01" value={val}
            onChange={(e) => setField(brandCode, field, e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
            onBlur={() => { save(brandCode); setEditing(null); }} />
        );
      }
      return (
        <span className="kpi-val" onDoubleClick={() => setEditing(id)} title="Double-click to edit">
          {val === "" || val == null ? "—" : (+val).toFixed(2)}<span className="kpi-pencil">✎</span>
        </span>
      );
    };
    return (
      <div className="ptbl-scroll">
      <div className="tbl-x"><table className="perf-tbl kpi-tbl"><thead><tr>
        <th>{label}</th><th className="r">Pool</th><th className="r">Last month</th>
        <th className="r">This month</th><th className="r">vs {target}%</th><th className="r">Need</th>
      </tr></thead><tbody>
        {kpi.brands.map((br) => {
          const pool = br[pcol].pool, v = get(br.brand);
          const manual = isManualBrand(br.brand);
          const curR = resolvedCur(br.brand, tierKey);
          const n = need(pool, curR, target);
          const delta = (curR == null || isNaN(curR)) ? null : curR - target;
          return (
            <tr key={br.brand}>
              <td><button type="button" className="kpi-brand" title="Open these players (0 deposit this month) in Daily"
                onClick={() => onDrill && onDrill(br.brand, tierKey === "t3" ? "3" : "V")}>
                <span className="b-dot" style={{ background: BRANDS[br.brand]?.p }} />{br.brand} <span className="kpi-arrow">→</span>
              </button></td>
              <td className="r mono">{pool}</td>
              <td className="r">{editCell(br.brand, lcol, v[lcol], false)}</td>
              <td className={"r " + cls(curR, target)}>
                {manual
                  ? editCell(br.brand, tierKey, v[tierKey], true)
                  : <span className="auto-pct" title="Auto from cumulative monthly deposits">{curR == null ? "—" : curR.toFixed(2)}<span className="auto-badge">auto</span></span>}
              </td>
              <td className={"r mono " + cls(curR, target)}>{delta == null ? "—" : (delta >= 0 ? "+" : "") + delta.toFixed(2)}</td>
              <td className="r mono need-cell">
                {n == null ? "—" : n === 0 ? "✓"
                  : <button className="need-btn mono" onClick={() => setOpenList(openList === br.brand + "|" + tierSeg ? null : br.brand + "|" + tierSeg)}>{n}</button>}
                {openList === br.brand + "|" + tierSeg && (() => {
                  const shown = candidatesFor(br.brand, tierSeg).slice(0, n);   // top-N highest value
                  return (
                    <div className="cand-pop">
                      <div className="cand-head">
                        <span className="cand-title">{br.brand} · Tier {tierSeg}</span>
                        <button className="cand-x" onClick={() => setOpenList(null)}>✕</button>
                      </div>
                      <div className="cand-sub">Top {shown.length} to recover · clears {target}% target</div>
                      <table className="cand-tbl">
                        <thead><tr><th>#</th><th>Player</th><th className="r">Value</th></tr></thead>
                        <tbody>
                          {shown.length === 0
                            ? <tr><td colSpan="3" className="cand-empty">None with 0 deposit in current data.</td></tr>
                            : shown.map((r, i) => (
                              <tr key={ckey(r)}>
                                <td className="cand-rk mono">{i + 1}</td>
                                <td className="cand-name">{dispName(r)}{r._tg && <span className="tg-flag">✈</span>}</td>
                                <td className="r mono cand-pnl">{fmt(r.pnl)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      <div className="cand-foot">
                        <button className="btn-ghost" disabled={!shown.length} onClick={() => copyNames(shown)}>{copiedNames === "ok" ? "✓ Copied" : copiedNames === "fail" ? "Copy blocked" : "Copy names"}</button>
                        <button className="btn-gold" onClick={() => onDrill && onDrill(br.brand, tierSeg)}>Open in Daily</button>
                      </div>
                    </div>
                  );
                })()}
              </td>
            </tr>
          );
        })}
        <tr className="kpi-team">
          <td>TEAM</td><td className="r mono">{tPool}</td>
          <td className="r mono">{teamLast == null ? "—" : teamLast.toFixed(2) + "%"}</td>
          <td className="r mono">{teamPct == null ? "—" : teamPct.toFixed(2) + "%"}</td>
          <td className={"r mono " + teamCls}>{teamDelta == null ? "—" : (teamDelta >= 0 ? "+" : "") + teamDelta.toFixed(2)}</td>
          <td className="r mono">{tNeed || 0}</td>
        </tr>
      </tbody></table></div>
      </div>
    );
  };

  // Are the contact-log-driven metrics empty? Then their 0s mean "nothing logged", not poor work.
  const contactedTotal = kpi.engagement?.contacted || 0;
  const reactTotal = (kpi.reactivation || []).reduce((s, r) => s + (r.recovered || 0), 0);
  const noOutcomes = contactedTotal === 0 && reactTotal === 0;

  // Team snapshot (sidebar): active VIPs, this-month deposits, players still needed to hit targets
  const activeVips = (kpi.team?.tier3?.deposited || 0) + (kpi.team?.tierV?.deposited || 0);
  const baseVips = (kpi.team?.tier3?.pool || 0) + (kpi.team?.tierV?.pool || 0);
  const teamNeed = (tierKey, target) => kpi.brands.reduce((n, br) => {
    const x = need(tierKey === "t3" ? br.tier3.pool : br.tierV.pool, resolvedCur(br.brand, tierKey), target);
    return n + (x || 0);
  }, 0);
  const needT3 = teamNeed("t3", KPI_TARGET.t3), needTV = teamNeed("tv", KPI_TARGET.tv);

  // Only scored CS agents appear in KPI views (excludes admins/viewers/test accounts)
  const agents = (team || []).filter((t) => t.on_leaderboard);

  return (
    <div className="perf-grid">
      <div className="perf-main">
        {noOutcomes && (
          <div className="kpi-empty">
            <b>No outcomes logged yet this month.</b> Reactivation, Engagement and Contact rate stay at 0
            until CS sets a status (Contacted / Responded / Recovered…) on players in the Daily queue.
            These are <b>empty inputs, not low scores</b> — they climb as the team works the queue.
          </div>
        )}
        {KPI_ENABLED ? (
        <div className="set-card kpi-team-card">
          <h3 className="kpi-h3">Team KPI
            <button className="btn-ghost kpi-refresh" onClick={loadKpi} disabled={refreshing} title="Pull fresh numbers (reactivation, engagement, retention)">{refreshing ? "…" : "↻ Refresh"}</button>
          </h3>
          <div className="kpi-team-two">
            <div className="kpi-team-col">
              <div className="kpi-subhead">Base Score
                <InfoTip>
                  BaseKPI = Tier 3 + Tier V + Growth + FRT + Discipline (max 100). {kpiFor === "TEAM" ? "Team view." : `Showing ${kpiFor} — FRT and Discipline are their own; Tier/Growth are team-shared.`}
                </InfoTip>
                <NativeSelect className="kpi-for" value={kpiFor} onChange={(e) => setKpiFor(e.target.value)}>
                  <option value="TEAM">Team</option>
                  {agents.map((t) => <option key={t.username} value={t.username}>{t.username}</option>)}
                </NativeSelect>
                {savedTeam && <span className="kpi-saved"> Saved ✓</span>}
              </div>
              <div className="kpi-team-inputs two">
                <label className="kpi-tinp">FRT (sec){teamInp(frtVal, setFrtVal, saveFrt)}</label>
                <label className="kpi-tinp">Last-month deposit (RM){depInp(lastDep, setLastDep, () => saveTeam())}</label>
                <label className="kpi-tinp">This-month deposit (RM){depInp(thisDep, setThisDep, () => saveTeam())}</label>
              </div>
              <div className="tbl-x"><table className="perf-tbl kpi-base">
                <thead><tr><th>Metric</th><th className="r">Value</th><th className="r">Points</th></tr></thead>
                <tbody>
                  <tr><td>Tier 3 retention</td><td className="r mono">{teamT3 == null ? "—" : teamT3.toFixed(2) + "%"}</td><td className={"r mono " + ptCls(t3Pts, 15)}>{t3Pts} / 15</td></tr>
                  <tr><td>Tier V retention</td><td className="r mono">{teamTV == null ? "—" : teamTV.toFixed(2) + "%"}</td><td className={"r mono " + ptCls(tvPts, 15)}>{tvPts} / 15</td></tr>
                  <tr><td>Deposit growth (MoM)</td><td className="r mono">{growthPct == null ? "—" : (growthPct >= 0 ? "+" : "") + growthPct.toFixed(2) + "%"}</td><td className={"r mono " + ptCls(growthPts, 20)}>{growthPts} / 20</td></tr>
                  <tr><td>FRT (response time)</td><td className="r mono">{frtVal === "" ? "—" : frtVal + "s"}</td><td className={"r mono " + ptCls(frtPts, 30)}>{frtPts} / 30</td></tr>
                  <tr><td>Discipline ({kpiFor === "TEAM" ? "team" : kpiFor} · auto)</td><td className="r mono">{disciplineTotal == null ? "—" : disciplineTotal}</td><td className={"r mono " + ptCls(discPts, 20)}>{discPts} / 20</td></tr>
                  <tr className="kpi-total"><td>BASE KPI</td><td></td><td className={"r mono " + (baseKpi >= 75 ? "ok" : baseKpi >= 50 ? "warn" : "bad")}>{baseKpi} / 100</td></tr>
                </tbody>
              </table></div>
              <div className="tbl-x"><table className="perf-tbl kpi-base kpi-bonus">
                <thead><tr>
                  <th>Bonus {unlocked ? <span className="bon-badge ok">🔓 Unlocked</span> : <span className="bon-badge lock">🔒 Locked</span>}
                    <InfoTip>
                      Extra KPI unlocks only when BaseKPI is above {KPI_BONUS_UNLOCK}. Reactivation auto-counts
                      RECOVERED players{kpiFor === "TEAM" ? " (team total)" : ""} from the contact log; Growth is team-shared.
                      Discipline here is the mistake <b>count</b> (0/1/≥2) — the BaseKPI Discipline above uses weighted <b>points</b>.
                      <b> FinalKPI = BaseKPI + AddMarks.</b>
                    </InfoTip>
                  </th>
                  <th className="r">Value</th><th className="r">Points</th>
                </tr></thead>
                <tbody>
                  <tr className={unlocked ? "" : "bon-dim"}><td>Reactivation</td><td className="r mono">{scopeReact} {scopeReact === 1 ? "player" : "players"}</td><td className={"r mono " + ptCls(bReact, 8)}>{bReact} / 8</td></tr>
                  <tr className={unlocked ? "" : "bon-dim"}><td>Deposit growth</td><td className="r mono">{growthPct == null ? "—" : (growthPct >= 0 ? "+" : "") + growthPct.toFixed(2) + "%"}</td><td className={"r mono " + ptCls(bGrowth, 6)}>{bGrowth} / 6</td></tr>
                  <tr className={unlocked ? "" : "bon-dim"}><td>Discipline (mistakes)</td><td className="r mono">{scopeMist == null ? "—" : scopeMist}</td><td className={"r mono " + ptCls(bDisc, 4)}>{bDisc} / 4</td></tr>
                  <tr className={unlocked ? "" : "bon-dim"}><td>FRT</td><td className="r mono">{frtVal === "" ? "—" : frtVal + "s"}</td><td className={"r mono " + ptCls(bFrt, 2)}>{bFrt} / 2</td></tr>
                  <tr className="kpi-total"><td>ADD MARKS{!unlocked && <span className="bon-note"> · locked until &gt;{KPI_BONUS_UNLOCK}</span>}</td><td></td><td className={"r mono " + (addMarks > 0 ? "ok" : "")}>{addMarks} / 20</td></tr>
                  <tr className="kpi-total"><td>FINAL KPI</td><td></td><td className={"r mono " + (finalKpi >= 100 ? "ok" : finalKpi >= 75 ? "warn" : "bad")}>{finalKpi} / 120</td></tr>
                </tbody>
              </table></div>
            </div>
            <div className="kpi-team-col">
              <TeamChallenge teamData={kpi.team} month={month} lastDep={lastDep} eng={kpi.engagement} />
            </div>
          </div>
        </div>
        ) : (
          <div className="set-card kpi-disabled">
            <b>🔧 KPI system under revision.</b> Scores and the leaderboard are paused while the KPI engine is rebuilt for this month. Retention, save-rate and the team snapshot below stay live.
          </div>
        )}

        <div className="set-card">
          <h3>Team KPI — Retention detail
            <InfoTip>
              This month <b>auto-computes</b> for every brand from cumulative monthly deposits. Two reading notes: it runs low early in the month (only a few days of deposits in) and climbs as the month goes; and a brand's pool still carries players pending downgrade — once last month's non-retained players drop out of the tier, the pool shrinks and the rate rises to its true level. Last month is manual (trend).
              Targets: Tier 3 ≥{KPI_TARGET.t3}% · Tier V ≥{KPI_TARGET.tv}%. "Players needed" = how many more must deposit to clear target. Month {month}.
            </InfoTip>
            {savedBrand && <span className="kpi-saved"> Saved ✓</span>}
          </h3>
          <div className="kpi-cols">
            <TierTable tierKey="t3" label="Tier 3" target={KPI_TARGET.t3} />
            <TierTable tierKey="tv" label="Tier V" target={KPI_TARGET.tv} />
          </div>
        </div>

        {children}
      </div>

      <div className="perf-side">
        {KPI_ENABLED ? (
        <div className="set-card lb-card">
          <h3>KPI Leaderboard
            <InfoTip align="right">Auto from each person's FinalKPI · {month}. FinalKPI = BaseKPI + AddMarks (bonus unlocks above {KPI_BONUS_UNLOCK}).</InfoTip>
          </h3>
          <div className="lb-list">
            {agents.length === 0 && <div className="dim" style={{ fontSize: 13 }}>No scored agents yet — set an account to "On leaderboard" in Settings.</div>}
            {agents.map((t) => { const base = agentBaseKpi(t.username), add = agentAddMarks(t.username); return { name: t.username, add, final: base + add }; })
              .sort((a, b) => b.final - a.final)
              .map((r, i) => (
                <div className={"lb-row" + (i < 3 ? " top" : "")} key={r.name}>
                  <span className="lb-rank">{["🥇", "🥈", "🥉"][i] || (i + 1)}</span>
                  <span className="lb-name">{r.name}</span>
                  {r.add > 0 && <span className="lb-add mono" title="Bonus AddMarks">+{r.add}</span>}
                  <span className={"lb-kpi mono " + (r.final >= 100 ? "ok" : r.final >= 75 ? "warn" : "bad")}>{r.final}</span>
                </div>
              ))}
          </div>
        </div>
        ) : (
          <div className="set-card lb-card">
            <h3>KPI Leaderboard</h3>
            <div className="dim" style={{ fontSize: 13 }}>🔧 Paused this month — the KPI leaderboard returns with the new scoring engine.</div>
          </div>
        )}

        <div className="set-card snap-card">
          <h3>Team snapshot
            <InfoTip align="right">Live team context for {month}. Deposits shown are from tracked <b>Tier 3 + Tier V players only</b> — not each brand's full deposit; the all-brands total is added manually at month-end. "To hit target" = how many more players must deposit this month to clear the retention target (summed across brands). Tracking range reflects snapshots stored this month.</InfoTip>
          </h3>
          <div className="snap-grid">
            <div className="snap-row"><span className="snap-k">Active VIPs</span>
              <span className="snap-v mono">{activeVips.toLocaleString("en-US")}<span className="snap-sub"> / {baseVips.toLocaleString("en-US")}</span></span></div>
            <div className="snap-row"><span className="snap-k">Deposits · Tier 3+V</span>
              <span className="snap-v mono">RM {Math.round(kpi.team?.deposit || 0).toLocaleString("en-US")}</span></div>
            <div className="snap-row"><span className="snap-k">To hit Tier 3 ({KPI_TARGET.t3}%)</span>
              <span className={"snap-v mono " + (needT3 ? "warn" : "ok")}>{needT3 ? "+" + needT3.toLocaleString("en-US") + " players" : "✓ cleared"}</span></div>
            <div className="snap-row"><span className="snap-k">To hit Tier V ({KPI_TARGET.tv}%)</span>
              <span className={"snap-v mono " + (needTV ? "warn" : "ok")}>{needTV ? "+" + needTV.toLocaleString("en-US") + " players" : "✓ cleared"}</span></div>
            <div className="snap-row"><span className="snap-k">Tracking since</span>
              <span className="snap-v mono">{kpi.first_day || "—"}<span className="snap-sub"> · {kpi.days || 0}d</span></span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* One performance table (By CS / Class / Brand) — click a row to reveal the players behind the numbers. */
export function PerfBlock({ title, rows, logs, keyField, onOpen, liveSet, react, reactPlayers, marks }) {
  const hasScore = react !== undefined;   // By CS passes the weighted reactivation map; Class/Brand don't
  const [open, setOpen] = useState(null);   // { name, status } — status null = all players; else filter the drill to that status
  const [sort, setSort] = useState({ col: hasScore ? "score" : "actioned", dir: "desc" });
  const label = title.split(" ")[1] || "";
  const stColor = ST_COLOR;
  const bandOf = (t) => t === 4 ? { lab: "30+d", w: 1.00 } : t === 3 ? { lab: "14–29d", w: 0.75 } : t === 2 ? { lab: "7–13d", w: 0.50 } : (t != null ? { lab: "1–6d", w: 0.10 } : null);
  // count columns; `status` = the contact-log status a click filters the drill to (null = not a filter)
  const cols = [
    { key: "assigned", label: "Assigned", status: "ASSIGNED" },
    { key: "contacted", label: "Contacted", status: "CONTACTED" },
    { key: "responded", label: "Responded", status: "RESPONDED" },
    { key: "recovered", label: "Recovered", status: "RECOVERED" },
    { key: "no_response", label: "No resp.", status: "NO_RESPONSE" },
    { key: "actioned", label: "Actioned", status: "ACTIONED" },
    { key: "save", label: "Save %", status: null },
  ];
  if (hasScore) cols.push({ key: "score", label: "Score", status: null });

  const val = (r, k) => k === "score" ? (react[r.name]?.score ?? -1) : k === "name" ? r.name : (r[k] ?? 0);
  // Child rows (a moved agent's new-team work) are pulled out of the sort and drawn right under their parent.
  const kids = rows.filter((r) => r.parent);
  const sorted = [...rows.filter((r) => !r.parent)].sort((a, b) => {
    const av = val(a, sort.col), bv = val(b, sort.col);
    const c = typeof av === "string" ? String(av).localeCompare(String(bv)) : (av - bv);
    return sort.dir === "desc" ? -c : c;
  }).flatMap((r) => [r, ...kids.filter((k) => k.parent === r.name)]);
  const sortBy = (k) => setSort((s) => s.col === k ? { col: k, dir: s.dir === "desc" ? "asc" : "desc" } : { col: k, dir: "desc" });
  const arr = (k) => sort.col === k ? (sort.dir === "desc" ? " ▾" : " ▴") : "";
  const isFilter = (name, status) => open && open.name === name && (open.status || null) === (status || null);
  const toggle = (name, status) => setOpen((o) => (o && o.name === name && (o.status || null) === (status || null)) ? null : { name, status: status || null });
  const hCol = { cursor: "pointer", userSelect: "none" };

  return (
    <div className="set-card">
      <h3>{title}
        <InfoTip>Current calendar month only · Save % = Recovered ÷ Actioned. Click a column header to sort; click a number to see just those players. A recovery counts in the month it happened.</InfoTip>
      </h3>
      <div className="tbl-x"><table className="perf-tbl"><thead><tr>
        <th style={hCol} onClick={() => sortBy("name")}>{label}{arr("name")}</th>
        {cols.map((c) => <th key={c.key} className="r" style={hCol} onClick={() => sortBy(c.key)}>{c.label}{arr(c.key)}</th>)}
      </tr></thead><tbody>
        {sorted.flatMap((r) => {
          const isOpen = open && open.name === r.name;
          const main = (
            <tr key={r.name} className={"perf-row" + (isOpen ? " open" : "")} {...tap(() => toggle(r.name, null), null)}>
              <td className={r.parent ? "perf-child" : undefined}>{r.parent ? "↳ " : (isOpen ? "▾ " : "▸ ")}{r.display || r.name}{marks && marks[r.name] ? <span className="perf-mark">{marks[r.name]}</span> : null}</td>
              {cols.map((c) => {
                const disp = c.key === "score" ? (react[r.name]?.score ?? "—") : c.key === "save" ? (r.save + "%") : r[c.key];
                const clickable = c.status && (r[c.key] || 0) > 0;
                const active = clickable && isFilter(r.name, c.status);
                const style = {
                  ...(c.key === "score" ? { color: "var(--pos)", fontWeight: 500 }
                    : c.key === "save" ? { color: r.save >= 20 ? "var(--pos)" : r.save >= 10 ? "var(--warn)" : "var(--neg)" }
                    : c.key === "recovered" ? { color: ST_COLOR.RECOVERED }
                    : c.key === "no_response" ? { color: ST_COLOR.NO_RESPONSE } : {}),
                  ...(clickable ? { cursor: "pointer" } : {}),
                  ...(active ? { background: "rgba(74,222,128,0.14)", borderRadius: "4px" } : {}),
                };
                return <td key={c.key} className="r mono" style={style}
                  onClick={clickable ? (e) => { e.stopPropagation(); toggle(r.name, c.status); } : undefined}>{disp}</td>;
              })}
            </tr>
          );
          if (!isOpen) return [main];
          const st = open.status;
          const players = logs.filter((l) => {
            if ((l[keyField] || "—") !== r.name) return false;
            if (!st) return true;
            if (st === "ACTIONED") return ["CONTACTED", "RESPONDED", "RECOVERED", "NO_RESPONSE"].includes(l.status);
            return l.status === st;
          }).sort((a, b) => (b.contacted_at || b.snapshot_date || "").localeCompare(a.contacted_at || a.snapshot_date || ""));
          const rx = hasScore ? react[r.name] : null;
          const drill = (
            <tr key={r.name + "__d"} className="perf-drill"><td colSpan={cols.length + 1}>
              {rx && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  {[["1–6d", rx.b1_6, 0.10], ["7–13d", rx.b7_13, 0.50], ["14–29d", rx.b14_29, 0.75], ["30+d", rx.b30, 1.00]].map(([lab, n, w]) => (
                    <div key={lab} style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: "8px", padding: "5px 9px" }}>
                      <span className="dim" style={{ fontSize: "11px", marginRight: "6px" }}>{lab}</span>
                      <span className="mono" style={{ fontSize: "12px" }}>{n}×{w.toFixed(2)}=<b>{(n * w).toFixed(2)}</b></span>
                    </div>
                  ))}
                  <span className="mono" style={{ marginLeft: "auto", fontSize: "12px" }}>Score <b style={{ color: "var(--pos)" }}>{rx.score ?? 0}</b>{st ? ` · showing ${st === "ACTIONED" ? "actioned" : st.toLowerCase().replace("_", " ")}` : ""}</span>
                </div>
              )}
              {players.length === 0 ? <span className="dim">No players.</span> : (
                <div className="perf-players">
                  {players.map((l, i) => {
                    const on = !!(liveSet && onOpen && liveSet.has(ckey(l)));   // player is on the current board → openable
                    const band = (l.status === "RECOVERED" && reactPlayers) ? bandOf(reactPlayers[l.player_key + "|" + l.brand + "|" + l.tier_segment]) : null;
                    return (
                    <div key={i} className={"perf-player" + (on ? " clickable" : "")}
                      onClick={on ? () => onOpen(l) : undefined}
                      title={on ? "Open this player" : "Not on the current board — can't open the drawer"}>
                      <span className="pp-name">{l.player_key || "—"}</span>
                      <span className="pp-meta">{l.brand} · T{l.tier_segment}
                        {keyField !== "class" && l.class ? ` · ${l.class}` : ""}
                        {keyField !== "assigned_to" && l.assigned_to ? ` · ${l.assigned_to}` : ""}
                        {band ? ` · ${band.lab} ×${band.w.toFixed(2)}` : ""}</span>
                      <span className="pp-date mono">{l.contacted_at || l.snapshot_date}</span>
                      <span className="pp-status" style={{ color: stColor[l.status] || "#8B94A7" }}>{l.status || "—"}</span>
                    </div>
                    );
                  })}
                </div>
              )}
            </td></tr>
          );
          return [main, drill];
        })}
      </tbody></table></div>
    </div>
  );
}

export function Performance({ onDrill, data, team, me, viewTeam = "B", contacts, snap, onSaveContact, onClearContact, readOnly }) {
  const [logs, setLogs] = useState(null);
  const [perfMonth, setPerfMonth] = useState("");   // which calendar month these logs cover (from server)
  const [react, setReact] = useState({});           // agent -> weighted reactivation breakdown (By CS Score column)
  const [reactPlayers, setReactPlayers] = useState({});  // "player|brand|tier" -> comeback-depth tier (drill-down band tags)
  const [moves, setMoves] = useState([]);           // staff team moves touching this team (marks in By CS)
  const [away, setAway] = useState([]);             // moved-out staff's work on their new team (extra By CS rows)
  const [err, setErr] = useState("");
  const [mistakes, setMistakes] = useState(null);   // { month, mistakes: [] }
  const [sel, setSel] = useState(null);             // { list:[player], index } — drawer opened from a drill row
  const loadMistakes = () => api("/api/rtn/mistakes").then(setMistakes).catch(() => {});

  // Last 6 months for the picker; [0] is the current month. Browser local time is MYT here.
  const monthOptions = useMemo(() => {
    const out = [], d = new Date();
    for (let i = 0; i < 6; i++) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`); }
    return out;
  }, []);
  const [selMonth, setSelMonth] = useState(monthOptions[0]);

  // Endpoint returns { month, logs } for ONE calendar month; pass ?month= to review a past one.
  useEffect(() => { setLogs(null); api(`/api/rtn/performance?team=${encodeURIComponent(viewTeam)}&month=${selMonth}`)
    .then((d) => { setLogs(d.logs || []); setPerfMonth(d.month || "");
      // reactivation is now one row per recovered player {agent, player_key, brand, tier_segment, tier}.
      // Fold into per-agent totals (Score + band counts) and a per-player tier map (drill-down band tags).
      const agg = {}, byPlayer = {};
      (d.reactivation || []).forEach((x) => {
        if (!x.agent) return;
        const w = x.tier === 4 ? 1.00 : x.tier === 3 ? 0.75 : x.tier === 2 ? 0.50 : 0.10;
        byPlayer[x.player_key + "|" + x.brand + "|" + x.tier_segment] = x.tier;
        const a = agg[x.agent] || (agg[x.agent] = { b1_6: 0, b7_13: 0, b14_29: 0, b30: 0, saves: 0, score: 0 });
        if (x.tier === 4) a.b30++; else if (x.tier === 3) a.b14_29++; else if (x.tier === 2) a.b7_13++; else a.b1_6++;
        a.saves++; a.score += w;
      });
      // Moved-out staff: their new-team work becomes its own By CS row, keyed "<user> · Team <to>".
      const awayRows = (d.away || []).map((a) => ({ ...a, label: `${a.user} · Team ${a.to}` }));
      awayRows.forEach((a) => (a.reactivation || []).forEach((x) => {
        const w = x.tier === 4 ? 1.00 : x.tier === 3 ? 0.75 : x.tier === 2 ? 0.50 : 0.10;
        byPlayer[x.player_key + "|" + x.brand + "|" + x.tier_segment] = x.tier;
        const r = agg[a.label] || (agg[a.label] = { b1_6: 0, b7_13: 0, b14_29: 0, b30: 0, saves: 0, score: 0 });
        if (x.tier === 4) r.b30++; else if (x.tier === 3) r.b14_29++; else if (x.tier === 2) r.b7_13++; else r.b1_6++;
        r.saves++; r.score += w;
      }));
      Object.values(agg).forEach((a) => { a.score = Math.round(a.score * 100) / 100; });
      setReact(agg); setReactPlayers(byPlayer); setMoves(d.moves || []); setAway(awayRows); })
    .catch((e) => setErr(e.message)); loadMistakes(); }, [viewTeam, selMonth]);

  // Export the raw contact log behind these tables: who contacted whom, status, date.
  const exportPerf = () => {
    if (!logs || !logs.length) return;
    const cols = ["contacted_at", "snapshot_date", "assigned_to", "player_key", "brand", "tier_segment", "class", "status", "updated_by"];
    const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.join(",")].concat(
      [...logs].sort((a, b) => (a.assigned_to || "").localeCompare(b.assigned_to || "") ||
        (b.snapshot_date || "").localeCompare(a.snapshot_date || ""))
        .map((l) => cols.map((c) => esc(l[c])).join(","))
    ).join("\n") + "\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `performance_${viewTeam}_${perfMonth || "current"}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  // Open the per-player Drawer from a drill row — but only for players on the current board
  // (the drill lists 30 days of log; older players have no live row to drive the drawer).
  const byKey = useMemo(() => { const m = {}; (data || []).forEach((r) => (m[ckey(r)] = r)); return m; }, [data]);
  const liveSet = useMemo(() => new Set(Object.keys(byKey)), [byKey]);
  const contactMap = useMemo(() => { const m = {}; (contacts || []).forEach((c) => { if (c.snapshot_date === snap) m[ckey(c)] = c; }); return m; }, [contacts, snap]);
  const openPlayer = (l) => { const p = byKey[ckey(l)]; if (p) setSel({ list: [p], index: 0 }); };

  // By CS only: this team's logs plus moved-out staff's new-team logs, relabelled to their own row.
  const csLogs = useMemo(() => (logs || []).concat(...away.map((a) => a.logs.map((l) => ({ ...l, assigned_to: a.label })))), [logs, away]);
  // Marks beside a name, only in the month the move happened, e.g. "1–17 Oct · moved to Team A".
  const csMarks = useMemo(() => {
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const m = {};
    moves.filter((x) => x.on.slice(0, 7) === perfMonth).forEach((x) => {
      const [, mo, d] = x.on.split("-").map(Number), mon = MON[mo - 1];
      if (x.from === viewTeam) {
        m[x.user] = d > 1 ? `until ${d - 1} ${mon}` : `moved to Team ${x.to}`;
        m[`${x.user} · Team ${x.to}`] = `since ${d} ${mon}`;
      } else if (x.to === viewTeam) m[x.user] = `joined from Team ${x.from} · ${d} ${mon}`;
    });
    return m;
  }, [moves, perfMonth, viewTeam]);

  // Moved staff show in By CS from day one, even before their first contact on the new side.
  const csRows = () => {   // called from the JSX, after agg() below exists
    if (!logs) return [];
    const rows = agg("assigned_to", csLogs);
    const have = new Set(rows.map((r) => r.name));
    const want = [...away.map((a) => a.label), ...moves.filter((x) => x.to === viewTeam && x.on.slice(0, 7) === perfMonth).map((x) => x.user)];
    want.filter((n) => !have.has(n)).forEach((name) =>
      rows.push({ name, assigned: 0, contacted: 0, responded: 0, recovered: 0, no_response: 0, actioned: 0, save: 0 }));
    // New-team rows hang under the agent's own row, shown as "↳ Team A".
    away.forEach((a) => {
      const r = rows.find((x) => x.name === a.label);
      if (r) { r.parent = a.user; r.display = `Team ${a.to}`; }
    });
    // A child with no parent row this month (no old-team work) stands on its own.
    rows.forEach((r) => { if (r.parent && !rows.some((x) => x.name === r.parent && !x.parent)) { delete r.parent; r.display = r.name; } });
    return rows;
  };

  const agg = (key, src = logs) => {
    const m = {};
    src.forEach((l) => {
      const k = l[key] || "—";
      m[k] = m[k] || { assigned: 0, contacted: 0, responded: 0, recovered: 0, no_response: 0 };
      if (l.status === "ASSIGNED") m[k].assigned++;
      if (l.status === "CONTACTED") m[k].contacted++;
      if (l.status === "RESPONDED") m[k].responded++;
      if (l.status === "RECOVERED") m[k].recovered++;
      if (l.status === "NO_RESPONSE") m[k].no_response++;
    });
    return Object.entries(m).map(([name, v]) => {
      const actioned = v.contacted + v.responded + v.recovered + v.no_response;
      return { name, ...v, actioned, save: actioned ? Math.round((100 * v.recovered) / actioned) : 0 };
    }).sort((a, b) => b.actioned - a.actioned);
  };

  return (
    <div className="perfwrap">
      <KpiScorecard onDrill={onDrill} data={data} team={team} viewTeam={viewTeam} mistakeList={mistakes ? (mistakes.mistakes || []) : null}>
        {mistakes && <MistakeLog data={mistakes} me={me} team={team} onMutate={loadMistakes} />}
        {err && <div className="bigmsg err">{err}</div>}
        {!err && !logs && <div className="bigmsg">Loading performance…</div>}
        {/* Bar (with the month picker) shows whenever logs are loaded, so an empty month
            never traps the user without a way to switch back. */}
        {!err && logs && (
          <div className="perf-bar">
            <span className="perf-month">Save rate ·
              <NativeSelect className="perf-mth-sel" value={selMonth} onChange={(e) => setSelMonth(e.target.value)}>
                {monthOptions.map((m, i) => <option key={m} value={m}>{m}{i === 0 ? " (this month)" : ""}</option>)}
              </NativeSelect>
            </span>
            {logs.length > 0 && <button className="btn-ghost" onClick={exportPerf}>↓ Export contacts CSV</button>}
          </div>
        )}
        {!err && logs && logs.length === 0 && <div className="bigmsg">No outcomes logged for {perfMonth || "this month"}.</div>}
        {!err && logs && logs.length > 0 && (<>
          <PerfBlock title="By CS" rows={csRows()} logs={csLogs} keyField="assigned_to" onOpen={openPlayer} liveSet={liveSet} react={react} reactPlayers={reactPlayers} marks={csMarks} />
          <PerfBlock title="By Class" rows={agg("class")} logs={logs} keyField="class" onOpen={openPlayer} liveSet={liveSet} />
          <PerfBlock title="By Brand" rows={agg("brand")} logs={logs} keyField="brand" onOpen={openPlayer} liveSet={liveSet} />
        </>)}
      </KpiScorecard>
      {sel && sel.list[sel.index] && (
        <Drawer list={sel.list} index={sel.index} setIndex={(i) => setSel((s) => ({ ...s, index: i }))}
          snap={snap} me={me} team={team} contact={contactMap[ckey(sel.list[sel.index])]}
          onSave={onSaveContact} onClear={onClearContact} onClose={() => setSel(null)} readOnly={readOnly} />
      )}
    </div>
  );
}

/* ════════════════════════ SETTINGS (admin) ════════════════════════ */
export const ROLE_DEFAULTS = {
  admin:  { can_edit: 1, can_delete: 1, on_leaderboard: 0, manage_users: 1 },
  agent:  { can_edit: 1, can_delete: 1, on_leaderboard: 1, manage_users: 0 },
  viewer: { can_edit: 0, can_delete: 0, on_leaderboard: 0, manage_users: 0 },
};
export const PERM_KEYS = [["can_edit", "Edit"], ["can_delete", "Delete"], ["on_leaderboard", "Scored"], ["manage_users", "Manage"]];

export const ACT_FILTERS = [["all", "All activity"], ["login", "Sign in"], ["logout", "Sign out"], ["contact", "Contact"],
  ["recovered", "Recovered"], ["clear", "Clear/delete"], ["note", "Notes"], ["telegram", "Telegram"],
  ["kpi", "KPI"], ["mistake", "Mistakes"], ["perm", "Permissions"], ["user", "Users"]];

/* Activity Logs — append-only audit trail (managers only). Filter by user / type / date. */
export function ActivityLog({ viewTeam = "B" }) {
  const [logs, setLogs] = useState(null);
  const [fu, setFu] = useState(""); const [fa, setFa] = useState("all"); const [fd, setFd] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => {
    setBusy(true);
    const q = new URLSearchParams();
    q.set("team", viewTeam);
    if (fu.trim()) q.set("username", fu.trim());
    if (fa && fa !== "all") q.set("action", fa);
    if (fd) q.set("date", fd);
    api("/api/activity?" + q.toString()).then((d) => setLogs(d.logs || [])).catch(() => setLogs([])).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, [viewTeam]);
  const fmtTime = (ts) => {
    try { return new Date(ts.replace(" ", "T") + "Z").toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " MYT"; }
    catch (e) { return ts; }
  };
  return (
    <div className="set-card act-card">
      <h3>Activity Logs · Team {viewTeam}
        <InfoTip align="right">Every meaningful action — sign in/out, contact saves, RECOVERED, clears, notes, Telegram, KPI, mistakes, and account changes — with who, when (MYT) and IP. Newest first, last 300.</InfoTip>
      </h3>
      <div className="act-filters">
        <input placeholder="username" value={fu} onChange={(e) => setFu(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <NativeSelect value={fa} onChange={(e) => setFa(e.target.value)}>{ACT_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
        <input type="date" value={fd} onChange={(e) => setFd(e.target.value)} />
        <button className="btn-gold" onClick={load} disabled={busy}>{busy ? "…" : "Filter"}</button>
      </div>
      <div className="tbl-wrap act-wrap">
        <div className="tbl-x"><table className="perf-tbl act-tbl">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Activity</th><th>IP</th></tr></thead>
          <tbody>
            {logs === null && <tr><td colSpan="5" className="dim" style={{ padding: "12px" }}>Loading…</td></tr>}
            {logs && logs.length === 0 && <tr><td colSpan="5" className="dim" style={{ padding: "12px" }}>No activity for this filter.</td></tr>}
            {logs && logs.map((l, i) => (
              <tr key={i}>
                <td className="mono act-time">{fmtTime(l.ts)}</td>
                <td>{l.username || "—"}</td>
                <td><span className={"perm-badge " + (l.role || "")}>{l.role || "—"}</span></td>
                <td className="act-detail">{l.detail || l.action}</td>
                <td className="mono act-ip">{l.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

/* Bulk Telegram-link import (managers only). Accepts CSV of brand,player,link;
   short brand codes map to full names. Re-uses the existing /api/rtn/telegram bulk endpoint. */
export const TG_SHORT = { LPK: "LPK777", BM: "BM69", HOT: "HOT321", RM: "RM68", SK: "SK69", ACE: "ACE33" };
export function TelegramImport({ viewTeam = "B" }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const teamBrands = TEAMS[viewTeam] || BRAND_ORDER;
  const p = useMemo(() => {
    const rows = [], perBrand = {}, bad = [], seen = new Set();
    let dupes = 0;
    // strip surrounding double-quotes (handles whole-line-quoted "A,b,c" and per-field "A","b","c")
    const unq = (s) => { s = s.trim(); return s.length > 1 && s[0] === '"' && s[s.length - 1] === '"' ? s.slice(1, -1).trim() : s; };
    text.split(/\r?\n/).forEach((raw, idx) => {
      const line = unq(raw);
      if (!line) return;
      const i1 = line.indexOf(","), i2 = line.indexOf(",", i1 + 1);
      if (i1 < 0 || i2 < 0) { bad.push({ n: idx + 1, t: raw.trim() }); return; }
      const code = unq(line.slice(0, i1)), key = unq(line.slice(i1 + 1, i2)), url = unq(line.slice(i2 + 1));
      let brand = TG_SHORT[code] || code;
      if (!teamBrands.includes(brand)) brand = null;   // only the selected team's brands
      if (!brand || !key || !url) { bad.push({ n: idx + 1, t: raw.trim() }); return; }
      const k = key + "|" + brand;
      if (seen.has(k)) dupes++; else seen.add(k);
      rows.push({ player_key: key, brand, url }); perBrand[brand] = (perBrand[brand] || 0) + 1;
    });
    return { rows, perBrand, bad, dupes };
  }, [text, viewTeam]);
  const readFile = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setText(String(rd.result || "")); rd.readAsText(f); };
  async function doImport() {
    if (!p.rows.length || busy) return;
    const summary = Object.entries(p.perBrand).map(([b, n]) => `${b} ${n}`).join(", ");
    if (!window.confirm(`Import ${p.rows.length} Telegram links (${summary})?\nExisting players' links update in place — nothing is deleted.`)) return;
    setBusy(true); setMsg("");
    try { const r = await api("/api/rtn/telegram", { method: "POST", body: JSON.stringify({ rows: p.rows }) }); setMsg(`Imported ${r.saved ?? p.rows.length} links ✓`); setText(""); }
    catch (e) { setMsg("Import failed: " + e.message); }
    setBusy(false);
  }
  return (
    <div className="set-card set-tg">
      <h3>Telegram links — bulk import · Team {viewTeam}
        <InfoTip>Upload or paste a CSV: <b>brand, player, link</b> — one per line. Short brand codes (LPK, BM, HOT, RM, SK, ACE) map to full names automatically. Re-importing a player updates their link. New links are usually added per-player in the Daily drawer; use this for big loads.</InfoTip>
      </h3>
      <div className="tg-imp-row">
        <input type="file" accept=".csv,.txt" onChange={readFile} className="tg-file" />
        {text && <span className="tg-prev"><b>{p.rows.length}</b> valid · {Object.entries(p.perBrand).map(([b, n]) => `${b} ${n}`).join(" · ") || "—"}
          {p.dupes > 0 && <> · {p.dupes} dupe{p.dupes > 1 ? "s" : ""} (last wins)</>}
          {p.bad.length > 0 && <> · <span className="warn">{p.bad.length} skipped</span></>}</span>}
      </div>
      <textarea className="tg-imp-area" placeholder="…or paste here, e.g.&#10;LPK,username,https://my.livechatinc.com/archives/XXXX?shared=true" value={text} onChange={(e) => setText(e.target.value)} />
      {p.bad.length > 0 && (
        <div className="tg-bad">⚠ Skipped (bad format or unknown brand): {p.bad.slice(0, 6).map((b) => `line ${b.n} "${b.t.slice(0, 32)}${b.t.length > 32 ? "…" : ""}"`).join(" · ")}{p.bad.length > 6 ? ` · +${p.bad.length - 6} more` : ""}</div>
      )}
      <div className="tg-imp-foot">
        <button className="btn-gold" disabled={!p.rows.length || busy} onClick={doImport}>{busy ? "Importing…" : `Import ${p.rows.length || ""} links`.trim()}</button>
        {msg && <span className="set-msg" style={{ marginLeft: 10 }}>{msg}</span>}
      </div>
    </div>
  );
}

export function Settings({ me, viewTeam = "B", hideLog = false, hideAccounts = false }) {
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});   // id -> { role, can_edit, can_delete, on_leaderboard, manage_users }
  const [nu, setNu] = useState(""); const [np, setNp] = useState("");
  const [nrole, setNrole] = useState("viewer"); const [nflags, setNflags] = useState(ROLE_DEFAULTS.viewer);
  const [nteam, setNteam] = useState("B");
  const [cp, setCp] = useState(""); const [cn, setCn] = useState("");
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState(null);   // which user row is expanded for editing
  const canManage = !!me.manage_users;
  const load = () => {
    if (!canManage) return;
    api("/api/users").then((list) => {
      setUsers(list);
      const d = {};
      list.forEach((u) => { d[u.id] = { role: u.role, can_edit: u.can_edit, can_delete: u.can_delete, on_leaderboard: u.on_leaderboard, manage_users: u.manage_users, team: u.team || "" }; });
      setDrafts(d);
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const setDraft = (id, patch) => setDrafts((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const pickRole = (id, role) => setDraft(id, { role, ...ROLE_DEFAULTS[role] });
  async function savePerm(id) {
    try { await api("/api/users/perm", { method: "POST", body: JSON.stringify({ id, ...drafts[id] }) });
      setMsg("Permissions saved."); load(); } catch (e) { setMsg(e.message); } }
  function pickNewRole(role) { setNrole(role); setNflags(ROLE_DEFAULTS[role]); }
  async function addUser() {
    try { await api("/api/users", { method: "POST", body: JSON.stringify({ username: nu, password: np, role: nrole, team: nteam, ...nflags }) });
      setNu(""); setNp(""); setNrole("viewer"); setNteam("B"); setNflags(ROLE_DEFAULTS.viewer); setMsg("User added."); load(); } catch (e) { setMsg(e.message); } }
  async function delUser(id) { try { await api(`/api/users/${id}`, { method: "DELETE" }); load(); } catch (e) { setMsg(e.message); } }
  async function changePw() {
    try { await api("/api/change-password", { method: "POST", body: JSON.stringify({ current_password: cp, new_password: cn }) });
      setCp(""); setCn(""); setMsg("Password updated."); } catch (e) { setMsg(e.message); } }
  return (
    <div className="settings">
      {canManage && !hideAccounts && (
        <div className="set-card set-accounts">
          <h3>Team accounts
            <InfoTip>Pick a role to auto-set the boxes, then tick/untick any. <b>Edit</b> = write the queue · <b>Delete</b> = clear a contact/note · <b>Leaderboard</b> = scored CS agent · <b>Manage</b> = this account panel. The last Manage account can't be removed.</InfoTip>
          </h3>
          <div className="perm-list">
            {users.map((u) => {
              const d = drafts[u.id] || {};
              const open = editingId === u.id;
              return (
                <div key={u.id} className={"perm-row" + (open ? " open" : "")}>
                  <div className="perm-head">
                    <span className="perm-name">{u.username}{u.username === me.username && <span className="perm-you"> · you</span>}</span>
                    <span className={"perm-badge " + (d.role || "viewer")}>{d.role || "viewer"}</span>
                    <span className="perm-head-act">
                      <button className="btn-ghost" onClick={() => setEditingId(open ? null : u.id)}>{open ? "Close" : "Edit"}</button>
                      {u.username !== me.username && <button className="lb-x" title="Remove user" onClick={() => delUser(u.id)}>✕</button>}
                    </span>
                  </div>
                  {open && (
                    <div className="perm-editor">
                      <label className="perm-field">Role
                        <NativeSelect className="perm-role" value={d.role || "viewer"} onChange={(e) => pickRole(u.id, e.target.value)}>
                          <option value="admin">Admin</option><option value="agent">Agent</option><option value="viewer">Viewer</option></NativeSelect>
                      </label>
                      <label className="perm-field">Team
                        <NativeSelect className="perm-role" value={d.team || ""} onChange={(e) => setDraft(u.id, { team: e.target.value || null })}>
                          <option value="">— none —</option>
                          {TEAM_KEYS.map((t) => <option key={t} value={t}>Team {t}</option>)}
                        </NativeSelect>
                      </label>
                      <div className="perm-boxes">
                        {PERM_KEYS.map(([k, l]) => (
                          <label key={k} className="perm-box"><input type="checkbox" checked={!!d[k]} onChange={(e) => setDraft(u.id, { [k]: e.target.checked ? 1 : 0 })} /> {l}</label>
                        ))}
                      </div>
                      <button className="btn-gold" onClick={() => { savePerm(u.id); setEditingId(null); }}>Save</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="form-row perm-new">
            <input placeholder="New username" value={nu} onChange={(e) => setNu(e.target.value)} />
            <input placeholder="Password" type="password" value={np} onChange={(e) => setNp(e.target.value)} />
            <NativeSelect value={nrole} onChange={(e) => pickNewRole(e.target.value)}>
              <option value="admin">Admin</option><option value="agent">Agent</option><option value="viewer">Viewer</option></NativeSelect>
            <NativeSelect value={nteam} onChange={(e) => setNteam(e.target.value)} title="Which team this account sees">
              {TEAM_KEYS.map((t) => <option key={t} value={t}>Team {t}</option>)}
            </NativeSelect>
            <button className="btn-gold" disabled={!nu || !np} onClick={addUser}>Add user</button>
          </div>
          <div className="hint">New accounts start as <b>Viewer</b> (lowest access). Pick a role to set defaults, then fine-tune the boxes. CS reps log in with their own account — "My queue" and the action log track them by name.</div>
        </div>)}
      <div className="set-card set-password">
        <h3>Change my password</h3>
        <div className="form-row">
          <input placeholder="Current password" type="password" value={cp} onChange={(e) => setCp(e.target.value)} />
          <input placeholder="New password" type="password" value={cn} onChange={(e) => setCn(e.target.value)} />
          <button className="btn-gold" disabled={!cp || !cn} onClick={changePw}>Update</button>
        </div>
      </div>
      {canManage && <TelegramImport viewTeam={viewTeam} />}
      {canManage && !hideLog && <ActivityLog viewTeam={viewTeam} />}
      {msg && <div className="set-msg">{msg}</div>}
    </div>
  );
}

/* ════════════════════════ APP ════════════════════════ */
/* ════════════════════════ DELTA — "what changed since yesterday" ════════════════════════ */
export const DL_COLD = ["BLOCKED", "DSLD30", "DSLD14", "DSLD7", "WATCH"];        // cold/cooling classes
export const DL_SEV = { WATCH: 1, DSLD7: 2, BLOCKED: 2, DSLD14: 3, DSLD30: 4 }; // coldness severity
export const tierNum = (t) => { const m = String(t || "").match(/(\d+)/); return m ? +m[1] : null; };
export const isHV = (p) => p._whale || p.tier_segment === "V";   // high-value: whale or Tier V

/* ════════════════════════ MOVEMENT — brand × date grid (Changes tab) ════════════════════════
   The daily numbers the team used to keep in a spreadsheet: one row per day, one column per
   brand, for Deposit / Net / Active VIP / Retention.

   Two rules this view exists to get right, both of which a naive build gets wrong:
   • Retention is a RATIO and CUMULATIVE. "All tiers" rebuilds it from roster + depositors
     (never averages the two tier percentages), the footer shows the LAST day (never the mean
     of a rising curve — that reads ~5 points low), and colour is against target because
     day-over-day on a cumulative figure is green every single day.
   • Deposits have a weekly rhythm, so the default comparison is the SAME WEEKDAY last week.
     Comparing Sunday to Monday produced fake -24% days.
   Data comes from the daily_brand_stats rollup — see schema_v22. */
export const MV_METRICS = [
  { k: "dep", label: "Deposit", kind: "money" },
  { k: "net", label: "Net", kind: "money" },
  { k: "act", label: "Active VIP", kind: "count" },
  { k: "ret", label: "Retention", kind: "pct" },
];
export const MV_TIERS = [{ k: "ALL", label: "All tiers" }, { k: "3", label: "Tier 3" }, { k: "V", label: "Tier V" }];
export const MV_BASES = [{ k: "dow", label: "Same weekday" }, { k: "prev", label: "Previous day" }, { k: "avg", label: "Month average" }];
export const MV_TARGET = { "3": 92, V: 94.5, ALL: 92 };
export const MV_NEUTRAL = 2;   // a move smaller than this is flat, not "up" — stops every cell being coloured
export const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const mvMonLabel = (m) => MON3[+m.slice(5, 7) - 1] + " " + m.slice(0, 4);

export function Movement({ viewTeam }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [month, setMonth] = useState(null);
  const [metric, setMetric] = useState("dep");
  const [tier, setTier] = useState("ALL");
  const [base, setBase] = useState("dow");
  const [pin, setPin] = useState(null);
  const [legend, setLegend] = useState(false);

  useEffect(() => {
    setBusy(true); setErr("");
    // ?team is what scopes a MANAGER to one team — without it the Worker returns all 23 brands
    // and the grid mixes three teams into one table. Agents are pinned server-side regardless.
    api(`/api/rtn/movement?team=${encodeURIComponent(viewTeam || "")}` + (month ? "&month=" + month : ""))
      .then((d) => { setData(d); setMonth(d.month); setBusy(false); })
      .catch((e) => { setErr(e.message); setBusy(false); });
  }, [month, viewTeam]);

  // date → brand → tier → stats, built once per payload
  const grid = useMemo(() => {
    const g = {};
    ((data && data.rows) || []).forEach((r) => {
      ((g[r.snapshot_date] = g[r.snapshot_date] || {})[r.brand] =
        g[r.snapshot_date][r.brand] || {})[r.tier_segment] = r;
    });
    return g;
  }, [data]);
  const days = useMemo(() => Object.keys(grid).sort(), [grid]);
  // Columns are this team's brands, in the team's own order. Anything outside the team is
  // dropped rather than sorted to the front — a second guard behind the ?team= scope, so a
  // stale payload can never put another team's brands in the grid.
  const brands = useMemo(() => {
    const seen = new Set(); ((data && data.rows) || []).forEach((r) => seen.add(r.brand));
    const order = TEAMS[viewTeam] || BRAND_ORDER;
    return order.filter((b) => seen.has(b));
  }, [data, viewTeam]);

  const M = MV_METRICS.find((x) => x.k === metric);
  const isRet = metric === "ret";

  // Sum the tier parts, then derive. Retention must come from the summed parts, never from
  // averaging percentages — a 20-player tier would otherwise count as much as a 700-player one.
  const pick = (parts) => {
    let dep = 0, wd = 0, act = 0, ros = 0, md = 0, seen = false;
    parts.forEach((r) => { if (!r) return; seen = true;
      dep += r.deposit || 0; wd += r.withdraw || 0; act += r.active_vip || 0;
      ros += r.roster || 0; md += r.depositors_mtd || 0; });
    if (!seen) return null;
    if (metric === "dep") return dep;
    if (metric === "net") return dep - wd;
    if (metric === "act") return act;
    return ros ? (100 * md) / ros : null;
  };
  const tiersOf = tier === "ALL" ? ["3", "V"] : [tier];
  const cellOf = (d, b) => { const x = grid[d] && grid[d][b]; return x ? pick(tiersOf.map((t) => x[t])) : null; };
  const totalOf = (d) => {
    const parts = []; brands.forEach((b) => { const x = grid[d] && grid[d][b]; if (x) tiersOf.forEach((t) => parts.push(x[t])); });
    return pick(parts);
  };
  const fmtV = (v) => v == null ? "—" : M.kind === "pct" ? v.toFixed(1) + "%" : Math.round(v).toLocaleString("en-US");

  const stats = useMemo(() => {
    const avg = {}, hi = {}, lo = {};
    brands.forEach((b) => {
      const v = days.map((d) => cellOf(d, b)).filter((x) => x != null);
      if (v.length) { avg[b] = v.reduce((a, c) => a + c, 0) / v.length; hi[b] = Math.max(...v); lo[b] = Math.min(...v); }
    });
    return { avg, hi, lo };
  }, [grid, days, brands, metric, tier]);

  const order = pin ? [pin, ...brands.filter((b) => b !== pin)] : brands;
  const baseFor = (i, b) => {
    if (base === "avg") return stats.avg[b];
    if (base === "prev") return i > 0 ? cellOf(days[i - 1], b) : null;
    const j = i - 7;                                    // same weekday last week
    return j >= 0 ? cellOf(days[j], b) : (i > 0 ? cellOf(days[i - 1], b) : null);
  };
  const dirClass = (v, b) => {
    if (!b) return "";
    const pc = ((v - b) / Math.abs(b)) * 100;
    return Math.abs(pc) < MV_NEUTRAL ? "mv-fl" : pc > 0 ? "mv-up" : "mv-dn";
  };

  const exportCsv = async () => {
    const rows = [["Date", ...brands, "Total"]];
    days.forEach((d) => {
      rows.push([d, ...brands.map((b) => { const v = cellOf(d, b); return v == null ? "" : M.kind === "pct" ? v.toFixed(2) : Math.round(v); }),
        (() => { const t = totalOf(d); return t == null ? "" : M.kind === "pct" ? t.toFixed(2) : Math.round(t); })()]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `movement-${metric}-${tier}-${month}.csv`; a.click();
  };

  if (busy && !data) return <div className="delta-empty">Loading movement…</div>;
  if (err) return <div className="delta-empty">Could not load movement: {err}</div>;
  if (!days.length) return <div className="delta-empty">No data for {month ? mvMonLabel(month) : "this month"} yet.</div>;

  const totVals = days.map((d) => ({ d, v: totalOf(d) })).filter((x) => x.v != null);
  let kpis = [];
  if (isRet) {
    const cur = totVals.length ? totVals[totVals.length - 1].v : null;
    const tgt = MV_TARGET[tier];
    const below = totVals.filter((x) => x.v < tgt).length;
    const bBelow = brands.filter((b) => { for (let i = days.length - 1; i >= 0; i--) { const c = cellOf(days[i], b); if (c != null) return c < tgt; } return false; });
    kpis = [["Current", cur == null ? "—" : cur.toFixed(1) + "%", "team, latest day"],
      ["Target", tgt + "%", tier === "V" ? "Tier V" : "Tier 3 / all"],
      ["Gap to target", cur == null ? "—" : <span className={cur >= tgt ? "mv-up" : "mv-dn"}>{(cur >= tgt ? "+" : "") + (cur - tgt).toFixed(1)} pts</span>, ""],
      ["Days below target", below + " / " + totVals.length, "this month"],
      ["Brands below", bBelow.length + " / " + brands.length, bBelow.slice(0, 3).join(", ") || "none"]];
  } else {
    // First-week vs last-week average. A single-day-to-single-day read is far too noisy to lead with.
    const fw = totVals.slice(0, 7), lw = totVals.slice(-7);
    const fa = fw.length ? fw.reduce((a, c) => a + c.v, 0) / fw.length : null;
    const la = lw.length ? lw.reduce((a, c) => a + c.v, 0) / lw.length : null;
    const swing = fa && la ? ((la - fa) / Math.abs(fa)) * 100 : null;
    const mtd = totVals.reduce((a, c) => a + c.v, 0);
    kpis = [["Month to date", fmtV(mtd), totVals.length + " days"],
      ["Last 7d average", fmtV(la), ""],
      ["First 7d average", fmtV(fa), ""],
      ["Direction", swing == null ? "—" : <span className={Math.abs(swing) < MV_NEUTRAL ? "mv-fl" : swing > 0 ? "mv-up" : "mv-dn"}>{(swing >= 0 ? "+" : "") + swing.toFixed(1)}%</span>, "last 7d vs first 7d"]];
  }

  let staleN = 0;
  const isStale = (i, b) => {
    if (i === 0) return false;
    const a = grid[days[i]] && grid[days[i]][b], p = grid[days[i - 1]] && grid[days[i - 1]][b];
    if (!a || !p) return false;
    return tiersOf.every((t) => { const x = a[t], y = p[t]; if (!x || !y) return false;
      return x.deposit === y.deposit && x.active_vip === y.active_vip && x.roster === y.roster; });
  };
  days.forEach((d, i) => brands.forEach((b) => { if (cellOf(d, b) != null && isStale(i, b)) staleN++; }));

  return (
    <div className="mv">
      <MvStyle />
      <div className="mv-head">
        <h2>Movement <span className="dim">· how each brand moved, day by day</span></h2>
        <div className="dim mv-sub">Team {viewTeam} · {mvMonLabel(month)} · {brands.length} brands · {MV_TIERS.find((x) => x.k === tier).label}</div>
      </div>
      <div className="mv-bar">
        <div className="seg">{MV_METRICS.map((x) => (
          <button key={x.k} className={metric === x.k ? "on" : ""} onClick={() => setMetric(x.k)}>{x.label}</button>))}</div>
        <div className="seg">{MV_TIERS.map((x) => (
          <button key={x.k} className={tier === x.k ? "on" : ""} onClick={() => setTier(x.k)}>{x.label}</button>))}</div>
        <div className="seg">{((data && data.months) || []).slice(-6).map((m) => (
          <button key={m} className={month === m ? "on" : ""} onClick={() => setMonth(m)}>{mvMonLabel(m)}</button>))}</div>
        {!isRet && <><span className="dim mv-vs">vs</span>
        <div className="seg sm">{MV_BASES.map((x) => (
          <button key={x.k} className={base === x.k ? "on" : ""} onClick={() => setBase(x.k)}>{x.label}</button>))}</div></>}
        <button className="mv-lbtn" onClick={() => setLegend(true)}>ⓘ Legend</button>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={exportCsv}>Export CSV</button>
      </div>

      {!!staleN && <div className="mv-warn">● {staleN} cell{staleN > 1 ? "s" : ""} identical to the day before — that brand's feed may not have moved. Treat those days as unconfirmed, not flat.</div>}

      <div className="mv-kpis">{kpis.map((k, i) => (
        <div className="mv-kpi" key={i}><div className="l">{k[0]}</div><div className="v">{k[1]}</div><div className="s">{k[2]}</div></div>))}</div>

      <div className="mv-wrap"><table className="mv-t">
        <thead><tr><th className="d">Date</th>
          {order.map((b) => <th key={b} onClick={() => setPin(pin === b ? null : b)}>{b}{pin === b ? " ▾" : ""}</th>)}
          <th>Total</th><th className="pc">Chg %</th></tr></thead>
        <tbody>
          {days.map((d, i) => {
            const dow = new Date(d + "T00:00:00Z").getUTCDay();
            const tot = totalOf(d);
            let tb = null;
            if (!isRet) {
              if (base === "prev") tb = i > 0 ? totalOf(days[i - 1]) : null;
              else if (base === "dow") { const j = i - 7; tb = j >= 0 ? totalOf(days[j]) : (i > 0 ? totalOf(days[i - 1]) : null); }
            }
            const pc = tb && tot != null ? ((tot - tb) / Math.abs(tb)) * 100 : null;
            const pcls = pc == null ? "" : Math.abs(pc) < MV_NEUTRAL ? "mv-fl" : pc > 0 ? "mv-up" : "mv-dn";
            const arrow = pc == null ? "" : Math.abs(pc) < MV_NEUTRAL ? "→ " : pc > 0 ? "▲ " : "▼ ";
            return (
              <tr key={d} className={dow === 0 || dow === 6 ? "wk" : ""}>
                <td className="d">{d.slice(8)} {mvMonLabel(month).slice(0, 3)}</td>
                {order.map((b) => {
                  const v = cellOf(d, b);
                  if (v == null) return <td key={b} className="mv-blank">—</td>;
                  let cls = isRet ? (v >= MV_TARGET[tier] ? "mv-up" : "mv-dn") : dirClass(v, baseFor(i, b));
                  if (v === stats.hi[b]) cls += " mv-hi"; else if (v === stats.lo[b]) cls += " mv-lo";
                  return <td key={b} className={cls}>{fmtV(v)}{isStale(i, b) && <span className="mv-stale" title="Identical to the previous day — feed may not have moved">●</span>}</td>;
                })}
                <td className="tot">{fmtV(tot)}</td>
                <td className={"tot pc " + pcls}>{pc == null ? "—" : arrow + (pc >= 0 ? "+" : "") + pc.toFixed(1) + "%"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr className="foot">
          <td className="d">{isRet ? "Month end" : "Month"}</td>
          {order.map((b) => {
            let v = null;
            if (isRet) { for (let i = days.length - 1; i >= 0; i--) { const c = cellOf(days[i], b); if (c != null) { v = c; break; } } }
            else { const s = days.map((d) => cellOf(d, b)).filter((x) => x != null); v = s.length ? s.reduce((a, c) => a + c, 0) : null; }
            return <td key={b}>{fmtV(v)}</td>;
          })}
          <td className="tot">{fmtV(isRet ? (totVals.length ? totVals[totVals.length - 1].v : null) : totVals.reduce((a, c) => a + c.v, 0))}</td>
          <td className="tot pc"></td>
        </tr></tfoot>
      </table></div>

      <div className="mv-note">{isRet
        ? <>Colour is against the {MV_TARGET[tier]}% target, not day-over-day. <b>Month end</b> is the month's retention.</>
        : <>Colour = change against <b>{MV_BASES.find((x) => x.k === base).label.toLowerCase()}</b>. Moves under {MV_NEUTRAL}% read as flat.</>}
        {" "}<button className="mv-link" onClick={() => setLegend(true)}>What do the colours mean?</button>
      </div>
      {legend && <MvLegend tier={tier} base={base} onClose={() => setLegend(false)} />}
    </div>
  );
}

export function MvLegend({ tier, base, onClose }) {
  return (
    <div className="mv-ov" onClick={(e) => { if (e.target.classList.contains("mv-ov")) onClose(); }}>
      <div className="mv-modal">
        <div className="mv-mh"><h3>Movement — legend</h3><button className="mv-x" onClick={onClose}>×</button></div>
        <p className="dim" style={{ fontSize: 12.5, margin: "2px 0 0" }}>What each number means, and why the colours behave differently for retention.</p>

        <div className="mv-msec">
          <div className="mv-mt">The four metrics</div>
          <div className="mv-mrow"><b>Deposit</b><span>Money in that day. The headline number.</span></div>
          <div className="mv-mrow"><b>Net</b><span>Deposit minus withdrawal — what we actually kept. A big deposit day can still be a poor net day.</span></div>
          <div className="mv-mrow"><b>Active VIP</b><span>How many players deposited that day. Depth of the base, not size of the money.</span></div>
          <div className="mv-mrow"><b>Retention</b><span>Players with a deposit this month ÷ tier roster. Cumulative — it climbs all month and resets on the 1st.</span></div>
        </div>

        <div className="mv-msec">
          <div className="mv-mt">Colours</div>
          <div className="mv-mrow"><span className="mv-up mono">123,499</span><span><b>Green</b> — up against {MV_BASES.find((x) => x.k === base).label.toLowerCase()}.</span></div>
          <div className="mv-mrow"><span className="mv-dn mono">89,749</span><span><b>Red</b> — down against the same baseline.</span></div>
          <div className="mv-mrow"><span className="mv-fl mono">→ +0.8%</span><span><b>Grey</b> — moved less than {MV_NEUTRAL}%. Treated as flat on purpose, so only real moves catch the eye.</span></div>
          <div className="mv-eg"><b>Retention is different.</b> It only ever climbs during a month, so day-over-day would be green every single day and tell you nothing. There, green means <b>at or above the {MV_TARGET[tier]}% target</b> and red means below it.</div>
        </div>

        <div className="mv-msec">
          <div className="mv-mt">Marks on a cell</div>
          <div className="mv-mrow"><span className="mv-lg-hi mono">374,923</span><span><b>Green outline</b> — that brand's best day of the month.</span></div>
          <div className="mv-mrow"><span className="mv-lg-lo mono">241,095</span><span><b>Red outline</b> — its worst day.</span></div>
          <div className="mv-mrow"><span className="mv-stale">●</span><span><b>Gold dot</b> — identical to the day before. The feed may not have moved, so treat that day as unconfirmed rather than genuinely flat.</span></div>
          <div className="mv-mrow"><span className="dim">—</span><span><b>Dash</b> — no feed for that brand that day. Never shown as zero, which would read as a collapse.</span></div>
        </div>

        <div className="mv-msec">
          <div className="mv-mt">Comparison baseline</div>
          <div className="mv-mrow"><b>Same weekday</b><span>Against the same day last week. The default, because deposits follow a weekly rhythm — comparing Sunday to Monday invents a 24% drop that never happened.</span></div>
          <div className="mv-mrow"><b>Previous day</b><span>Straight day-over-day. Useful for spotting a single sharp event.</span></div>
          <div className="mv-mrow"><b>Month average</b><span>Against that brand's own average for the month. Shows which days were genuinely unusual.</span></div>
        </div>

        <div className="mv-msec">
          <div className="mv-mt">The bottom row</div>
          <div className="mv-mrow"><b>Month</b><span>For Deposit, Net and Active VIP — the month's total.</span></div>
          <div className="mv-mrow"><b>Month end</b><span>For Retention — the figure on the last day, which <i>is</i> the month's retention and matches the daily report. Averaging the daily curve would read several points low, because it starts near zero on the 1st.</span></div>
        </div>

        <div className="mv-msec">
          <div className="mv-mt">Other</div>
          <div className="mv-mrow"><b>Tinted rows</b><span>Weekends, so the weekly rhythm is visible without counting.</span></div>
          <div className="mv-mrow"><b>Click a brand header</b><span>Pins it to the front, so you can sit two brands side by side.</span></div>
          <div className="mv-mrow"><b>Export CSV</b><span>Downloads exactly what is on screen — current metric, tier and month.</span></div>
        </div>
      </div>
    </div>
  );
}

export function MvStyle() {
  return (<style>{`
    .mv{padding:2px 0 30px}
    .mv-head{margin-bottom:13px}
    .mv-head h2{margin:0 0 3px;font-size:19px}
    .mv-head h2 .dim{font-weight:400;font-size:13px}
    .mv-sub{font-size:12.5px}
    .mv-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px}
    .mv-vs{font-size:11.5px}
    .mv .seg.sm button{font-size:11.5px;padding:5px 11px}
    .mv-kpis{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px}
    .mv-kpi{flex:1 1 150px;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:10px 13px}
    .mv-kpi .l{color:var(--dim);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase}
    .mv-kpi .v{font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:700;margin-top:3px}
    .mv-kpi .s{font-size:11px;color:var(--dim);margin-top:2px}
    .mv-warn{background:color-mix(in srgb,var(--warn) 9%,transparent);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);border-radius:9px;padding:8px 12px;font-size:12px;margin-bottom:11px}
    .mv-wrap{border:1px solid var(--line);border-radius:12px;overflow:auto;background:var(--panel);max-height:620px;-webkit-overflow-scrolling:touch}
    .mv-t{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;font-family:'IBM Plex Mono',monospace;font-size:12px}
    .mv-t th,.mv-t td{padding:6px 8px;white-space:nowrap;text-align:right;overflow:hidden;text-overflow:ellipsis}
    .mv-t th.d,.mv-t td.d{width:74px;text-align:left;position:sticky;left:0;background:var(--panel);z-index:1;font-family:inherit}
    .mv-t th.pc,.mv-t td.pc{width:84px}
    .mv-t th{position:sticky;top:0;background:var(--panel2);color:var(--dim);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;border-bottom:1px solid var(--line);z-index:2;cursor:pointer}
    .mv-t th:hover{color:var(--accent)}
    .mv-t th.d{background:var(--panel2);z-index:3}
    .mv-t tr:hover td,.mv-t tr:hover td.d{background:var(--panel2)}
    .mv-t tr.wk td,.mv-t tr.wk td.d{background:color-mix(in srgb,var(--accent) 4%,transparent)}
    .mv-t td.tot{font-weight:700;background:color-mix(in srgb,var(--accent) 6%,transparent)}
    .mv-up{color:var(--pos)}.mv-dn{color:var(--neg)}.mv-fl{color:var(--dim)}
    /* high / low use an OUTLINE — fill is reserved for direction, so the two never blur together */
    .mv-hi{box-shadow:inset 0 0 0 1px var(--pos);border-radius:4px}
    .mv-lo{box-shadow:inset 0 0 0 1px var(--neg);border-radius:4px}
    .mv-blank{color:color-mix(in srgb,var(--dim) 45%,transparent)}
    .mv-stale{color:var(--warn);font-size:9px;margin-left:3px}
    .mv-t .foot td{border-top:1px solid var(--line);font-weight:700;background:var(--panel2)}
    .mv-note{color:var(--dim);font-size:11.5px;margin-top:10px;line-height:1.65}
    .mv-lbtn{background:var(--panel);border:1px solid var(--line);color:var(--dim);font-size:11.5px;font-weight:600;padding:6px 11px;border-radius:8px;cursor:pointer;font-family:inherit}
    .mv-lbtn:hover{border-color:var(--accent);color:var(--accent)}
    .mv-link{background:none;border:0;color:var(--accent);font:inherit;font-size:11.5px;padding:0;cursor:pointer;text-decoration:underline}
    .mv-ov{position:fixed;inset:0;background:rgba(0,0,0,.62);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;z-index:60}
    .mv-modal{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px 22px;max-width:640px;width:100%}
    .mv-mh{display:flex;align-items:center;gap:10px}
    .mv-mh h3{margin:0;font-size:16px}
    .mv-x{margin-left:auto;background:none;border:none;color:var(--dim);font-size:20px;cursor:pointer;line-height:1;padding:2px 6px}
    .mv-x:hover{color:var(--txt)}
    .mv-msec{margin-top:16px}
    .mv-mt{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:7px}
    .mv-mrow{display:flex;gap:11px;align-items:baseline;font-size:12.5px;line-height:1.55;margin-bottom:5px}
    .mv-mrow>b,.mv-mrow>span:first-child{flex:0 0 92px;color:var(--txt)}
    .mv-mrow>span:last-child{color:var(--dim)}
    .mv-mrow .mono{font-family:'IBM Plex Mono',monospace;font-size:11.5px}
    .mv-lg-hi{box-shadow:inset 0 0 0 1px var(--pos);border-radius:4px;padding:1px 5px;color:var(--pos)}
    .mv-lg-lo{box-shadow:inset 0 0 0 1px var(--neg);border-radius:4px;padding:1px 5px;color:var(--neg)}
    .mv-eg{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:9px 12px;font-size:12px;color:var(--dim);line-height:1.6;margin-top:8px}
    .mv-eg b{color:var(--txt)}
    @media (max-width:760px){
      .mv-kpi{flex:1 1 46%;padding:9px 11px}
      .mv-kpi .v{font-size:16px}
      .mv-t th,.mv-t td{padding:6px 7px;font-size:11px}
      .mv-wrap{max-height:none}
    }
  `}</style>);
}

export function Delta({ data, brandOrder = BRAND_ORDER, snap, dates, contacts, me, team, viewTeam, onSaveContact, onClearContact, readOnly }) {
  const [dView, setDView] = useState("changes");   // 'changes' = player movers · 'movement' = brand grid
  const [yData, setYData] = useState(null);            // yesterday's classified rows
  const [prevDate, setPrevDate] = useState(undefined); // undefined = resolving · null = none available
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState({});
  const [selIdx, setSelIdx] = useState(null);          // open drawer over the flattened mover list
  const [fBrand, setFBrand] = useState(null);          // band filters (hero + rollup stay portfolio-wide)
  const [fTier, setFTier] = useState("ALL");
  const [sortBy, setSortBy] = useState("value");       // value | severity | days

  useEffect(() => { setSelIdx(null); }, [fBrand, fTier, sortBy]);

  useEffect(() => {
    setShowAll({});
    const list = dates.map((x) => x.snapshot_date);
    const i = list.indexOf(snap);
    const prev = i >= 0 ? list[i + 1] : list[1];       // the snapshot immediately before `snap`
    if (!prev) { setPrevDate(null); setYData(null); return; }
    setPrevDate(prev); setLoading(true); setErr(""); setYData(null);
    let alive = true;
    api(`/api/rtn/board?date=${prev}`)
      .then((b) => { if (alive) setYData(classifyAll(b.rows || [], prev)); })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [snap, dates]);

  const contactMap = useMemo(() => {
    const m = {};
    (contacts || []).filter((c) => c.snapshot_date === snap).forEach((c) => (m[ckey(c)] = c));
    return m;
  }, [contacts, snap]);

  const d = useMemo(() => {
    if (!yData) return null;
    const yMap = {}; yData.forEach((p) => (yMap[ckey(p)] = p));
    const returned = [], cold = [], fresh = [], tierDrop = [];
    for (const p of data) {
      const y = yMap[ckey(p)];
      if (!y) { fresh.push(p); continue; }
      const wasCold = (DL_SEV[y._cls] || 0) >= 2;
      const depToday = p._dsld === 0 || (p.daily_deposit ?? 0) > 0;
      if (wasCold && depToday) returned.push({ ...p, _from: y._cls });
      else if (DL_COLD.includes(p._cls) && (DL_SEV[p._cls] || 0) > (DL_SEV[y._cls] || 0)) cold.push({ ...p, _from: y._cls });
      const nt = tierNum(p.tier), ny = tierNum(y.tier);
      if ((nt != null && ny != null && nt < ny) || (y.tier_segment === "V" && p.tier_segment === "3"))
        tierDrop.push({ ...p, _fromTier: y.tier || ("Tier " + y.tier_segment), _fromSeg: y.tier_segment });
    }
    // Priority: high-value players moving the WRONG way today (colder or demoted), deduped per player.
    const prio = {};
    cold.forEach((p) => { if (isHV(p)) prio[ckey(p)] = { ...p, _move: `${p._from} → ${p._cls}` }; });
    tierDrop.forEach((p) => {
      if (!(isHV(p) || p._fromSeg === "V")) return;
      const k = ckey(p), demote = `${p._fromTier} → ${p.tier || ("Tier " + p.tier_segment)}`;
      if (prio[k]) prio[k]._move += ` · ${demote}`;
      else prio[k] = { ...p, _move: demote };
    });
    const priority = Object.values(prio).sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));

    returned.sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));   // highest value (most-negative pnl) first
    cold.sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));       // value-sorted, not day-count
    const vFirst = (x) => (x.tier_segment === "V" ? 0 : 1);
    fresh.sort((a, b) => vFirst(a) - vFirst(b) || (a.pnl ?? 0) - (b.pnl ?? 0));

    // Per-brand rollup: net movement so the fastest-bleeding brand floats to the top.
    const roll = {};
    const bump = (b, k) => { (roll[b] = roll[b] || { brand: b, ret: 0, cool: 0, fresh: 0 })[k]++; };
    returned.forEach((p) => bump(p.brand, "ret"));
    cold.forEach((p) => bump(p.brand, "cool"));
    fresh.forEach((p) => bump(p.brand, "fresh"));
    const brands = Object.values(roll).sort((a, b) => (b.cool - b.ret) - (a.cool - a.ret) || b.cool - a.cool);

    const badN = cold.length + tierDrop.length;
    const dir = returned.length > badN ? "warming" : returned.length < badN ? "cooling" : "steady";
    return { priority, returned, cold, fresh, brands, dir };
  }, [data, yData]);

  // The view switch sits above both branches, so Movement stays reachable even on the days
  // when the player-level comparison cannot run (one snapshot only, or still loading).
  const viewBar = (
    <div className="toolbar" style={{ marginBottom: 14 }}>
      <div className="seg view-seg">
        <button className={dView === "changes" ? "on" : ""} onClick={() => setDView("changes")}>Player changes</button>
        <button className={dView === "movement" ? "on" : ""} onClick={() => setDView("movement")}>Movement</button>
        <button className={dView === "lost" ? "on" : ""} onClick={() => setDView("lost")}>Lost &amp; gone</button>
      </div>
    </div>
  );
  if (dView === "movement") return (<div className="delta">{viewBar}<Movement viewTeam={viewTeam} /></div>);

  if (prevDate === null)
    return <div className="delta">{viewBar}<div className="delta-empty">Changes needs at least 2 days of history. Only one snapshot exists so far — check back after the next feed.</div></div>;
  if (loading || !d)
    return <div className="delta">{viewBar}<div className="delta-empty">{err ? "Could not load " + prevDate + ": " + err : `Comparing ${snap} to ${prevDate || "…"}…`}</div></div>;
  if (dView === "lost") return (
    <div className="delta">{viewBar}
      <LostGone data={data} yData={yData} snap={snap} prevDate={prevDate} brandOrder={brandOrder} contacts={contacts} contactMap={contactMap}
        me={me} team={team} onSaveContact={onSaveContact} onClearContact={onClearContact} readOnly={readOnly} />
    </div>);

  const total = d.returned.length + d.cold.length + d.fresh.length;
  const brandN = {}; d.brands.forEach((b) => (brandN[b.brand] = b.ret + b.cool + b.fresh));

  // Brand / Tier / Sort apply to the BANDS only — the hero + rollup stay portfolio-wide.
  const SORTERS = {
    value: (a, b) => (a.pnl ?? 0) - (b.pnl ?? 0),
    severity: (a, b) => (DL_SEV[b._cls] || 0) - (DL_SEV[a._cls] || 0) || (b._dsld ?? 0) - (a._dsld ?? 0),
    days: (a, b) => (b._dsld ?? 0) - (a._dsld ?? 0),
  };
  const applyFS = (rows) => {
    let r = rows;
    if (fBrand) r = r.filter((x) => x.brand === fBrand);
    if (fTier !== "ALL") r = r.filter((x) => x.tier_segment === fTier);
    return [...r].sort(SORTERS[sortBy] || SORTERS.value);
  };
  const fp = applyFS(d.priority), fr = applyFS(d.returned), fc = applyFS(d.cold), ff = applyFS(d.fresh);
  const ftotal = fp.length + fr.length + fc.length + ff.length;

  // Drawer navigates the visible movers, in display order.
  const flat = [], seen = new Set();
  [...fp, ...fr, ...fc, ...ff].forEach((p) => { const k = ckey(p); if (!seen.has(k)) { seen.add(k); flat.push(p); } });
  const pos = {}; flat.forEach((p, i) => (pos[ckey(p)] = i));

  // Hero money totals (portfolio-wide): volume = headcount, importance = ringgit.
  const recovered = d.returned.reduce((s, p) => s + (p.daily_deposit || 0), 0);   // RM deposited today by returned players
  const atRisk = d.cold.reduce((s, p) => s + Math.max(0, -(p.pnl || 0)), 0);      // value at risk = net losses we'd forgo (pnl<0 only; net-winners aren't an asset)
  const newDep = d.fresh.reduce((s, p) => s + (p.daily_deposit || 0), 0);         // RM deposited today by new players

  // Hero card hover briefings — top-5 movers (with brand), brand spread, Tier V count, and a
  // vs-yesterday "pile" trend. All from data already on hand.
  const vCount = (arr) => arr.filter((p) => p.tier_segment === "V").length;
  const inCold = (rows) => rows.filter((p) => DL_COLD.includes(p._cls)).length;
  const depositors = (rows) => rows.filter((p) => (p.daily_deposit || 0) > 0).length;
  const negPnl = (p) => Math.max(0, -(p.pnl || 0));
  const depFn = (p) => p.daily_deposit || 0;
  const top5 = (arr, big) => [...arr].sort((a, b) => big(b) - big(a)).slice(0, 5);
  const brandSplit = (arr) => {
    const m = {}; arr.forEach((p) => (m[p.brand] = (m[p.brand] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} ${n}`).join(" · ");
  };
  const HERO = [
    { key: "returned", band: "returned", cls: "up", arrow: "↑", n: d.returned.length, label: "Returned",
      rm: recovered, rmL: "recovered", big: depFn, list: top5(d.returned, depFn), split: brandSplit(d.returned), vN: vCount(d.returned),
      trend: { label: "Depositors", today: depositors(data), yest: depositors(yData), goodUp: true } },
    { key: "cooled", band: "cold", cls: "down", arrow: "↓", n: d.cold.length, label: "Cooled",
      rm: atRisk, rmL: "at risk", big: negPnl, list: top5(d.cold, negPnl), split: brandSplit(d.cold), vN: vCount(d.cold),
      trend: { label: "Cold pile", today: inCold(data), yest: inCold(yData), goodUp: false } },
    { key: "new", band: "fresh", cls: "new", arrow: "✦", n: d.fresh.length, label: "New",
      rm: newDep, rmL: "deposited", big: depFn, list: top5(d.fresh, depFn), split: brandSplit(d.fresh), vN: vCount(d.fresh),
      trend: { label: "On list", today: data.length, yest: yData.length, goodUp: true } },
  ];
  const goBand = (k) => document.getElementById("dl-band-" + k)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const SORT_LABEL = { value: "Player value", severity: "Severity", days: "Day count" };
  const VERDICT = {
    cooling: "More players cooled than returned today — portfolio is trending down.",
    warming: "More players returned than cooled today — portfolio is trending up.",
    steady: "Returns and cooldowns are balanced today — portfolio is holding steady.",
  };

  // dir: "up" (improved/green) · "down" (worsened/red) · "new" (blue). Movement is the visual hero.
  const band = (key, dir, icon, label, desc, rows, move, amt, note, prio) => {
    if (rows.length === 0) return null;
    const cap = 10;
    const all = !!showAll[key];
    const shown = all ? rows : rows.slice(0, cap);
    const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "✦";
    return (
      <div className={`dl-band dl-${dir}${prio ? " dl-prio" : ""}`} key={key} id={`dl-band-${key}`}>
        <div className="dl-bhead">
          <span className="dl-bicon">{icon}</span>
          <span className="dl-blabel">{label}</span>
          <span className="dl-bdesc">{desc}</span>
          <span className="dl-bcount mono">{rows.length}</span>
        </div>
        {shown.map((p) => {
          const con = contactMap[ckey(p)];
          return (
            <div className="dl-row" key={ckey(p)} {...tap(() => setSelIdx(pos[ckey(p)]))}>
              <span className="dl-dot" style={{ background: BRANDS[p.brand]?.p }} />
              <span className="dl-name">
                <span className="dl-pname">{dispName(p)}{p._whale ? " ♛" : ""}<TgFlag on={p._tg} /></span>
                <span className="dl-psub">{p.brand} · T{p.tier_segment}</span>
              </span>
              <span className={`dl-move dl-${dir}`}>{arrow} {move(p)}</span>
              {note && <span className="dl-rtag">{note(p)}</span>}
              {con?.status
                ? <span className="dl-tag" style={{ "--sc": ST_COLOR[con.status] }}>{con.status.replace("_", " ")}</span>
                : con?.assigned_to
                ? <span className="dl-tag" style={{ "--sc": ST_COLOR.ASSIGNED }}>{con.assigned_to}</span>
                : null}
              <span className="dl-amt mono">{amt(p)}</span>
            </div>
          );
        })}
        {rows.length > cap && (
          <div className="dl-more">
            <button className="btn-ghost" onClick={() => setShowAll((s) => ({ ...s, [key]: !s[key] }))}>
              {all ? "Show less" : `Show all ${rows.length}`}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="delta">
      {viewBar}
      <div className="delta-head">Portfolio movement · {snap} vs {prevDate}</div>
      <div className="delta-hero">
        <div className="dh-stats">
          {HERO.map((c) => {
            const delta = c.trend.today - c.trend.yest;
            const good = delta === 0 ? null : (delta > 0) === c.trend.goodUp;
            return (
              <div className={"dh-card dh-" + c.cls} key={c.key} {...tap(() => goBand(c.band))}>
                <span className={"dh-n " + c.cls}>{c.arrow} {c.n}</span>
                <span className="dh-l">{c.label}</span>
                <span className={"dh-rm " + c.cls}>{fmtK(c.rm)} <span className="dh-rml">{c.rmL}</span></span>
                <div className="dh-pop">
                  <div className="dh-pop-head">{c.label} · {c.n} player{c.n === 1 ? "" : "s"} · {fmtK(c.rm)} {c.rmL}</div>
                  <div className="dh-pop-sub">{c.vN} Tier V{c.split ? " · " + c.split : ""}</div>
                  <div className="dh-pop-list">
                    {c.list.length === 0
                      ? <div className="dh-pop-empty">none today</div>
                      : c.list.map((p, i) => (
                        <div className="dh-pl" key={ckey(p)}>
                          <span className="dh-pl-rank">{i + 1}</span>
                          <span className="dh-pl-name">{dispName(p)}{p._whale ? " ♛" : ""}<TgFlag on={p._tg} /></span>
                          <span className="dh-pl-brand" style={{ color: BRANDS[p.brand]?.txt }}>{p.brand}·{p.tier_segment}</span>
                          <span className="dh-pl-amt mono">{fmtK(c.big(p))}</span>
                        </div>
                      ))}
                  </div>
                  <div className="dh-pop-row">
                    {c.trend.label}: <b>{c.trend.today}</b> vs {c.trend.yest} yesterday{" "}
                    <span className={"dh-tr " + (good == null ? "flat" : good ? "good" : "bad")}>
                      {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"}{delta !== 0 ? Math.abs(delta) : ""}
                    </span>
                  </div>
                  <div className="dh-pop-hint">click to jump to this list ↓</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="dh-verdict">
          Net direction: <span className={"dir dir-" + d.dir}>{d.dir}</span>
          <span className="dh-explain"> — {VERDICT[d.dir]}</span>
        </div>
        {d.priority.length > 0 && (
          <button className="dh-needs" onClick={() => goBand("priority")}>
            ⚠ {d.priority.length} high-value player{d.priority.length === 1 ? "" : "s"} slipping — act on Priority changes below ↓
          </button>
        )}
      </div>

      <div className="filters-row">
        <Dropdown label="Brand" value={fBrand || ""} onPick={(it) => setFBrand(it.key === "all" ? null : it.key)}
          items={[
            { key: "all", label: "All brands", n: total, on: !fBrand },
            ...brandOrder.map((b) => ({ key: b, label: b, dot: BRANDS[b]?.p, n: brandN[b] || 0, on: fBrand === b })),
          ]} />
        <div className="seg">
          {["ALL", "3", "V"].map((t) => (
            <button key={t} className={fTier === t ? "on" : ""} onClick={() => setFTier(t)}>
              {t === "ALL" ? "All tiers" : t === "3" ? "Tier 3" : "Tier V"}</button>))}
        </div>
        <Dropdown label="Sort" value={SORT_LABEL[sortBy]} onPick={(it) => setSortBy(it.key)}
          items={[
            { key: "value", label: "Player value", on: sortBy === "value" },
            { key: "severity", label: "Severity of move", on: sortBy === "severity" },
            { key: "days", label: "Day count", on: sortBy === "days" },
          ]} />
      </div>

      {d.brands.length > 0 && (
        <div className="dl-roll">
          {d.brands.map((b) => (
            <div className="dl-rollrow" key={b.brand}>
              <span className="dl-rb" style={{ color: BRANDS[b.brand]?.txt }}>{b.brand}</span>
              <span className="dl-rcell up">{b.ret} returned</span><span className="dl-rsep">·</span>
              <span className="dl-rcell down">{b.cool} cooled</span><span className="dl-rsep">·</span>
              <span className="dl-rcell new">{b.fresh} new</span>
            </div>
          ))}
        </div>
      )}
      {total === 0
        ? <div className="delta-empty">No notable changes since {prevDate}. Quiet day.</div>
        : ftotal === 0
        ? <div className="delta-empty">No movers match these filters.</div>
        : null}
      {band("priority", "down", "⚠", "Priority changes", "high-value players slipping — act today", fp,
        (p) => p._move, (p) => (p._dsld != null ? `${p._dsld}d` : (p.tier_segment === "V" ? "V" : "3")), null, true)}
      {band("returned", "up", "🟢", "Returned", "came back after going cold", fr,
        (p) => `was ${p._from} · deposited`, (p) => (p.daily_deposit ? fmtRM(p.daily_deposit) : "↩"),
        () => "acknowledge & thank · don't over-reward")}
      {band("cold", "down", "❄", "Went colder", "stopped depositing or slipped deeper", fc,
        (p) => `${p._from} → ${p._cls}`, (p) => (p._dsld != null ? `${p._dsld}d` : "—"))}
      {band("fresh", "new", "✦", "New on the list", "first appearance — a fresh VVIP to know", ff,
        () => "new to list", (p) => p.tier || ("T" + p.tier_segment))}
      {selIdx != null && flat[selIdx] && (
        <Drawer list={flat} index={selIdx} setIndex={setSelIdx} snap={snap} me={me} team={team}
          contact={contactMap[ckey(flat[selIdx])]} onSave={onSaveContact} onClear={onClearContact}
          onClose={() => setSelIdx(null)} readOnly={readOnly} />
      )}
    </div>
  );
}

/* Lost & gone — players who LOST on the previous snapshot and did not play on this one
   (no deposit, no bet). The loss can be read two ways, picked by the agent:
     dw = withdraw <= deposit (matches the SPV/Excel colouring; needs a deposit that day)
     wl = game win_loss < 0 (also catches losses played from an existing balance)
   Previous snapshot = the day before in our data; SPV's date is one day earlier still. */
export const LG_RULES = {
  dw: { label: "Withdraw ≤ deposit", lost: (y) => (y.daily_deposit || 0) > 0 && (y.daily_withdraw || 0) <= (y.daily_deposit || 0),
        amt: (y) => (y.daily_deposit || 0) - (y.daily_withdraw || 0), desc: "withdrew no more than they deposited" },
  wl: { label: "Game win/loss", lost: (y) => (y.win_loss ?? 0) < 0,
        amt: (y) => -(y.win_loss || 0), desc: "game win/loss below 0" },
};
export function LostGone({ data, yData, snap, prevDate, brandOrder, contacts, contactMap, me, team, onSaveContact, onClearContact, readOnly }) {
  const [rule, setRule] = useState("dw");
  const [fBrand, setFBrand] = useState(null);
  const [fTier, setFTier] = useState("ALL");
  const [tgOnly, setTgOnly] = useState(false);
  const [sortBy, setSortBy] = useState("value");       // value = Tier V + month deposit first · loss = biggest loss
  const [limit, setLimit] = useState(50);              // rows shown (history is fetched per shown row)
  const [selIdx, setSelIdx] = useState(null);
  const [busy, setBusy] = useState(null);              // ckey being marked contacted
  const [, setHistTick] = useState(0);                 // re-render when a row's history lands in HIST_CACHE
  useEffect(() => { setSelIdx(null); setLimit(50); }, [rule, fBrand, fTier, tgOnly, sortBy]);

  // Our snapshot D holds the data of real day D-1 (SPV/Excel date), so label with real days.
  const lostDay = prevDate ? shiftDate(prevDate, -1) : null, goneDay = shiftDate(snap, -1);
  const dLabel = (iso) => iso ? +iso.slice(8) + " " + "JanFebMarAprMayJunJulAugSepOctNovDec".substr((+iso.slice(5, 7) - 1) * 3, 3) : "—";

  const cooldown = useMemo(() => {   // same 48h anti-spam rule as the Today queue
    const s = new Set(), cutoff = Date.now() - 48 * 3600 * 1000;
    (contacts || []).forEach((c) => { if (c.status && c.status !== "SKIPPED" && new Date(c.updated_at + "Z").getTime() > cutoff) s.add(ckey(c)); });
    return s;
  }, [contacts]);

  const all = useMemo(() => {
    const yMap = {}; yData.forEach((y) => (yMap[ckey(y)] = y));
    const R = LG_RULES[rule], out = [];
    for (const p of data) {
      const y = yMap[ckey(p)];
      if (!y || !R.lost(y)) continue;
      if ((p.daily_deposit || 0) > 0 || (p.bet || 0) > 0) continue;   // played today → not gone
      out.push({ ...p, _y: y, _lost: R.amt(y) });
    }
    return out;
  }, [data, yData, rule]);

  let rows = all;
  if (fBrand) rows = rows.filter((p) => p.brand === fBrand);
  if (fTier !== "ALL") rows = rows.filter((p) => p.tier_segment === fTier);
  if (tgOnly) rows = rows.filter((p) => !!p._tg);
  rows = [...rows].sort(sortBy === "loss"
    ? (a, b) => b._lost - a._lost
    : (a, b) => (a.tier_segment === "V" ? 0 : 1) - (b.tier_segment === "V" ? 0 : 1)
        || (b.monthly_deposit || 0) - (a.monthly_deposit || 0) || b._lost - a._lost);
  const shown = rows.slice(0, limit);

  // Fetch the daily series for shown rows only (6 at a time), shared with the drawer's cache.
  const shownKeys = shown.map(ckey).join(",");
  useEffect(() => {
    let alive = true;
    const todo = shown.filter((p) => !HIST_CACHE.has(ckey(p)));
    let i = 0;
    const next = () => {
      if (!alive || i >= todo.length) return Promise.resolve();
      const p = todo[i++];
      return api(`/api/rtn/history?player_key=${encodeURIComponent(p.player_key)}&brand=${encodeURIComponent(p.brand)}&tier_segment=${encodeURIComponent(p.tier_segment)}`)
        .then((d) => { HIST_CACHE.set(ckey(p), d.series || []); if (alive) setHistTick((t) => t + 1); })
        .catch(() => {})
        .then(next);
    };
    for (let k = 0; k < 6; k++) next();
    return () => { alive = false; };
  }, [shownKeys]);

  // Last 7 days as dots + "lost X of Y" (Y = days played), judged by the selected rule.
  const R = LG_RULES[rule];
  const streak = (p) => {
    const h = HIST_CACHE.get(ckey(p));
    if (!h) return null;
    const days = h.filter((x) => x.snapshot_date <= snap).slice(-7);
    const dots = days.map((x) => {
      const on = (x.daily_deposit || 0) > 0 || (x.daily_withdraw || 0) > 0 || (x.win_loss || 0) !== 0;
      return { d: x.snapshot_date, s: !on ? "n" : R.lost(x) ? "l" : "w", x };
    });
    const played = dots.filter((d) => d.s !== "n").length, lost = dots.filter((d) => d.s === "l").length;
    return { dots, played, lost };
  };

  // 30-day grid export — same layout as the SPV "Daily Deposit & Withdrawal" sheet, for one brand.
  // Covers every player on today's list for that brand (tier filter respected), not only lost & gone.
  const [grid, setGrid] = useState("");   // "" idle · "n/N" progress · message
  async function downloadGrid() {
    if (grid && grid.includes("/")) return;
    if (!fBrand) { setGrid("Pick a brand first"); setTimeout(() => setGrid(""), 2500); return; }
    const players = data.filter((p) => p.brand === fBrand && (fTier === "ALL" || p.tier_segment === fTier));
    let done = 0, i = 0;
    setGrid(`0/${players.length}`);
    const worker = async () => {
      while (i < players.length) {
        const p = players[i++];
        if (!HIST_CACHE.has(ckey(p))) {
          try {
            const d = await api(`/api/rtn/history?player_key=${encodeURIComponent(p.player_key)}&brand=${encodeURIComponent(p.brand)}&tier_segment=${encodeURIComponent(p.tier_segment)}`);
            HIST_CACHE.set(ckey(p), d.series || []);
          } catch (e) { /* player shows N/A */ }
        }
        setGrid(`${++done}/${players.length}`);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));

    const dateSet = new Set();
    players.forEach((p) => (HIST_CACHE.get(ckey(p)) || []).forEach((h) => { if (h.snapshot_date <= snap) dateSet.add(h.snapshot_date); }));
    const snaps = [...dateSet].sort().slice(-30);
    const days = snaps.map((s) => shiftDate(s, -1));   // label with the real game day (SPV date)
    const XS = await import("xlsx-js-style");
    const X = XS.default || XS;
    const S = {
      title: { font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F4E78" } } },
      legend: { font: { sz: 10, color: { rgb: "1F4E78" } }, fill: { fgColor: { rgb: "EAF2F8" } } },
      head: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "5B9BD5" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } },
      id: { fill: { fgColor: { rgb: "F8F9FA" } } },
      w: { font: { color: { rgb: "006100" } }, fill: { fgColor: { rgb: "C6EFCE" } } },
      l: { font: { color: { rgb: "9C0006" } }, fill: { fgColor: { rgb: "FFC7CE" } } },
      n: { font: { color: { rgb: "999999" } }, fill: { fgColor: { rgb: "F2F2F2" } } },
      tot: { font: { bold: true }, fill: { fgColor: { rgb: "FFF2CC" } } },
    };
    const lbl = (d) => dLabel(d);
    const nCols = 3 + days.length * 2 + 3;
    const title = `${fBrand} ${fTier === "ALL" ? "all tiers" : "Tier " + fTier} — Daily Deposit & Withdrawal | ${lbl(days[0])} – ${lbl(days[days.length - 1])}`;
    const aoa = [
      [{ v: title, s: S.title }, ...Array(nCols - 1).fill({ v: "", s: S.title })],
      [{ v: "Green = Withdraw > Deposit (player won) | Red = Withdraw ≤ Deposit (player lost) | Grey = no deposit or withdraw | N/A = not on the list that day", s: S.legend }, ...Array(nCols - 1).fill({ v: "", s: S.legend })],
      [],
      [..."UID|Member ID|Tier".split("|"), ...days.flatMap((d) => [`${lbl(d)}\nDeposit`, `${lbl(d)}\nWithdraw`]), "Total Deposit", "Total Withdraw", "Net Deposit"].map((v) => ({ v, s: S.head })),
    ];
    players.sort((a, b) => (a.tier_segment === "V" ? 0 : 1) - (b.tier_segment === "V" ? 0 : 1) || (b.monthly_deposit || 0) - (a.monthly_deposit || 0));
    for (const p of players) {
      const byD = {}; (HIST_CACHE.get(ckey(p)) || []).forEach((h) => (byD[h.snapshot_date] = h));
      let td = 0, tw = 0;
      const cells = snaps.flatMap((s) => {
        const h = byD[s];
        if (!h) return [{ v: "N/A", s: S.n }, { v: "N/A", s: S.n }];
        const d = h.daily_deposit || 0, w = h.daily_withdraw || 0;
        td += d; tw += w;
        const st = d === 0 && w === 0 ? S.n : w > d ? S.w : S.l;
        return [{ v: d, t: "n", s: st }, { v: w, t: "n", s: st }];
      });
      aoa.push([{ v: p.uid || "", s: S.id }, { v: p.username || "", s: S.id }, { v: p.tier_segment, s: S.id }, ...cells,
        { v: td, t: "n", s: S.tot }, { v: tw, t: "n", s: S.tot }, { v: td - tw, t: "n", s: S.tot }]);
    }
    const ws = X.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } }];
    ws["!cols"] = [{ wch: 11 }, { wch: 22 }, { wch: 5 }, ...Array(days.length * 2).fill({ wch: 10 }), { wch: 13 }, { wch: 13 }, { wch: 12 }];
    ws["!rows"] = [{ hpt: 22 }, {}, {}, { hpt: 30 }];
    ws["!freeze"] = { xSplit: 3, ySplit: 4 };
    ws["!views"] = [{ state: "frozen", xSplit: 3, ySplit: 4 }];
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, `${fBrand} 30d`);
    X.writeFile(wb, `${fBrand}_${fTier === "ALL" ? "All" : "Tier" + fTier}_${days[0]}_${days[days.length - 1]}_Daily_Deposit_Withdrawal.xlsx`);
    setGrid(`Downloaded ${players.length} players`); setTimeout(() => setGrid(""), 3000);
  }

  async function markContacted(e, p) {
    e.stopPropagation();
    if (readOnly || busy) return;
    const c = contactMap[ckey(p)];
    setBusy(ckey(p));
    try {
      await onSaveContact({ snapshot_date: snap, player_key: p.player_key, brand: p.brand, tier_segment: p.tier_segment,
        status: "CONTACTED", assigned_to: c?.assigned_to || me?.username || null, class: c?.class || p._cls || null, note: c?.note || null });
    } catch (err) { /* row stays unmarked */ }
    setBusy(null);
  }

  const brandN = {}; all.forEach((p) => (brandN[p.brand] = (brandN[p.brand] || 0) + 1));
  const sum = (arr, f) => arr.reduce((s, p) => s + f(p), 0);
  const vN = rows.filter((p) => p.tier_segment === "V").length, tgN = rows.filter((p) => p._tg).length;
  const reset = () => { setFBrand(null); setFTier("ALL"); setTgOnly(false); };
  const KPI = [
    { l: "Lost & gone", v: rows.length.toLocaleString(), s: `of ${data.length.toLocaleString()} on the list · show all`, on: !fBrand && fTier === "ALL" && !tgOnly, go: reset },
    { l: "Tier V", v: vN.toLocaleString(), s: fTier === "V" ? "showing Tier V · click to clear" : "top whales · click to show", on: fTier === "V", go: () => setFTier(fTier === "V" ? "ALL" : "V") },
    { l: `Lost on ${dLabel(lostDay)}`, v: fmtK(sum(rows, (p) => p._lost)), s: sortBy === "loss" ? "sorted by biggest loss" : "click to sort by loss", on: sortBy === "loss", go: () => setSortBy(sortBy === "loss" ? "value" : "loss") },
    { l: "On Telegram", v: tgN.toLocaleString(), s: tgOnly ? "showing reachable · click to clear" : "reachable now · click to show", on: tgOnly, go: () => setTgOnly(!tgOnly) },
  ];

  return (
    <div className="mv">
      <MvStyle />
      <style>{`
        .lg-kpi{cursor:pointer;text-align:left;font:inherit;color:inherit}
        .lg-kpi:hover{border-color:var(--accent)}
        .lg-kpi.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,var(--panel))}
        .lg-t td,.lg-t th{text-align:right;vertical-align:middle}
        .lg-t th.n,.lg-t td.n{text-align:left;width:25%}
        .lg-t th.s,.lg-t td.s{text-align:left;width:19%}
        .lg-t th.a,.lg-t td.a{width:190px}
        .lg-t td.n{font-family:inherit}
        .lg-t tbody tr{cursor:pointer}
        .lg-p{display:flex;align-items:center;gap:8px;min-width:0}
        .lg-dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}
        .lg-nm{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .lg-v{font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:4px;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}
        .lg-sub{color:var(--dim);font-size:11px;margin-left:16px;overflow:hidden;text-overflow:ellipsis}
        .lg-dots{display:inline-flex;gap:3px;vertical-align:middle}
        .lg-dots i{width:11px;height:11px;border-radius:3px;display:inline-block}
        .lg-dots i.w{background:var(--pos)} .lg-dots i.l{background:var(--neg)} .lg-dots i.n{background:var(--line)}
        .lg-st{font-size:11px;color:var(--dim);margin-left:8px}
        .lg-st b{color:var(--neg)}
        .lg-act{display:inline-flex;gap:6px;justify-content:flex-end}
        .lg-btn{font:inherit;font-size:11px;padding:4px 9px;border-radius:7px;border:1px solid var(--line);background:var(--panel2);color:var(--txt);cursor:pointer;white-space:nowrap;text-decoration:none}
        .lg-btn:hover{border-color:var(--accent);color:var(--accent)}
        .lg-btn.tg{border-color:color-mix(in srgb,var(--info) 50%,var(--line));color:var(--info)}
        .lg-btn[disabled]{opacity:.5;cursor:default}
        .lg-more{display:flex;justify-content:center;padding:10px}
        @media (max-width:760px){ .lg-t th.s,.lg-t td.s{width:120px} .lg-dots i{width:8px;height:8px} .lg-st{display:none} }
      `}</style>
      <div className="mv-head">
        <h2>Lost &amp; gone <span className="dim">· lost on {dLabel(lostDay)}, no play on {dLabel(goneDay)}</span></h2>
        <div className="dim mv-sub">Loss = {R.desc} · no play = no deposit and no bets · real game days (snapshot {snap} holds {dLabel(goneDay)})</div>
      </div>
      <div className="mv-bar">
        <span className="dim">Loss rule</span>
        <div className="seg">{Object.entries(LG_RULES).map(([k, r]) => (
          <button key={k} className={rule === k ? "on" : ""} onClick={() => setRule(k)}>{r.label}</button>))}</div>
        <Dropdown label="Brand" value={fBrand || ""} onPick={(it) => setFBrand(it.key === "all" ? null : it.key)}
          items={[
            { key: "all", label: "All brands", n: all.length, on: !fBrand },
            ...brandOrder.map((b) => ({ key: b, label: b, dot: BRANDS[b]?.p, n: brandN[b] || 0, on: fBrand === b })),
          ]} />
        <div className="seg">{["ALL", "3", "V"].map((t) => (
          <button key={t} className={fTier === t ? "on" : ""} onClick={() => setFTier(t)}>
            {t === "ALL" ? "All tiers" : t === "3" ? "Tier 3" : "Tier V"}</button>))}</div>
        <button className={"btn-ghost" + (tgOnly ? " active" : "")} onClick={() => setTgOnly(!tgOnly)}>On Telegram</button>
        <span className="dim" style={{ marginLeft: "auto" }}>Sort</span>
        <div className="seg">
          <button className={sortBy === "value" ? "on" : ""} onClick={() => setSortBy("value")}>Value first</button>
          <button className={sortBy === "loss" ? "on" : ""} onClick={() => setSortBy("loss")}>Biggest loss</button>
        </div>
        <button className="btn-ghost" onClick={downloadGrid}
          title={fBrand ? `Excel grid: every ${fBrand} player on today's list, last 30 days of deposit and withdraw` : "Pick a brand first, then download its 30-day grid"}>
          {!grid ? "⬇ 30-day grid" : grid.includes("/") ? `Building ${grid}…` : grid}
        </button>
      </div>

      <div className="mv-kpis">{KPI.map((k) => (
        <button className={"mv-kpi lg-kpi" + (k.on ? " on" : "")} key={k.l} onClick={k.go}>
          <div className="l">{k.l}</div><div className="v">{k.v}</div><div className="s">{k.s}</div></button>))}</div>

      {rows.length === 0
        ? <div className="delta-empty">No players match these filters.</div>
        : <div className="mv-wrap"><table className="mv-t lg-t">
          <thead><tr>
            <th className="n">Player</th><th className="s">Last 7 days</th>
            <th title={"Deposit on " + dLabel(lostDay)}>Deposit</th><th title={"Withdraw on " + dLabel(lostDay)}>Withdraw</th><th>Lost</th><th title="Days since last deposit">Quiet</th><th>Month dep</th>
            <th className="a">Action</th>
          </tr></thead>
          <tbody>{shown.map((p, i) => {
            const k = ckey(p), con = contactMap[k], st = streak(p), cool = cooldown.has(k);
            return (
              <tr key={k} {...tap(() => setSelIdx(i), null)}>
                <td className="n">
                  <div className="lg-p">
                    <span className="lg-dot" style={{ background: BRANDS[p.brand]?.p }} />
                    <span className="lg-nm" style={{ color: BRANDS[p.brand]?.txt }}>{dispName(p)}</span>
                    {p.tier_segment === "V" && <span className="lg-v">V</span>}{p._whale ? " ♛" : ""}
                  </div>
                  <div className="lg-sub">{p.brand}{realName(p) ? " · " + realName(p) : ""}</div>
                </td>
                <td className="s">{st
                  ? <><span className="lg-dots">{st.dots.map((d) => (
                      <i key={d.d} className={d.s} title={`${dLabel(shiftDate(d.d, -1))} · dep ${fmt(d.x.daily_deposit)} · wd ${fmt(d.x.daily_withdraw)} · game ${fmt(d.x.win_loss)}`} />))}</span>
                    <span className="lg-st">lost <b>{st.lost}</b> of {st.played}</span></>
                  : <span className="dim">…</span>}</td>
                <td>{fmt(p._y.daily_deposit)}</td>
                <td>{fmt(p._y.daily_withdraw)}</td>
                <td className="mv-dn" title={`Game win/loss ${fmt(p._y.win_loss)}`}>{fmt(p._lost)}</td>
                <td>{p._dsld ?? "—"}</td>
                <td>{fmt(p.monthly_deposit)}</td>
                <td className="a"><div className="lg-act">
                  {p._tg && <a className="lg-btn tg" href={p._tg} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>✈ Telegram</a>}
                  {con?.status && con.status !== "ASSIGNED"
                    ? <span className="dl-tag" style={{ "--sc": ST_COLOR[con.status] }}>{con.status.replace("_", " ")}</span>
                    : cool
                    ? <span className="dl-tag" style={{ "--sc": "#64748B" }} title="Contacted in the last 48h">cooldown</span>
                    : !readOnly && <button className="lg-btn" disabled={busy === k} onClick={(e) => markContacted(e, p)}>{busy === k ? "…" : "✓ Contacted"}</button>}
                </div></td>
              </tr>
            );
          })}</tbody>
        </table>
        {rows.length > limit && <div className="lg-more"><button className="btn-ghost" onClick={() => setLimit(limit + 50)}>Show {Math.min(50, rows.length - limit)} more · {rows.length - limit} left</button></div>}
        </div>}

      {selIdx != null && shown[selIdx] && (
        <Drawer list={shown} index={selIdx} setIndex={setSelIdx} snap={snap} me={me} team={team}
          contact={contactMap[ckey(shown[selIdx])]} onSave={onSaveContact} onClear={onClearContact}
          onClose={() => setSelIdx(null)} readOnly={readOnly} />
      )}
    </div>
  );
}

/* Notification bell — event/exception alerts only (no standing metrics). Dismissible, per-day. */
export function NotifBell({ notices, snap, onGo }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return JSON.parse(localStorage.getItem("notif_dismissed") || "{}"); } catch (e) { return {}; } });
  const dkey = (id) => `${snap}:${id}`;
  const dismiss = (id) => setDismissed((d) => { const n = { ...d, [dkey(id)]: 1 }; try { localStorage.setItem("notif_dismissed", JSON.stringify(n)); } catch (e) { /* private mode */ } return n; });
  const visible = notices.filter((n) => !dismissed[dkey(n.id)]);
  const crit = visible.some((n) => n.sev === "crit");
  return (
    <div className="notif">
      <button className={"notif-bell" + (crit ? " crit" : "")} onClick={() => setOpen((o) => !o)} title="Alerts">
        🔔{visible.length > 0 && <span className={"notif-badge" + (crit ? " crit" : "")}>{visible.length}</span>}
      </button>
      {open && <div className="notif-overlay" onClick={() => setOpen(false)} />}
      {open && (
        <div className="notif-panel">
          <div className="notif-head">Alerts{visible.length > 0 && <button className="notif-clear" onClick={() => visible.forEach((n) => dismiss(n.id))}>clear all</button>}</div>
          {visible.length === 0 && <div className="notif-empty">Nothing needs attention ✓</div>}
          {visible.map((n) => (
            <div key={n.id} className={"notif-row " + n.sev}>
              <span className="notif-ico">{n.icon}</span>
              <div className="notif-body" style={{ cursor: n.tab ? "pointer" : "default" }} onClick={() => { if (n.tab) { onGo(n); setOpen(false); } }}>
                <div className="notif-text">{n.text}</div>
                {n.detail && <div className="notif-detail">{n.detail}</div>}
              </div>
              <button className="notif-x" title="Dismiss" onClick={() => dismiss(n.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════ ASSIGNED — daily auto-assigned list (Daily tab view) ════════════════════════ */
// Reads the Worker's deal (GET /api/rtn/auto-assign) and enriches each player from the live
// classified board rows — real UID (dispName), churn risk (_cool2), TG link, today's status.
// Row → the existing Drawer. Read-only preview (Phase 1): assignments are shown, not written.
export const AA_BANDC = { cooling: "var(--cool)", whale: "var(--gold)", "7-13d": "var(--pos)", "14-29d": "var(--pos)", "3-6d": "var(--dim)", "2d": "var(--dim)", "30d+": "var(--dim)" };
export const AA_TAGL = { cooling: "COOLING", whale: "WHALE", "7-13d": "REACTIVATE", "14-29d": "REACTIVATE", "3-6d": "WATCH", "2d": "WATCH", "30d+": "CHURN" };
export const AA_SC = { New: "var(--dim)", Contacted: ST_COLOR.CONTACTED, Recovered: "var(--pos)" };
/* Contact parity — the month's standing position against the department target.
   Counts each reachable player ONCE, so the bar only moves on a first touch. The milestone
   ladder reopens at the next rung as soon as one is cleared, which is why the label reads
   "next" rather than "target" once 52 is behind us. */
export function ParityBar({ d, onDupes }) {
  if (!d || !d.reachable) return null;
  const pct = d.rate, ms = d.milestone, done = pct >= ms;
  const pace = d.today_new >= d.need_per_day;
  const col = pct >= ms ? "var(--pos)" : pct >= ms - 6 ? "var(--warn)" : "var(--neg)";
  return (
    <div className="pb">
      <div className="pb-top">
        <div className="pb-big" style={{ color: col }}>{pct.toFixed(1)}<span>%</span></div>
        <div className="pb-sum">
          <b>{d.touched.toLocaleString()}</b> of <b>{d.reachable.toLocaleString()}</b> reachable players contacted this month
          <span className="pb-sub">{d.untouched.toLocaleString()} never contacted · Telegram only, SMS and Internal Mail are counted outside the console</span>
        </div>
        {!!(d.overcontact || []).length && (
          <button className="pb-dup" onClick={onDupes} title="Players contacted by more than one agent in the last 7 days">
            ⚠ {d.overcontact_total || d.overcontact.length} double-contacted
          </button>
        )}
      </div>
      <div className="pb-track">
        <div className="pb-fill" style={{ width: Math.min(100, pct) + "%", background: col }} />
        {(d.milestones || []).map((m) => (
          <span key={m} className={"pb-tick" + (pct >= m ? " hit" : "") + (m === ms ? " now" : "")}
            style={{ left: m + "%" }} title={`${m}%`} />
        ))}
      </div>
      <div className="pb-foot">
        {done ? (
          <span className="pb-ok">Milestone cleared — next rung is {ms}%</span>
        ) : (
          <span>Next milestone <b>{ms}%</b> · need <b>{d.need}</b> more in <b>{d.days_left}</b> day{d.days_left === 1 ? "" : "s"} = <b>{d.need_per_day}/day</b></span>
        )}
        <span className={"pb-today" + (pace ? " ok" : "")}>
          Today: <b>{d.today_new}</b> new {pace ? "✓" : `· ${Math.max(0, d.need_per_day - d.today_new)} to go`}
        </span>
      </div>
      {!!(d.brands || []).length && (
        <div className="pb-brands">
          {d.brands.map((b) => (
            <span key={b.brand} className="pb-b" title={`${b.touched} of ${b.reachable} contacted`}>
              {b.brand}<b>{b.untouched}</b>
            </span>
          ))}
          <span className="pb-bl">left to contact</span>
        </div>
      )}
    </div>
  );
}

/* Over-contact guard. Two agents messaging the same VIP inside a week is bad for the player
   and inflates nobody's numbers — parity counts the person once however many times they were
   contacted. Listing them is the honest version: it shows the waste instead of hiding it. */
export function DupeCard({ rows, total, onClose }) {
  return (
    <div className="aa-dry">
      <div className="aa-dryh">
        <b>Contacted by more than one agent · last 7 days</b>
        {total > rows.length && <span className="dim" style={{ fontSize: 12 }}>showing {rows.length} of {total}</span>}
        <button className="aa-x" onClick={onClose}>×</button>
      </div>
      {!rows.length ? <div className="dim" style={{ fontSize: 13 }}>None — no player was double-contacted this week.</div> : (
        <>
          <table className="aa-drytbl">
            <thead><tr><th>Player</th><th>Brand</th><th>Agents</th><th>Last touch</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}><td className="mono">{r.player_key}</td><td>{r.brand}</td>
                <td><b style={{ color: "var(--accent)" }}>{r.agents}</b></td><td className="mono dim">{r.last_touch}</td></tr>
            ))}</tbody>
          </table>
          <div className="dim" style={{ fontSize: 12, marginTop: 9 }}>
            Each of these counts once toward parity however many times they were messaged. The
            second touch cost a slot that an uncontacted player could have used.
          </div>
        </>
      )}
    </div>
  );
}

export function AssignedView({ rows, contactMap, contacts, team, viewTeam, me, snap, dates, setViewDate, onSaveContact, onClearContact, readOnly }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);
  const [pic, setPic] = useState("");
  const [legend, setLegend] = useState(false);
  const [dIdx, setDIdx] = useState(null);
  const [dry, setDry] = useState(null);      // managers-only dry run of the daily writer
  const [dryBusy, setDryBusy] = useState(false);
  const [busySave, setBusySave] = useState({});   // per-row spinner for the ✓ quick-log
  const [saveErr, setSaveErr] = useState("");
  // How many batches of the cap are open today. Starts at 1; "Open next batch" adds another,
  // so an agent who clears the first 30 and still has shift left pulls the next 30 themselves
  // instead of a fixed bigger list nobody finishes.
  const [batch, setBatch] = useState(1);
  const [rate, setRate] = useState(null);         // contact-parity counter
  const [dupOpen, setDupOpen] = useState(false);
  // One team per call — the deal must match the board rows on screen, or nothing enriches.
  const load = () => {
    setBusy(true); setErr("");
    api(`/api/rtn/auto-assign?team=${encodeURIComponent(viewTeam || "")}&batch=${batch}`)
      .then((d) => { setData(d); setBusy(false);
        // Keep the selected PIC only if they belong to the team now on screen.
        setPic((p) => ((p && (d.pics || []).includes(p)) ? p
          : (me?.manage_users ? (d.pics?.[0] || "") : (me?.username || d.pics?.[0] || "")))); })
      .catch((e) => { setErr(e.message); setBusy(false); });
  };
  useEffect(load, [viewTeam, batch]);
  // A different team means a different pool, so the day's batch count starts over.
  useEffect(() => { setBatch(1); }, [viewTeam]);
  // Parity counter. Separate from the deal so opening another batch does not re-run it —
  // it is the month's standing position, not today's list.
  useEffect(() => {
    let gone = false;
    api(`/api/rtn/contact-rate?team=${encodeURIComponent(viewTeam || "")}`)
      .then((d) => { if (!gone) setRate(d); })
      .catch(() => { if (!gone) setRate(null); });
    return () => { gone = true; };
  }, [viewTeam]);
  // Dry run: asks the Worker to compute the daily write for ALL teams and report the
  // counts without saving a row. Same function the cron calls, so this proves the real job.
  const runDry = () => {
    setDryBusy(true); setDry(null);
    api("/api/rtn/auto-assign/run?dry=1", { method: "POST" })
      .then((d) => { setDry(d); setDryBusy(false); })
      .catch((e) => { setDry({ error: e.message }); setDryBusy(false); });
  };
  useEffect(() => { setDIdx(null); }, [pic]);

  const rowByKey = useMemo(() => { const m = {}; (rows || []).forEach((r) => (m[ckey(r)] = r)); return m; }, [rows]);
  const list = useMemo(() => {
    const asg = (data && pic && data.assignments && data.assignments[pic]) || [];
    return asg.map((a) => {
      const r = rowByKey[`${a.player_key}|${a.brand}|${a.tier_segment}`];
      // _aaDsld = the deal's own idle count, already aged for the one-day feed lag. Shown in
      // place of the board's raw _dsld so the days an agent reads always match the band.
      const extra = { _band: a.band, _sticky: a.sticky, _aaDsld: a.dsld, _fresh: a.fresh, _dupe: a.dupe };
      return r ? { ...r, ...extra } : { ...a, ...extra };
    });
  }, [data, pic, rowByKey]);

  // Risk is ONLY the server's deposit-rhythm model. There used to be a fallback of
  // 28 + days*3 here, which made the column a rescaled copy of Quiet — every 7-day player
  // read 49%, dressed up as a churn probability. A blank is honest; a guess is not.
  const riskOf = (p) => (p._cool2 ? p._cool2.risk : null);
  const statOf = (p) => { const s = contactMap[ckey(p)] && contactMap[ckey(p)].status;
    return s === "RECOVERED" ? "Recovered" : (s === "CONTACTED" || s === "RESPONDED" || s === "NO_RESPONSE") ? "Contacted" : "New"; };
  const rc = (r) => (r >= 70 ? "var(--neg)" : r >= 55 ? "var(--warn)" : "var(--dim)");
  const openMsg = (e, p) => { e.stopPropagation(); const u = safeHttpUrl(p._tg); if (u) window.open(u, "_blank", "noopener,noreferrer"); };
  // One-click "I've messaged them" straight from the row — same write the card does, so the
  // outcome still counts on the leaderboard. Assigns to the signed-in agent if nobody owns it.
  const markContacted = async (e, p) => {
    e.stopPropagation();
    if (readOnly || !me?.username) return;
    const k = ckey(p);
    setBusySave((s) => ({ ...s, [k]: true })); setSaveErr("");
    try {
      const cur = contactMap[k] || {};
      await onSaveContact({ snapshot_date: snap, player_key: p.player_key, brand: p.brand,
        tier_segment: p.tier_segment, class: p._cls || cur.class || null,
        assigned_to: cur.assigned_to || me.username, status: "CONTACTED", note: cur.note || null });
    } catch (e2) { setSaveErr(e2.message || "Could not save"); }
    setBusySave((s) => ({ ...s, [k]: false }));
  };
  const done = list.filter((p) => statOf(p) !== "New").length;
  // Still-uncontacted players on this list who have not been touched at all this month — the
  // only ones left that can still move the parity rate today.
  const freshLeft = list.filter((p) => p._fresh && statOf(p) === "New").length;

  // Export every PIC's assigned accounts for this team to CSV, so an agent can pull the whole
  // list into a sheet and work through the accounts fast. Enriches each assignment from the live
  // board row (username / value / risk / telegram) the same way the on-screen list does.
  const exportCsv = () => {
    if (!data || !data.assignments) return;
    const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const header = ["Agent", "Player key", "Username", "Brand", "Tier", "Class", "Band",
      "Value (player net RM)", "Risk %", "Quiet days", "Telegram", "Status", "First contact this month"];
    const lines = [header.join(",")];
    Object.keys(data.assignments).forEach((agent) => {
      (data.assignments[agent] || []).forEach((a) => {
        const r = rowByKey[`${a.player_key}|${a.brand}|${a.tier_segment}`] || {};
        const cm = contactMap[`${a.player_key}|${a.brand}|${a.tier_segment}`];
        const s = cm && cm.status;
        const status = s === "RECOVERED" ? "Recovered"
          : (s === "CONTACTED" || s === "RESPONDED" || s === "NO_RESPONSE") ? "Contacted" : "New";
        lines.push([agent, a.player_key, r.username || "", a.brand, a.tier_segment,
          r._cls || "", a.band || "", (r.pnl ?? ""), (r._cool2 ? r._cool2.risk : ""),
          (a.dsld != null ? a.dsld : (r._dsld != null ? r._dsld : "")),
          safeHttpUrl(r._tg) || "", status, a.fresh ? "yes" : "no"].map(esc).join(","));
      });
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `assigned-${data.team || viewTeam || "team"}-${data.snapshot || snap}.csv`;
    a.click();
  };
  const totalAccounts = data && data.assignments
    ? Object.values(data.assignments).reduce((n, arr) => n + (arr || []).length, 0) : 0;

  const stale = !!(data && data.snapshot && snap && data.snapshot !== snap);
  const yday = dates && dates[1] && dates[1].snapshot_date;
  const yc = (contacts || []).filter((c) => c.snapshot_date === yday && c.assigned_to === pic);
  const yCon = yc.filter((c) => ["CONTACTED", "RESPONDED", "NO_RESPONSE", "RECOVERED"].includes(c.status)).length;
  const yRes = yc.filter((c) => ["RESPONDED", "RECOVERED"].includes(c.status)).length;
  const yRec = yc.filter((c) => c.status === "RECOVERED").length;

  return (
    <div className="aa">
      <AAStyle />
      <div className="aa-hd">
        <h2>Assigned <span className="dim" style={{ fontWeight: 400, fontSize: 13 }}>· who to contact today</span></h2>
        {data && <span className="mono dim" style={{ fontSize: 12 }}>{data.team ? `Team ${data.team} · ` : ""}{data.snapshot} · {data.batch > 1 ? `${data.batch} batches · ` : ""}cap {data.cap}</span>}
        <button className="aa-lbtn" onClick={() => setLegend(true)}>ⓘ Legend</button>
        {!!list.length && <span className="aa-prog"><b>{done}</b> done · {list.length - done} to go{freshLeft
          ? <> · <b style={{ color: "var(--pos)" }}>{freshLeft}</b> count toward target</> : null}</span>}
        <button className="btn-ghost" style={{ marginLeft: data && list.length ? 8 : "auto" }} onClick={load} disabled={busy}>{busy ? "…" : "Refresh"}</button>
        {/* Another batch of the same cap, opened by hand. Deliberately NOT automatic: a longer
            list nobody finishes helps nothing, but an agent who has cleared theirs should never
            have to wait until tomorrow for more names. */}
        {data && data.batch < (data.max_batch || 4) && (
          <button className="btn-ghost aa-more" onClick={() => setBatch((b) => b + 1)} disabled={busy}
            title={`Add another ${data.batch_size || 30} players to today's list`}>
            + Open next batch ({data.batch_size || 30})
          </button>
        )}
        {totalAccounts > 0 && <button className="btn-ghost" style={{ marginLeft: 8 }} onClick={exportCsv}
          title={`Download all ${totalAccounts} assigned accounts (every agent) as a CSV`}>Export CSV</button>}
        {me?.manage_users && <button className="btn-ghost" style={{ marginLeft: 8 }} onClick={runDry} disabled={dryBusy}
          title="Work out today's assignment for every team and show the counts. Saves nothing.">{dryBusy ? "…" : "Dry run"}</button>}
      </div>
      {dry && <DryRunCard dry={dry} onClose={() => setDry(null)} />}
      {err && <div style={{ color: "var(--neg)", fontSize: 13, marginBottom: 12 }}>Couldn't load: {err}</div>}
      {busy && !data && <div className="dim">Computing today's list…</div>}
      {/* The deal is always built from the newest snapshot, but the board behind it follows the
          date picker. On a past date nothing matches, so Risk/Quiet/Telegram all come up empty —
          say so plainly instead of showing a half-filled list that looks broken. */}
      {stale && (
        <div className="aa-stale">
          <span>This list is always <b>today's</b> ({data.snapshot}), but the console is showing <b>{snap}</b>. Player details stay blank until you come back to today.</span>
          {setViewDate && <button className="btn-ghost" onClick={() => setViewDate(null)}>Back to today</button>}
        </div>
      )}
      <ParityBar d={rate} onDupes={() => setDupOpen(true)} />
      {dupOpen && rate && <DupeCard rows={rate.overcontact || []} total={rate.overcontact_total || 0} onClose={() => setDupOpen(false)} />}
      {data && (
        <>
          {pic && (
            <div className="aa-ycard">
              <div className="aa-yl">Yesterday<b>{yday || "—"} · {pic}</b></div>
              <div className="aa-ystat"><span className="v">{yCon}</span><span className="l">contacted</span></div>
              <div className="aa-ystat"><span className="v" style={{ color: ST_COLOR.RESPONDED }}>{yRes}</span><span className="l">responded</span></div>
              <div className="aa-ystat"><span className="v" style={{ color: "var(--pos)" }}>{yRec}</span><span className="l">recovered</span></div>
            </div>
          )}
          {/* Managers get the whole row to switch between PICs. An agent is sent only their
              own list by the Worker, so there is nothing to switch — hide the row. */}
          {(data.pics || []).length > 1 && (
            <div className="aa-pics">
              {(data.pics || []).map((p) => (
                <button key={p} className={pic === p ? "on" : ""} onClick={() => setPic(p)}>{p}</button>
              ))}
            </div>
          )}
          <div className="aa-list">
            <div className="aa-cols"><span></span><span className="l-l">Player</span><span></span><span className="l-l">Brand</span><span className="r-r">Value</span><span className="r-r">Risk</span><span className="r-r">Quiet</span><span className="l-l">Status</span><span className="r-r">Action</span></div>
            {list.map((p, i) => {
              const band = p._band, st = statOf(p), risk = riskOf(p);
              const won = (Number(p.pnl) || 0) > 0;   // player is UP on us — lowest retention value
              const quiet = p._aaDsld != null ? p._aaDsld : p._dsld;
              const k = ckey(p), saving = !!busySave[k];
              return (
                <div key={i} className="aa-row" onClick={() => p._cls && setDIdx(i)}>
                  <span className="aa-dot" style={{ background: AA_BANDC[band] || "var(--dim)" }} />
                  {/* Same shape as the player card: account id on top, name underneath. */}
                  <span className="aa-nm">
                    <span className="aa-nm-id">{dispName(p)}{p._sticky ? <span className="dim" title="stays with this PIC"> ↺</span> : null}
                      {/* Only a FIRST touch this month moves contact parity, so the one thing an
                          agent needs to see at a glance is whether this player still counts. */}
                      {p._fresh && <span className="aa-new" title="Not contacted yet this month — this one counts toward the target">NEW</span>}
                      {p._dupe && <span className="aa-dup" title="Another agent already contacted this player in the last 7 days">⚠</span>}
                    </span>
                    {realName(p) && <span className="aa-nm-sub">{realName(p)}</span>}
                  </span>
                  <span className="aa-pill" style={{ "--c": AA_BANDC[band] || "var(--dim)" }}>{AA_TAGL[band] || band}</span>
                  <span className="aa-meta">{p.brand} · {p.tier_segment === "V" ? "Tier V" : "Tier 3"}</span>
                  {/* Value = how much the player is DOWN to us (negative pnl) — our highest-value
                      customers. A player who is UP on us is marked "+" and dimmed, never blended
                      in as if it were the same thing. Math.abs() alone used to hide the difference. */}
                  <span className="aa-rm" style={{ color: won ? "var(--dim)" : undefined }}
                    title={won ? "This player is UP on us — lower value to win back" : "This player is down to us — high-value customer"}>
                    {won ? "+" : ""}{fmtK(Math.abs(Number(p.pnl) || 0))}</span>
                  {risk == null
                    ? <span className="aa-risk dim" title="No deposit-rhythm model for this player yet — go by Quiet and Value">—</span>
                    : <span className="aa-risk" style={{ color: rc(risk) }}>{risk}%</span>}
                  <span className="aa-d" title="Days since their last deposit, aged by one day because the feed runs a day behind">{quiet != null ? quiet : "—"}d</span>
                  <span className="aa-stat" style={{ "--sc": AA_SC[st] }}>{st}</span>
                  {/* Message stays available after contact — a follow-up needs the same chat.
                      ✓ logs CONTACTED to the signed-in agent without opening the card, which is
                      the whole day's most repeated click. */}
                  <span className="aa-acts">
                    {p._tg && <button className={"aa-act" + (st === "New" ? "" : " sec")} onClick={(e) => openMsg(e, p)}>
                      {st === "New" ? "Message" : "Chat"}</button>}
                    {!readOnly && st === "New" && me?.can_edit !== false && (
                      <button className="aa-tick" disabled={saving} title="Mark contacted — logs it under your name"
                        onClick={(e) => markContacted(e, p)}>{saving ? "·" : "✓"}</button>)}
                  </span>
                </div>
              );
            })}
            {saveErr && <div style={{ color: "var(--neg)", fontSize: 12.5, padding: "8px 18px" }}>{saveErr}</div>}
            {!list.length && <div className="dim" style={{ padding: "16px" }}>
              {(data.pics || []).length ? "No players assigned to this PIC today."
                : me?.manage_users ? `No agents set up on Team ${data.team || "?"} yet — add them in Settings (role “agent”, team ${data.team || "?"}).`
                : "You're not on the assignment list yet — ask a manager to set your role to agent."}</div>}
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 11 }}>Row → full card (smart read + message) · Message opens their Telegram chat.{data.live
            ? " Unfinished players stay yours and carry to tomorrow."
            : " Preview — the list is worked out fresh each time and not saved yet."}</div>
        </>
      )}
      {legend && <AALegend onClose={() => setLegend(false)} />}
      {dIdx != null && list[dIdx] && (
        <Drawer list={list} index={dIdx} setIndex={setDIdx} snap={snap} me={me} team={team}
          contact={contactMap[ckey(list[dIdx])]} onSave={onSaveContact} onClear={onClearContact}
          onClose={() => setDIdx(null)} readOnly={readOnly} />
      )}
    </div>
  );
}

export function AALegend({ onClose }) {
  return (
    <div className="aa-ov" onClick={(e) => { if (e.target.classList.contains("aa-ov")) onClose(); }}>
      <div className="aa-modal">
        <div className="aa-mh"><h3>Assigned — legend</h3><button className="aa-x" onClick={onClose}>×</button></div>
        <p className="dim" style={{ fontSize: 12.5, margin: "2px 0 0" }}>What each label means, and how the numbers are worked out.</p>
        <div className="aa-msec">
          <div className="aa-mt">Why they're on the list</div>
          <div className="aa-mrow"><i style={{ background: "var(--cool)" }} /><span><b>Cooling</b> — a top-value whale gone quiet <b>5–6 days</b>. The last window before they go cold. Handle personally.</span></div>
          <div className="aa-mrow"><i style={{ background: "var(--gold)" }} /><span><b>Whale</b> — a top-value player quiet <b>7d+</b>. High worth — worth a personal touch.</span></div>
          <div className="aa-mrow"><i style={{ background: "var(--pos)" }} /><span><b>Reactivate</b> — a player idle <b>7–29 days</b>: the KPI "money-zone" where reactivations score best.</span></div>
        </div>
        <div className="aa-msec">
          <div className="aa-mt">The three numbers</div>
          <div className="aa-mrow"><span><b>Value</b> — how much the player is <b>down to us</b>. The bigger the number, the more they have lost with us, and the more they are worth keeping. A <b>+</b> and a greyed number means the opposite: that player is <b>up on us</b>. Still worth a polite touch, but they are the lowest value on your list.</span></div>
          <div className="aa-mrow"><span><b>Quiet</b> — simply the days since their last deposit (DSLD). Raw and factual.</span></div>
          <div className="aa-mrow"><span><b>Risk %</b> — churn probability 0–100%, built from the player's <b>own deposit rhythm</b>. It only appears for players who have deposited often enough for us to know their rhythm. <b>A dash (—) means we don't have a rhythm for them yet</b> — go by Quiet and Value instead. We would rather show you nothing than a made-up number.</span></div>
          <div className="aa-eg"><b>Example — same "Quiet", very different Risk:</b><br />• Player A usually deposits <b>every 2 days</b>, now quiet 6 → 3× overdue → <span className="hl">Risk 82%</span><br />• Player B usually goes <b>10 days</b> between deposits, quiet 6 → barely late → <span className="hl">Risk 30%</span><br />Both show <b>Quiet 6d</b>, but A is far more likely to churn.</div>
        </div>
        <div className="aa-msec">
          <div className="aa-mt">Status</div>
          <div className="aa-mrow"><span><b>New</b> — not contacted yet &nbsp;·&nbsp; <b>Contacted</b> — messaged, awaiting reply &nbsp;·&nbsp; <b>Recovered</b> — deposited after your contact (scores the KPI).</span></div>
        </div>
        <div className="aa-msec">
          <div className="aa-mt">How today's list is built</div>
          <div className="aa-mrow"><span>Telegram-reachable players, 2+ days quiet → ranked <b>whales first, then the 7–29d money-zone</b> → capped at 15 per PIC. After you contact someone they rest <b>3 days</b>, then return if still quiet.</span></div>
        </div>
      </div>
    </div>
  );
}

/* Dry-run result (managers). Shows what the daily writer WOULD do, per team.
   `written` only appears on a real run; a dry run reports `dealt` and saves nothing. */
export function DryRunCard({ dry, onClose }) {
  const teams = (dry && dry.teams) || {};
  const keys = Object.keys(teams);
  const total = keys.reduce((n, t) => n + (teams[t].dealt || 0), 0);
  return (
    <div className="aa-dry">
      <div className="aa-dryh">
        <b>Dry run{dry.dry === false ? "" : " — nothing was saved"}</b>
        <span className={"aa-sw " + (dry.enabled ? "on" : "off")}>{dry.enabled ? "Auto-assign ON" : "Auto-assign OFF"}</span>
        <button className="aa-x" onClick={onClose}>×</button>
      </div>
      {dry.error ? <div style={{ color: "var(--neg)", fontSize: 13 }}>Couldn't run: {dry.error}</div> : (
        <>
          <table className="aa-drytbl">
            <thead><tr><th>Team</th><th>PICs</th><th>Players dealt</th><th>Each</th><th></th></tr></thead>
            <tbody>
              {keys.map((t) => { const r = teams[t];
                return (
                  <tr key={t}>
                    <td><b>Team {t}</b></td>
                    <td>{r.skipped ? "—" : r.pics}</td>
                    <td>{r.skipped ? "—" : r.dealt}</td>
                    <td>{r.skipped || !r.pics ? "—" : Math.round((r.dealt / r.pics) * 10) / 10}</td>
                    <td className="dim">{r.skipped ? r.skipped : r.error ? r.error : r.written != null ? `${r.written} written · ${r.untouched} left alone` : ""}</td>
                  </tr>);
              })}
            </tbody>
          </table>
          <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
            {total} players across all teams. {dry.enabled
              ? "The switch is ON — the 16:00 MYT job writes these to the contact log each day."
              : "The switch is OFF — the daily job is asleep and writes nothing. Flip AUTO_ASSIGN_ENABLED and redeploy to go live."}
          </div>
        </>
      )}
    </div>
  );
}

export function AAStyle() {
  return (<style>{`
    /* ── contact parity bar ── */
    .pb{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:13px 16px;margin-bottom:14px}
    .pb-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .pb-big{font-family:'IBM Plex Mono',monospace;font-size:30px;font-weight:700;line-height:1}
    .pb-big span{font-size:15px;margin-left:1px}
    .pb-sum{font-size:12.5px;color:var(--dim);line-height:1.5}
    .pb-sum b{color:var(--txt);font-family:'IBM Plex Mono',monospace}
    .pb-sub{display:block;font-size:11px;opacity:.8}
    .pb-dup{margin-left:auto;background:color-mix(in srgb,var(--warn) 12%,transparent);border:1px solid color-mix(in srgb,var(--warn) 45%,transparent);color:var(--warn);font:inherit;font-size:11.5px;font-weight:600;padding:6px 11px;border-radius:8px;cursor:pointer;white-space:nowrap}
    .pb-track{position:relative;height:8px;background:var(--panel2);border-radius:99px;margin:11px 0 9px;overflow:visible}
    .pb-fill{height:100%;border-radius:99px;transition:width .4s ease}
    .pb-tick{position:absolute;top:-3px;width:2px;height:14px;background:var(--line);border-radius:2px}
    .pb-tick.hit{background:color-mix(in srgb,var(--pos) 70%,transparent)}
    .pb-tick.now{background:var(--accent);width:3px;height:16px;top:-4px}
    .pb-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--dim)}
    .pb-foot b{color:var(--txt);font-family:'IBM Plex Mono',monospace}
    .pb-ok{color:var(--pos);font-weight:600}
    .pb-today{margin-left:auto;color:var(--neg)}.pb-today.ok{color:var(--pos)}
    .pb-today b{color:inherit}
    .pb-brands{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px solid var(--line)}
    .pb-b{font-size:11px;color:var(--dim);background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:3px 8px;font-family:'IBM Plex Mono',monospace}
    .pb-b b{color:var(--accent);margin-left:5px}
    .pb-bl{font-size:10.5px;color:var(--dim);opacity:.75;letter-spacing:.05em;text-transform:uppercase}
    .aa-new{font-size:8.5px;font-weight:700;letter-spacing:.06em;color:var(--pos);background:color-mix(in srgb,var(--pos) 14%,transparent);border-radius:4px;padding:1px 4px;margin-left:6px;vertical-align:1px}
    .aa-dup{font-size:11px;color:var(--warn);margin-left:5px}
    .aa-more{border-color:color-mix(in srgb,var(--pos) 45%,transparent)!important;color:var(--pos)!important}
    @media (max-width:760px){
      .pb-big{font-size:24px}
      .pb-dup,.pb-today{margin-left:0}
      .pb-foot{gap:8px}
    }
    .aa-stale{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12.5px;background:color-mix(in srgb,var(--warn) 10%,transparent);border:1px solid color-mix(in srgb,var(--warn) 45%,transparent);border-radius:10px;padding:10px 14px;margin-bottom:14px}
    .aa-stale button{margin-left:auto}
    .aa-dry{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:14px}
    .aa-dryh{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:14px}
    .aa-dryh .aa-x{margin-left:auto}
    .aa-sw{font-size:9.5px;font-weight:700;letter-spacing:.05em;padding:3px 9px;border-radius:999px}
    .aa-sw.on{color:var(--pos);border:1px solid color-mix(in srgb,var(--pos) 55%,transparent);background:color-mix(in srgb,var(--pos) 12%,transparent)}
    .aa-sw.off{color:var(--dim);border:1px solid var(--line)}
    .aa-drytbl{width:100%;border-collapse:collapse;font-size:13px}
    .aa-drytbl th{text-align:left;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);padding:4px 10px 6px 0;font-weight:600}
    .aa-drytbl td{padding:5px 10px 5px 0;font-family:'IBM Plex Mono',monospace}
    .aa-drytbl td:first-child,.aa-drytbl td:last-child{font-family:inherit}
    .aa-drytbl tr+tr td{border-top:1px solid var(--line)}
    .aa{padding:6px 0 40px}
    .aa-hd{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    .aa-hd h2{margin:0;font-size:19px}
    .aa-lbtn{background:var(--panel);border:1px solid var(--line);color:var(--dim);font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:8px;cursor:pointer;font-family:inherit}
    .aa-lbtn:hover{border-color:var(--accent);color:var(--accent)}
    .aa-prog{font-size:12px;color:var(--dim)}.aa-prog b{color:var(--pos);font-family:'IBM Plex Mono',monospace}
    .aa-ycard{display:flex;align-items:center;gap:24px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 18px;margin-bottom:14px}
    .aa-yl{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;line-height:1.3}.aa-yl b{display:block;color:var(--txt);font-size:13px;letter-spacing:0;text-transform:none}
    .aa-ystat{display:flex;flex-direction:column;gap:2px}.aa-ystat .v{font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700}.aa-ystat .l{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
    .aa-pics{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}
    .aa-pics button{background:var(--panel);border:1px solid var(--line);color:var(--dim);font-size:12.5px;padding:5px 13px;border-radius:999px;cursor:pointer;text-transform:capitalize;font-family:inherit}
    .aa-pics button.on{border-color:var(--accent);color:var(--accent);font-weight:600}
    .aa-list{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
    .aa-cols,.aa-row{display:grid;grid-template-columns:12px 2fr 1.2fr 1.7fr 0.9fr 0.6fr 0.55fr 1fr 1.1fr;gap:16px;align-items:center;padding:9px 18px}
    .aa-cols{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);background:var(--panel2)}
    .aa-row{cursor:pointer;border-left:3px solid transparent;font-size:13.5px}
    .aa-row+.aa-row{border-top:1px solid var(--line)}
    .aa-row:hover{background:var(--panel2);border-left-color:var(--accent)}
    .aa-dot{width:8px;height:8px;border-radius:50%}
    .aa-nm{display:flex;flex-direction:column;gap:1px;min-width:0}
    .aa-nm-id{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .aa-nm-sub{color:var(--dim);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .aa-pill{justify-self:start;font-size:9px;font-weight:700;letter-spacing:.04em;color:var(--c);border:1px solid var(--c);background:color-mix(in srgb,var(--c) 13%,transparent);padding:2px 7px;border-radius:5px}
    .aa-meta{color:var(--dim);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .aa-rm{justify-self:end;font-family:'IBM Plex Mono',monospace;font-size:12.5px}
    .aa-risk{justify-self:end;font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:700}
    .aa-d{justify-self:end;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--dim)}
    .aa-stat{justify-self:start;font-size:9.5px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;color:var(--sc);border:1px solid color-mix(in srgb,var(--sc) 55%,transparent);background:color-mix(in srgb,var(--sc) 12%,transparent)}
    .aa-acts{justify-self:end;display:flex;gap:6px;align-items:center;width:100%}
    .aa-act{flex:1 1 auto;font-size:11px;font-weight:600;padding:5px 12px;border-radius:7px;border:1px solid var(--accent);color:var(--accent);background:transparent;cursor:pointer;font-family:inherit}
    .aa-act:hover{background:color-mix(in srgb,var(--accent) 15%,transparent)}
    .aa-act.sec{border-color:var(--line);color:var(--dim)}
    .aa-act.sec:hover{border-color:var(--accent);color:var(--accent);background:transparent}
    .aa-tick{flex:0 0 auto;width:28px;height:26px;font-size:12px;border-radius:7px;border:1px solid var(--line);color:var(--dim);background:transparent;cursor:pointer;font-family:inherit}
    .aa-tick:hover:not(:disabled){border-color:var(--pos);color:var(--pos)}
    .aa-tick:disabled{opacity:.5;cursor:default}
    /* Phones: the 9-column grid can't hold. Rows become wrapped cards, the header row goes
       away, and the bare numbers get their own labels so they stay readable without it. */
    @media (max-width:900px){
      .aa-cols{display:none}
      .aa-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px 10px;padding:12px 14px}
      .aa-nm{flex:1 1 auto;min-width:0}
      .aa-meta{flex:1 1 100%;order:4}
      .aa-rm,.aa-risk,.aa-d,.aa-stat{order:5}
      .aa-d::after{content:" quiet";color:var(--dim);font-size:10px}
      .aa-risk::after{content:" risk";color:var(--dim);font-size:10px;font-weight:400}
      .aa-acts{order:6;width:auto;margin-left:auto}
      .aa-act{flex:0 0 auto}
    }
    .aa .l-l{justify-self:start}.aa .r-r{justify-self:end}
    .aa-ov{position:fixed;inset:0;background:rgba(3,5,9,.66);display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;z-index:60;color:var(--txt)}
    .aa-modal{background:var(--panel2);border:1px solid var(--line);border-radius:14px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:22px 24px;color:var(--txt)}
    .aa-mh{display:flex;align-items:center;justify-content:space-between}
    .aa-mh h3{margin:0;font-size:17px}
    .aa-x{background:none;border:none;color:var(--dim);font-size:20px;cursor:pointer;line-height:1;padding:2px 6px}.aa-x:hover{color:var(--txt)}
    .aa-msec{margin-top:18px}
    .aa-mt{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--accent);margin-bottom:9px;font-weight:700}
    .aa-mrow{display:flex;gap:10px;padding:6px 0;font-size:13px;line-height:1.5;color:var(--txt)}
    .aa-mrow i{width:9px;height:9px;border-radius:50%;flex:none;margin-top:5px}
    .aa-eg{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:13px 15px;font-size:12.5px;color:var(--dim);margin-top:10px;line-height:1.65}
    .aa-eg b{color:var(--txt)}.aa-eg .hl{color:var(--accent);font-weight:600;font-family:'IBM Plex Mono',monospace}
  `}</style>);
}

/* ════════════════════ DAILY LOGIN CHECK ════════════════════
   Per-agent manual tick of Login + Deposit for an assigned Tier V roster.
   Login and Deposit are checkboxes the agent fills in real time. The deposit
   AMOUNT is never typed — it is read from the ingest and confirms next day, so
   the sheet stays a check, not a data-entry form (no hand-typed figures). */
/* ════════ GRACE TASKS — activated, reloaded inside the window, not claimed yet ════════
   Rule (worker graceTasksFor): window = activated date → expiry date, both from the Lark Grace table; required deposit =
   the Grace ladder applied to the bonus in the SW Check text; deposits = the console's own daily feed (one day behind).
   The requirement is met by ONE day's deposit (not accumulative across days).
   A claim never expires, so a row stays until Lark says Claimed. Read-only. */
export const GT_STATUS = {
  reloaded:     { label: "RELOADED · NOT CLAIMED", color: "var(--pos)" },
  same_day:     { label: "SAME-DAY RELOAD · CHECK TIME", color: "#E8C547" },
  in_progress:  { label: "WINDOW OPEN", color: "#E8C547" },
  not_reloaded: { label: "DID NOT RELOAD", color: "var(--dim)" },
  unknown:      { label: "NO AMOUNT IN LARK", color: "var(--dim)" },
};
export function GraceTasks({ data, snap, me, team, contactMap, onSaveContact, onClearContact, readOnly }) {
  const [res, setRes] = useState(null);       // null = loading, { rows, notes } or { error }
  const [filter, setFilter] = useState("reloaded");
  const [open, setOpen] = useState(null);     // { list, index } — the player drawer
  const load = () => { setRes(null); api("/api/rtn/grace-tasks").then(setRes).catch((e) => setRes({ error: e.message || "Could not read the Grace table" })); };
  useEffect(load, [snap]);
  const byKey = useMemo(() => { const m = {}; data.forEach((r) => (m[`${r.player_key}|${r.brand}|${r.tier_segment}`] = r)); return m; }, [data]);
  const rows = res && res.rows ? res.rows : [];
  const counts = { reloaded: 0, same_day: 0, in_progress: 0, not_reloaded: 0, unknown: 0 };
  rows.forEach((r) => { counts[r.status]++; });
  const shown = rows.filter((r) => (filter === "all" || r.status === filter) && byKey[`${r.player_key}|${r.brand}|${r.tier_segment}`]);
  const players = shown.map((r) => byKey[`${r.player_key}|${r.brand}|${r.tier_segment}`]);
  const chip = (k, label) => (
    <button key={k} className={"btn-ghost" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>{label}{k !== "all" ? ` ${counts[k]}` : ` ${rows.length}`}</button>);
  return (
    <div className="gt-wrap">
      <div className="gt-head">
        <b>Grace tasks</b>
        <span className="gt-sub">Activated in Lark, reloaded the required deposit inside the window, not claimed yet.</span>
        <button className="btn-ghost" onClick={load}>Refresh</button>
      </div>
      {res && res.notes && (
        <div className="gt-note">
          Window = the <b>activated date</b> to the <b>expiry date</b>, both read from the Lark Grace table. The required deposit must be reached <b>in one single day</b>; days are never added together (RM50 + RM50 on two days does not count). Only days <b>after the activation day</b> count; a deposit on the activation day itself (dashed cell) could be before the activation time, so it is shown separately as "same day, check time". The required deposit follows from the bonus (Tier 3: 100→18, 200→28, 300→38, 500→58 · Tier V: 600→68 … 1000→108).
          {" "}Deposits come from the console's daily feed, one day behind; a "–" day has not arrived yet. The claim never expires, so a row stays until Lark says Claimed.
          {res.notes.late > 0 && <> {res.notes.late} row(s) were activated after their expiry date.</>}
          {res.notes.noPlayer > 0 && <> {res.notes.noPlayer} Grace row(s) have no matching player in the console.</>}
        </div>
      )}
      <div className="gt-filters">
        {chip("reloaded", "Reloaded, not claimed")}{chip("same_day", "Same-day, check time")}{chip("in_progress", "Window open")}{chip("not_reloaded", "Did not reload")}{chip("unknown", "No amount")}{chip("all", "All")}
      </div>
      {res === null && <div className="ledger-empty">Reading the Lark Grace table…</div>}
      {res && res.error && <div className="stale-banner">{res.error}</div>}
      {res && !res.error && (
        <div className="tbl-wrap"><table>
          <thead><tr><th>Player</th><th>Brand</th><th>Tier</th><th>✈</th><th>Window</th><th>Deposit per day</th>
            <th className="r">Best day</th><th className="r">Required</th><th className="r">Bonus</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map((t, i) => {
              const p = players[i], st = GT_STATUS[t.status];
              return (
                <tr key={`${t.player_key}|${t.brand}|${t.end}`} {...tap(() => setOpen({ list: players, index: i }), null)}>
                  <td className="tname"><div className="pname">{dispName(p)}</div><div className="psub">{!looksNumeric(p.addressing) ? p.addressing : ""}</div></td>
                  <td><span className="b-dot" style={{ background: BRANDS[t.brand]?.p }} />{t.brand}</td>
                  <td className="mono">{t.tier_segment}</td>
                  <td>{p._tg ? <span className="tg-cell">✈</span> : <span className="tg-cell off">·</span>}</td>
                  <td className="mono" title={t.late ? "Activated after the expiry date" : "Activated date → expiry date, from Lark"}>
                    {t.start.slice(5)} → {t.end.slice(5)}{t.late ? " ⚠" : ""}</td>
                  <td><div className="gt-days">{t.days.map((d) => (
                    <span key={d.d} className={"gt-d" + (d.d === t.start ? " act" : t.req != null && d.dep >= t.req ? " on" : "") + (d.dep === null ? " na" : "")}
                      title={d.d === t.start ? `${d.d} · activation day: the deposit could be before or after the activation time, so it is not counted as certain` : d.d}>{d.dep === null ? "–" : fmt(d.dep)}</span>))}</div></td>
                  <td className="r mono" title="Highest single day after activation">{fmt(t.best)}{t.sameDay > 0 && <div className="gt-sd" title="Deposited on the activation day itself; time of day unknown">{fmt(t.sameDay)} same day</div>}</td>
                  <td className="r mono">{t.req == null ? "—" : fmt(t.req)}</td>
                  <td className="r mono">{t.bonus == null ? "—" : fmt(t.bonus)}</td>
                  <td><span className="gt-st" style={{ "--cc": st.color }} title={t.text}>{st.label}</span></td>
                </tr>);
            })}
            {shown.length === 0 && <tr><td colSpan="10" className="emptyrow">Nothing in this group.</td></tr>}
          </tbody>
        </table></div>
      )}
      {open && open.list[open.index] && (
        <Drawer list={open.list} index={open.index} setIndex={(i) => setOpen((o) => ({ ...o, index: i }))}
          snap={snap} me={me} team={team} contact={contactMap[ckey(open.list[open.index])]}
          onSave={onSaveContact} onClear={onClearContact} onClose={() => setOpen(null)} readOnly={readOnly} />
      )}
    </div>
  );
}

export const lcStatusColor = (g) => {
  const s = String(g || "");
  if (s.startsWith("Active")) return "var(--pos)";
  if (s.startsWith("Reactivated")) return "var(--info)";
  if (s === "Churn") return "var(--neg)";
  return "var(--dim)";
};
export function LcBox({ on, onClick, disabled }) {
  return <button className={"lc-box" + (on ? " on" : "")} onClick={onClick} disabled={disabled}
    aria-pressed={!!on} title={on ? "Checked — click to clear" : "Click to check"}>{on ? "✓" : ""}</button>;
}
export function LoginCheck({ me, team, viewDate, viewTeam = "B" }) {
  const manager = !!me?.manage_users;
  const readOnly = !me?.can_edit;
  const date = viewDate || "";                                                // driven by the shared top date picker
  const teamBrands = TEAMS[viewTeam] || BRAND_ORDER;                          // brands of the team in view
  const [d, setD] = useState(null);
  const [agent, setAgent] = useState(manager ? "" : (me?.username || ""));   // "" = all agents
  // Default to the team's live pilot brand where there is one (Team B = SK69), else its first.
  const defaultBrand = (t) => (t === "B" ? "SK69" : (TEAMS[t] || BRAND_ORDER)[0]);
  const [brand, setBrand] = useState(() => defaultBrand(viewTeam));           // roster scope, within the team
  const [tier, setTier] = useState("V");                                      // "3" | "V"
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Switching team (manager) snaps the brand back into that team's list.
  useEffect(() => { setBrand(defaultBrand(viewTeam)); /* eslint-disable-next-line */ }, [viewTeam]);

  const load = async () => {
    setBusy(true); setErr("");
    const q = new URLSearchParams({ brand, tier });
    if (agent) q.set("agent", agent);
    if (date) q.set("date", date);
    try { setD(await api(`/api/rtn/login-check?${q}`)); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [agent, date, brand, tier]);

  const toggle = async (row, field) => {
    if (readOnly) return;
    const next = { ...row, [field]: row[field] ? 0 : 1 };
    setD((p) => ({ ...p, rows: p.rows.map((r) => r.player_key === row.player_key ? next : r) }));   // optimistic
    try {
      await api("/api/rtn/login-check", { method: "POST", body: JSON.stringify({
        date: d.date, brand: d.brand, tier_segment: d.tier, player_key: row.player_key,
        login: next.login, deposited: next.deposited }) });
    } catch (e) {
      setErr(e.message);
      setD((p) => ({ ...p, rows: p.rows.map((r) => r.player_key === row.player_key ? row : r) }));   // revert
    }
  };

  const assign = async (player_key, ag) => {
    if (!manager || !ag) return;
    try {
      await api("/api/rtn/login-check/assign", { method: "POST",
        body: JSON.stringify({ brand: d.brand, tier_segment: d.tier, player_key, agent: ag }) });
      load();
    } catch (e) { setErr(e.message); }
  };

  const autoAssign = async () => {
    if (!manager) return;
    try {
      await api("/api/rtn/login-check/auto-assign", { method: "POST",
        body: JSON.stringify({ brand: d.brand, tier_segment: d.tier }) });
      load();
    } catch (e) { setErr(e.message); }
  };

  const exportCsv = () => {
    const cols = ["Player", "Player ID", "Agent", "Status", "Last deposit", "Login", "Deposit", "Deposit yesterday", "Filled by"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = (d.rows || []).map((r) => [pid(r), r.player_key, r.agent, r.group_name || "", r.last_deposit || "",
      r.login ? "Y" : "N", r.deposited ? "Y" : "N", r.prev_deposit ?? "", r.filled_by || ""].map(esc).join(","));
    const csv = "﻿" + cols.join(",") + "\n" + lines.join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `logincheck_${d.brand}_${agent || "all"}_${d.date}.csv`;
    a.click();
  };

  if (!d && busy) return <div className="bigmsg">Loading…</div>;
  if (err && !d) return <div className="bigmsg err">Could not load: {err}</div>;
  if (!d) return null;

  const rows = d.rows || [];
  const loggedIn = rows.filter((r) => r.login).length;
  const deposited = rows.filter((r) => r.deposited).length;
  // Chips come from the server, already scoped to the brand's own team (no cross-team
  // staff). Everyone sees every teammate's roster for leave cover; ownership is unchanged.
  const agentNames = (d.agents || []).map((a) => a.agent);
  const countFor = (ag) => (d.agents || []).find((a) => a.agent === ag)?.n ?? 0;
  const setUp = (d.agents || []).some((a) => a.n > 0);   // brand has any owners = it's live for Login Check
  const depCell = (row) => row.prev_deposit ? fmtRM(row.prev_deposit) : <span className="dim">—</span>;
  const lastDepCell = (row) => {
    if (!row.last_deposit) return <span className="dim">never</span>;
    const n = days(row.last_deposit, d.date);
    return <>{fmtDate(row.last_deposit)}{n != null ? <span className="dim"> · {n}d</span> : null}</>;
  };
  // Display handle: Zyra brands show the uid, others (TC, e.g. JOM99) show the username — same rule as the rest of the console.
  const pid = (row) => dispId({ brand, uid: row.uid, username: row.username }) || row.player_key;

  return (
    <div className="lc-wrap">
      <div className="lc-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Dropdown label="Brand" value={brand}
            items={teamBrands.map((b) => ({ key: b, label: b, dot: BRANDS[b]?.p }))}
            onPick={(it) => setBrand(it.key)} />
          <div className="seg">
            {["3", "V"].map((t) => (
              <button key={t} className={tier === t ? "on" : ""} onClick={() => setTier(t)}>Tier {t}</button>))}
          </div>
          <span className="dim" style={{ fontSize: 12 }}>check {d.date} · amount = yesterday's confirmed deposit</span>
        </div>
        <div className="lc-chips">
          <button className={"chip" + (agent === "" ? " on" : "")} onClick={() => setAgent("")}>All <span className="chip-n">{(d.agents || []).reduce((s, a) => s + a.n, 0)}</span></button>
          {agentNames.map((ag) => (
            <button key={ag} className={"chip" + (agent === ag ? " on" : "")} onClick={() => setAgent(ag)}
              style={agent === ag ? { borderColor: "var(--accent)", color: "var(--accent)" } : null}>
              {ag} <span className="chip-n">{countFor(ag)}</span></button>))}
        </div>
      </div>

      {readOnly && <div className="viewonly-banner">👁 View-only account — you can see the roster but can't tick.</div>}
      {setUp && <div className="lc-sum">
        <span>Players <b>{rows.length}</b></span>
        <span>Logged in <b>{loggedIn}</b></span>
        <span>Deposited <b>{deposited}</b></span>
        {err && <span style={{ color: "var(--neg)" }}>{err}</span>}
        <span style={{ marginLeft: "auto" }}>
          <button className="btn-ghost" onClick={exportCsv} disabled={!rows.length}>↓ CSV</button>
        </span>
      </div>}

      {!setUp ? (
        <div className="lc-empty">
          <div style={{ fontSize: 14, marginBottom: 6 }}><b>{brand} · Tier {tier}</b> not set up for Login Check yet.</div>
          {manager ? (<>
            <div className="dim" style={{ fontSize: 12, marginBottom: 12 }}>
              {(d.unassigned || []).length} Tier {tier} player{(d.unassigned || []).length === 1 ? "" : "s"} ready to deal evenly across {agentNames.length} agent{agentNames.length === 1 ? "" : "s"}.</div>
            <button className="btn-ghost" onClick={autoAssign} disabled={!(d.unassigned || []).length}>Set up — auto-assign evenly</button>
          </>) : (
            <div className="dim" style={{ fontSize: 12 }}>No roster assigned here yet. Your ATL sets it up.</div>
          )}
        </div>
      ) : (<>
      <div className="tbl-x"><table className="perf-tbl lc-tbl">
        <thead><tr>
          {(manager && agent === "") && <th>Agent</th>}
          <th>Player</th><th>Status</th><th>Last deposit</th>
          <th style={{ textAlign: "center" }}>Login</th>
          <th style={{ textAlign: "center" }}>Deposit</th>
          <th className="r">Deposit yesterday</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player_key}>
              {(manager && agent === "") && <td className="dim">{r.agent}</td>}
              <td className="mono">{pid(r)}{r.filled_by && r.filled_by !== r.agent
                ? <span className="dim" style={{ fontSize: 11 }}> · by {r.filled_by}</span> : null}</td>
              <td style={{ color: lcStatusColor(r.group_name) }}>{r.group_name || "—"}</td>
              <td className="mono" style={{ fontSize: 12 }}>{lastDepCell(r)}</td>
              <td style={{ textAlign: "center" }}><LcBox on={r.login} disabled={readOnly} onClick={() => toggle(r, "login")} /></td>
              <td style={{ textAlign: "center" }}><LcBox on={r.deposited} disabled={readOnly} onClick={() => toggle(r, "deposited")} /></td>
              <td className="r mono">{depCell(r)}</td>
            </tr>))}
          {rows.length === 0 && <tr><td colSpan={(manager && agent === "") ? 7 : 6} className="dim" style={{ padding: 20 }}>No players assigned{agent ? ` to ${agent}` : ""}.</td></tr>}
        </tbody>
      </table></div>

      {manager && (d.unassigned || []).length > 0 && (
        <div className="lc-unassigned">
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b style={{ color: "var(--warn)" }}>⚠ {d.unassigned.length} unassigned</b>
            <span className="dim" style={{ fontSize: 12 }}>New in the tier's latest roster, no owner. Auto-deals daily after the feed; deal now if you like.</span>
            <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={autoAssign}>Auto-assign evenly</button></div>
          <div className="tbl-x"><table className="perf-tbl lc-tbl">
            <thead><tr><th>Player</th><th>Status</th><th className="r">Deposit</th><th>Assign to</th></tr></thead>
            <tbody>
              {d.unassigned.map((u) => (
                <tr key={u.player_key}>
                  <td className="mono">{pid(u)}</td>
                  <td style={{ color: lcStatusColor(u.group_name) }}>{u.group_name || "—"}</td>
                  <td className="r mono">{u.ingest_deposit != null ? fmtRM(u.ingest_deposit) : "—"}</td>
                  <td><NativeSelect className="team-pick" defaultValue="" onChange={(e) => assign(u.player_key, e.target.value)}>
                    <option value="" disabled>Pick agent…</option>
                    {agentNames.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
                  </NativeSelect></td>
                </tr>))}
            </tbody>
          </table></div>
        </div>)}
      </>)}
    </div>
  );
}

/* Rollout flag for the revamped shell (docs/design/BUILD-CONTRACT.md section 8). OFF by default.
   ?revamp=1 turns it on and is remembered in localStorage.revamp_ui; ?revamp=0 turns it off. */
function readRevampFlag() {
  try {
    const q = new URLSearchParams(window.location.search).get("revamp");
    if (q === "1") localStorage.setItem("revamp_ui", "1");
    else if (q === "0") localStorage.removeItem("revamp_ui");
    return localStorage.getItem("revamp_ui") === "1";
  } catch (e) { return false; }
}

export default function App() {
  const [rv] = useState(readRevampFlag);                 // revamped shell on/off (fixed for the page's lifetime)
  const [rvTab, setRvTab] = useState(() => { try { return sessionStorage.getItem("rv_tab") || ""; } catch (e) { return ""; } });
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("dash");
  const [drill, setDrill] = useState(null); // KPI → Daily deep-link: { brand, tier }
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [dates, setDates] = useState([]);         // available snapshot dates, newest first
  const [viewDate, setViewDate] = useState(null); // null = latest/today (the only actionable day)
  const [viewTeam, setViewTeam] = useState(rv ? "A" : "B");  // revamp: everyone starts on their own team (Team A when they have none); managers can switch with the logo switcher, others are pinned
  const teamStart = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem("session_token");
    if (t) api("/api/me").then(setMe).catch(() => localStorage.removeItem("session_token"));
  }, []);

  async function loadBoard(date) {
    setLoading(true); setLoadErr("");
    try { setBoard(await api("/api/rtn/board" + (date ? `?date=${date}` : ""))); }
    catch (e) { setLoadErr(e.message); }
    setLoading(false);
  }
  useEffect(() => { if (me) api("/api/rtn/dates").then(setDates).catch(() => setDates([])); }, [me]);
  useEffect(() => { if (me) loadBoard(viewDate); }, [me, viewDate]);
  // Non-managers are pinned to their own team; managers may switch and default to B.
  useEffect(() => {
    if (!me) return;
    if (!rv) { if (!me.manage_users && me.team) setViewTeam(me.team); return; }          // flag off: unchanged behaviour
    const mine = TEAM_KEYS.includes(me.team) ? me.team : "A";
    if (!me.manage_users) setViewTeam(mine);                                           // pinned to their own team
    else if (teamStart.current !== me.username) { teamStart.current = me.username; setViewTeam(mine); }   // a manager starts there once, then may switch
  }, [me]);

  async function saveContact(payload) {
    await api("/api/rtn/contact", { method: "POST", body: JSON.stringify(payload) });
    setBoard((b) => {
      if (!b) return b;
      const others = b.contacts.filter((c) => !(c.snapshot_date === payload.snapshot_date &&
        c.player_key === payload.player_key && c.brand === payload.brand && c.tier_segment === payload.tier_segment));
      return { ...b, contacts: [...others, { ...payload, updated_at: new Date().toISOString().replace("T", " ").slice(0, 19) }] };
    });
  }

  async function clearContact(payload) {
    await api("/api/rtn/contact", { method: "POST", body: JSON.stringify({ ...payload, clear: true }) });
    setBoard((b) => {
      if (!b) return b;
      const others = b.contacts.filter((c) => !(c.snapshot_date === payload.snapshot_date &&
        c.player_key === payload.player_key && c.brand === payload.brand && c.tier_segment === payload.tier_segment));
      return { ...b, contacts: others };
    });
  }

  const data = useMemo(() => {
    if (!board?.snapshot_date) return [];
    const rows = classifyAll(board.rows, board.snapshot_date);
    const tg = {};
    (board.telegram || []).forEach((t) => (tg[`${t.player_key}|${t.brand}`] = t.url));
    const cool = {};
    (board.cooling || []).forEach((c) => (cool[ckey(c)] = c));   // smarter early-cooling (per-player baseline, from the server)
    const rct = {};
    (board.reactivation || []).forEach((c) => (rct[ckey(c)] = c));   // reactivation-likelihood for lapsed whales
    rows.forEach((r) => { r._tg = tg[`${r.player_key}|${r.brand}`] || null; r._tgrank = r._tg ? 1 : 0; r._cool2 = cool[ckey(r)] || null; r._react = rct[ckey(r)] || null; });
    return rows;
  }, [board]);

  // Team view: managers see all data but the logo switcher narrows it to one team's brands;
  // non-managers already only receive their team's rows from the server. teamData feeds every tab.
  const teamBrands = TEAMS[viewTeam] || BRAND_ORDER;
  const teamData = useMemo(() => {
    const tb = TEAMS[viewTeam] || BRAND_ORDER;
    return data.filter((r) => tb.includes(r.brand));
  }, [data, viewTeam]);

  // Bell notices — events & exceptions only (never standing metrics). Built from data already on hand.
  const notices = useMemo(() => {
    if (!board?.snapshot_date) return [];
    const out = [], snap = board.snapshot_date, health = board.health || [];
    const namesOf = (rows, fmtItem) => rows.slice(0, 4).map(fmtItem).join(", ") + (rows.length > 4 ? ` +${rows.length - 4} more` : "");
    const stale = health.filter((h) => h.last_fed && h.last_fed !== snap);
    const withDep = health.filter((h) => h.newest_dep);
    const lead = withDep.reduce((m, h) => (h.newest_dep > m ? h.newest_dep : m), "");
    stale.forEach((h) => out.push({ id: `stale-${h.brand}`, sev: "crit", icon: "🔴", text: `${h.brand} not fed today (last ${h.last_fed})`, tab: "queue" }));
    withDep.filter((h) => h.newest_dep < lead).forEach((h) => out.push({ id: `lag-${h.brand}`, sev: "crit", icon: "🔴", text: `${h.brand} deposits lag — only through ${h.newest_dep}`, tab: "queue" }));
    const coldW = data.filter((r) => r._whale && r._dsld === 7).sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));
    if (coldW.length) out.push({ id: "coldwhales", sev: "warn", icon: "❄", text: `${coldW.length} whale${coldW.length > 1 ? "s" : ""} just went cold (7 days)`, detail: namesOf(coldW, (r) => `${dispName(r)} (${r.brand})`), tab: "queue", keys: coldW.map(ckey), focusLabel: "cold whales (7d)" });
    const coolW = board.cooling || [];   // at-risk whales — breaking their own deposit rhythm, scored 0-100
    if (coolW.length) out.push({ id: "coolingwhales", sev: "warn", icon: "❄", text: `${coolW.length} whale${coolW.length > 1 ? "s" : ""} at churn-risk — act now`, detail: coolW.slice(0, 4).map((c) => `${c.player} (${c.brand}) risk ${c.risk}`).join(", ") + (coolW.length > 4 ? ` +${coolW.length - 4} more` : ""), tab: "queue", keys: coolW.map(ckey), focusLabel: "at-risk whales" });
    return out;
  }, [board, data]);

  const latestDate = dates[0]?.snapshot_date || null;
  const isPast = !!(board?.snapshot_date && latestDate && board.snapshot_date !== latestDate);
  const viewerRO = me ? !me.can_edit : false;   // view-only account → queue is read-only on today too
  const queueRO = isPast || viewerRO;

  if (!me) return (<><Style /><Login onLogin={setMe} /></>);

  if (rv) {
    const signOut = () => { api("/api/logout", { method: "POST" }).catch(() => {}); localStorage.removeItem("session_token"); setMe(null); };
    const goto = (key, params) => {
      setDrill(params && Object.keys(params).length ? params : null);   // e.g. goto("queue", { brand }) → Contact filtered to that brand
      setRvTab(key); try { sessionStorage.setItem("rv_tab", key); } catch (e) { /* private mode */ }
    };
    const ctx = {
      me, viewTeam, board, data, teamData, teamBrands, contacts: board?.contacts || [], dates, viewDate, setViewDate, isPast,
      readOnly: queueRO, saveContact, clearContact, loadBoard, drill, setDrill, goto,
      setViewTeam, teamKeys: TEAM_KEYS, team: board?.team || [], health: board?.health || [], snap: board?.snapshot_date || null, loading,
    };
    return (<><Style scope /><RevampShell ctx={ctx} tab={rvTab || (me.manage_users ? "dash" : "home")} notices={notices} loading={loading} loadErr={loadErr} onSignOut={signOut} /></>);
  }

  return (
    <>
      <Style />
      <div className="shell">
        <header className="top">
          <div className="top-brand"><span className="mark">♠</span>
            <div><div className="t1">{me?.manage_users
              ? <>TEAM <NativeSelect className="team-pick" value={viewTeam} onChange={(e) => setViewTeam(e.target.value)} title="Switch team view">{TEAM_KEYS.map((t) => <option key={t} value={t}>{t}</option>)}</NativeSelect> · VIP RTN</>
              : `TEAM ${me?.team || "B"} · VIP RTN`}</div><div className="t2">Daily action console</div></div></div>
          <nav className="tabs">
            <button className={tab === "dash" ? "on" : ""} onClick={() => setTab("dash")}>Dashboard</button>
            <button className={tab === "queue" ? "on" : ""} onClick={() => setTab("queue")}>Daily</button>
            <button className={tab === "delta" ? "on" : ""} onClick={() => setTab("delta")}>Changes</button>
            <button className={tab === "camp" ? "on" : ""} onClick={() => setTab("camp")}>Campaigns</button>
            <button className={tab === "perf" ? "on" : ""} onClick={() => setTab("perf")}>Performance</button>
            <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")}>Settings</button>
          </nav>
          <div className="top-right">
            <div className={"snap" + (isPast ? " past" : "")}>{board?.snapshot_date
              ? `${isPast ? "Viewing" : "Snapshot"} ${board.snapshot_date}${board.synced_at ? ` · ${mytClock(board.synced_at)} MYT` : ""}${isPast ? " · read-only" : ""}`
              : "No data yet"}</div>
            {board?.snapshot_date && <NotifBell notices={notices} snap={board.snapshot_date} onGo={(n) => { setDrill(n.keys ? { keys: n.keys, label: n.focusLabel } : null); setTab(n.tab); }} />}
            <button className="btn-ghost" onClick={() => loadBoard(viewDate)}>{loading ? "…" : "Refresh"}</button>
            <button className="btn-ghost" onClick={() => { api("/api/logout", { method: "POST" }).catch(() => {}); localStorage.removeItem("session_token"); setMe(null); }}>
              {me.username} · Sign out</button>
          </div>
        </header>
        <main>
          {loadErr && <div className="bigmsg err">Could not load data: {loadErr}</div>}
          {!loadErr && board && !board.snapshot_date && !loading && (
            <div className="bigmsg">No snapshots yet — run the sheet feeders (runFeedNow) and refresh.</div>)}
          {viewerRO && !isPast && (tab === "queue" || tab === "delta") && (
            <div className="viewonly-banner">👁 View-only account — you can see everything but can't edit the queue. Ask a manager for edit access.</div>)}
          {["dash", "queue", "delta", "perf"].includes(tab) && board?.snapshot_date && (
            <SnapshotPicker dates={dates} viewDate={viewDate} setViewDate={setViewDate} isPast={isPast} />)}
          {tab === "queue" && board?.snapshot_date && (
            <Queue data={teamData} brandOrder={teamBrands} snap={board.snapshot_date} me={me}
              team={board.team || []} viewTeam={viewTeam} contacts={board.contacts || []}
              health={board.health || []} onSaveContact={saveContact} onClearContact={clearContact}
              readOnly={queueRO} dates={dates} viewDate={viewDate} setViewDate={setViewDate}
              drill={drill} clearDrill={() => setDrill(null)} />)}
          {tab === "delta" && board?.snapshot_date && (
            <Delta data={teamData} brandOrder={teamBrands} snap={board.snapshot_date} dates={dates} contacts={board.contacts || []}
              me={me} team={board.team || []} viewTeam={viewTeam} onSaveContact={saveContact} onClearContact={clearContact}
              readOnly={queueRO} />)}
          {tab === "dash" && board?.snapshot_date && <Dashboard data={teamData} brandOrder={teamBrands} viewTeam={viewTeam} snap={board.snapshot_date} isPast={isPast}
            contacts={board.contacts || []} me={me} team={board.team || []} dates={dates}
            onSaveContact={saveContact} onClearContact={clearContact} readOnly={queueRO} />}
          {tab === "perf" && <Performance data={teamData} team={board?.team || []} me={me} viewTeam={viewTeam}
            contacts={board?.contacts || []} snap={board?.snapshot_date} onSaveContact={saveContact} onClearContact={clearContact} readOnly={queueRO}
            onDrill={(brand, tier) => { setDrill({ brand, tier }); setTab("queue"); }} />}
          {tab === "camp" && <Campaigns me={me} viewTeam={viewTeam} />}
          {tab === "settings" && <Settings me={me} viewTeam={viewTeam} />}
        </main>
        <footer className="foot">Phase-1 classification (snapshot signals) · sequence cards activate as daily history accumulates · PNL shown as player net (negative = player loss)</footer>
      </div>
    </>
  );
}

/* ════════════════════ CAMPAIGNS · VVIP REDEEM CODE ════════════════════
   Deliberately NOT team-scoped (matches the worker routes). Livechat hands
   any agent any brand, so anyone can look up and release a code. Creating,
   exporting, closing and the report stay managers-only.

   Split config — the twin of CODE_BANDS in worker/index.js. Amounts are NOT
   here: they differ per brand and are entered per event. Reverting to 4 bands
   (8/12/15/18 @ 40/30/20/10) means editing BOTH copies.                     */
export const CODE_BANDS = [
  { label: "A", share: 0.5 },
  { label: "B", share: 0.5 },
];

/* Rotation calendar — computed from the date, nothing stored.
   Three fixed day-pairs; teams shift one slot per week, so both peak days
   (Sun, Sat) rotate. Per 3-week cycle every team gets 6 days, 1 Saturday,
   1 Sunday, 4 Zyra Tier V days and 2 Zyra Tier 3 days. Friday is rest.
   Tier is NOT chosen — it falls out of the weekday.
   KEEP IN SYNC with the same block in worker/index.js.                     */
export const CAMPAIGN_ANCHOR = "2026-07-26";                 // a Sunday = rotation week 1
export const CAMPAIGN_SLOTS = [["Sun", "Wed"], ["Mon", "Thu"], ["Tue", "Sat"]];
export const CAMPAIGN_TEAMS = ["A", "B", "C"];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Hand-made July + August schedule (team per date). Neither month follows the clean
// rotation, so both are stored verbatim and win over the computed pattern. From
// September onward there is no override → falls through to the generated rotation. Tier
// stays computed (the Sun-Wed=V, Thu/Sat=3 rule held on every sheet row).
// KEEP IN SYNC with the copy in worker/index.js.
export const SCHEDULE_OVERRIDE = {
  "2026-07-01": "C", "2026-07-02": "A", "2026-07-04": "C", "2026-07-05": "B",
  "2026-07-06": "C", "2026-07-07": "A", "2026-07-08": "B", "2026-07-09": "C",
  "2026-07-11": "A", "2026-07-12": "C", "2026-07-13": "A", "2026-07-14": "B",
  "2026-07-15": "C", "2026-07-16": "A", "2026-07-18": "B", "2026-07-19": "A",
  "2026-07-20": "B", "2026-07-21": "C", "2026-07-22": "A", "2026-07-23": "B",
  "2026-07-25": "C", "2026-07-26": "B", "2026-07-27": "C", "2026-07-28": "A",
  "2026-07-29": "B", "2026-07-30": "C",
  // August — also hand-tuned (does not follow the clean rotation), per the planner sheet.
  "2026-08-01": "A", "2026-08-02": "B", "2026-08-03": "C", "2026-08-04": "A",
  "2026-08-05": "B", "2026-08-06": "C", "2026-08-08": "B", "2026-08-09": "A",
  "2026-08-10": "B", "2026-08-11": "C", "2026-08-12": "A", "2026-08-13": "B",
  "2026-08-15": "C", "2026-08-16": "B", "2026-08-17": "C", "2026-08-18": "A",
  "2026-08-19": "B", "2026-08-20": "C", "2026-08-22": "A", "2026-08-23": "C",
  "2026-08-24": "A", "2026-08-25": "B", "2026-08-26": "C", "2026-08-27": "A",
  "2026-08-29": "B", "2026-08-30": "A", "2026-08-31": "B",
};

export function campaignDay(iso) {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d)) return null;
  const day = DOW[d.getUTCDay()];
  if (day === "Fri") return { date: iso, day, rest: true };
  const zyra = (day === "Thu" || day === "Sat") ? "3" : "V";
  const base = { date: iso, day, rest: false, zyra, tc: zyra === "V" ? "3" : "V", peak: day === "Sat" || day === "Sun" };

  if (SCHEDULE_OVERRIDE[iso]) return { ...base, team: SCHEDULE_OVERRIDE[iso], source: "manual" };

  const anchor = new Date(CAMPAIGN_ANCHOR + "T00:00:00Z");
  const weeks = Math.floor((d - anchor) / (7 * 86400000));   // floor continues backwards too
  const w = ((weeks % 3) + 3) % 3;
  const slot = CAMPAIGN_SLOTS.findIndex((s) => s.includes(day));
  return { ...base, week: w + 1, slot, team: CAMPAIGN_TEAMS[(slot + w) % 3], source: "rotation" };
}
export const shiftDate = (iso, n) =>
  new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
// Next date this team is up — used by the strip when it isn't their day.
export function nextDayForTeam(fromIso, team) {
  for (let i = 1; i <= 21; i++) {
    const p = campaignDay(shiftDate(fromIso, i));
    if (p && !p.rest && p.team === team) return p;
  }
  return null;
}
// Fallback only, used before /campaign/day answers. The REAL eligibility test is
// uid coverage returned by the worker — the prov tag lies (OMG67 is tagged ZY but
// ships no uid), and BO's audience upload keys on user_id.
export const campaignBrands = (team) => (TEAMS[team] || []).filter((b) => BRANDS[b]?.prov === "ZY");

export const todayMYT = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
// Codes sit in the manager table in plain sight, so mask them: an agent must
// click Release (which records who + when) to get a usable code.
export const maskCode = (c) => (!c ? "—" : c.length <= 4 ? "••••" : c.slice(0, c.length - 4) + "••••");

/* Same markup + classes as the Daily pager, so it looks and behaves identically.
   The eligible pager drives BOTH columns at once: A and B are near-equal halves
   of one shuffle, so paging them together reads as one list, not two.
   Defined at module scope on purpose — declaring it inside Campaigns() made it a
   brand-new component type on every render, so React unmounted and remounted it
   and the "Show per page" select dropped focus mid-interaction. */
export function CampPager({ total, page, setPage, label, perPage, onSize }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * perPage;
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  if (total <= perPage && pages <= 1) {
    return <div className="pager"><span className="pager-info">{fmt(total)} {label}</span></div>;
  }
  return (
    <div className="pager">
      <label className="pager-size">Show per page
        <NativeSelect value={perPage} onChange={(e) => onSize(Number(e.target.value))}>
          {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          <option value={100000}>All</option>
        </NativeSelect>
      </label>
      <span className="pager-info">Showing {total ? start + 1 : 0}–{Math.min(start + perPage, total)} of {fmt(total)} {label}</span>
      <div className="pager-nav">
        <button disabled={cur <= 1} onClick={() => setPage(1)} title="First">«</button>
        <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} title="Previous">‹</button>
        {nums.map((n, i) => n === "…"
          ? <span key={"g" + i} className="pager-gap">…</span>
          : <button key={n} className={n === cur ? "on" : ""} onClick={() => setPage(n)}>{n}</button>)}
        <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} title="Next">›</button>
        <button disabled={cur >= pages} onClick={() => setPage(pages)} title="Last">»</button>
      </div>
    </div>
  );
}

export function Campaigns({ me, viewTeam }) {
  const isMgr = !!me?.manage_users;
  const canEdit = !!me?.can_edit || isMgr;
  // Managers switch teams in the header; agents are pinned to their own team.
  // Only the MANAGER-side views (event list + create form) narrow to this team —
  // find/release stay global on purpose, because Livechat hands any agent any brand.
  const team = (isMgr ? viewTeam : me?.team) || "B";
  const [day, setDay] = useState(todayMYT());
  const [events, setEvents] = useState([]);
  const [bands, setBands] = useState([]);          // the 2 BO codes per event
  const [brandStats, setBrandStats] = useState([]); // this team's brands + uid coverage
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [modal, setModal] = useState(null);        // assignment awaiting release confirmation
  const [openEvent, setOpenEvent] = useState(null);
  const [bandEdit, setBandEdit] = useState(null);   // { event, A:{code,amount}, B:{...} }
  const [perPage, setPerPage] = useState(20);       // shared by both tables (same control as Daily)
  const [pgEl, setPgEl] = useState(1);              // eligible page — pages A and B together
  const [pgCl, setPgCl] = useState(1);              // claimed page
  const dismissed = useRef(false);                  // user clicked Close — don't auto-reopen
  const [showWeek, setShowWeek] = useState(false);  // 7-day grid stays collapsed by default
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  // Starts empty and is filled once the eligible-brand list arrives (see the
  // effect below) — it can't be seeded here because eligibleBrands is derived
  // from state declared further down.
  const [newEv, setNewEv] = useState({ brand: "", tier: "3", A: { code: "", amount: "" }, B: { code: "", amount: "" } });
  // Clear the manager's panels when the team switches — an open table or code
  // editor from the previous team would otherwise sit over the new team's list.
  useEffect(() => {
    dismissed.current = false;   // a new team gets its default table back
    setOpenEvent(null); setBandEdit(null); setReport(null);
  }, [team]);

  const loadDay = async (d = day, t = team) => {
    try {
      const r = await api(`/api/rtn/campaign/day?date=${d}&team=${t}`);
      const evs = r.events || [];
      setEvents(evs); setBands(r.bands || []); setBrandStats(r.brands || []);
      // Drop editors/tables whose event no longer exists (deleted, or the date
      // changed underneath them) — otherwise a stale panel keeps showing the
      // wrong brand and tier over a list that has moved on.
      setBandEdit((be) => (be && evs.some((e) => e.id === be.event.id) ? be : null));
      // Open a table by default rather than making everyone click Players first.
      // Prefers a live (exported) event over a draft, because that's the one being
      // worked; keeps whatever was already open so a refresh doesn't move you.
      const mine = evs.filter((e) => (TEAMS[team] || []).includes(e.brand));
      setOpenEvent((oe) => {
        const still = oe && mine.find((e) => e.id === oe.id);
        if (still) return still;
        // Respect an explicit Close — loadDay runs after every release and export,
        // so without this the panel would spring back open and Close would look broken.
        if (dismissed.current) return null;
        return mine.find((e) => e.status === "exported") || mine[0] || null;
      });
    } catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  useEffect(() => { loadDay(day, team); /* eslint-disable-next-line */ }, [day, team]);

  // A brand can run a campaign if it has AT LEAST ONE player with a uid. Players
  // without a uid are simply skipped from the pool (the worker excludes them), so
  // a partial-coverage brand still runs for the rest. Falls back to the prov tag
  // until the first load answers.
  const eligibleBrands = brandStats.length
    ? brandStats.filter((b) => b.with_uid > 0).map((b) => b.brand)
    : campaignBrands(team);
  // Only flag the SURPRISING exclusions: a brand tagged Zyra that ships NO uid at
  // all (OMG67 today), so it can't run even for a subset. Partial-coverage brands
  // are no longer blocked — they run for their uid'd players. TC brands are
  // excluded by design and stay unlisted as noise.
  const blockedBrands = brandStats.filter(
    (b) => b.pool > 0 && b.with_uid === 0 && BRANDS[b.brand]?.prov === "ZY");

  // The rotation decides team + tier for the viewed date. Nothing stored.
  const plan = campaignDay(day);
  const nextMine = plan && !plan.rest && plan.team !== team ? nextDayForTeam(day, team) : null;
  // Tier follows the calendar rather than being picked — one less thing to get
  // wrong, and it can't disagree with what the teams were told to run.
  useEffect(() => {
    if (plan && !plan.rest) setNewEv((n) => (n.tier === plan.zyra ? n : { ...n, tier: plan.zyra }));
    /* eslint-disable-next-line */
  }, [day]);
  // Keep the <select> pointing at a brand that is actually in its own options —
  // otherwise "Shuffle & assign" fires on a brand the manager can no longer see.
  useEffect(() => {
    setNewEv((n) => (eligibleBrands.includes(n.brand) ? n : { ...n, brand: eligibleBrands[0] || "" }));
    /* eslint-disable-next-line */
  }, [eligibleBrands.join(",")]);

  const bandsOf = (id) => bands.filter((b) => b.event_id === id).sort((a, b) => a.label.localeCompare(b.label));

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true); setMsg(null);
    try { const r = await api(`/api/rtn/campaign/find?q=${encodeURIComponent(q.trim())}&date=${day}`); setHits(r.hits || []); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
    finally { setBusy(false); }
  };

  const doRelease = async (channel) => {
    setBusy(true);
    try {
      const r = await api("/api/rtn/campaign/release", {
        method: "POST", body: JSON.stringify({ assignment_id: modal.id, channel }),
      });
      setModal({ ...modal, released: r });
      setMsg({ t: `Released ${r.label} · ${r.code}` });
      search(); loadDay(day);
      if (openEvent) openTables(openEvent, "all");
    } catch (e) { setMsg({ bad: true, t: e.message }); setModal(null); }
    finally { setBusy(false); }
  };

  const doBlock = async (id) => {
    setBusy(true);
    try { await api("/api/rtn/campaign/block", { method: "POST", body: JSON.stringify({ assignment_id: id }) });
      setMsg({ t: "Recorded as not qualified — the code is still theirs if they top up." }); search(); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
    finally { setBusy(false); }
  };

  const createEvent = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/api/rtn/campaign/event", {
        method: "POST",
        body: JSON.stringify({ event_date: day, brand: newEv.brand, tier_segment: newEv.tier,
          bands: [{ label: "A", code: newEv.A.code, amount: newEv.A.amount },
                  { label: "B", code: newEv.B.code, amount: newEv.B.amount }] }),
      });
      setMsg({ t: `${newEv.brand} Tier ${newEv.tier}: ${r.pool_size} players split ${r.counts.join(" / ")} (from the ${r.snapshot} snapshot)` });
      loadDay(day);
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    finally { setBusy(false); }
  };

  // Downloads BO's exact upload shape: one column, header user_id, UID as stored.
  const exportCsv = async (ev, label) => {
    setBusy(true); setMsg(null);
    try {
      const r = await api(`/api/rtn/campaign/export?event_id=${ev.id}&label=${label}`);
      const csv = "user_id\n" + r.uids.join("\n") + "\n";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `${ev.brand}_TIER${ev.tier_segment}_${ev.event_date}_${label}.csv`;
      a.click(); URL.revokeObjectURL(a.href);
      setMsg({ t: `${r.uids.length} UIDs exported for ${r.band?.code || label}${r.locked_now ? " — event is now LOCKED" : ""}` });
      loadDay(day);
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    finally { setBusy(false); }
  };

  // Follow-up audience: players who have NOT claimed yet, for re-blasting through
  // IM so they come back and claim. Read-only, never locks — pull it as often as
  // you like through the day; the list shrinks as claims come in.
  const exportUnclaimed = async (ev) => {
    setBusy(true); setMsg(null);
    try {
      const r = await api(`/api/rtn/campaign/unclaimed?event_id=${ev.id}`);
      if (!r.uids.length) { setMsg({ t: `${ev.brand}: everyone has claimed — nothing to follow up.` }); return; }
      const csv = "user_id\n" + r.uids.join("\n") + "\n";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `${ev.brand}_TIER${ev.tier_segment}_${ev.event_date}_UNCLAIMED.csv`;
      a.click(); URL.revokeObjectURL(a.href);
      setMsg({ t: `${r.uids.length} unclaimed ${ev.brand} UIDs exported — blast to bring them back.` });
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    finally { setBusy(false); }
  };

  // Codes can be filled in (or corrected) any time before export. After export
  // BO holds the lists, so the worker refuses — the form isn't rendered either.
  const saveBands = async (ev, edit) => {
    setBusy(true); setMsg(null);
    try {
      await api("/api/rtn/campaign/bands", {
        method: "POST",
        body: JSON.stringify({ event_id: ev.id,
          bands: CODE_BANDS.map((c) => ({ label: c.label, code: edit[c.label].code, amount: edit[c.label].amount })) }),
      });
      setMsg({ t: "Codes saved." });
      await loadDay(day);
      setBandEdit(null);
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    finally { setBusy(false); }
  };

  // Runs the same function the 00:00 cron calls, so testing it here proves the
  // real job. dry=1 reports what it would build without writing anything.
  const runAutoCreate = async (dry) => {
    if (!dry && !window.confirm("Create today's draft events now?\n\nThis writes real events for the scheduled team. Codes stay empty and nothing is exported.")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api(`/api/rtn/campaign/auto-create${dry ? "?dry=1" : ""}`, { method: "POST" });
      if (r.skipped === "rest day") { setMsg({ t: `${r.date} is a rest day — nothing to create.` }); return; }
      const made = dry ? r.would : r.created;
      setMsg({
        t: `${dry ? "Would create" : "Created"} ${made.length} event(s) · Team ${r.team} · Tier ${r.tier}` +
           (made.length ? ` — ${made.join(", ")}` : "") +
           (r.skipped?.length ? ` · skipped ${r.skipped.join(", ")}` : ""),
      });
      if (!dry) loadDay(day, team);
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    finally { setBusy(false); }
  };

  const openTables = (ev) => { dismissed.current = false; setOpenEvent(ev); setReport(null); };
  const closeTables = () => { dismissed.current = true; setOpenEvent(null); };
  // Rows follow whichever event is open — including the one auto-opened by
  // loadDay when there's only a single event for the day.
  useEffect(() => {
    if (!openEvent || !isMgr) { setRows([]); return; }
    let dead = false;
    api(`/api/rtn/campaign/assignments?event_id=${openEvent.id}&view=all`)
      .then((r) => { if (!dead) { setRows(r.rows || []); setPgEl(1); setPgCl(1); } })
      .catch((e) => { if (!dead) setMsg({ bad: true, t: e.message }); });
    return () => { dead = true; };
    /* eslint-disable-next-line */
  }, [openEvent?.id, isMgr]);
  const loadReport = async () => {
    setOpenEvent(null);
    try { setReport(await api(`/api/rtn/campaign/report?date=${day}&team=${team}`)); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  const closeEvent = async (ev) => {
    try { await api("/api/rtn/campaign/close", { method: "POST", body: JSON.stringify({ event_id: ev.id }) }); loadDay(day); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  // Only ever offered on a draft — an exported event is locked forever, so the
  // button is not rendered at all rather than rendered and rejected.
  // Allowed on any event with ZERO claims — the line is claims, not status. A
  // released code is real history and the worker refuses to delete it; a
  // mis-click that never reached a player is safe to erase.
  const deleteEvent = async (ev) => {
    const warn = ev.status === "draft"
      ? `Delete the DRAFT ${ev.brand} Tier ${ev.tier_segment} event?\n\nThe pool and both code lists are thrown away. You can then create it again with different codes.`
      : `Delete this ${ev.status.toUpperCase()} ${ev.brand} Tier ${ev.tier_segment} event?\n\nNobody has claimed a code, so nothing is lost on our side.\n\nBUT: if you already uploaded these UID lists to BO, remove them there too — otherwise BO is holding an audience the console no longer knows about.`;
    if (!window.confirm(warn)) return;
    try {
      const r = await api("/api/rtn/campaign/delete", { method: "POST", body: JSON.stringify({ event_id: ev.id }) });
      setMsg({ t: `Deleted — ${r.assignments_removed} assignments removed. You can recreate this brand + tier now.` });
      if (openEvent?.id === ev.id) setOpenEvent(null);
      loadDay(day);
    } catch (e) { setMsg({ bad: true, t: e.message }); }
  };

  // Manager views narrow to the team in the header. Filtered on the team's FULL
  // brand list (not just Zyra) so an event on any of its brands stays visible.
  const teamEvents = events.filter((e) => (TEAMS[team] || []).includes(e.brand));
  const eligible = rows.filter((r) => !r.claimed);
  const claimed = rows.filter((r) => r.claimed);

  const slice = (arr, page) => arr.slice((page - 1) * perPage, (page - 1) * perPage + perPage);
  const maxEligible = Math.max(...CODE_BANDS.map((c) => eligible.filter((r) => r.label === c.label).length), 0);

  return (
    <div className="camp">
      <div className="camp-head">
        <div>
          <div className="camp-t1">VVIP Redeem Code</div>
          <div className="camp-t2">Deposit RM100+ on the event day · 1 code per player · Zyra brands</div>
        </div>
        <div className="camp-daybar">
          <input type="date" className="crm-date" value={day} onChange={(e) => setDay(e.target.value || todayMYT())} />
          {day !== todayMYT() && <span className="camp-warn">Not today — codes can only be released on their own date</span>}
        </div>
      </div>

      {/* Rotation strip — one line. The 7-day view is behind a click so the
          calendar never takes over the page. */}
      {plan && (
        <div className={"camp-strip" + (plan.rest ? " rest" : plan.team === team ? " mine" : "")}>
          <span className="camp-strip-date">{plan.day} {day.slice(8)}/{day.slice(5, 7)}</span>
          {plan.rest ? (
            <>
              <span className="camp-tag warn">REST DAY</span>
              <span className="dim">No campaigns on Fridays</span>
            </>
          ) : (
            <>
              <span className={"camp-strip-team" + (plan.team === team ? " on" : "")}>TEAM {plan.team}</span>
              <span className="camp-strip-tier">Zyra <b>Tier {plan.zyra}</b></span>
              <span className="dim camp-strip-tc">TC Tier {plan.tc}</span>
              {plan.peak && <span className="camp-tag done">★ PEAK</span>}
              {plan.team !== team && <span className="camp-strip-not">not Team {team}</span>}
            </>
          )}
          <span className="camp-strip-right">
            {plan.team !== team && nextMine && (
              <button className="camp-link" onClick={() => setDay(nextMine.date)}>
                your next: {nextMine.day} {nextMine.date.slice(8)}/{nextMine.date.slice(5, 7)} ›
              </button>)}
            <button className="camp-link" onClick={() => setShowWeek((s) => !s)}>{showWeek ? "hide week" : "week"}</button>
          </span>
        </div>
      )}
      {showWeek && (
        <div className="camp-week">
          {Array.from({ length: 7 }, (_, i) => {
            const iso = shiftDate(day, i);
            const p = campaignDay(iso);
            const isMine = p && !p.rest && p.team === team;
            return (
              <button key={iso} className={"camp-wday" + (iso === day ? " cur" : "") + (isMine ? " mine" : "") + (p?.rest ? " rest" : "")}
                onClick={() => setDay(iso)}>
                <div className="camp-wd">{p?.day} {iso.slice(8)}</div>
                <div className="camp-wt">{p?.rest ? "—" : p.team}</div>
                <div className="camp-wtier">{p?.rest ? "rest" : `Tier ${p.zyra}`}</div>
              </button>
            );
          })}
        </div>
      )}

      {msg && <div className={"camp-msg" + (msg.bad ? " bad" : "")}>{msg.t}</div>}

      {/* ── Serve a player: the Livechat path. Every agent, any brand. ── */}
      <div className="camp-card">
        <div className="dsec" style={{ marginTop: 0 }}>Find a player</div>
        <div className="camp-search">
          <input className="wf-note" style={{ minHeight: 0, height: 38 }} placeholder="UID or username…"
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button className="btn-gold" onClick={search} disabled={busy}>{busy ? "…" : "Find"}</button>
        </div>

        {hits && hits.length === 0 && (
          <div className="camp-none">Not in any {day} pool — there's no code for this player. Nothing to give.</div>)}

        {(hits || []).map((h) => (
          <div key={h.id} className={"camp-hit" + (h.claimed ? " done" : "")}>
            <div className="camp-hit-main">
              <div className="camp-hit-id mono">{h.uid}</div>
              <div className="camp-hit-sub">{h.username} · {h.brand} · Tier {h.tier_segment}</div>
            </div>
            {h.claimed ? (
              <div className="camp-hit-act">
                {h.contacted_before === 0 && <span className="camp-tag bad">no prior contact</span>}
                <span className="camp-tag done">Released {mytClock(h.claimed_at)}</span>
                <span className="camp-hit-sub">by {h.claimed_by} · {h.channel}</span>
                <span className="mono camp-code">{h.code}</span>
              </div>
            ) : h.status !== "exported" ? (
              <span className="camp-tag warn">Event not exported yet</span>
            ) : !canEdit ? (
              <span className="camp-tag">View-only account</span>
            ) : (
              <div className="camp-hit-act">
                <span className="camp-tag">Code {h.label}</span>
                {!h.contacted && <span className="camp-tag warn">not contacted yet</span>}
                <button className="btn-gold" onClick={() => setModal(h)}>Release</button>
                <button className="btn-ghost" onClick={() => doBlock(h.id)}>Not qualified</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Managers: run the events ── */}
      {isMgr && (
        <>
          <div className="camp-card">
            <div className="camp-row-head">
              <div className="dsec" style={{ margin: 0 }}>Events · Team {team} · {day}</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button className="btn-ghost" onClick={() => runAutoCreate(true)} disabled={busy}
                  title="Show what the 00:00 job would create. Writes nothing.">Preview auto-create</button>
                <button className="btn-ghost" onClick={() => runAutoCreate(false)} disabled={busy}
                  title="Run the 00:00 job now">Run auto-create</button>
                <button className="btn-ghost" onClick={loadReport}>Report</button>
              </div>
            </div>
            {teamEvents.length === 0 && (
              <div className="camp-none">
                No Team {team} events for this date.
                {events.length > 0 && ` (${events.length} event${events.length > 1 ? "s" : ""} on other teams — switch team in the header to see them.)`}
              </div>)}
            {bandEdit && (
              <div className="camp-bandedit">
                <span className="dim">{bandEdit.event.brand} Tier {bandEdit.event.tier_segment} — enter the BO codes</span>
                {CODE_BANDS.map((c) => (
                  <span key={c.label} className="camp-newband">
                    <b>{c.label}</b>
                    <input placeholder={`BO code ${c.label}`} value={bandEdit[c.label].code}
                      onChange={(e) => setBandEdit({ ...bandEdit, [c.label]: { ...bandEdit[c.label], code: e.target.value } })} />
                    <input placeholder="RM" style={{ width: 70 }} value={bandEdit[c.label].amount}
                      onChange={(e) => setBandEdit({ ...bandEdit, [c.label]: { ...bandEdit[c.label], amount: e.target.value } })} />
                  </span>))}
                <button className="btn-gold" disabled={busy} onClick={() => saveBands(bandEdit.event, bandEdit)}>Save</button>
                <button className="btn-ghost" onClick={() => setBandEdit(null)}>Cancel</button>
              </div>
            )}
            {teamEvents.map((ev) => {
              const bs = bandsOf(ev.id);
              return (
                <div key={ev.id} className="camp-ev">
                  <div className="camp-ev-l">
                    <span className="b-dot" style={{ background: BRANDS[ev.brand]?.p }} />
                    <b>{ev.brand}</b> <span className="dim">Tier {ev.tier_segment}</span>
                    <span className={"camp-tag " + (ev.status === "draft" ? "warn" : ev.status === "closed" ? "" : "done")}>
                      {ev.status === "exported" ? "🔒 exported" : ev.status}</span>
                  </div>
                  <div className="camp-ev-m">
                    {bs.map((b) => (
                      <span key={b.label} className="camp-band">
                        <b>{b.label}</b> <span className="mono">{b.code || "no code"}</span> · RM{b.amount} · {b.assigned}
                      </span>
                    ))}
                  </div>
                  <div className="camp-ev-r">
                    <span className="dim">{ev.claimed}/{ev.assigned} claimed</span>
                    <button className="btn-ghost" onClick={() => openTables(ev)}>Players</button>
                    {bs.map((b) => (
                      <button key={b.label} className="btn-ghost" onClick={() => exportCsv(ev, b.label)}>CSV {b.label}</button>))}
                    {ev.status === "exported" && ev.assigned - ev.claimed > 0 && (
                      <button className="btn-ghost" title="UIDs of players who haven't claimed — export to blast a follow-up"
                        onClick={() => exportUnclaimed(ev)}>Unclaimed ({ev.assigned - ev.claimed})</button>)}
                    {ev.status === "exported" && <button className="btn-ghost" onClick={() => closeEvent(ev)}>Close</button>}
                    {ev.claimed === 0 && (
                      <button className="btn-ghost danger" onClick={() => deleteEvent(ev)}
                        title={ev.status === "draft" ? "Delete this draft" : "Nobody claimed — safe to delete"}>Delete</button>)}
                    {ev.status === "draft" && (
                      <button className="btn-ghost" onClick={() => setBandEdit({
                        event: ev,
                        ...Object.fromEntries(CODE_BANDS.map((c) => {
                          const b = bs.find((x) => x.label === c.label);
                          return [c.label, { code: b?.code || "", amount: b?.amount || "" }];
                        })),
                      })}>Codes</button>)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="camp-card">
            <div className="dsec" style={{ marginTop: 0 }}>New event</div>
            <div className="camp-new">
              <NativeSelect value={newEv.brand} onChange={(e) => setNewEv({ ...newEv, brand: e.target.value })}>
                {eligibleBrands.map((b) => <option key={b}>{b}</option>)}</NativeSelect>
              <span className="camp-tierlock" title="Set by the rotation calendar for this date">
                Tier {newEv.tier} <span className="dim">🔒</span></span>
              {CODE_BANDS.map((cfg) => (
                <span key={cfg.label} className="camp-newband">
                  <b>{cfg.label}</b>
                  <input placeholder={`BO code ${cfg.label}`} value={newEv[cfg.label].code}
                    onChange={(e) => setNewEv({ ...newEv, [cfg.label]: { ...newEv[cfg.label], code: e.target.value } })} />
                  <input placeholder="RM" style={{ width: 70 }} value={newEv[cfg.label].amount}
                    onChange={(e) => setNewEv({ ...newEv, [cfg.label]: { ...newEv[cfg.label], amount: e.target.value } })} />
                </span>
              ))}
              <button className="btn-gold" onClick={createEvent} disabled={busy}>Shuffle &amp; assign</button>
            </div>
            <div className="camp-note">
              Pool is the whole tier from the latest snapshot. The shuffle runs on the server and can't be repeated
              once exported — so enter the real BO codes before you download.
              {blockedBrands.length > 0 && (
                <> <br />Not listed: <b>{blockedBrands.map((b) => b.brand).join(", ")}</b> — no UID on file, and BO's
                audience upload needs one. Nothing to do here; it has to be fixed in the feed.</>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Manager tables: eligible highlighted, claimed dimmed ── */}
      {isMgr && openEvent && (
        <div className="camp-card">
          <div className="camp-row-head">
            <div className="dsec" style={{ margin: 0 }}>{openEvent.brand} Tier {openEvent.tier_segment} · players</div>
            <button className="btn-ghost" onClick={closeTables}>Close</button>
          </div>

          {/* A and B side by side: halves the page height, and the two lists are
              never compared row-to-row anyway — you read one or the other. Each
              column scrolls inside itself so a 895-player JK32 pool doesn't turn
              the page into a mile of scrolling. */}
          <div className="camp-split">
            {CODE_BANDS.map((cfg) => {
              const band = bandsOf(openEvent.id).find((b) => b.label === cfg.label);
              const list = eligible.filter((r) => r.label === cfg.label);
              return (
                <div className="camp-col" key={cfg.label}>
                  <div className="camp-col-head">
                    <span className="camp-col-t">Code {cfg.label}</span>
                    {band?.code
                      ? <span className="mono camp-code">{band.code}</span>
                      : <span className="camp-tag warn">no code set</span>}
                    <span className="dim">RM{band?.amount ?? 0}</span>
                    <span className="camp-col-n">{list.length} waiting</span>
                  </div>
                  <div className="camp-col-scroll">
                    <div className="tbl-x"><table className="perf-tbl camp-tbl">
                      <thead><tr><th>UID</th><th>Username</th><th></th></tr></thead>
                      <tbody>
                        {slice(list, pgEl).map((r) => (
                          <tr key={r.id} className="camp-live">
                            <td className="mono">{r.uid}</td>
                            <td className="dim">{r.username}</td>
                            <td style={{ textAlign: "right" }}>
                              {r.blocked_at && <span className="camp-tag bad">not qualified</span>}
                            </td>
                          </tr>))}
                        {list.length === 0 && <tr><td colSpan={3} className="dim">Nobody waiting.</td></tr>}
                      </tbody>
                    </table></div>
                  </div>
                </div>
              );
            })}
          </div>
          <CampPager total={maxEligible} page={pgEl} setPage={setPgEl} label="per code"
            perPage={perPage} onSize={(n) => { setPerPage(n); setPgEl(1); setPgCl(1); }} />

          <div className="camp-sub">Claimed — {claimed.length}</div>
          <div className="ptbl-scroll">
            <div className="tbl-x"><table className="perf-tbl camp-tbl dimmed">
              <thead><tr><th>UID</th><th>Username</th><th>Code</th><th>Time</th><th>By</th><th>Via</th></tr></thead>
              <tbody>
                {slice(claimed, pgCl).map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.uid}</td><td className="dim">{r.username}</td>
                    <td className="mono">{r.code}</td><td className="dim">{mytClock(r.claimed_at)}</td>
                    <td>{r.claimed_by}</td><td className="dim">{r.channel}</td>
                  </tr>))}
                {claimed.length === 0 && <tr><td colSpan={6} className="dim">Nobody yet.</td></tr>}
              </tbody>
            </table></div>
          </div>
          {claimed.length > 0 && <CampPager total={claimed.length} page={pgCl} setPage={setPgCl} label="claimed"
            perPage={perPage} onSize={(n) => { setPerPage(n); setPgEl(1); setPgCl(1); }} />}
        </div>
      )}

      {/* ── Report ── */}
      {isMgr && report && (
        <div className="camp-card">
          <div className="camp-row-head">
            <div className="dsec" style={{ margin: 0 }}>Report · {report.event_date}</div>
            <button className="btn-ghost" onClick={() => setReport(null)}>Close</button>
          </div>
          <div className="ptbl-scroll">
            <div className="tbl-x"><table className="perf-tbl camp-tbl">
              <thead><tr><th>Brand</th><th>Tier</th><th>Pool</th><th>Claimed</th><th>Rate</th><th>Cost</th><th>Not qualified</th><th title="Codes released with no contact logged first — these deposits can't be credited to the team">No contact</th></tr></thead>
              <tbody>
                {(report.by_brand || []).map((r) => (
                  <tr key={r.brand + r.tier_segment}>
                    <td><span className="b-dot" style={{ background: BRANDS[r.brand]?.p }} />{r.brand}</td>
                    <td>{r.tier_segment}</td><td>{fmt(r.assigned)}</td><td>{fmt(r.claimed)}</td>
                    <td>{r.assigned ? ((r.claimed / r.assigned) * 100).toFixed(1) + "%" : "—"}</td>
                    <td>{fmtRM(r.cost)}</td><td className="dim">{fmt(r.blocked)}</td>
                    <td className={r.no_contact > 0 ? "neg" : "dim"}>{fmt(r.no_contact)}</td>
                  </tr>))}
              </tbody>
            </table></div>
          </div>
          <div className="camp-sub">Code A vs B</div>
          <div className="ptbl-scroll">
            <div className="tbl-x"><table className="perf-tbl camp-tbl">
              <thead><tr><th>Code</th><th>Value</th><th>Assigned</th><th>Claimed</th><th>Rate</th></tr></thead>
              <tbody>
                {(report.by_code || []).map((r) => (
                  <tr key={r.label}>
                    <td><b>{r.label}</b></td><td>RM{r.amount}</td><td>{fmt(r.assigned)}</td><td>{fmt(r.claimed)}</td>
                    <td>{r.assigned ? ((r.claimed / r.assigned) * 100).toFixed(1) + "%" : "—"}</td>
                  </tr>))}
              </tbody>
            </table></div>
          </div>
          <div className="camp-sub">Released by</div>
          <div className="camp-agents">
            {(report.by_agent || []).map((a) => (
              <span key={a.agent} className="camp-band"><b>{a.agent || "—"}</b> · {a.released}</span>))}
            {(report.by_agent || []).length === 0 && <span className="dim">No releases yet.</span>}
          </div>
        </div>
      )}

      {/* ── Release confirmation — the guard against a mis-click ── */}
      {modal && (
        <>
          <div className="drawer-veil" onClick={() => setModal(null)} />
          <div className="camp-modal">
            {!modal.released ? (
              <>
                <div className="camp-modal-t">Release this code?</div>
                <div className="camp-modal-s">Once released it can't be undone.</div>
                <div className="camp-modal-box">
                  <div className="camp-hit-sub">{modal.uid} · {modal.username} · {modal.brand}</div>
                  <div className="camp-modal-code mono">{maskCode(modal.code)}</div>
                  <div className="camp-hit-sub">Code {modal.label} · RM{modal.amount}</div>
                </div>
                {!modal.contacted && (
                  <div className="camp-nocontact">
                    <b>⚠ No contact logged for this player today.</b><br />
                    The campaign is built on reaching out <i>first</i> — a code released cold still counts
                    as cost, but the deposit can't be credited to us. Release it if they qualify, then log
                    the contact in Daily.
                  </div>)}
                <div className="camp-modal-s">Confirm their deposits today total <b>RM100 or more</b>, then pick where they contacted you.</div>
                <div className="camp-modal-btns">
                  <button className="btn-gold" disabled={busy} onClick={() => doRelease("telegram")}>Release via Telegram</button>
                  <button className="btn-gold" disabled={busy} onClick={() => doRelease("livechat")}>Release via Livechat</button>
                </div>
                <button className="btn-ghost camp-modal-cancel" onClick={() => setModal(null)}>Cancel</button>
              </>
            ) : (
              <>
                <div className="camp-modal-t">Released</div>
                <div className="camp-modal-box">
                  <div className="camp-modal-code mono gold">{modal.released.code}</div>
                  <div className="camp-hit-sub">Code {modal.released.label} · RM{modal.released.amount} credit</div>
                </div>
                <div className="camp-modal-btns">
                  <button className="btn-gold" onClick={() => copyText(modal.released.code)}>Copy code</button>
                  <button className="btn-ghost" onClick={() => setModal(null)}>Done</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════ STYLES ════════════════════════ */
export function Style({ scope = false } = {}) {   // scope: revamp shell on → live CSS applies only inside .rv-live
  const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root{--bg:#0B0E13;--panel:#12161E;--panel2:#171C26;--line:#232A37;--txt:#E7EAF0;--dim:#8B94A7;--gold:#D4AF37;--neg:#F2727F;--pos:#4CC38A;
  --top-hi:#10141C;--login-hi:#141A26;--line-soft:#1B2130;--hover:#161C28;--hover-2:#1B2230;--line-hover:#2A3344;--line-strong:#3A4356;--line-zone:#2B3342;--off:#39414F;--faint:#4A5366;--mute:#5F6B7E;--slate:#94A3B8;--zone-c-line:#6F6A52;--on-accent:#FFF;--gold-line-2:#5A4A1E;--amber:#FCD34D;--amber-bg:#2A1F07;--amber-line:#7C5A12;--on-amber:#2A1907;--lc-line:#4A3D12;--lc-bg:#241D06;--warn:#FBBF24;--amber-deep:#F59E0B;--stale:#FDBA74;--stale-line:#7C2D12;--stale-bg:#2A1206;--hook-warn:#FCD9A8;--hook-warn-bg:#2A1A0B;--hook-warn-line:#7C4A12;--hook-warn-bg-hi:#33200D;--hook-warn-line-hi:#9A5F1A;--neg-soft:#FCA5A5;--neg-softer:#FECACA;--neg-strong:#EF4444;--neg-line:#7F1D1D;--neg-line-hi:#B91C1C;--bad-line:#7A2530;--neg-bg:#2A0F0F;--neg-bg-2:#240C0C;--pos-soft:#86EFAC;--pos-soft-2:#7FE7A6;--pos-muted:#86C7A0;--pos-line:#2F6B43;--pos-line-2:#14532D;--pos-bg:#0C2416;--info:#38BDF8;--info-soft:#7FD3F2;--blue-soft:#93C5FD;--blue-line:#1E40AF;--blue-line-2:#1E3A8A;--blue-bg:#10243A;--blue-bg-2:#0F1A33;--cool:#7DD3FC;--cool-line:#0C4A6E;--cool-bg:#082032;--tg:#2AABEE;--tg-lo:#1E96D4;--frag:#F9A8D4;--frag-line:#9D2463;--frag-bg:#2A0F1E;--teal:#2DD4BF;--violet:#A78BFA;
  --accent:#E9E3D3;--accent-bg:color-mix(in srgb,var(--accent) 7%,var(--panel));--accent-line:color-mix(in srgb,var(--accent) 30%,var(--line));--on-accent-ink:#15181E;
  --band-act:#FF6A3D;--band-today:#E39A4B;--band-win:#B79A7C;
  --focus:var(--accent)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:'IBM Plex Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
[role=button]{cursor:pointer}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
.mono{font-family:'IBM Plex Mono',monospace}.dim{color:var(--dim)}
button{cursor:pointer;font-family:inherit}input,select,textarea{font-family:inherit}
/* Custom dropdown trigger (NativeSelect replaces every native <select>); the menu is styled by revamp.css in #rv-portal */
.live-csb{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;max-width:100%;font:inherit;font-size:13px;line-height:1.3;text-align:left;color:var(--txt);background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer}
.live-csb:hover{border-color:var(--dim)}.live-csb:disabled{opacity:.6;cursor:not-allowed}
.live-csb .csl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.live-csb .csa{color:var(--dim);font-size:11px;flex:none}
.shell{min-height:100vh;display:flex;flex-direction:column}
.top{display:flex;align-items:center;flex-wrap:wrap;gap:24px;row-gap:10px;padding:14px 22px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--top-hi),var(--bg))}
.top-brand{display:flex;align-items:center;gap:12px}.mark{font-size:26px;color:var(--gold)}
.t1{font-weight:700;letter-spacing:.06em}.t2{font-size:12px;color:var(--dim)}
.team-pick{font:inherit;font-weight:700;letter-spacing:.06em;color:var(--gold);background:transparent;border:none;padding:0 2px;margin:0 1px;cursor:pointer;-webkit-appearance:none;appearance:none}
.team-pick:hover{filter:brightness(1.15)}.team-pick option{background:var(--panel2);color:var(--txt)}
.tabs{display:flex;gap:6px;margin-left:12px}
.tabs button{background:none;border:1px solid transparent;color:var(--dim);padding:8px 14px;border-radius:8px;font-size:13px}
.tabs button.on{color:var(--txt);border-color:var(--line);background:var(--panel)}
.top-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.snap{font-size:12px;color:var(--accent);border:1px solid var(--accent-line);background:var(--accent-bg);padding:6px 10px;border-radius:6px}
.snap.past{color:var(--stale);border-color:var(--stale-line);background:var(--stale-bg)}
.snapbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 16px;padding:9px 13px;background:var(--panel);border:1px solid var(--line);border-radius:11px}
.snapbar.past{border-color:var(--stale-line)}
.snapbar-lbl{font-size:12px;color:var(--dim);font-weight:600}
.snapbar > :nth-child(2){margin-left:auto}
.date-quick button{font-size:12px}
.datesel{background:var(--panel);border:1px solid var(--line);color:var(--txt);padding:9px 14px;border-radius:9px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.datesel.set{border-color:var(--accent);color:var(--accent)}
.datesel:focus,.datesel:hover{outline:none;border-color:var(--accent)}
.cal-ico{opacity:.6;font-size:12px}
.cal-wrap{position:relative}
.cal-pop{position:absolute;top:calc(100% + 6px);right:0;z-index:60;width:266px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:0 14px 36px rgba(0,0,0,.5)}
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.cal-title{font-size:13px;font-weight:600;color:var(--txt);letter-spacing:.02em}
.cal-nav{background:none;border:1px solid var(--line);color:var(--txt);width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center}
.cal-nav:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.cal-nav:disabled{opacity:.25;cursor:default}
.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:3px}
.cal-dow span{text-align:center;font-size:10px;color:var(--dim);letter-spacing:.05em;padding:3px 0}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-cell{height:32px;border:none;background:none;color:var(--txt);font-size:12.5px;border-radius:7px;cursor:pointer;padding:0}
.cal-cell:hover:not(:disabled):not(.sel){background:var(--line)}
.cal-cell.sel{background:var(--accent);color:var(--on-accent-ink);font-weight:700}
.cal-cell.off,.cal-cell:disabled{color:var(--dim);opacity:.3;cursor:default}
.cal-cell.empty{visibility:hidden}
.cal-foot{display:flex;align-items:center;justify-content:space-between;margin-top:9px;border-top:1px solid var(--line);padding-top:9px}
.cal-range{font-size:10.5px;color:var(--dim)}
.cal-link{background:none;border:none;color:var(--accent);font-size:12px;cursor:pointer;font-weight:600}
.ro-banner{background:var(--blue-bg);border:1px solid var(--blue-line);color:var(--blue-soft);padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:14px}
.wf-row select:disabled,.wf-note[readonly],.wf-row .live-csb:disabled{opacity:.65;cursor:default}
.st-btn:disabled{opacity:.4;cursor:default}
.btn-ghost{background:none;border:1px solid var(--line);color:var(--dim);padding:7px 12px;border-radius:8px;font-size:12px}
.btn-ghost:hover{color:var(--txt);border-color:var(--line-strong)}
.btn-ghost.active{color:var(--accent);border-color:var(--accent)}
.btn-ghost.wide{width:100%;padding:10px;margin-top:8px}
.btn-gold{background:var(--accent);border:none;color:var(--on-accent-ink);font-weight:700;padding:10px 16px;border-radius:9px}
.btn-gold:disabled{opacity:.45;cursor:default}
main{flex:1;padding:18px 22px;max-width:1520px;width:100%;margin:0 auto}
.foot{padding:12px 22px;color:var(--faint);font-size:11px;letter-spacing:.06em;border-top:1px solid var(--line)}
.stale-banner{background:var(--stale-bg);border:1px solid var(--stale-line);color:var(--stale);padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:14px}
.rail{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.rail-row{display:flex;flex-wrap:wrap;gap:8px}
.plaque{position:relative;flex:1 1 160px;min-width:150px;background:linear-gradient(160deg,var(--panel2),var(--panel));border:1px solid var(--line);border-left:4px solid var(--bp);border-radius:10px;padding:10px 12px 9px;cursor:pointer;transition:transform .12s;overflow:hidden}
.plaque::after{content:"";position:absolute;inset:0;background:radial-gradient(420px 80px at 0% 0%,color-mix(in srgb,var(--bp) 26%,transparent),transparent 70%);pointer-events:none}
.plaque:hover{transform:translateY(-2px)}.plaque.on{border-color:var(--ba);box-shadow:0 0 0 1px var(--ba) inset}.plaque.empty{opacity:.4}
.plaque-name{font-weight:700;letter-spacing:.08em;font-size:12px;display:flex;align-items:center;gap:8px}
.stale-chip{font-size:9px;color:var(--stale);border:1px solid var(--stale-line);background:var(--stale-bg);padding:1px 6px;border-radius:10px;letter-spacing:.06em}
.plaque-num{font-size:18px;font-weight:600;margin-top:4px}.plaque-num span{font-size:10px;color:var(--dim);margin-left:5px}
.plaque-dep{font-size:11px;color:var(--ba);margin-top:1px}
.plaque-alert{margin-top:6px;display:flex;flex-wrap:wrap;gap:2px 10px;font-size:11px;color:var(--dim)}
.plaque-alert span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.plaque-alert i{width:6px;height:6px;border-radius:2px;background:var(--cc)}.plaque-alert b{color:var(--txt);font-weight:600}
.strip{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.chip{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--panel);color:var(--dim);font-size:11px;letter-spacing:.05em;padding:6px 10px;border-radius:20px;cursor:pointer}
.chip-dot{width:8px;height:8px;border-radius:50%;background:var(--cc)}.chip-n{color:var(--txt);font-size:11px}
.chip.on{border-color:var(--cc);color:var(--txt);background:color-mix(in srgb,var(--cc) 12%,var(--panel))}
.chip.gracewatch{border-style:dashed}
.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.search{flex:1;max-width:300px;background:var(--panel);border:1px solid var(--line);color:var(--txt);padding:9px 13px;border-radius:9px;font-size:13px}
.search:focus{outline:none;border-color:var(--accent)}
.seg{display:flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}
.seg button{background:var(--panel);border:none;color:var(--dim);padding:8px 13px;font-size:12px}
.seg button.on{background:var(--panel2);color:var(--accent)}
.progress{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dim)}
.pbar{display:inline-block;width:90px;height:6px;background:var(--panel2);border-radius:4px;overflow:hidden}
.pbar span{display:block;height:100%;background:var(--accent)}
.count{margin-left:auto;color:var(--dim);font-size:12px}
.active-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.af-label{font-size:12px;color:var(--dim);font-weight:600}
.fchip{display:inline-flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);font-size:12px;padding:5px 6px 5px 10px;border-radius:20px}
.fchip-x{background:none;border:none;color:var(--dim);font-size:13px;line-height:1;padding:0 2px}
.fchip-x:hover{color:var(--neg)}
.focus-chip{border-color:var(--accent);color:var(--accent)}
.tbl-wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{position:sticky;top:0;background:var(--panel2);color:var(--dim);font-size:11.5px;font-weight:600;text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);z-index:1;white-space:nowrap}
th.sortable{cursor:pointer;user-select:none}th.sortable:hover{color:var(--txt)}
th.r,td.r{text-align:right}
tbody tr{border-bottom:1px solid var(--line-soft);cursor:pointer}tbody tr:hover{background:var(--hover)}
tbody tr.cool{opacity:.45}
td{padding:9px 8px;vertical-align:middle}
.pname{font-weight:600}.psub{font-size:11px;color:var(--dim)}
.b-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}
.neg{color:var(--neg)}.pos{color:var(--pos)}
.cls-pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--cc);border:1px solid var(--cc);background:color-mix(in srgb,var(--cc) 12%,transparent);padding:3px 8px;border-radius:6px}
.cls-pill.big{font-size:12px;padding:5px 12px}
.frag{margin-left:6px;font-size:9px;font-weight:700;color:var(--frag);border:1px solid var(--frag-line);background:var(--frag-bg);padding:2px 6px;border-radius:6px}
.frag.big{font-size:11px;padding:4px 9px}
.cooling{margin-left:6px;font-size:9px;font-weight:700;color:var(--cool);border:1px solid var(--cool-line);background:var(--cool-bg);padding:2px 6px;border-radius:6px;white-space:nowrap}
.cooling.big{font-size:11px;padding:4px 9px}
.whale{margin-left:6px;color:var(--gold);font-size:13px}
.coolbadge{margin-left:6px;font-size:9px;color:var(--blue-soft);border:1px solid var(--blue-line-2);background:var(--blue-bg-2);padding:2px 6px;border-radius:6px}
.st-tag{font-size:10px;font-weight:600;color:var(--sc);border:1px solid var(--sc);padding:2px 7px;border-radius:6px;white-space:nowrap}
.emptyrow{text-align:center;color:var(--dim);padding:34px}
.ct-head{display:flex;align-items:center;gap:14px;padding:12px 14px;border-bottom:1px solid var(--line)}
.ct-pulse{display:flex;gap:18px;font-size:13px;color:var(--dim)}
.ct-pulse b{color:var(--txt);font-weight:700;margin-right:3px}
.ct-pulse .pos b{color:var(--pos)}.ct-pulse .neg b{color:var(--neg)}
.ct-agent{margin-left:auto;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:7px 10px;border-radius:8px;font-size:13px;cursor:pointer}
.ct-note{color:var(--dim);font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.auto-tag{margin-left:6px;font-size:9px;color:var(--dim);border:1px solid var(--line);border-radius:8px;padding:1px 5px;}
.more{padding:12px;text-align:center}
.pager{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--line);font-size:13px}
.pager-size{display:flex;align-items:center;gap:8px;color:var(--dim)}
.pager-size select,.pager-size .live-csb{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:5px 8px;border-radius:7px;font-size:13px;cursor:pointer}
.pager-info{color:var(--dim)}
.pager-nav{margin-left:auto;display:flex;align-items:center;gap:4px}
.pager-nav button{min-width:30px;height:30px;padding:0 8px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:7px;font-size:13px;cursor:pointer}
.pager-nav button:hover:not(:disabled){border-color:var(--accent)}
.pager-nav button.on{border-color:var(--accent);color:var(--accent);font-weight:700}
.pager-nav button:disabled{opacity:.35;cursor:default}
.pager-gap{color:var(--dim);padding:0 2px}
.view-seg{flex-shrink:0}
.seg .seg-div{width:1px;align-self:stretch;background:var(--accent);opacity:.45}
.legend-q{width:34px;text-align:center;font-weight:700}
.legend{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--txt);line-height:1.5}
.legend b{color:var(--accent)}
.wl{display:flex;flex-direction:column;gap:14px}
.wl-band{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--cc);border-radius:12px;overflow:hidden}
.wl-band.wl-ACT{border-left-width:6px;background:color-mix(in srgb,var(--band-act) 5%,var(--panel))}.wl-band.wl-WINBACK,.wl-band.wl-NONE{border-left-width:2px}
.wl-head{display:flex;align-items:center;gap:10px;padding:12px 14px 10px;flex-wrap:wrap}
.wl-hname{font-weight:700;letter-spacing:.04em;font-size:14px}.wl-ACT .wl-hname{font-size:15px}
.wl-hdesc{font-size:12px;color:var(--dim)}
.wl-prog{margin-left:auto;font-size:12.5px;color:var(--dim);white-space:nowrap;flex-shrink:0}.wl-prog b{color:var(--txt);font-weight:600}
.wl-notg + .wl-prog{margin-left:0}
.wl-pbar{height:2px;background:var(--line);margin:0 14px}.wl-pbar i{display:block;height:100%;background:var(--cc);transition:width .3s}
.wl-hcount{margin-left:auto;font-size:13px;font-weight:600;color:var(--txt);background:var(--panel2);border:1px solid var(--line);padding:2px 11px;border-radius:20px;flex-shrink:0}
.wl-notg{margin-left:auto;font-size:11px;font-weight:600;color:var(--amber);background:var(--amber-bg);border:1px solid var(--amber-line);padding:2px 9px;border-radius:20px;flex-shrink:0;cursor:pointer}
.wl-notg:hover{border-color:var(--amber)}
.wl-notg.on{background:var(--amber);color:var(--on-amber);border-color:var(--amber)}
.wl-export{font-size:11px;color:var(--dim);background:transparent;border:1px solid var(--line);border-radius:20px;padding:2px 9px;cursor:pointer;flex-shrink:0}
.wl-export:hover{color:var(--accent);border-color:var(--accent)}
.wl-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--line-soft);cursor:pointer}
.wl-pbar + .wl-row{border-top-color:transparent}

.wl-row:hover{background:var(--hover)}
/* Done: dim the player, keep the logged status fully readable. */
.wl-row.done .wl-main,.wl-row.done .wl-amt,.wl-row.done > .b-dot{opacity:.5}
.wl-main{flex:1;min-width:0}
.wl-name{font-weight:600;display:flex;align-items:center;gap:6px;font-size:13px}
.wl-instr{font-size:12px;color:var(--dim);margin-top:1px}
/* multi-select checkbox + bar (Table view) */
.wl-check{appearance:none;-webkit-appearance:none;width:18px;height:18px;flex-shrink:0;cursor:pointer;position:relative;border:1.5px solid var(--line-strong);border-radius:4px;background:transparent;transition:opacity .12s,border-color .12s,background .12s}
.wl-check:hover{opacity:1;border-color:var(--accent)}
.wl-check:checked{opacity:1;border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,transparent)}
.wl-check:checked::after{content:"";position:absolute;left:5.5px;top:2px;width:4px;height:9px;border:solid var(--accent);border-width:0 2px 2px 0;transform:rotate(45deg)}
.sel-bar{display:flex;align-items:center;gap:12px;background:var(--panel2);border:1px solid var(--accent);border-radius:10px;padding:9px 14px;margin-bottom:14px}
.sel-n{font-weight:700;font-size:13px;color:var(--accent)}
.paste-box{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:14px}
.paste-help{font-size:12px;color:var(--dim);margin-bottom:8px}
.paste-ta{box-sizing:border-box;width:100%;max-width:420px;display:block;background:var(--panel);color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:12px/1.4 monospace;resize:vertical}
.paste-actions{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
.paste-res{font-size:12px;color:var(--txt)}
.paste-bad{font-size:12px;color:var(--dim);margin-top:6px;word-break:break-word}
.sel-bar .btn-gold{padding:7px 14px}
.btn-mark{background:color-mix(in srgb,var(--pos) 18%,var(--panel2));border:1px solid var(--pos);color:var(--pos);font-weight:700;font-size:13px;padding:7px 13px;border-radius:9px;cursor:pointer}
.btn-mark:disabled{opacity:.5;cursor:default}
td.tcheck{width:32px;text-align:center}
td.tname{cursor:text;user-select:text}
tbody tr.sel{background:color-mix(in srgb,var(--accent) 9%,transparent)}
tbody tr.sel:hover{background:color-mix(in srgb,var(--accent) 13%,transparent)}
.wl-bt{font-size:11px;color:var(--dim);font-weight:400;margin-left:2px}
.wl-done{color:var(--pos);font-size:12px;display:flex;align-items:center;gap:5px;white-space:nowrap}
.wl-amt{font-weight:600;font-size:14px;min-width:96px;text-align:right;white-space:nowrap;color:var(--txt)}.wl-amt.neg{color:var(--neg)}.wl-amt.pos{color:var(--pos)}
.wl-instr.rep{opacity:.5;font-size:11px}
.wl-row.act{padding:13px 14px}
.wl-row.act .wl-name{font-size:15px}
.wl-row.act .wl-instr{font-size:12.5px;color:color-mix(in srgb,var(--band-act) 55%,var(--txt))}
.wl-row.act .wl-amt{font-size:15px}
.wl-row.today .wl-name{font-size:14px}
.wl-row.today .wl-instr{color:color-mix(in srgb,var(--band-today) 55%,var(--txt))}
.wl-none{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer}
.wl-none:hover{background:var(--hover)}
.wl-none-line{color:var(--dim);font-size:13px}
.wl-caret{color:var(--dim);font-size:11px;width:10px;text-align:center;flex-shrink:0}
.wl-more{padding:10px 14px;text-align:center;border-top:1px solid var(--line-soft)}
.drawer-veil{position:fixed;inset:0;background:rgba(5,8,12,.6);backdrop-filter:blur(2px);z-index:40}
.drawer{position:fixed;top:0;right:0;height:100vh;width:760px;max-width:94vw;background:var(--panel);border-left:1px solid var(--line);box-shadow:-18px 0 50px rgba(0,0,0,.5);padding:20px;overflow-y:auto;z-index:41}
/* two-column body: A (who/notes) left · B (approach/action) right; collapses on narrow screens */
.drawer-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin:16px 0}
.drawer-cols .zone{margin:0}
.zone-a{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px 14px}
@media (max-width:760px){.drawer-cols{grid-template-columns:1fr}}
/* value-at-a-glance strip */
.vstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}
.vcell{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 11px}
.vlab{font-size:11px;color:var(--dim)}
.vval{font-size:16px;font-weight:600;margin-top:2px}
.drawer:focus{outline:none}
.smart{border:1px solid color-mix(in srgb,var(--blue-soft) 35%,transparent);background:color-mix(in srgb,var(--blue-soft) 6%,transparent);border-radius:10px;padding:10px 12px;margin-bottom:12px}
.smart-l{font-size:12px;font-weight:600;color:var(--blue-soft);margin-bottom:4px}.smart-r{font-size:13px;line-height:1.5}.smart-t{font-size:12px;color:var(--dim);margin-top:6px}
.drawer::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--bp),var(--ba))}
.drawer-head{display:flex;justify-content:space-between;align-items:flex-start}
.drawer-brand{font-size:11px;letter-spacing:.14em;font-weight:700}
.drawer-name{font-size:20px;font-weight:700;margin-top:3px}.drawer-sub{color:var(--dim);font-size:12px}
.x{position:absolute;top:16px;right:16px;z-index:2;background:var(--panel);border:1px solid var(--line);color:var(--dim);border-radius:8px;width:30px;height:30px}
.drawer-class{margin:14px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.drawer-why{width:100%;color:var(--dim);font-size:12px}
.dsec{margin:18px 0 7px;font-size:12.5px;font-weight:600;color:var(--txt)}
.rg-warn{background:var(--neg-bg);border:1px solid var(--neg-line);color:var(--neg-soft);font-size:11px;padding:8px 10px;border-radius:8px;margin-bottom:8px;line-height:1.5}
.hooks{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.hook{display:flex;align-items:center;gap:7px;background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:7px 10px;min-height:34px;box-sizing:border-box;font-size:12px;line-height:1.3;color:var(--txt)}
.hook-i{font-size:12px;line-height:1;opacity:.9;flex-shrink:0}
.hook.warn{grid-column:1/-1;background:var(--hook-warn-bg);border-color:var(--hook-warn-line);color:var(--hook-warn)}
.hook.warn .hook-i{color:var(--amber-deep);opacity:1}
/* drawer zones — A identity · B action (primary, framed) · C reference (recessed) */
.zone-b{background:var(--panel);border:1px solid var(--line-zone);border-radius:12px;padding:12px 14px 14px;margin:18px 0;box-shadow:0 8px 22px rgba(0,0,0,.28)}
.zone-b .dsec{font-size:13px}
.zone-b .dsec:first-child{margin-top:2px}
.zone-c{margin-top:16px;border-top:1px solid var(--line);padding-top:8px}
.zone-c .dsec{color:var(--dim)}
.details-toggle{background:none;border:none;color:var(--dim);font-size:12px;font-weight:600;cursor:pointer;padding:4px 0}
.details-toggle:hover{color:var(--accent)}
.details-body{opacity:.92;margin-top:2px}
.angles-hint{color:var(--dim);font-size:11px;margin-bottom:8px;line-height:1.5}
.angles{display:flex;flex-direction:column;gap:7px}
.angle{display:flex;gap:10px;align-items:flex-start;background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:9px 11px}
.angle-i{font-size:15px;line-height:1.3}
.angle-l{font-size:12px;font-weight:700;color:var(--txt);letter-spacing:.01em}
.angle-h{font-size:11px;color:var(--dim);line-height:1.45;margin-top:2px}
.tmpl-toggle{margin-top:9px;background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;padding:2px 0;opacity:.85}
.tmpl-toggle:hover{opacity:1}
.ledger{display:flex;flex-direction:column;gap:7px}
.ledger-empty{color:var(--dim);font-size:11px;line-height:1.5;font-style:italic}
.ledger-note{display:flex;gap:9px;align-items:flex-start;background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:8px 10px}
.ln-pin{font-size:13px;line-height:1.4}
.ln-body{flex:1;min-width:0}
.ln-text{font-size:13px;color:var(--txt);line-height:1.45;white-space:pre-wrap;word-break:break-word}
.ln-meta{font-size:10px;color:var(--dim);margin-top:3px;letter-spacing:.02em}
.ln-x{background:none;border:none;color:var(--dim);font-size:12px;cursor:pointer;padding:0 2px;line-height:1;opacity:.6}
.ln-x:hover{opacity:1;color:var(--neg)}
.gt-head{display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap}.gt-sub{color:var(--dim);font-size:12px;flex:1}
.gt-note{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:9px 12px;font-size:12px;color:var(--dim);margin-bottom:10px;line-height:1.5}
.gt-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.gt-days{display:flex;gap:4px}.gt-d{min-width:46px;text-align:center;padding:3px 6px;border-radius:6px;border:1px solid var(--line);font-size:11px;font-family:var(--mono,monospace);color:var(--dim)}
.gt-d.on{color:var(--pos);border-color:var(--pos)}.gt-d.na{opacity:.5}
.gt-d.act{border-style:dashed;color:#E8C547;border-color:#E8C547}.gt-sd{font-size:10px;color:#E8C547;white-space:nowrap}
.gt-st{font-size:10px;font-weight:700;letter-spacing:.04em;padding:3px 8px;border-radius:10px;border:1px solid var(--cc);color:var(--cc);white-space:nowrap}
.grace-div td{background:var(--panel2);font-size:11px;letter-spacing:.06em;padding:7px 14px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);cursor:default}
.grace-div .gd-0{color:#E8C547;font-weight:700}.grace-div .gd-1{color:var(--pos);font-weight:700}.grace-div .gd-2{color:var(--dim);font-weight:700}
.bonus-btn{align-self:flex-start;font-size:12px;padding:6px 11px}
.bonus-tag{margin-left:8px;font-size:10px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:10px;border:1px solid var(--line)}
.bonus-tag.on{color:var(--pos);border-color:var(--pos)}
.bonus-tag.off{color:var(--gold, #E8C547);border-color:var(--gold, #E8C547)}
.ledger-add{display:flex;gap:7px;margin-top:2px}
.ledger-add input{flex:1;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:9px 12px;border-radius:8px;font-size:13px}
.ledger-add .btn-ghost{white-space:nowrap}
/* CRM boxes — Telegram button · follow-up date · contact history */
.tg-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:.02em;text-decoration:none;cursor:pointer;border:1px solid var(--tg);background:linear-gradient(180deg,var(--tg),var(--tg-lo));color:var(--on-accent);box-shadow:0 6px 16px rgba(42,171,238,.28)}
.tg-btn:hover{filter:brightness(1.06)}
.tg-btn.off{border:1px dashed var(--off);background:var(--panel2);color:var(--dim);box-shadow:none;cursor:not-allowed;opacity:.75}
.tg-row{display:flex;gap:8px;align-items:stretch}
.tg-row .tg-btn{flex:1;width:auto}
.lc-tag{margin-left:8px;font-size:9px;letter-spacing:.1em;color:var(--accent);border:1px solid var(--lc-line);background:var(--lc-bg);border-radius:6px;padding:1px 6px}
.lc-count{margin-left:6px;font-size:11px;color:var(--dim);background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:0 7px}
.lc-list{display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-radius:9px;overflow:hidden;margin:2px 0 8px}
.lc-row{display:flex;align-items:center;gap:10px;padding:8px 11px;border-bottom:1px solid var(--line-soft);font-size:12px}.lc-row:last-child{border-bottom:none}
.lc-agent{font-weight:600;color:var(--txt);min-width:80px}
.lc-date{color:var(--dim);font-size:11px;flex:1}
.lc-open{color:var(--accent);font-weight:700;text-decoration:none;font-size:12px}.lc-open.off{color:var(--neg)}
.lc-x{background:none;border:none;color:var(--mute);cursor:pointer;font-size:13px;padding:0 2px}.lc-x:hover{color:var(--neg)}
.lc-add{display:flex;gap:7px;margin-bottom:2px}
.lc-add input{flex:1;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:9px 12px;border-radius:8px;font-size:13px}
.tg-edit-btn{flex:0 0 auto;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--dim);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.tg-edit-btn:hover{border-color:var(--accent);color:var(--accent)}
.tg-edit{display:flex;gap:8px;align-items:center}
.tg-input{flex:1;min-width:0;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:10px 12px;border-radius:8px;font-size:13px}
.tg-input:focus{outline:none;border-color:var(--tg)}
/* Telegram table column */
.tgcol{text-align:center;width:34px}
.tg-cell{display:inline-block;font-size:14px;line-height:1;text-decoration:none;color:var(--tg)}
a.tg-cell:hover{filter:brightness(1.2)}
.tg-cell.off{color:var(--off);font-weight:700}
.tg-flag{color:var(--tg);font-size:11px;margin-left:5px;vertical-align:baseline}
.crm-date{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:9px 12px;border-radius:8px;font-size:13px}
.crm-hist{display:flex;flex-direction:column;gap:7px}
.dm{margin:12px 0 4px;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.dm-head{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;margin-bottom:8px;gap:8px;flex-wrap:wrap}
.dm-lg{font-weight:400;color:var(--dim);font-size:11px;display:flex;align-items:center;gap:5px}
.dm-lg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-left:6px}
.dm-grid{display:grid;gap:3px}
.dm-c{display:flex;flex-direction:column;align-items:center;border-radius:5px;padding:5px 0;font-size:11.5px;font-weight:500;line-height:1.4;min-width:0;overflow:hidden}
.dm-d{color:var(--txt);font-size:10.5px;font-weight:600;opacity:.75}
.dm-w{background:color-mix(in srgb,var(--pos) 16%,transparent);color:var(--pos)}
.dm-l{background:color-mix(in srgb,var(--neg) 16%,transparent);color:var(--neg)}
.dm-n{background:var(--panel);color:var(--dim);box-shadow:inset 0 0 0 1px var(--line)}
.dm-sum{font-size:11px;color:var(--dim);margin-top:8px}
.mc-wrap{display:inline-block;margin-left:10px}
.mc-btn{font:inherit;font-size:11px;padding:3px 9px;border-radius:7px;border:1px solid var(--line);background:var(--panel);color:var(--txt);cursor:pointer}
.mc-btn:hover{border-color:var(--accent);color:var(--accent)}
.mc-pop{width:282px;font-weight:400}
.cal-cell.mc-w{background:color-mix(in srgb,var(--pos) 20%,transparent);color:var(--pos)}
.cal-cell.mc-l{background:color-mix(in srgb,var(--neg) 20%,transparent);color:var(--neg)}
.cal-cell.mc-n{background:var(--panel);color:var(--dim)}
.cal-cell.mc-sel{box-shadow:inset 0 0 0 2px var(--accent)}
.mc-detail{font-size:11.5px;color:var(--txt);margin-top:9px;min-height:18px;line-height:1.5}
.mc-detail .neg,.mc-foot .neg{color:var(--neg)}
.mc-detail .pos{color:var(--pos)}
.mc-tag{margin-left:6px;font-size:10px;padding:1px 6px;border-radius:5px}
.mc-tag.mc-w{background:color-mix(in srgb,var(--pos) 20%,transparent);color:var(--pos)}
.mc-tag.mc-l{background:color-mix(in srgb,var(--neg) 20%,transparent);color:var(--neg)}
.mc-tag.mc-n{background:var(--panel);color:var(--dim)}
.mc-foot{font-size:10.5px;color:var(--dim);flex-direction:column;align-items:flex-start;gap:2px}
.mc-foot b{color:var(--txt)}
.ch-row{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:8px 10px}
.ch-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ch-date{font-size:11px;color:var(--dim)}
.ch-status{font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--accent)}
.ch-who{font-size:11px;color:var(--dim)}
.ch-note{font-size:12px;color:var(--txt);line-height:1.45;margin-top:4px;white-space:pre-wrap;word-break:break-word}
.tmpl{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap}
.wf-row select,.wf-row .live-csb{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:9px 12px;border-radius:8px;font-size:13px}
.wf-status{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:10px}
.seg-st{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--panel2)}
.seg-st .st-btn{border:none;border-radius:0;border-right:1px solid var(--line);padding:9px 14px;font-size:11.5px}
.seg-st .st-btn:last-child{border-right:none}
.seg-st .st-btn.on{background:color-mix(in srgb,var(--sc) 20%,var(--panel2));box-shadow:inset 0 -2px 0 var(--sc)}
.st-auto{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.st-auto-l{font-size:11.5px;color:var(--dim);margin-right:2px}
.st-auto .st-btn{border-style:dashed}
.st-btn{font-size:10px;font-weight:600;letter-spacing:.04em;color:var(--sc);border:1px solid var(--line);background:var(--panel2);padding:6px 9px;border-radius:7px}
.st-btn.on{border-color:var(--sc);background:color-mix(in srgb,var(--sc) 14%,var(--panel2))}
.st-btn.on.locked{opacity:.9}  /* a current auto status (e.g. RECOVERED) still reads clearly even though locked */
.wf-note{width:100%;margin-top:8px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:9px 12px;border-radius:8px;font-size:13px;min-height:54px;resize:vertical}
.savedmsg{color:var(--pos);font-size:12px;margin-top:6px}
.btn-ghost.danger{border-color:var(--neg-line);color:var(--neg-soft)}
.btn-ghost.danger:hover{border-color:var(--neg-line-hi);color:var(--neg-softer)}
.clearedmsg{color:var(--neg-soft);font-size:12px;margin-top:6px}
.errmsg{color:var(--neg);font-size:12px;font-weight:600;margin-left:6px}
.dgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:12px 0 4px}
.dcard{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:10px}
.dlab{font-size:11px;color:var(--dim)}
.dval{font-size:17px;font-weight:600;margin-top:3px}
.drow{display:flex;justify-content:space-between;gap:14px;padding:6px 0;border-bottom:1px solid var(--line-soft);font-size:13px}
.drow span:first-child{color:var(--dim)}
.drow .dv{text-align:right}
.next-row{display:flex;align-items:center;justify-content:space-between;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}
/* Changes — "portfolio movement" view (flow, not an action queue) */
.delta{display:flex;flex-direction:column;gap:13px}
.delta-head{font-size:12.5px;font-weight:600;color:var(--dim)}
.delta-hero{display:flex;flex-direction:column;gap:11px}
.dh-stats{display:flex;gap:12px;flex-wrap:wrap}
.dh-card{position:relative;flex:1;min-width:160px;display:flex;flex-direction:column;gap:2px;background:var(--panel2);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:11px;padding:13px 15px;cursor:pointer;transition:border-color .12s,background .12s}
.dh-card:hover{background:var(--hover-2);border-color:var(--line-strong)}
.dh-card.dh-up{border-left-color:var(--pos)}
.dh-card.dh-down{border-left-color:var(--neg-strong)}
.dh-card.dh-new{border-left-color:var(--info)}
.dh-n{font-size:28px;font-weight:800;line-height:1.05}
.dh-n.up{color:var(--pos)}
.dh-n.down{color:var(--neg)}
.dh-n.new{color:var(--info-soft)}
.dh-l{font-size:11.5px;color:var(--dim)}
.dh-pop{position:absolute;top:100%;left:0;margin-top:6px;z-index:20;min-width:312px;max-width:380px;background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:12px 14px;box-shadow:0 16px 38px rgba(0,0,0,.55);display:none;flex-direction:column;gap:8px}
.dh-card:hover .dh-pop{display:flex}
.dh-card:last-child .dh-pop{left:auto;right:0}
.dh-pop-head{font-size:12px;font-weight:700;color:var(--txt)}
.dh-pop-sub{font-size:11px;color:var(--dim);line-height:1.4}
.dh-pop-list{display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:8px 0}
.dh-pl{display:flex;align-items:center;gap:9px;font-size:12px}
.dh-pl-rank{color:var(--dim);font-size:10px;width:11px;text-align:right;flex-shrink:0}
.dh-pl-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--txt)}
.dh-pl-brand{font-size:10px;font-weight:600;flex-shrink:0}
.dh-pl-amt{font-weight:700;flex-shrink:0;min-width:54px;text-align:right}
.dh-pop-empty{font-size:11px;color:var(--dim);font-style:italic}
.dh-pop-row{font-size:12px;color:var(--txt);line-height:1.45}
.dh-pop-row b{color:var(--txt)}
.dh-pop-hint{font-size:11px;color:var(--dim)}
.dh-tr{font-weight:700}
.dh-tr.good{color:var(--pos)}
.dh-tr.bad{color:var(--neg)}
.dh-tr.flat{color:var(--dim)}
.dh-verdict{font-size:13px;color:var(--dim);border-top:1px solid var(--line);padding-top:8px}
.dh-explain{color:var(--dim)}
.dh-rm{font-size:12px;font-weight:700;margin-top:3px}
.dh-rm.up{color:var(--pos)}
.dh-rm.down{color:var(--neg)}
.dh-rm.new{color:var(--info-soft)}
.dh-rml{color:var(--dim);font-weight:500}
.dh-needs{display:block;width:100%;text-align:left;background:var(--hook-warn-bg);border:1px solid var(--hook-warn-line);color:var(--hook-warn);font-size:13px;font-weight:600;padding:9px 12px;border-radius:9px;cursor:pointer}
.dh-needs:hover{background:var(--hook-warn-bg-hi);border-color:var(--hook-warn-line-hi)}
.dir{font-weight:800;text-transform:uppercase;letter-spacing:.04em}
.dir-cooling{color:var(--neg)}
.dir-warming{color:var(--pos)}
.dir-steady{color:var(--dim)}
.dl-roll{display:flex;flex-direction:column;gap:5px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 13px}
.dl-rollrow{display:flex;align-items:center;gap:9px;font-size:12px}
.dl-rb{font-weight:700;min-width:64px}
.dl-rcell{color:var(--dim)}
.dl-rcell.up{color:var(--pos)}
.dl-rcell.down{color:var(--neg)}
.dl-rcell.new{color:var(--info-soft)}
.dl-rsep{color:var(--line)}
.delta-empty{color:var(--dim);font-size:13px;padding:34px;text-align:center;background:var(--panel);border:1px solid var(--line);border-radius:12px}
.dl-band{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:12px;overflow:hidden}
.dl-band.dl-up{border-left-color:var(--pos)}
.dl-band.dl-down{border-left-color:var(--neg-strong)}
.dl-band.dl-new{border-left-color:var(--info)}
.dl-band.dl-prio{border-left-width:5px;box-shadow:0 8px 22px rgba(127,29,29,.20)}
.dl-prio .dl-bhead{background:var(--neg-bg-2)}
.dl-bhead{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.dl-bicon{font-size:14px;line-height:1}
.dl-blabel{font-size:13px;font-weight:700;letter-spacing:.04em;white-space:nowrap}
.dl-up .dl-blabel{color:var(--pos)}
.dl-down .dl-blabel{color:var(--neg)}
.dl-new .dl-blabel{color:var(--info)}
.dl-bdesc{font-size:12px;color:var(--dim)}
.dl-bcount{margin-left:auto;font-size:13px;font-weight:600;color:var(--txt);background:var(--panel2);border:1px solid var(--line);padding:2px 11px;border-radius:20px;flex-shrink:0}
.dl-row{display:flex;align-items:center;gap:11px;padding:6px 14px;border-bottom:1px solid var(--line-soft);cursor:pointer}
.dl-row:hover{background:var(--hover)}
.dl-row:last-child{border-bottom:none}
.dl-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dl-name{flex:1;min-width:0;line-height:1.3}
.dl-pname{font-weight:600;font-size:13px}
.dl-psub{font-size:11px;color:var(--dim);margin-left:7px}
.dl-rtag{font-size:10px;color:var(--pos-muted);font-style:italic;white-space:nowrap}
.dl-move{font-size:12px;font-weight:600;white-space:nowrap}
.dl-move.dl-up{color:var(--pos)}
.dl-move.dl-down{color:var(--neg)}
.dl-move.dl-new{color:var(--info-soft)}
.dl-tag{font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px;border:1px solid var(--sc);color:var(--sc);white-space:nowrap}
.dl-amt{font-weight:700;font-size:13px;min-width:56px;text-align:right;white-space:nowrap;color:var(--txt)}
.dl-more{padding:9px 14px;text-align:center}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(800px 500px at 50% 20%,var(--login-hi),var(--bg))}
.login-card{width:340px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:30px;display:flex;flex-direction:column;gap:11px;text-align:center}
.login-mark{font-size:34px;color:var(--gold)}.login-card h1{letter-spacing:.1em;font-size:22px}
.login-slogan{font-size:12px;font-weight:600;color:var(--gold);letter-spacing:.03em}
.login-sub{font-size:10px;letter-spacing:.22em;color:var(--dim);margin-bottom:8px}
.login-card input{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:11px 13px;border-radius:9px;font-size:14px}
.login-card input:focus{outline:none;border-color:var(--accent)}
.login-err{color:var(--neg-soft);font-size:12px}
.login-switch{color:var(--dim);font-size:11px;cursor:pointer;margin-top:4px}.login-switch:hover{color:var(--accent)}
.filters-row{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.dd{position:relative}
.dd-btn{background:var(--panel);border:1px solid var(--line);color:var(--txt);padding:9px 14px;border-radius:9px;font-size:13px}
.dd-btn.set{border-color:var(--accent);color:var(--accent)}
.dd-menu{position:absolute;top:100%;left:0;min-width:250px;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:6px;z-index:30;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.dd-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;font-size:13px;color:var(--dim);cursor:pointer}
.dd-item:hover{background:var(--hover-2);color:var(--txt)}
.dd-item.on{color:var(--accent)}
.dd-box{width:12px;height:12px;flex-shrink:0;border:1px solid var(--line-strong);border-radius:3px;position:relative}
.dd-item.on .dd-box{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent)}
.dd-item.on .dd-box::after{content:"";position:absolute;left:3px;top:0;width:3px;height:6px;border:solid var(--accent);border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.sort-ord{font-size:9px;color:var(--accent);margin-left:1px}
.dd-n{margin-left:auto;color:var(--txt);font-size:12px}
.dash{display:flex;flex-direction:column;gap:14px}
.dash-actions{display:flex;justify-content:flex-end;align-items:center;gap:12px;flex-wrap:wrap}
.tier-seg{margin-right:auto}.tier-seg button{font-size:12px}
.dash-warn{color:var(--warn);font-size:12px;font-weight:600}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
.kdelta{font-size:11px;margin-top:4px}
.spark{display:flex;align-items:flex-end;gap:8px;height:120px}
.sbar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;height:100%}
.sbar i{display:block;width:100%;background:linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 45%,var(--panel)));border-radius:4px 4px 0 0}
.sbar b{font-size:9px;color:var(--dim);font-weight:400}
.dash-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.lrow{display:flex;align-items:center;gap:10px;padding:7px 8px;margin:0 -8px;border-bottom:1px solid var(--line-soft);font-size:13px;cursor:pointer;border-radius:8px;transition:background .1s}
.lrow:hover{background:var(--hover)}
.lrow .rk{color:var(--dim);font-size:11px;width:26px}
.lrow .amt{margin-left:auto;font-weight:600}
.list-card{position:relative;overflow:hidden}
.list-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--acc)}
.list-card.muted{opacity:.6}
.notif{position:relative}
.notif-bell{position:relative;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:7px 10px;font-size:14px;line-height:1;cursor:pointer}
.notif-bell.crit{border-color:var(--neg)}
.notif-badge{position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--on-accent-ink);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
.notif-badge.crit{background:var(--neg);color:var(--on-accent)}
.notif-overlay{position:fixed;inset:0;z-index:40}
.notif-panel{position:absolute;top:calc(100% + 8px);right:0;width:320px;max-width:90vw;background:var(--panel2);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.6);z-index:41;overflow:hidden}
.notif-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);font-size:13px;color:var(--txt);font-weight:600}
.notif-clear{background:none;border:none;color:var(--dim);font-size:11px;cursor:pointer;text-transform:none;letter-spacing:0}
.notif-clear:hover{color:var(--txt)}
.notif-empty{padding:18px 14px;color:var(--dim);font-size:13px;text-align:center}
.notif-row{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}
.notif-row:last-child{border-bottom:none}
.notif-row.crit{background:rgba(248,113,113,.07)}
.notif-ico{font-size:14px;flex:0 0 auto;margin-top:1px}
.notif-body{flex:1;min-width:0}
.notif-text{font-size:13px;color:var(--txt)}
.notif-detail{font-size:11px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notif-x{background:none;border:none;color:var(--dim);cursor:pointer;font-size:12px;flex:0 0 auto;line-height:1}
.notif-x:hover{color:var(--txt)}
.tierrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
@media (max-width:1000px){.kpis{grid-template-columns:repeat(2,1fr)}.dash-grid{grid-template-columns:1fr}}
.perfwrap{display:flex;flex-direction:column;gap:14px}
.perf-note{color:var(--dim);font-size:12px;line-height:1.5}
.perf-tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl-x{overflow-x:auto;max-width:100%}
.perf-tbl th{color:var(--dim);font-size:11.5px;font-weight:600;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
.perf-tbl th.r,.perf-tbl td.r{text-align:right}
.perf-tbl td{padding:8px 10px;border-bottom:1px solid var(--line-soft)}
.lc-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:4px 0 14px}
.lc-chips{display:flex;gap:8px;flex-wrap:wrap}
.lc-sum{display:flex;gap:18px;margin:0 0 12px;font-size:12px;color:var(--dim)}
.lc-sum b{color:var(--txt)}
.lc-box{width:24px;height:24px;border-radius:6px;border:1px solid var(--line);background:var(--panel2);color:var(--accent);font-size:14px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.lc-box.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 18%,var(--panel2))}
.lc-box:disabled{opacity:.4;cursor:default}
.lc-unassigned{margin-top:20px;border:1px dashed var(--line);border-radius:10px;padding:12px 14px}
.lc-date{background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:5px 8px;font-size:12px;font-family:inherit;color-scheme:dark}
.lc-empty{border:1px dashed var(--line);border-radius:12px;padding:34px 20px;text-align:center;margin-top:8px}
.perf-mark{margin-left:8px;font-size:11px;color:var(--warn);border:1px solid color-mix(in srgb,var(--warn) 40%,transparent);border-radius:4px;padding:1px 6px;white-space:nowrap}
.perf-tbl td.perf-child{padding-left:28px;color:var(--dim)}
.perf-row{cursor:pointer;transition:background .1s}.perf-row:hover{background:var(--panel2)}.perf-row.open{background:var(--panel2)}
.perf-drill>td{padding:0 10px 10px;border-bottom:1px solid var(--line-soft)}
.perf-players{display:flex;flex-direction:column;gap:2px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 8px;max-height:280px;overflow:auto}
.perf-player{display:flex;align-items:center;gap:10px;font-size:12px;padding:4px 4px;border-bottom:1px solid var(--line-soft)}.perf-player:last-child{border-bottom:none}
.perf-player.clickable{cursor:pointer;border-radius:6px}.perf-player.clickable:hover{background:var(--line-soft)}
.pp-name{font-weight:600;color:var(--txt);min-width:120px}.pp-meta{color:var(--dim);flex:1;font-size:11px}
.pp-date{color:var(--dim);font-size:11px}.pp-status{font-weight:600;font-size:11px;min-width:96px;text-align:right}
/* KPI retention scorecard */
.kpi-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin-top:12px}
.kpi-cols>*,.kpi-team-two>*{min-width:0}
.ptbl-scroll{overflow-x:auto;max-width:100%}
@media (max-width:900px){.kpi-cols{grid-template-columns:1fr}}
.kpi-tbl{margin:0}
.kpi-tbl th,.kpi-tbl td{padding:6px 6px}
.kpi-tbl th{font-size:9px}
.kpi-in{width:58px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:4px 5px;border-radius:6px;font-size:12px;text-align:right;font-family:inherit}
.kpi-in.ok{border-color:var(--pos-line)}.kpi-in.warn{border-color:var(--amber-line)}.kpi-in.bad{border-color:var(--bad-line)}
.kpi-val{cursor:pointer;display:inline-flex;align-items:center;gap:4px;justify-content:flex-end;width:100%;user-select:none}
.kpi-pencil{font-size:10px;color:var(--dim);opacity:.5}
.auto-pct{display:inline-flex;align-items:center;gap:5px;justify-content:flex-end;width:100%}
.auto-badge{font-size:10px;color:var(--pos-soft-2);border:1px solid var(--pos-line);border-radius:8px;padding:1px 5px;font-weight:700}
.kpi-val:hover .kpi-pencil{opacity:1;color:var(--accent)}
.kpi-tbl td.ok{color:var(--pos)}.kpi-tbl td.warn{color:var(--warn)}.kpi-tbl td.bad{color:var(--neg)}
.kpi-team td{border-top:2px solid var(--line);font-weight:700;background:rgba(255,255,255,.02)}
.need-cell{position:relative}
.need-btn{background:none;border:none;color:var(--accent);font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0}
.cand-pop{position:absolute;right:4px;top:100%;z-index:30;width:252px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 38px rgba(0,0,0,.6);padding:12px 13px;text-align:left}
.cand-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.cand-title{font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--txt)}
.cand-x{background:none;border:none;color:var(--dim);cursor:pointer;font-size:12px;padding:0 2px}
.cand-sub{font-size:10px;color:var(--accent);margin:3px 0 9px;letter-spacing:.02em}
.cand-tbl{width:100%;border-collapse:collapse;font-size:12px}
.cand-tbl th{font-size:11px;font-weight:600;color:var(--dim);text-align:left;padding:0 0 5px;border-bottom:1px solid var(--line)}
.cand-tbl th.r{text-align:right}
.cand-tbl td{padding:5px 0;border-bottom:1px solid var(--line-soft)}
.cand-tbl tbody tr:last-child td{border-bottom:none}
.cand-tbl tbody tr:hover td{background:rgba(255,255,255,.03)}
.cand-rk{color:var(--dim);font-size:10px;width:16px}
.cand-name{color:var(--txt)}
.cand-pnl{color:var(--dim)}
.cand-empty{font-size:11px;color:var(--dim);font-style:italic;padding:8px 0;text-align:center}
.cand-foot{display:flex;gap:7px;margin-top:11px}
.cand-foot button{flex:1;font-size:11px;padding:6px 8px;text-align:center}
.kpi-brand{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--txt);font:inherit;cursor:pointer;padding:0}
.kpi-brand:hover{color:var(--accent)}
.kpi-arrow{color:var(--dim);font-size:11px;opacity:0;transition:opacity .12s}
.kpi-brand:hover .kpi-arrow{opacity:1;color:var(--accent)}
.kpi-saved{color:var(--pos);font-weight:700}
.kpi-team-inputs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0 4px}
.kpi-team-inputs.two{grid-template-columns:1fr 1fr}
.tc-prov{color:var(--accent);font-weight:700;margin-left:1px}
.kpi-bonus{margin-top:14px}
.bon-badge{font-size:10px;font-weight:700;letter-spacing:.04em;padding:1px 6px;border-radius:6px;margin-left:6px}
.bon-badge.ok{color:var(--pos);background:rgba(74,222,128,.12)}
.bon-badge.lock{color:var(--slate);background:rgba(148,163,184,.12)}
.bon-dim td{opacity:.45}
.bon-note{font-size:10px;font-weight:500;color:var(--dim);letter-spacing:0;text-transform:none}
.lb-add{font-size:11px;color:var(--accent);margin-right:6px;opacity:.85}
.infotip{position:relative;display:inline-flex;vertical-align:middle;margin-left:6px;cursor:help;outline:none}
.infotip-i{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid var(--dim);color:var(--dim);font:700 10px/1 Georgia,serif;font-style:italic;text-transform:none;letter-spacing:0;transition:color .12s,border-color .12s}
.infotip:hover .infotip-i,.infotip:focus .infotip-i{border-color:var(--accent);color:var(--accent)}
.infotip-pop{position:absolute;top:22px;left:0;z-index:60;width:290px;max-width:78vw;display:none;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;box-shadow:0 12px 34px rgba(0,0,0,.55);color:var(--dim);font:400 12px/1.5 inherit;text-transform:none;letter-spacing:0;white-space:normal;text-align:left;opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity .12s,transform .12s;pointer-events:none}
.infotip.r .infotip-pop{left:auto;right:0}
.infotip:hover .infotip-pop,.infotip:focus .infotip-pop,.infotip:focus-within .infotip-pop{display:block;opacity:1;visibility:visible;transform:translateY(0)}
@media (max-width:640px){.infotip-pop,.infotip.r .infotip-pop{position:fixed;left:16px;right:16px;top:auto;bottom:16px;width:auto;max-width:none}}
.infotip-pop b{color:var(--txt)}
.infotip-pop .it-data{display:block;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:11px}
.kpi-empty{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:11px 14px;margin-bottom:14px;color:var(--dim);font-size:12.5px;line-height:1.5}
.kpi-disabled{color:var(--dim);font-size:13px;line-height:1.55}.kpi-disabled b{color:var(--accent)}
.kpi-empty b{color:var(--accent)}
.snap-card{margin-top:16px}
.snap-grid{display:flex;flex-direction:column;gap:2px}
.snap-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.snap-row:last-child{border-bottom:none}
.snap-k{font-size:12px;color:var(--dim)}
.snap-v{font-size:13px;font-weight:600;color:var(--txt);text-align:right}
.snap-v.ok{color:var(--pos)}.snap-v.warn{color:var(--warn)}
.snap-sub{color:var(--dim);font-weight:400}
.perm-list{display:flex;flex-direction:column;gap:8px;margin-bottom:6px}
.perm-row{border:1px solid var(--line);border-radius:10px;background:var(--panel2);overflow:hidden}
.perm-row.open{border-color:var(--accent)}
.perm-head{display:flex;align-items:center;gap:10px;padding:9px 12px}
.perm-name{font-weight:600;font-size:13px;color:var(--txt);min-width:90px}
.perm-you{color:var(--accent);font-size:11px;font-weight:400}
.perm-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;border:1px solid var(--line);color:var(--dim)}
.perm-badge.admin{color:var(--warn);border-color:rgba(251,191,36,.4)}
.perm-badge.agent{color:var(--pos);border-color:rgba(74,222,128,.4)}
.perm-badge.viewer{color:var(--slate);border-color:rgba(148,163,184,.4)}
.perm-chips{display:flex;flex-wrap:wrap;gap:4px;flex:1}
.perm-chip{font-size:10px;color:var(--dim);background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.perm-chip.none{opacity:.6}
.perm-head-act{display:flex;align-items:center;gap:6px;margin-left:auto}
.perm-editor{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:12px;border-top:1px solid var(--line);background:var(--panel)}
.perm-field{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim)}
.perm-role{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:5px 8px;border-radius:7px;font-size:13px;text-transform:none;letter-spacing:0}
.perm-boxes{display:flex;flex-wrap:wrap;gap:14px}
.perm-box{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--txt);cursor:pointer}
.perm-box input{width:15px;height:15px;cursor:pointer;accent-color:var(--accent)}
.perm-new{margin-top:12px}
.act-filters{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px}
.act-filters input,.act-filters select,.act-filters .live-csb{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:8px 10px;border-radius:8px;font-size:13px}
.act-filters input[type=date]{color-scheme:dark}
.act-wrap{flex:1;min-height:260px;max-height:72vh;overflow:auto}
.act-tbl{font-size:12.5px}
.act-tbl th,.act-tbl td{padding:7px 9px}
.act-tbl thead th{position:sticky;top:0;background:var(--panel);z-index:1}
.act-time{white-space:nowrap;color:var(--dim)}
.act-ip{color:var(--dim);font-size:11px}
.act-detail{color:var(--txt)}
.set-tg{grid-column:1/-1}
.tg-imp-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:10px}
.tg-file,.tg-prev{font-size:12px;color:var(--dim)}
.tg-imp-area{width:100%;box-sizing:border-box;min-height:88px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:10px 12px;font-size:12px;font-family:'IBM Plex Mono',monospace;resize:vertical}
.tg-imp-foot{display:flex;align-items:center;margin-top:10px}
.tg-bad{margin-top:8px;font-size:11px;color:var(--warn);line-height:1.5;word-break:break-word}
.kpi-h3{display:flex;align-items:center;justify-content:space-between;gap:10px}
.kpi-refresh{font-size:11px;padding:5px 10px;text-transform:none;letter-spacing:0}
.kpis2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
@media (max-width:900px){.kpis2{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:460px){.kpis2{grid-template-columns:1fr}}
.kpi2{position:relative;background:linear-gradient(160deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:13px;padding:14px 16px 13px 18px;overflow:hidden;transition:transform .12s,border-color .12s}
.kpi2:hover{transform:translateY(-2px);border-color:var(--line-strong)}
.kpi2-wrap.has-pop .kpi2{cursor:help}
.kpi2-wrap.has-pop:hover .kpi2,.kpi2-wrap.has-pop:focus-within .kpi2{border-color:var(--accent-line);background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 6%,var(--panel2)),var(--panel));transform:translateY(-2px)}
.kpi2-wrap:focus-visible{outline:none}.kpi2-wrap:focus-visible .kpi2{box-shadow:0 0 0 2px var(--focus)}
.k2-lab{font-size:12px;color:var(--dim);font-weight:600;margin-bottom:7px}
.k2-val{font-size:26px;font-weight:600;color:var(--txt);line-height:1;font-variant-numeric:tabular-nums}
.k2-val.pos{color:var(--pos)}.k2-val.neg{color:var(--neg)}
.k2-sub{font-size:11px;color:var(--dim);margin-top:7px}
.k2-up{color:var(--pos);font-weight:600}.k2-down{color:var(--neg);font-weight:600}.k2-flat{color:var(--dim)}
.kpi2.muted{opacity:.6}.kpi2.muted .k2-val{color:var(--dim)}.kpi2.muted .k2-sub{font-style:italic}
.kpi2-wrap{position:relative}
.kpi2-pop{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--panel2);border:1px solid var(--accent-line);border-radius:11px;padding:9px 12px;box-shadow:0 16px 40px rgba(0,0,0,.6);z-index:20;opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity .12s,transform .12s;pointer-events:none}
.kpi2-wrap:hover .kpi2-pop,.kpi2-wrap:focus-within .kpi2-pop{opacity:1;visibility:visible;transform:translateY(0)}
.kp-row{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px}
.kp-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.kp-lab{color:var(--dim);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kp-val{color:var(--txt);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.dash-trend-head{display:flex;align-items:center;gap:10px}
.trend-brand{background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:4px 9px;font-size:12px;text-transform:none;letter-spacing:0}
.range-toggle{display:inline-flex;gap:4px;margin-left:auto}
.range-toggle button{background:var(--panel2);border:1px solid var(--line);color:var(--dim);border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer}
.range-toggle button.on{background:var(--accent);color:var(--on-accent-ink);border-color:var(--accent);font-weight:700}
.trend-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--dim);margin:2px 0 6px}
.trend-legend span{display:inline-flex;align-items:center;gap:6px}.trend-legend i{width:14px;height:0;border-top:2px solid var(--c)}.trend-legend i.dash{border-top-style:dashed}
.trend-sub{font-size:13px;font-weight:600;color:var(--txt);margin:14px 0 2px}
.trend-end{fill:var(--dim);font-size:11px}
.trend-insight{font-size:12px;color:var(--dim);margin:0 0 6px}
.trend-insight b{font-weight:700;color:var(--txt)}
.trend-insight b.ins-bad{color:var(--neg)}.trend-insight b.ins-good{color:var(--pos)}
.trend-wrap{position:relative;margin-top:2px}
.trend-svg{display:block;width:100%}
.trend-axis{stroke:var(--line);stroke-width:1}
.trend-grid{stroke:var(--line);stroke-width:1;opacity:.3}
.trend-guide{stroke:var(--line);stroke-width:1;stroke-dasharray:3 3}
.trend-xlab{fill:var(--dim);font-size:10.5px}
.trend-axlab{fill:var(--dim);font-size:10.5px}
.trend-tip{position:absolute;top:-4px;transform:translateX(-50%);background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:10px 13px;min-width:210px;box-shadow:0 16px 40px rgba(0,0,0,.6);pointer-events:none;z-index:6}
.tip-date{font-size:12px;font-weight:700;color:var(--txt);padding-bottom:7px;margin-bottom:5px;border-bottom:1px solid var(--line)}
.tip-row{display:flex;align-items:center;gap:9px;padding:3px 0;font-size:12px}
.tip-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.tip-lab{color:var(--dim);flex:1;white-space:nowrap}
.tip-val{color:var(--txt);font-weight:700;font-variant-numeric:tabular-nums}
.brand-tbl td,.brand-tbl th{padding:8px 10px}
.brand-row{cursor:pointer}
.brand-row:hover td{background:var(--hover)}
.brand-row.sel td{background:var(--accent-bg)}.brand-row.sel td:first-child{box-shadow:inset 3px 0 0 var(--accent)}
.brand-tbl td .b-dot{margin-right:7px}
.list-of{font-weight:400;font-size:11px;margin-left:8px}
.viewonly-banner{background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.32);color:var(--dim);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px}
.tc-auto{margin-top:8px;font-size:11px}
@media (max-width:760px){.kpi-team-inputs{grid-template-columns:1fr 1fr}}
.kpi-tinp{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--dim)}
.kpi-tinp .kpi-in{width:100%;box-sizing:border-box;text-align:left}
.kpi-base{margin-top:10px;max-width:540px}
.kpi-base td.ok{color:var(--pos)}.kpi-base td.warn{color:var(--warn)}.kpi-base td.bad{color:var(--neg)}
.kpi-base .kpi-total td{border-top:2px solid var(--line);font-weight:700;font-size:14px;padding-top:9px}
/* Performance page grid: main content column (left) + Leaderboard sidebar (right) */
.perf-grid{display:grid;grid-template-columns:1fr 300px;gap:18px;align-items:start}
@media (max-width:980px){.perf-grid{grid-template-columns:1fr}}
.perf-main{display:flex;flex-direction:column;gap:14px;min-width:0}
.perf-side{min-width:0}
/* Team KPI box holds Base Score + Team Challenge side by side */
.kpi-team-two{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;margin-top:4px}
@media (max-width:820px){.kpi-team-two{grid-template-columns:1fr}}
.kpi-team-col{min-width:0}
.kpi-subhead{font-size:13px;color:var(--txt);margin-bottom:8px;font-weight:600;display:flex;align-items:center;gap:8px}
.kpi-for{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:3px 8px;border-radius:7px;font-size:11px;text-transform:none;letter-spacing:0;font-weight:400}
.lb-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.lb-row{display:flex;align-items:center;gap:9px;padding:7px 9px;background:var(--panel2);border:1px solid var(--line);border-radius:9px}
.lb-row.top{border-color:var(--gold-line-2)}
.lb-rank{width:22px;text-align:center;font-weight:700;font-size:13px;color:var(--dim);flex-shrink:0}
.lb-name{flex:1;font-size:13px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-mark{width:58px;text-align:right;flex-shrink:0}
.lb-kpi{width:42px;text-align:right;font-weight:700;font-size:14px;flex-shrink:0}
.lb-kpi.ok{color:var(--pos)}.lb-kpi.warn{color:var(--warn)}.lb-kpi.bad{color:var(--neg)}
.lb-x{background:none;border:none;color:var(--dim);cursor:pointer;font-size:12px;padding:0 2px;flex-shrink:0;opacity:.55}
.lb-x:hover{opacity:1;color:var(--neg)}
.lb-add{display:flex;gap:7px;margin-top:10px}
.lb-add input{flex:1;min-width:0;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:8px 10px;border-radius:8px;font-size:13px}
.lb-add .btn-ghost{flex-shrink:0;font-size:12px;padding:7px 12px}
/* Mistake log */
.mk-form{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.mk-form select,.mk-form input,.mk-form .live-csb{background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:8px 10px;border-radius:8px;font-size:13px}
.mk-pts{width:64px;text-align:right}
.mk-note{flex:1;min-width:160px}
.mk-tally{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}
.mk-chip{font-size:11px;background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:3px 10px;color:var(--dim)}
.mk-tbl{margin-top:8px}
.mk-notecell{color:var(--dim);font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ro-tag{font-size:9px;background:var(--panel2);border:1px solid var(--line);color:var(--dim);padding:2px 7px;border-radius:10px;letter-spacing:.06em;margin-left:8px;text-transform:uppercase;font-weight:400;vertical-align:middle}
.settings{display:grid;grid-template-columns:minmax(300px,400px) 1fr;grid-template-areas:"accounts activity" "password activity";gap:14px;max-width:1500px;align-items:start}
.set-accounts{grid-area:accounts}
.set-password{grid-area:password}
.act-card{grid-area:activity;align-self:stretch;display:flex;flex-direction:column}
.set-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px}
.set-card h3{font-size:15px;font-weight:600;color:var(--txt);margin-bottom:12px}
.urow{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft);font-size:14px}
.urow em{color:var(--dim);font-size:11px;margin-left:8px}
.form-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.form-row input,.form-row select,.form-row .live-csb{flex:1;min-width:110px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);padding:9px 12px;border-radius:8px;font-size:13px}
.hint{margin-top:10px;color:var(--dim);font-size:11px}
.set-msg{grid-column:1/-1;color:var(--accent);font-size:13px}
.bigmsg{padding:60px 20px;text-align:center;color:var(--dim);font-size:14px}.bigmsg.err{color:var(--neg-soft)}
.settings > *{min-width:0}.act-wrap{overflow-x:auto}
@media (max-width:1000px){.settings{grid-template-columns:minmax(0,1fr);grid-template-areas:"accounts" "password" "activity"}.act-card{align-self:auto}.act-wrap{max-height:560px}}
/* Responsive: tablet → phone. Rules only bind at narrow widths; desktop is unchanged. */
/* Wide tables (Brand Health, By CS/Class, retention) scroll inside their card instead of
   widening the whole page. display:block only kicks in when narrow, so desktop tables still fill. */
@media (max-width:1024px){main{padding:16px}.top{gap:16px}.tabs{margin-left:0}
  .perf-tbl{white-space:nowrap}}
@media (max-width:820px){.vstrip{grid-template-columns:repeat(2,1fr)}.dgrid,.hooks{grid-template-columns:1fr}.snapbar{width:100%}.snapbar > :nth-child(2){margin-left:0}.search{max-width:none}}
@media (max-width:640px){.top{gap:12px}.tabs{order:3;width:100%;justify-content:space-between;gap:4px;margin-left:0}.tabs button{flex:1;padding:8px 6px;font-size:12px}.top-right{margin-left:0;width:100%;flex-wrap:wrap;justify-content:flex-start}main{padding:12px}.search{flex:1 1 100%}.snap{font-size:11px}}
@media (max-width:420px){.tabs button{font-size:11px;padding:7px 3px}.plaque{min-width:calc(50% - 4px)}}
@media (max-width:640px){.view-seg{flex-shrink:1;max-width:100%;overflow-x:auto}.seg button{white-space:nowrap}
  .dl-row{flex-wrap:wrap;row-gap:2px}.dl-rtag{white-space:normal;order:5;flex-basis:100%;padding-left:19px}.dl-amt{margin-left:auto}}
@media (prefers-reduced-motion:reduce){.plaque{transition:none}}
.perf-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:4px 0 12px}
.perf-month{font-size:13px;color:var(--accent);font-weight:600;display:flex;align-items:center;gap:7px}
.perf-mth-sel{background:var(--panel2);border:1px solid var(--line);color:var(--accent);border-radius:7px;padding:5px 9px;font-size:12.5px;font-family:inherit;font-weight:600}

/* ── Campaigns · VVIP Redeem Code ────────────────────────────────────────
   Eligible rows are the highlighted (gold) set — they are the work. Claimed
   rows are dimmed, not coloured: every row in that table is claimed, so a
   colour there would carry no information. Red is reserved for exceptions. */
.camp{display:flex;flex-direction:column;gap:14px}
.camp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.camp-t1{font-size:17px;font-weight:700}
.camp-t2{font-size:12px;color:var(--dim);margin-top:2px}
.camp-daybar{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.camp-warn{font-size:11.5px;color:var(--stale);border:1px solid var(--stale-line);background:var(--stale-bg);padding:5px 9px;border-radius:6px}
/* Rotation strip — deliberately one line. The week grid is opt-in so the
   calendar informs the page instead of taking it over. */
.camp-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 13px;border-radius:10px;
  background:var(--panel);border:1px solid var(--line);font-size:12.5px}
.camp-strip.mine{background:var(--accent-bg);border-color:var(--accent)}
.camp-strip.rest{background:var(--stale-bg);border-color:var(--stale-line)}
.camp-strip-date{font-weight:700}
.camp-strip.mine .camp-strip-date{color:var(--accent)}
.camp-strip-team{font-size:10.5px;border:1px solid var(--line);color:var(--dim);padding:3px 8px;border-radius:5px}
.camp-strip-team.on{background:var(--accent);color:var(--on-accent-ink);border-color:var(--accent);font-weight:700}
.camp-strip-tier b{color:var(--txt)}
.camp-strip-not{font-size:11px;color:var(--dim)}
.camp-strip-right{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.camp-link{background:none;border:none;color:var(--accent);font-size:11.5px;cursor:pointer;padding:0;font-family:inherit}
.camp-link:hover{text-decoration:underline}
.camp-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
.camp-wday{background:var(--panel2);border:1px solid transparent;border-radius:8px;padding:7px 4px;
  text-align:center;cursor:pointer;color:var(--txt);font-family:inherit}
.camp-wday:hover{border-color:var(--line)}
.camp-wday.mine{background:var(--accent-bg)}
.camp-wday.cur{border-color:var(--accent)}
.camp-wday.rest{background:var(--bg);color:var(--dim)}
.camp-wd{font-size:10px;color:var(--dim)}
.camp-wt{font-size:12px;margin-top:2px}
.camp-wday.mine .camp-wt{color:var(--accent);font-weight:700}
.camp-wtier{font-size:9.5px;color:var(--dim)}
.camp-tierlock{background:var(--accent-bg);border:1px solid var(--accent);color:var(--accent);
  border-radius:8px;padding:8px 11px;font-size:12.5px}
.camp-msg{font-size:12.5px;padding:9px 13px;border-radius:9px;background:var(--pos-bg);border:1px solid var(--pos-line-2);color:var(--pos-soft)}
.camp-msg.bad{background:var(--stale-bg);border-color:var(--stale-line);color:var(--stale)}
.camp-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.camp-row-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.camp-search{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.camp-search input{flex:1;min-width:170px}
.camp-none{font-size:12.5px;color:var(--dim);padding:10px 2px}
.camp-hit{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  border:1px solid var(--accent);background:var(--accent-bg);border-radius:10px;padding:11px 13px;margin-top:10px}
.camp-hit.done{border-color:var(--line);background:var(--panel2);opacity:.72}
.camp-hit-main{min-width:0}
.camp-hit-id{font-size:15px;font-weight:700}
.camp-hit-sub{font-size:11.5px;color:var(--dim)}
.camp-hit-act{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.camp-code{font-size:13px;color:var(--accent)}
.camp-tag{font-size:10.5px;border:1px solid var(--line);color:var(--dim);padding:3px 8px;border-radius:5px;white-space:nowrap}
.camp-tag.done{border-color:var(--pos-line-2);background:var(--pos-bg);color:var(--pos)}
.camp-tag.warn{border-color:var(--stale-line);background:var(--stale-bg);color:var(--stale)}
.camp-tag.bad{border-color:var(--neg-line);background:var(--neg-bg);color:var(--neg-soft)}
.camp-ev{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
  border-top:1px solid var(--line);padding:10px 0;font-size:12.5px}
.camp-ev-l,.camp-ev-m,.camp-ev-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.camp-band{font-size:11.5px;color:var(--dim);background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:4px 9px}
.camp-ev-r .btn-ghost{padding:5px 10px}
.btn-ghost.danger:hover{color:var(--neg);border-color:var(--neg-line)}
.camp-new{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.camp-new select,.camp-new input,.camp-new .live-csb{background:var(--panel2);border:1px solid var(--line);color:var(--txt);
  border-radius:8px;padding:8px 10px;font-size:12.5px;font-family:inherit}
.camp-newband{display:flex;align-items:center;gap:6px}
.camp-note{font-size:11.5px;color:var(--dim);margin-top:9px;line-height:1.6}
.camp-sub{font-size:12px;color:var(--dim);margin:14px 0 7px}
.camp-sub.gold{color:var(--accent)}
.camp-tbl{font-size:12px}
.camp-tbl.dimmed{opacity:.62}
/* A | B side by side. Each column scrolls inside itself so pool size never
   changes the page height — JK32's 895 players read the same as BM69's 149. */
.camp-split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.camp-col{border:1px solid var(--line);border-radius:10px;overflow:hidden;min-width:0}
.camp-col-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;
  background:var(--panel2);border-bottom:1px solid var(--line);font-size:12px}
.camp-col-t{font-weight:700;color:var(--accent)}
.camp-col-n{margin-left:auto;color:var(--dim);white-space:nowrap}
.camp-col-scroll{overflow-x:auto}
.camp-col-scroll .perf-tbl thead th{position:sticky;top:0;background:var(--panel);z-index:1}
.camp-bandedit{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 0;border-top:1px solid var(--line)}
.camp-bandedit input{background:var(--panel2);border:1px solid var(--line);color:var(--txt);
  border-radius:8px;padding:8px 10px;font-size:12.5px;font-family:inherit}
@media (max-width:860px){.camp-split{grid-template-columns:1fr}}
.camp-tbl tr.camp-live{background:var(--accent-bg)}
.camp-tbl tr.camp-live td:first-child{border-left:2px solid var(--accent)}
.camp-agents{display:flex;gap:8px;flex-wrap:wrap}
.camp-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:42;width:360px;max-width:92vw;
  background:var(--panel);border:1px solid var(--accent);border-radius:12px;padding:17px 19px}
.camp-modal-t{font-size:15px;font-weight:700}
.camp-modal-s{font-size:11.5px;color:var(--dim);margin-top:4px;line-height:1.6}
.camp-modal-box{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:12px;margin:12px 0;text-align:center}
.camp-modal-code{font-size:19px;letter-spacing:.06em;margin:5px 0}
.camp-modal-code.gold{color:var(--accent)}
.camp-nocontact{background:var(--stale-bg);border:1px solid var(--stale-line);color:var(--stale);font-size:11.5px;
  padding:10px 12px;border-radius:8px;margin:12px 0;line-height:1.65}
.camp-modal-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.camp-modal-btns button{flex:1;min-width:118px}
.camp-modal-cancel{width:100%;margin-top:8px}
@media (max-width:640px){.camp-ev{flex-direction:column;align-items:flex-start}}
`;
  return <style>{scope ? scopeLiveCss(css) : css}</style>;
}