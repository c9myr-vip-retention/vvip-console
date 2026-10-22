// ═══════════════════════════════════════════════════
// GROUP B HIGH ROLLER TRACKER — Cloudflare Worker
// Handles all API routes between React app and D1
// v2: adds POST /api/ingest (Google Sheets feeder → player_days)
// ═══════════════════════════════════════════════════

import { handleWork } from "./work/index.js";
import { handleRoles } from "./roles.js";
import { liveBump } from "./work/pulse.js";
import { loadRoles, resolvePerms, rolePerms, legacyColumns, filterPeople } from "./perms.js";

function corsFor(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed =
    origin === "https://groupb-tracker.pages.dev" ||
    /^https:\/\/[a-z0-9-]+\.groupb-tracker\.pages\.dev$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://groupb-tracker.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}
let CORS = {}; // populated per-request in fetch()

const SESSION_TTL_HOURS = 8;

// Brand → team map. A non-manager user is locked to their team's brands;
// managers (manage_users=1) see all. Keep in sync with TEAMS in App.jsx.
const TEAM_BRANDS = {
  A: ["JOM99", "EZ96", "PP96", "BIG321", "FUN36", "JUS22", "YES82", "SA"],
  B: ["LPK777", "BM69", "HOT321", "RM68", "SK69", "ACE33", "JK32", "ZAS36"],
  C: ["SPIN321", "MY36", "VS96", "ONG66", "RUSH33", "MAX39", "OMG67", "AC69", "OG"],
};

// Staff team moves. `on` = first day on the new team (MYT). Work before it stays with the old
// team's brands; By CS in the old team also shows an extra "<user> · Team <to>" row for the work
// since the move, and both teams mark the row. Add a line here for each future move.
const STAFF_MOVES = [
  { user: "quinton", from: "A", to: "B", on: "2026-10-18" },
  { user: "jason",   from: "B", to: "A", on: "2026-10-18" },
  { user: "mexha",   from: "C", to: "A", on: "2026-10-18" },
];

/* ══ CAMPAIGN ROTATION CALENDAR ═══════════════════════════════════════════════
   Whose day it is, and which tier, computed from the date — nothing stored.

   Three fixed day-pairs; teams shift one slot every week, so both peak days
   (Sun and Sat) rotate. Over one 3-week cycle each team gets exactly 6 days,
   1 Saturday, 1 Sunday, 4 Zyra Tier V days and 2 Zyra Tier 3 days. Friday is a
   rest day, so the week is 6 campaign days over 3 teams = 2 days each.

   Tier is NOT a choice — it falls out of the weekday:
     Sun–Wed : TC Tier 3, Zyra Tier V
     Thu, Sat: TC Tier V, Zyra Tier 3

   KEEP IN SYNC with the same block in App.jsx. Verified fair over 3 cycles.   */
/* MASTER SWITCH for the 00:00 cron. OFF while the campaign is still being
   prepared — otherwise the very first deploy would start writing real draft
   events overnight for whichever team the rotation names. Flip to true on the
   day you actually go live, then redeploy the worker.
   The manual POST /api/rtn/campaign/auto-create still works while this is off,
   so the job can be tested on demand without it running by itself. */
const AUTO_CREATE_ENABLED = false;

const CAMPAIGN_ANCHOR = "2026-07-26";                       // a Sunday = rotation week 1
const CAMPAIGN_SLOTS = [["Sun", "Wed"], ["Mon", "Thu"], ["Tue", "Sat"]];
const CAMPAIGN_TEAMS = ["A", "B", "C"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Hand-made July + August schedule (team per date). Neither month is the clean
   rotation — the teams tuned them by hand — so both are stored verbatim and win
   over the computed pattern. From September onward there is no override, so
   campaignDay() falls through to the generated rotation. Tier is NOT stored: the
   Sun-Wed = Tier V, Thu/Sat = Tier 3 rule held on every row of the sheet, so it
   stays computed. KEEP IN SYNC with the copy in App.jsx. */
const SCHEDULE_OVERRIDE = {
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

function campaignDay(iso) {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d)) return null;
  const day = DOW[d.getUTCDay()];
  if (day === "Fri") return { date: iso, day, rest: true };
  const zyra = (day === "Thu" || day === "Sat") ? "3" : "V";
  const base = { date: iso, day, rest: false, zyra, tc: zyra === "V" ? "3" : "V", peak: day === "Sat" || day === "Sun" };

  // Hand-made day wins. week/slot are meaningless for an override, so omit them.
  if (SCHEDULE_OVERRIDE[iso]) return { ...base, team: SCHEDULE_OVERRIDE[iso], source: "manual" };

  // Otherwise the generated rotation (August onward).
  const anchor = new Date(CAMPAIGN_ANCHOR + "T00:00:00Z");
  const weeks = Math.floor((d - anchor) / (7 * 86400000));   // floor continues the cycle backwards too
  const w = ((weeks % 3) + 3) % 3;
  const slot = CAMPAIGN_SLOTS.findIndex((s) => s.includes(day));
  return { ...base, week: w + 1, slot, team: CAMPAIGN_TEAMS[(slot + w) % 3], source: "rotation" };
}

// Split config — the twin of CODE_BANDS in App.jsx. Amounts are NOT here: they
// differ per brand and are entered per event. Reverting to 4 bands means
// editing both copies.
const CODE_BANDS = [
  { label: "A", share: 0.5 },
  { label: "B", share: 0.5 },
];

// Fisher–Yates over crypto RNG. The BO redeem system has no randomiser, so
// "luck" is entirely this shuffle — it must be server-side and unreproducible.
function shuffleSecure(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* Build one event: pull the tier pool, shuffle, split, write assignments.
   ONE implementation shared by the manual route and the 00:00 cron, so the two
   paths can never drift apart on how a pool is drawn or split.
   Returns { ok } or { error } — never throws into the caller.               */
async function createEventFor(env, { date, brand, tier, bands, createdBy }) {
  const dupe = await env.DB.prepare(
    "SELECT id, status FROM code_events WHERE event_date = ? AND brand = ? AND tier_segment = ?"
  ).bind(date, brand, tier).first();
  if (dupe) return { error: `already exists (${dupe.status})`, skipped: true };

  const snap = await env.DB.prepare("SELECT MAX(snapshot_date) AS d FROM player_days").first();
  if (!snap || !snap.d) return { error: "no snapshot data" };

  // Whole tier, no class/flag filtering — this is a campaign to a tier, not a
  // retention approach. Keeps the pool a plain query with no classifyAll mirror.
  // Players with NO uid are excluded right here: BO's audience upload keys on
  // user_id, so a uid-less player can't be exported — we skip them and run the
  // campaign for the rest. A brand with no uids at all (TC brands, OMG67) comes
  // back empty and is rejected below, so the promo still can't run on them.
  const pool = await env.DB.prepare(`
    SELECT player_key, uid, username FROM player_days
    WHERE snapshot_date = ? AND brand = ? AND tier_segment = ?
      AND uid IS NOT NULL AND TRIM(uid) <> ''`).bind(snap.d, brand, tier).all();
  const rows = pool.results || [];
  if (!rows.length) return { error: `no ${brand} Tier ${tier} players with a UID in the ${snap.d} snapshot`, noUid: true };

  const bandCfg = CODE_BANDS.map((cfg) => {
    const hit = (bands || []).find((x) => String(x.label).toUpperCase() === cfg.label) || {};
    return { label: cfg.label, share: cfg.share, code: String(hit.code || "").trim(), amount: Number(hit.amount) || 0 };
  });

  // Slice by share; the remainder on an odd pool goes to the CHEAPEST band,
  // which is why this sorts by amount rather than trusting label order.
  const n = rows.length;
  const counts = bandCfg.map((x) => Math.floor(n * x.share));
  let left = n - counts.reduce((s, c) => s + c, 0);
  const cheapFirst = bandCfg.map((x, i) => i).sort((i, j) => bandCfg[i].amount - bandCfg[j].amount);
  for (let k = 0; left > 0; k++, left--) counts[cheapFirst[k % bandCfg.length]]++;

  const shuffled = shuffleSecure(rows.slice());
  const ev = await env.DB.prepare(`
    INSERT INTO code_events (event_date, brand, tier_segment, status, pool_snapshot_date, pool_size, created_by)
    VALUES (?, ?, ?, 'draft', ?, ?, ?)`).bind(date, brand, tier, snap.d, n, createdBy).run();
  const eventId = ev.meta.last_row_id;

  let cursor = 0;
  for (let i = 0; i < bandCfg.length; i++) {
    const slice = shuffled.slice(cursor, cursor + counts[i]);
    cursor += counts[i];
    await env.DB.prepare(
      "INSERT INTO code_bands (event_id, label, code, amount, assigned) VALUES (?, ?, ?, ?, ?)"
    ).bind(eventId, bandCfg[i].label, bandCfg[i].code, bandCfg[i].amount, slice.length).run();
    for (let j = 0; j < slice.length; j += 25) {
      const chunk = slice.slice(j, j + 25);
      await env.DB.batch(chunk.map((r) => env.DB.prepare(`
        INSERT INTO code_assignments (event_id, player_key, uid, username, brand, tier_segment, label)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(eventId, r.player_key, r.uid, r.username, brand, tier, bandCfg[i].label)));
    }
  }
  // Integrity gate. The assignments go in as many separate batches, so a failure
  // partway leaves an event whose pool_size says 184 while only 100 rows landed —
  // and the export would then quietly ship a short list to BO, which is the exact
  // failure the uid check exists to prevent. Verify, and destroy the event if it
  // does not add up rather than leave a plausible-looking broken one behind.
  const check = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM code_assignments WHERE event_id = ?"
  ).bind(eventId).first();
  if (!check || check.n !== n) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM code_assignments WHERE event_id = ?").bind(eventId),
      env.DB.prepare("DELETE FROM code_bands WHERE event_id = ?").bind(eventId),
      env.DB.prepare("DELETE FROM code_events WHERE id = ?").bind(eventId),
    ]);
    return { error: `write incomplete — expected ${n} assignments, got ${check ? check.n : 0}. Event discarded, try again.` };
  }

  return { ok: true, event_id: eventId, pool_size: n, counts, snapshot: snap.d };
}

/* 00:00 MYT — create today's DRAFT events for whichever team the rotation says.
   Deliberately limited: it never enters codes, never exports, never locks and
   never touches an event someone already made. The one-way steps stay manual.
   TC brands fall out on their own via the uid check.                        */
async function autoCreateEvents(env, { dry = false, date } = {}) {
  const today = date || snapshotDateMYT();
  const plan = campaignDay(today);
  if (!plan) return { skipped: "bad date" };
  if (plan.rest) return { date: today, day: plan.day, skipped: "rest day", created: [], would: [] };

  const brands = TEAM_BRANDS[plan.team] || [];
  const created = [], skipped = [], would = [];

  // Dry run: report what it would build without writing a single row. Same
  // pool query and the same split arithmetic, so the preview cannot disagree
  // with the real run.
  if (dry) {
    const snap = await env.DB.prepare("SELECT MAX(snapshot_date) AS d FROM player_days").first();
    for (const brand of brands) {
      const dupe = await env.DB.prepare(
        "SELECT status FROM code_events WHERE event_date = ? AND brand = ? AND tier_segment = ?"
      ).bind(today, brand, plan.zyra).first();
      if (dupe) { skipped.push(`${brand}:already ${dupe.status}`); continue; }
      const row = await env.DB.prepare(`
        SELECT COUNT(*) AS pool,
               SUM(CASE WHEN uid IS NOT NULL AND TRIM(uid) <> '' THEN 1 ELSE 0 END) AS with_uid
        FROM player_days WHERE snapshot_date = ? AND brand = ? AND tier_segment = ?`
      ).bind(snap?.d, brand, plan.zyra).first();
      if (!row || !row.pool) { skipped.push(`${brand}:no players`); continue; }
      if (row.with_uid < row.pool) { skipped.push(`${brand}:no-uid`); continue; }
      const n = row.pool;
      const counts = CODE_BANDS.map((x) => Math.floor(n * x.share));
      let left = n - counts.reduce((s, c) => s + c, 0);
      for (let k = 0; left > 0; k++, left--) counts[k % counts.length]++;   // amounts unknown in a dry run; A first
      would.push(`${brand}:${n}(${counts.join("/")})`);
    }
    return { dry: true, date: today, day: plan.day, team: plan.team, tier: plan.zyra, snapshot: snap?.d, would, skipped };
  }

  for (const brand of brands) {
    try {
      const r = await createEventFor(env, {
        date: today, brand, tier: plan.zyra, bands: [], createdBy: "auto",
      });
      if (r.ok) created.push(`${brand}:${r.pool_size}(${r.counts.join("/")})`);
      else skipped.push(`${brand}:${r.noUid ? "no-uid" : r.error}`);
    } catch (e) { skipped.push(`${brand}:${(e && e.message) || e}`); }
  }
  const detail = `Auto-created ${created.length} draft event(s) · Team ${plan.team} · Tier ${plan.zyra} · ${created.join(", ") || "none"}`;
  await logAct(env, null, { username: "auto", role: "system" }, "campaign", detail);
  return { date: today, day: plan.day, team: plan.team, tier: plan.zyra, created, skipped };
}

// ── Lark bonus tables (read-only) — the same tables the Customer Approaching widget reads ──────
// The qualifying numbers (loss ladders, LTV ranks, Secret Wallet caps) are calculated INSIDE those
// Lark tables; this code only finds a player's row and applies the widget's "is it still claimable"
// rule. Ported from the widget's functions/lark-search.js (hidden(), the per-table predicates, the
// oldest-first / newest-first pick). If the widget's rules change, change them here too.
//
// Config: Worker secret/var WIDGET_LARK, JSON, never committed:
//   {"base":"<widget base app token>","tables":{"pnl":"tbl…","topPnl":"tbl…","ltv":"tbl…","grace":"tbl…",
//     "risk":"tbl…","vip":"tbl…","special":"tbl…","tg28":"tbl…","redeem":"tbl…","mooncake":"tbl…",
//     "vs96":"tbl…","ca":"tbl…"},
//     "graceOpts":{"activatedField":"<Grace column holding the activated date>","windowDays":3,"lookbackDays":14}}
//   (any table may be left out; "ca" only powers the other-brand warning; graceOpts is optional — without
//    activatedField the Grace window start is assumed from the expiry date, see "Grace daily tasks")
// Auth: LARK_APP_ID / LARK_APP_SECRET (or WLARK_APP_ID / WLARK_APP_SECRET if the widget uses another
// app). That app needs "can view" on those tables. Nothing here ever writes to Lark.
const BONUS_CACHE = new Map();          // "username|brand" -> { at, data } (per isolate; spares Lark repeat opens)
const BONUS_CACHE_MS = 60 * 1000;
const GRACE_CACHE = new Map();          // brand -> { at, map }
const GRACE_CACHE_MS = 5 * 60 * 1000;
let WL_TOKEN = { key: "", token: "", exp: 0 };

// The Lark tables' Brand column holds the SHORT code (FUN, VS, SPIN, PP …), not the console's full name (FUN36 …).
// WIDGET_LARK can set "brandStyle":"full" to send full names instead, or "brandMap":{"FUN36":"FUN"} to override one brand.
function wlBrand(cfg, brand) {
  if (cfg.brandMap && cfg.brandMap[brand]) return cfg.brandMap[brand];
  return cfg.brandStyle === "full" ? brand : String(brand).replace(/\d+$/, "");
}
function widgetLarkCfg(env) {
  try { const c = JSON.parse(env.WIDGET_LARK || ""); return c && c.base && c.tables ? c : null; } catch (e) { return null; }
}
async function wlToken(env) {
  const id = env.WLARK_APP_ID || env.LARK_APP_ID, secret = env.WLARK_APP_SECRET || env.LARK_APP_SECRET;
  if (!id || !secret) throw new Error("no Lark app credentials");
  if (WL_TOKEN.key === id && Date.now() < WL_TOKEN.exp) return WL_TOKEN.token;
  const j = await larkFetch("/open-apis/auth/v3/tenant_access_token/internal", null, {
    method: "POST", body: JSON.stringify({ app_id: id, app_secret: secret }) });
  WL_TOKEN = { key: id, token: j.tenant_access_token, exp: Date.now() + 60 * 60 * 1000 };
  return j.tenant_access_token;
}
// Lark field value → display text (port of the widget's toDisplay): arrays join, formula/select wrappers unwrap.
function wlText(v, optionMap) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => wlText(x, optionMap)).filter(Boolean).join(", ");
  if (typeof v === "object") {
    if ("value" in v) return wlText(v.value, optionMap);
    if ("text" in v) { const s = String(v.text); return optionMap && optionMap.has(s) ? optionMap.get(s) : s; }
    if ("name" in v) return String(v.name);
    if ("link" in v) return String(v.link);
    return JSON.stringify(v);
  }
  const s = String(v);
  return optionMap && optionMap.has(s) ? optionMap.get(s) : s;
}
function wlEpoch(v) {
  if (typeof v === "number") return v;
  if (Array.isArray(v)) { for (const x of v) { const n = wlEpoch(x); if (n !== null) return n; } return null; }
  if (v && typeof v === "object") {
    if ("value" in v) return wlEpoch(v.value);
    if ("text" in v) { const n = Number(v.text); return Number.isFinite(n) ? n : null; }
  }
  return null;
}
// Claimed / expired / failed / not eligible — the shared "nothing to claim" words (word-boundary, any position).
const wlHidden = (v) => /\b(claimed|expired|failed|not\s+eligible|ineligible)\b/.test(String(v || "").trim().toLowerCase());

async function wlSearch(env, cfg, table, conditions, maxPages = 3) {
  const token = await wlToken(env), out = [];
  let pt = "";
  for (let i = 0; i < maxPages; i++) {
    const j = await larkFetch(
      `/open-apis/bitable/v1/apps/${cfg.base}/tables/${table}/records/search?page_size=500${pt ? "&page_token=" + encodeURIComponent(pt) : ""}`,
      token, { method: "POST", body: JSON.stringify({ filter: { conjunction: "and", conditions }, automatic_fields: true }) });
    out.push(...(j.data?.items || []));
    if (!(j.data?.has_more && j.data.page_token)) break;
    pt = j.data.page_token;
  }
  return out;
}
const wlInspection = (fields, dateField) => {
  if (dateField) return Number(fields[dateField]) || 0;
  const k = Object.keys(fields).find((x) => /^time of insp/i.test(x.trim()));   // the real header is spelled "Time of inspectiion"
  return k ? Number(fields[k]) || 0 : 0;
};
// Pick one row, as the widget does: oldest claimable first (FIFO) unless `newest`.
function wlPick(rows, isClaimable, { dateField, newest } = {}) {
  const ok2 = rows.filter((r) => isClaimable(r.fields || {}));
  if (!ok2.length) return null;
  ok2.sort((a, b) => (wlInspection(a.fields || {}, dateField) - wlInspection(b.fields || {}, dateField))
    || ((Number(a.created_time) || 0) - (Number(b.created_time) || 0))
    || String(a.record_id || "").localeCompare(String(b.record_id || "")));
  return newest ? ok2[ok2.length - 1] : ok2[0];
}
// Most bonus tables call the player column "Username/UID"; a few call it "Username" or "UID".
async function wlFind(env, cfg, table, username, brand, isClaimable, opts = {}) {
  if (!table) return null;
  const cands = opts.usernameField ? [opts.usernameField] : ["Username/UID", "Username"];
  let rows, lastErr;
  for (const f of cands) {
    try {
      rows = await wlSearch(env, cfg, table, [
        { field_name: f, operator: "is", value: [username] },
        { field_name: "Brand", operator: "is", value: [brand] }]);
      break;
    } catch (e) { lastErr = e; if (cands.length === 1) throw e; }
  }
  if (!rows) throw lastErr;
  return wlPick(rows, isClaimable, opts);
}
const wlOptionCache = new Map();
async function wlOptionMap(env, cfg, table, fieldName) {
  const key = `${table}::${fieldName}`, hit = wlOptionCache.get(key);
  if (hit && Date.now() < hit.exp) return hit.map;
  const j = await larkFetch(`/open-apis/bitable/v1/apps/${cfg.base}/tables/${table}/fields?page_size=100`, await wlToken(env));
  const f = (j.data?.items || []).find((x) => x.field_name === fieldName);
  const map = new Map(((f && f.property && f.property.options) || []).map((o) => [o.id, o.name]));
  wlOptionCache.set(key, { map, exp: Date.now() + 10 * 60 * 1000 });
  return map;
}

// Same answer shape as the widget's own lookup, so summarizeWidgetLookup() below turns it into a list.
async function widgetLookup(env, cfg, uname, consoleBrand) {
  const brand = wlBrand(cfg, consoleBrand);          // what the Lark tables call this brand
  const T = cfg.tables || {}, warnings = [];
  const st = (r, f) => wlText(r && r.fields[f]).trim();
  const lower = (s) => s.toLowerCase();
  const soft = async (label, fn, fallback = null) => {
    try { return await fn(); } catch (e) { warnings.push(label); return fallback; }
  };
  const tasks = await Promise.all([
    soft("Other-brand check", async () => {
      if (!T.ca) return [];
      const rows = await wlSearch(env, cfg, T.ca, [{ field_name: "Username", operator: "is", value: [uname] }], 1);
      return [...new Set(rows.map((r) => wlText(r.fields["Brand"])).filter((b) => b && b.toUpperCase() !== brand.toUpperCase()))];
    }, []),
    soft("P&L tier", async () => {
      if (!T.pnl) return { tier: "", customerName: "", notVip: false };
      const m = await wlSearch(env, cfg, T.pnl, [
        { field_name: "Username", operator: "is", value: [uname] },
        { field_name: "Brand", operator: "is", value: [brand] }], 1);
      if (!m.length) return { tier: "", customerName: "", notVip: true };
      const tierMap = await wlOptionMap(env, cfg, T.pnl, "Tier");
      return { tier: wlText(m[0].fields["Tier"], tierMap), customerName: wlText(m[0].fields["Tittle name"]), notVip: false };
    }, { tier: "", customerName: "", notVip: false }),
    soft("Top 10 P&L", () => wlFind(env, cfg, T.topPnl, uname, brand, (f) => {
      const d = wlText(f["SW Check"]).trim();
      return f["Claimed Copy"] !== true && !!d && !wlHidden(d);
    })),
    soft("LTV", () => wlFind(env, cfg, T.ltv, uname, brand, (f) => {
      const d = wlText(f["SW Checker"]).trim();
      return /^pass\b/i.test(d) && !wlHidden(d);
    })),
    soft("Grace Period", () => wlFind(env, cfg, T.grace, uname, brand, (f) => !wlHidden(wlText(f["SW Check"])), { newest: true })),
    soft("Risk Player", () => wlFind(env, cfg, T.risk, uname, brand, (f) => {
      const s = wlText(f["Status"]).trim();
      return !!s && !/no bonus/i.test(s) && !wlHidden(s);
    }, { usernameField: "Username", dateField: "Date" })),
    soft("12h VIP Booster", () => wlFind(env, cfg, T.vip, uname, brand, (f) => lower(wlText(f["Status"]).trim()) === "eligible")),
    soft("Special Reload", () => wlFind(env, cfg, T.special, uname, brand, (f) => lower(wlText(f["Status"]).trim()) === "eligible angpao")),
    soft("Telegram RM28", () => wlFind(env, cfg, T.tg28, uname, brand, (f) => lower(wlText(f["Status"]).trim()) === "eligible")),
    soft("Redeem Code", async () => {
      if (!T.redeem) return null;
      const rows = (await wlSearch(env, cfg, T.redeem, [
        { field_name: "Username/UID", operator: "is", value: [uname] },
        { field_name: "Brand", operator: "is", value: [brand] }])).filter((r) => !wlHidden(wlText(r.fields["Status"])));
      return rows[rows.length - 1] || null;
    }),
    soft("Mooncake", () => wlFind(env, cfg, T.mooncake, uname, brand, (f) => {
      const s = wlText(f["Status"]);
      return !wlHidden(s) && !!s;
    }, { usernameField: "UID" })),
    soft("VS96 Feedback", () => wlFind(env, cfg, T.vs96, uname, brand, (f) => {
      const s = wlText(f["Status"]).trim();
      return !!s && !wlHidden(s);
    })),
  ]);
  const [otherBrands, pnl, top, ltv, grace, risk, vip, special, tg28, redeem, moon, vs96] = tasks;
  const row = {
    tier: pnl.tier, customerName: pnl.customerName,
    topPnl: top ? st(top, "SW Check") : "",
    ltvTest: ltv ? st(ltv, "SW Checker") : "",
    gracePeriod: grace ? st(grace, "SW Check") : "",
    graceExpiryMs: grace ? wlEpoch(grace.fields["Expried"]) : null,   // sic — the column is spelled "Expried" in Lark
    riskPlayer: risk ? st(risk, "Status") : "",
    riskExpiryMs: risk ? wlEpoch(risk.fields["Date Expired"]) : null,
    vipBooster: vip ? "Eligible" : "",
    specialReload: special ? { recordId: special.record_id, status: st(special, "Status") } : null,
    telegram28: tg28 ? (() => { const s = st(tg28, "Status"), a = st(tg28, "Bonus Amount"); return { recordId: tg28.record_id, status: a ? `${s} — RM${a}` : s }; })() : null,
    redeemCode: redeem ? { recordId: redeem.record_id, status: st(redeem, "Status") } : null,
    mooncake: moon ? st(moon, "Status") : "",
    vs96Feedback: vs96 ? st(vs96, "Status") : "",
  };
  return summarizeWidgetLookup({ notVip: pnl.notVip, otherBrands, lookupWarnings: warnings, row });
}

// Every Grace row of one brand (all cycles, claimed or not), cached 5 min and shared by the two readers below.
const GRACE_RAW = new Map();
async function graceRowsRaw(env, cfg, brand) {
  const hit = GRACE_RAW.get(brand);
  if (hit && Date.now() - hit.at < GRACE_CACHE_MS) return hit.rows;
  const rows = await wlSearch(env, cfg, cfg.tables.grace, [{ field_name: "Brand", operator: "is", value: [wlBrand(cfg, brand)] }], 20);
  GRACE_RAW.set(brand, { at: Date.now(), rows });
  return rows;
}

// Grace Period state for a set of brands: reads each brand's rows once, keeps the newest live row per player.
async function graceStatusFor(env, cfg, brands) {
  const out = {};
  await Promise.all(brands.map(async (brand) => {
    let map;
    const hit = GRACE_CACHE.get(brand);
    if (hit && Date.now() - hit.at < GRACE_CACHE_MS) map = hit.map;
    else {
      const rows = await graceRowsRaw(env, cfg, brand);
      const by = new Map();
      for (const r of rows) {
        const f = r.fields || {};
        const u = wlText(f["Username/UID"] ?? f["Username"]).trim().toLowerCase();
        const sw = wlText(f["SW Check"]);
        if (!u || wlHidden(sw)) continue;
        const prev = by.get(u);
        // newest live row wins (same as the widget's `newest`): later inspection date, then later creation
        // ties broken by record id, later wins — the widget's exact order
        const newer = !prev || (wlInspection(f) - wlInspection(prev.f)) || ((Number(r.created_time) || 0) - (Number(prev.t) || 0))
          || String(r.record_id || "").localeCompare(String(prev.id || ""));
        if (!prev || newer > 0) by.set(u, { f, t: r.created_time, id: r.record_id, sw });
      }
      map = {};
      for (const [u, x] of by) map[u] = { a: /^\s*pass\b/i.test(x.sw) ? 0 : 1, v: x.sw, e: wlEpoch(x.f["Expried"]) };
      GRACE_CACHE.set(brand, { at: Date.now(), map });
    }
    for (const [u, x] of Object.entries(map)) out[`${u}|${brand}`] = x;
  }));
  return out;
}

/* Grace daily tasks — "activated, reloaded the required deposit inside the window, not claimed yet".
   Window  = from the activated date to the expiry ("Expried"), both from the Lark Grace table. The live SW Check formula
             is: Claimed ≥ 1 → "Claimed"; no Activate Date → "Expired" / "Pass <bonus>" / "Failed"; Activate Date set →
             "Activated : yyyy-MM-dd HH:mm - Pass - <bonus>". So the start is the "Activate Date" column when we can read
             it (or graceOpts.activatedField), else the date inside the text. Expried = Time of inspection + 1 or 3 days
             (end of that day) and only matters before activation, so a claim never expires.
   Required = from the bonus through GRACE_LADDER (the text carries no deposit figure).
   Deposit  = the player's own daily deposits from the console feed. The feed is one day behind (snapshot D carries
             game day D−1), so game day D is read from snapshot D+1. Per day, NOT accumulative: one single day must
             reach the required deposit; deposits on different days are never added together.
   Claim    = never expires: a row stays on the list until its SW Check says Claimed (or Failed / Not eligible),
             looking back cfg.graceOpts.lookbackDays (default 14) days past the expiry.
   Nothing is written to Lark or to the console database. */
// Grace bonus → the deposit that earns it (Tier 3: 100→18, 200→28, 300→38, 500→58; Tier V: 600→68 … 1000→108).
// Overridable from WIDGET_LARK as graceOpts.ladder { "<bonus>": <deposit> } if the amounts change.
const GRACE_LADDER = { 18: 100, 28: 200, 38: 300, 58: 500, 68: 600, 78: 700, 88: 800, 98: 900, 108: 1000 };
const gAddDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const gMytDate = (ms) => new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
async function graceTasksFor(env, cfg, brands) {
  const opts = cfg.graceOpts || {};
  const windowDays = Number(opts.windowDays) || 3, lookback = Number(opts.lookbackDays) || 14;
  const today = snapshotDateMYT();
  const notes = { noExpiry: 0, noStart: 0, noPlayer: 0, startFromColumn: 0, startFromText: 0, late: 0 };
  const out = [];
  await Promise.all(brands.map(async (brand) => {
    const rows = await graceRowsRaw(env, cfg, brand);
    const cand = new Map();
    for (const r of rows) {
      const f = r.fields || {};
      const u = wlText(f["Username/UID"] ?? f["Username"]).trim().toLowerCase();
      const sw = wlText(f["SW Check"]);
      if (!u || !/\bactivated\b/i.test(sw)) continue;                       // still waiting to activate, or no text
      if (/\b(claimed|failed|not\s+eligible|ineligible)\b/i.test(sw)) continue;   // already paid, or did not qualify
      const e = wlEpoch(f["Expried"]);
      if (e == null) { notes.noExpiry++; continue; }
      const end = gMytDate(e);
      // SW Check, once activated (read from the live Lark formula): "Activated : 2026-10-17 14:35 - Pass - 58"
      //   = activation date/time, then the bonus. The deposit the player must make is NOT in the text; it follows from
      //   the bonus through the Grace ladder (Tier 3: 100→18 … 500→58; Tier V: 600→68 … 1000→108).
      const m = sw.match(/Activated\s*:\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?\s*-\s*Pass\s*-\s*(\d+(?:\.\d+)?)/i);
      const actKey = opts.activatedField || Object.keys(f).find((k) => /activat/i.test(k) && !/check/i.test(k) && wlEpoch(f[k]) > 1e11);
      const actMs = actKey ? wlEpoch(f[actKey]) : null;                      // the "Activate Date" column when present
      const start = actMs ? gMytDate(actMs) : (m ? m[1] : null);
      if (!start) { notes.noStart++; continue; }
      const bonus = m ? Number(m[3]) : (Number((sw.match(/Bonus\s*[:\-]?\s*(\d+(?:\.\d+)?)/i) || [])[1]) || null);
      const ladder = opts.ladder || GRACE_LADDER;
      const reqText = Number((sw.match(/Deposit\s*[:\-]?\s*(\d+(?:\.\d+)?)/i) || [])[1]) || null;   // only if the text ever carries it
      const req = reqText || (bonus != null && ladder[bonus] != null ? Number(ladder[bonus]) : null);
      if (end < gAddDays(today, -lookback)) continue;                        // an old cycle: out of the look-back
      const c = { u, brand, sw, start, end, startSrc: actMs ? "column" : "text", late: start > end,
        req, bonus, id: String(r.record_id || "") };
      const k = `${u}|${start}|${end}`, prev = cand.get(k);
      if (!prev || c.id.localeCompare(prev.id) > 0) cand.set(k, c);          // duplicate rows for one cycle: later record wins
    }
    if (!cand.size) return;
    const list = [...cand.values()];
    const minSnap = gAddDays(list.reduce((m, c) => (c.start < m ? c.start : m), "9999-12-31"), 1);
    const maxSnap = gAddDays(list.reduce((m, c) => (c.end > m ? c.end : m), "0000-01-01"), 1);
    const [latestRow, pdRows] = await Promise.all([
      env.DB.prepare("SELECT MAX(snapshot_date) AS d FROM player_days WHERE brand = ?").bind(brand).first(),
      env.DB.prepare(`SELECT player_key, tier_segment, uid, username, snapshot_date, daily_deposit FROM player_days
                      WHERE brand = ? AND snapshot_date BETWEEN ? AND ? ORDER BY snapshot_date`).bind(brand, minSnap, maxSnap).all(),
    ]);
    const latest = (latestRow && latestRow.d) || "";
    const idx = new Map();                                                   // any alias (key / uid / username) → player
    for (const p of (pdRows.results || [])) {
      const key = String(p.player_key).toLowerCase();
      let e = idx.get(key);
      if (!e) { e = { player_key: p.player_key, tier: p.tier_segment, days: new Map() }; }
      e.tier = p.tier_segment;
      e.days.set(p.snapshot_date, Number(p.daily_deposit) || 0);
      for (const a of [key, String(p.uid || "").toLowerCase(), String(p.username || "").toLowerCase()]) if (a) idx.set(a, e);
    }
    for (const c of list) {
      const e = idx.get(c.u);
      if (!e) { notes.noPlayer++; continue; }
      if (c.startSrc === "column") notes.startFromColumn++; else notes.startFromText++;
      if (c.late) notes.late++;
      const days = [];
      for (let d = c.start; d <= c.end; d = gAddDays(d, 1)) {
        const snap = gAddDays(d, 1);
        days.push({ d, dep: snap > latest ? null : (e.days.get(snap) || 0) });   // null = that day's feed has not arrived yet
      }
      // Only a reload AFTER activation counts. The console holds daily totals, not times, so:
      //   days after the activation day  = certainly after  → `best`
      //   the activation day itself       = could be before or after the activation time → `sameDay` (flagged, never counted as certain)
      // NOT accumulative: the required deposit must be reached inside ONE day. Each day stands alone, so RM50 today
      // + RM50 tomorrow does not qualify for a RM100 requirement. `best` = the highest single day after activation.
      const best = days.reduce((m, x) => (x.d > c.start ? Math.max(m, x.dep || 0) : m), 0);
      const sameDay = (days.find((x) => x.d === c.start) || {}).dep || 0;
      const windowOpen = days.some((x) => x.dep === null);
      const status = c.req == null ? "unknown"
        : best >= c.req ? "reloaded"
        : sameDay >= c.req ? "same_day"
        : windowOpen ? "in_progress" : "not_reloaded";
      out.push({ player_key: e.player_key, brand, tier_segment: e.tier, text: c.sw, req: c.req, bonus: c.bonus,
        start: c.start, end: c.end, startSource: c.startSrc, late: c.late, days, best, sameDay, status });
    }
  }));
  const rank = { reloaded: 0, same_day: 1, in_progress: 2, unknown: 3, not_reloaded: 4 };
  out.sort((a, b) => (rank[a.status] - rank[b.status]) || (a.end < b.end ? 1 : a.end > b.end ? -1 : 0) || a.brand.localeCompare(b.brand));
  return { rows: out, notes, today, windowDays, lookbackDays: lookback };
}

// Widget answer → a flat list the console can render. A program is listed only when the widget
// found something claimable for it. Grace Period carries `activated`: the widget's own rule is
// that a value starting "Pass" is the offer waiting to be activated, anything else is activated.
function summarizeWidgetLookup(d) {
  const row = d.row || {};
  const programs = [];
  const add = (key, label, value, extra = {}) => { if (value) programs.push({ key, label, value: String(value), ...extra }); };
  add("topPnl", "Top 10 P&L", row.topPnl);
  add("ltv", "LTV", row.ltvTest);
  if (row.gracePeriod) {
    const activated = !/^\s*pass\b/i.test(row.gracePeriod);
    add("grace", "Grace Period", row.gracePeriod, { activated, expiryMs: row.graceExpiryMs ?? null });
  }
  add("risk", "Risk Player", row.riskPlayer, { expiryMs: row.riskExpiryMs ?? null });
  add("vipBooster", "12h VIP Booster", row.vipBooster);
  add("specialReload", "Special Reload", row.specialReload && row.specialReload.status);
  add("telegram28", "Telegram RM28", row.telegram28 && row.telegram28.status);
  add("redeem", "Redeem Code", row.redeemCode && row.redeemCode.status);
  add("mooncake", "Mooncake", row.mooncake);
  add("vs96", "VS96 Feedback", row.vs96Feedback);
  const known = new Set(["tier", "customerName", "topPnl", "ltvTest", "gracePeriod", "graceExpiryMs", "riskPlayer",
    "riskExpiryMs", "vipBooster", "specialReload", "telegram28", "redeemCode", "mooncake", "vs96Feedback"]);
  for (const [k, v] of Object.entries(row)) {          // custom bonuses added from the widget's admin page
    if (!known.has(k) && typeof v === "string") add("custom:" + k, k, v);
  }
  return {
    ok: true, notVip: !!d.notVip, tier: row.tier || "", customerName: row.customerName || "",
    otherBrands: d.otherBrands || [], warnings: d.lookupWarnings || [], programs,
  };
}

const WIDGET_NOTES_PER_MIN = 60;        // flood cap for the widget key, across all agents

// Widget "Agent Name" option → bare first name. "96 Raven - VIP RTN SNR MY" → "Raven",
// "96 Hans-VIP RTN SNR" → "Hans", "96 Firdaus – VIP RTN JNR" → "Firdaus". A plain name passes through.
function cleanAgentName(raw) {
  let s = String(raw || "").replace(/[\r\n]+/g, " ").trim();
  s = s.replace(/^\d+\s+/, "");                 // leading "96 "
  s = s.split(/\s*[-–—]\s*/)[0];                // everything before the first dash
  return s.replace(/\s+/g, " ").trim().slice(0, 60);
}

// Constant-time string compare (hash both sides first so length doesn't leak) for API-key checks.
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// ── Simple SHA-256 hash ────────────────────────────────────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Generate session token ─────────────────────────────────────────────────────
async function makeToken(username, secret) {
  const expires = Date.now() + SESSION_TTL_HOURS * 3600 * 1000;
  const payload = `${username}:${expires}`;
  const sig = await sha256(payload + secret);
  return btoa(`${payload}:${sig}`);
}

// ── Verify session token ───────────────────────────────────────────────────────
async function verifyToken(token, secret, db) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(":");
    if (parts.length < 3) return null;
    const sig = parts.pop();
    const expires = parseInt(parts.pop());
    const username = parts.join(":");
    if (Date.now() > expires) return null;
    const expected = await sha256(`${username}:${expires}` + secret);
    if (sig !== expected) return null;
    const user = await db.prepare("SELECT * FROM users WHERE username = ?")
      .bind(username).first();
    return user || null;
  } catch { return null; }
}

// ── Auth middleware ────────────────────────────────────────────────────────────
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  return await verifyToken(token, env.SESSION_SECRET, env.DB);
}

// ── JSON response helpers ──────────────────────────────────────────────────────
function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}
function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// INGEST — Google Sheets daily feeder → player_days (history accumulator)
// Auth: Bearer INGEST_TOKEN (wrangler secret), independent of session auth.
// Identity: player_key = uid if present (Zyra), else username (TC).
// ══════════════════════════════════════════════════════════════════════════════

const INGEST_COLS = [
  "snapshot_date", "player_key", "brand", "tier_segment", "uid", "username", "entry_date",
  "threshold", "previous_tier", "tier", "tier_movement", "grace_end_date",
  "status", "status_days", "group_name", "daily_deposit_count", "daily_deposit",
  "daily_withdraw_count", "daily_withdraw", "monthly_deposit_count",
  "monthly_deposit", "is_mau", "monthly_withdraw_count", "monthly_withdraw",
  "lifetime_deposit_count", "lifetime_deposit", "lifetime_withdraw_count",
  "lifetime_withdraw", "bet", "valid_bet", "win_loss", "last_deposit_date",
  "register_date", "member_days", "addressing", "pnl"
];

const INGEST_KEY_COLS = ["snapshot_date", "player_key", "brand", "tier_segment"];

function buildIngestSQL() {
  const placeholders = INGEST_COLS.map(() => "?").join(", ");
  const updates = INGEST_COLS
    .filter((c) => !INGEST_KEY_COLS.includes(c))
    .map((c) => `${c}=excluded.${c}`)
    .join(", ");
  return (
    `INSERT INTO player_days (${INGEST_COLS.join(", ")}, ingested_at) ` +
    `VALUES (${placeholders}, datetime('now')) ` +
    `ON CONFLICT (player_key, snapshot_date, brand, tier_segment) ` +
    `DO UPDATE SET ${updates}, ingested_at=datetime('now')`
  );
}

// Today's date in Malaysia time (GMT+8) — the daily history axis.
function snapshotDateMYT() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// Strip spreadsheet float artifacts on identity/text fields: "123.0" -> "123"
function stripFloat(v) {
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  if (typeof v === "string" && /^\d+\.0$/.test(v.trim())) return v.trim().slice(0, -2);
  return v;
}

// Coerce blanks and spreadsheet error tokens (#REF!, #N/A, ...) to null.
function cleanVal(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    if (/^#(REF|N\/A|VALUE|DIV\/0|NAME|NUM|NULL|ERROR)/i.test(t)) return null;
    return t;
  }
  return v;
}

// Numeric columns — stored as real numbers. Some brands (e.g. RM68) feed comma-decimal
// text ("78,06", "-1.234,56") that otherwise lands as TEXT and breaks sums/comparisons.
const NUMERIC_COLS = new Set([
  "threshold", "status_days", "daily_deposit_count", "daily_deposit", "daily_withdraw_count",
  "daily_withdraw", "monthly_deposit_count", "monthly_deposit", "monthly_withdraw_count",
  "monthly_withdraw", "lifetime_deposit_count", "lifetime_deposit", "lifetime_withdraw_count",
  "lifetime_withdraw", "bet", "valid_bet", "win_loss", "member_days", "pnl",
]);

// Normalize a numeric cell to a real number (handles comma-decimal / European formats).
// Non-numeric junk (after cleanVal) stays as-is so nothing is silently lost.
function cleanNum(v) {
  const c = cleanVal(v);
  if (c === null || typeof c === "number") return c;
  let s = String(c).trim();
  if (s.includes(",")) { if (s.includes(".")) s = s.replace(/\./g, ""); s = s.replace(",", "."); }
  const n = parseFloat(s);
  return isNaN(n) ? c : n;
}

// Clean a cell by column: numeric columns get numeric normalization, everything else text-cleaned.
function cleanCell(col, v) {
  return NUMERIC_COLS.has(col) ? cleanNum(v) : cleanVal(v);
}

async function handleIngest(request, env, ctx) {
  // --- token auth (independent of dashboard sessions) ---
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!env.INGEST_TOKEN || token !== env.INGEST_TOKEN) {
    return err("unauthorized", 401);
  }

  // --- parse ---
  let body;
  try {
    body = await request.json();
  } catch {
    return err("invalid_json", 400);
  }

  const { brand, tier_segment, rows } = body;
  if (!brand || !tier_segment || !Array.isArray(rows)) {
    return err("missing brand / tier_segment / rows", 400);
  }
  if (rows.length > 5000) return err("too many rows (max 5000)", 413);

  // --- normalize: derive player_key (uid -> else username), drop keyless rows ---
  const cleanRows = [];
  let skipped = 0;
  for (const r of rows) {
    if (!r) { skipped++; continue; }
    r.uid = stripFloat(r.uid);
    r.username = stripFloat(r.username);
    r.addressing = stripFloat(r.addressing);
    const uid = cleanVal(r.uid);
    const uname = cleanVal(r.username);
    const player_key =
      uid !== null ? String(uid).trim()
      : uname !== null ? String(uname).trim()
      : null;
    if (!player_key) { skipped++; continue; }   // totals / blank lines
    // Guard: reject the spreadsheet HEADER row if it gets fed as data — its cells
    // are the column names themselves ("uid", "username", ...). One such MAX39 row
    // (2026-08-02) sorted after every real date and made all 20 brands show a false
    // LAG. The looksLikePlayer check below can't catch it, because a header row has
    // every field "present" (just filled with header text). Match on the tell:
    // player_key literally equals a column name.
    if (player_key === "uid" || player_key === "username") { skipped++; continue; }
    // Guard: reject non-player rows (e.g. a Telegram/contact list POSTed into the feed by
    // mistake). A real VIP always carries at least a tier, a group, a register/entry date,
    // or deposit history; a row with only a uid and everything else blank is not a player.
    // (ONG66 2026-07-12: 180 such rows tanked its retention until cleaned up.)
    const looksLikePlayer =
      cleanVal(r.tier) !== null || cleanVal(r.group_name) !== null ||
      cleanVal(r.register_date) !== null || cleanVal(r.entry_date) !== null ||
      cleanVal(r.member_days) !== null || cleanVal(r.lifetime_deposit) !== null ||
      cleanVal(r.monthly_deposit) !== null || cleanVal(r.last_deposit_date) !== null;
    if (!looksLikePlayer) { skipped++; continue; }
    r.player_key = player_key;
    r.brand = brand;                            // authoritative from caller
    r.tier_segment = tier_segment;
    r.snapshot_date = snapshotDateMYT();        // daily axis (GMT+8)
    cleanRows.push(r);
  }
  if (cleanRows.length === 0) {
    return ok({ ok: true, received: rows.length, upserted: 0, skipped, note: "no keyed rows" });
  }

  // --- batched upsert (chunked for D1 limits) ---
  const sql = buildIngestSQL();
  const stmt = env.DB.prepare(sql);
  const CHUNK = 25;
  let upserted = 0;

  try {
    for (let i = 0; i < cleanRows.length; i += CHUNK) {
      const slice = cleanRows.slice(i, i + CHUNK);
      const batch = slice.map((row) =>
        stmt.bind(...INGEST_COLS.map((c) => cleanCell(c, row[c])))
      );
      await env.DB.batch(batch);
      upserted += slice.length;
    }
  } catch (e) {
    console.log("ingest db_error:", String(e));
    return err("ingest failed", 500);
  }

  // --- one player, one tier, per brand per day ---
  // When a feeder re-pushes after a tier mistake, the corrected rows land under the NEW tier.
  // tier_segment is part of the upsert key, so the WRONG rows from the earlier push are not
  // overwritten — they survive as orphans and the player is counted in both tiers.
  // (ZAS36 2026-08-13: the Tier 3 list went out under the Tier V label at 13:23 MYT, was
  // re-pushed correctly at 20:04, and left 168 stale Tier V rows behind — double-counting the
  // brand and corrupting both tiers' retention rates, while every screen looked healthy
  // because the row count went UP.)
  // So: after writing, clear this brand+day's rows for the same players under any OTHER tier.
  // Last push wins, which makes a corrective re-push heal itself. The unique key is untouched.
  let tier_cleanup = 0;
  try {
    const keys = [...new Set(cleanRows.map((r) => r.player_key))];
    const snapDay = cleanRows[0].snapshot_date;
    const KCHUNK = 50;
    for (let i = 0; i < keys.length; i += KCHUNK) {
      const part = keys.slice(i, i + KCHUNK);
      const res = await env.DB.prepare(
        `DELETE FROM player_days WHERE brand = ? AND snapshot_date = ? AND tier_segment <> ?` +
        ` AND player_key IN (${part.map(() => "?").join(",")})`
      ).bind(brand, snapDay, tier_segment, ...part).run();
      tier_cleanup += (res.meta && res.meta.changes) || 0;
    }
    if (tier_cleanup) console.log(`ingest tier_cleanup: ${brand} ${snapDay} removed ${tier_cleanup} row(s) from the other tier`);
  } catch (e) { console.log("ingest tier_cleanup error:", String(e)); }   // never fail the ingest

  // --- group_name fallback ---
  // group_name is the feeder's behaviour label ("Active", "Inactive 3-6 Days", "Reactivated
  // 7-13 Days", "Churn"). Six things read it, and the costly one is the auto-recovery cron:
  // it matches on the Inactive bands to decide who qualifies as a recovery, so a missing label
  // means an agent's contact can NEVER be credited. On 2026-09-02 the feeder sent the column
  // empty on all 8,897 rows and every one of those broke silently.
  //
  // The label is fully derivable and was validated against a healthy day (2026-09-01), where
  // the feeder's own bands line up with these bucket edges exactly, with no overlap:
  //   dsld 1 = Active · 2-3 = 1-2 Days · 4-7 = 3-6 · 8-14 = 7-13 · 15-21 = 14-20
  //   · 22-30 = 21-29 · 31+ = Churn
  // A player is "Reactivated <band>" instead when their last_deposit_date moved forward since
  // the previous snapshot — the band being the gap they returned from, same edges.
  //
  // FALLBACK ONLY. A row that arrives with a label keeps it, so we stay byte-identical to the
  // feeder (and to SPV) whenever the feed is healthy, and never go blind when it is not.
  try {
    const snapDay3 = cleanRows[0].snapshot_date;
    const band = (expr) => `CASE
        WHEN ${expr} <= 3 THEN '1-2' WHEN ${expr} <= 7 THEN '3-6' WHEN ${expr} <= 14 THEN '7-13'
        WHEN ${expr} <= 21 THEN '14-20' WHEN ${expr} <= 30 THEN '21-29' ELSE '30+' END`;
    const dsld = "CAST(julianday(snapshot_date) - julianday(last_deposit_date) AS INT)";
    // The gap the player returned from: how far last_deposit_date jumped since the last snapshot.
    const gap = `(SELECT CAST(julianday(player_days.last_deposit_date) - julianday(y.last_deposit_date) AS INT)
        FROM player_days y WHERE y.player_key = player_days.player_key AND y.brand = player_days.brand
          AND y.tier_segment = player_days.tier_segment AND y.snapshot_date < player_days.snapshot_date
          AND y.last_deposit_date IS NOT NULL AND y.last_deposit_date <> ''
        ORDER BY y.snapshot_date DESC LIMIT 1)`;
    // One statement, and it only ever touches rows the feeder left blank. Reactivation is tested
    // first because a returning player is "Reactivated <gap>", not "Active".
    const res = await env.DB.prepare(`
      UPDATE player_days SET group_name = CASE
          WHEN last_deposit_date IS NULL OR last_deposit_date = '' THEN 'Churn'
          WHEN COALESCE(${gap}, 0) >= 2 THEN 'Reactivated ' || ${band(gap)} || ' Days'
          WHEN ${dsld} <= 1 THEN 'Active'
          WHEN ${dsld} <= 30 THEN 'Inactive ' || ${band(dsld)} || ' Days'
          ELSE 'Churn' END
      WHERE snapshot_date = ? AND brand = ? AND tier_segment = ?
        AND (group_name IS NULL OR group_name = '')
    `).bind(snapDay3, brand, tier_segment).run();
    if (res.meta && res.meta.changes) console.log(`ingest group_name fallback: ${brand} ${tier_segment} ${res.meta.changes} row(s)`);
  } catch (e) { console.log("ingest group_name fallback error:", String(e)); }

  // --- keep the Movement rollup current ---
  // daily_brand_stats is the brand × date grid the Movement view reads. Recomputing it live
  // from player_days costs ~1.2s and 625k row reads for one month and grows daily, so it is
  // maintained here instead: one upsert for the brand+tier just received. Cheap, and it means
  // the grid is never stale. A failure must not fail the ingest — the backfill can repair it.
  try {
    const snapDay2 = cleanRows[0].snapshot_date;
    await env.DB.prepare(`
      INSERT INTO daily_brand_stats
        (snapshot_date, brand, tier_segment, deposit, withdraw, active_vip, roster, depositors_mtd)
      SELECT snapshot_date, brand, tier_segment,
             ROUND(SUM(COALESCE(CAST(NULLIF(daily_deposit,'')  AS REAL), 0))),
             ROUND(SUM(COALESCE(CAST(NULLIF(daily_withdraw,'') AS REAL), 0))),
             COUNT(CASE WHEN COALESCE(CAST(NULLIF(daily_deposit,'')   AS REAL), 0) > 0 THEN 1 END),
             COUNT(*),
             COUNT(CASE WHEN COALESCE(CAST(NULLIF(monthly_deposit,'') AS REAL), 0) > 0 THEN 1 END)
      FROM player_days WHERE snapshot_date = ? AND brand = ? AND tier_segment = ?
      GROUP BY snapshot_date, brand, tier_segment
      ON CONFLICT (snapshot_date, brand, tier_segment) DO UPDATE SET
        deposit = excluded.deposit, withdraw = excluded.withdraw,
        active_vip = excluded.active_vip, roster = excluded.roster,
        depositors_mtd = excluded.depositors_mtd, updated_at = datetime('now')
    `).bind(snapDay2, brand, tier_segment).run();
  } catch (e) { console.log("ingest rollup error:", String(e)); }

  // A flagged brand was just re-fed → check if it's now fixed and post a resolution
  // follow-up (non-blocking). No-op unless that brand is flagged open for today.
  if (ctx && upserted > 0) ctx.waitUntil(feedResolutionCheck(env, brand).then(
    (r) => console.log("feedResolutionCheck:", JSON.stringify(r)),
    (e) => console.error("feedResolutionCheck failed:", e && e.message)
  ));
  return ok({ ok: true, brand, tier_segment, received: rows.length, upserted, skipped, tier_cleanup });
}

// ══════════════════════════════════════════════════════════════════════════════
// Append one audit row. Fire-and-forget via ctx.waitUntil so it never delays a response,
// and never throws into the request path.
async function logAct(env, ip, actor, action, detail) {
  try {
    await env.DB.prepare(
      "INSERT INTO activity_log (username, role, action, detail, ip) VALUES (?, ?, ?, ?, ?)"
    ).bind(actor?.username || null, actor?.role || null, action, detail || null, ip || null).run();
  } catch (e) { /* logging must never break the request */ }
}

// ── Automated contact-log outcomes (cron-driven) ───────────────────────────────
// Runs on a schedule (wrangler.toml [triggers]). Two rules, RECOVERED evaluated first
// so a deposit always beats a stale-timeout:
//   1) Auto-RECOVERED (reactivation): a real contact (CONTACTED/RESPONDED/NO_RESPONSE)
//      to an inactive/churned player who then deposits within the coldness window —
//      3 days if they were "Inactive 1-2/3-6 Days", 7 days if "Inactive 7-13/14-20/
//      21-29 Days" or "Churn" at contact time. Credits the MOST RECENT contacting agent
//      (one recovery per player per 20-day window; respects an existing RECOVERED).
//   2) Auto-NO_RESPONSE: a CONTACTED tag the agent hasn't updated within 6h (customer didn't reply)
//      → NO_RESPONSE. Deposit-based recovery is separate (Step 1) and can upgrade it later.
async function autoOutcomes(env) {
  // Step 1 — qualifying recoveries. Band window is derived from the feeder's group_name
  // at the contact's snapshot; deposit must land AFTER the contact and within the window.
  const qualifying = await env.DB.prepare(`
    SELECT c.snapshot_date, c.player_key, c.brand, c.tier_segment
    FROM contact_log c
    JOIN player_days pc ON pc.snapshot_date = c.snapshot_date AND pc.player_key = c.player_key
      AND pc.brand = c.brand AND pc.tier_segment = c.tier_segment
    WHERE c.status IN ('CONTACTED','RESPONDED','NO_RESPONSE')
      AND c.snapshot_date >= date('now','-20 days')
      AND pc.group_name IN ('Inactive 1-2 Days','Inactive 3-6 Days','Inactive 7-13 Days','Inactive 14-20 Days','Inactive 21-29 Days','Churn')
      AND NOT EXISTS (
        SELECT 1 FROM contact_log cr WHERE cr.player_key = c.player_key AND cr.brand = c.brand
          AND cr.tier_segment = c.tier_segment AND cr.status = 'RECOVERED' AND cr.snapshot_date >= date('now','-20 days'))
      AND EXISTS (
        SELECT 1 FROM player_days pd
        WHERE pd.player_key = c.player_key AND pd.brand = c.brand AND pd.tier_segment = c.tier_segment
          AND CAST(pd.daily_deposit AS REAL) > 0
          AND pd.snapshot_date > c.snapshot_date
          AND pd.snapshot_date <= date(c.snapshot_date, '+' || (CASE
              WHEN pc.group_name IN ('Inactive 1-2 Days','Inactive 3-6 Days') THEN 3
              ELSE 7 END) || ' days'))   -- KPI rule: 7d window for 7+ idle (was 14 — over-credited vs the official KPI)
  `).all();

  // Keep only the most recent qualifying contact per player — that agent earns the point.
  const latest = {};
  for (const r of (qualifying.results || [])) {
    const k = r.player_key + '|' + r.brand + '|' + r.tier_segment;
    if (!latest[k] || r.snapshot_date > latest[k].snapshot_date) latest[k] = r;
  }
  const recStmts = Object.values(latest).map((r) => env.DB.prepare(
    `UPDATE contact_log SET status='RECOVERED', updated_by='auto', updated_at=datetime('now')
     WHERE snapshot_date=? AND player_key=? AND brand=? AND tier_segment=? AND status!='RECOVERED'`
  ).bind(r.snapshot_date, r.player_key, r.brand, r.tier_segment));
  if (recStmts.length) await env.DB.batch(recStmts);

  // Step 2 — a CONTACTED tag the agent hasn't updated within 6h (customer didn't reply) → NO_RESPONSE.
  // This is about the customer not RESPONDING, not about deposits. If they later deposit within the
  // window, Step 1 runs first each cron and upgrades NO_RESPONSE → RECOVERED.
  const noResp = await env.DB.prepare(`
    UPDATE contact_log SET status='NO_RESPONSE', updated_by='auto', updated_at=datetime('now')
    WHERE status='CONTACTED' AND updated_at < datetime('now','-6 hours') AND snapshot_date >= date('now','-7 days')
  `).run();

  return { recovered: recStmts.length, no_response: noResp?.meta?.changes ?? 0 };
}

// ══ AUTO-ASSIGN — daily "who to contact" per PIC (Phase 1: preview, writes nothing) ══
// Fair (same mix), Telegram-reachable only, 2+ days no deposit. FRESH FIRST: anyone not yet
// contacted this month outranks every repeat, because only a first touch moves contact parity.
// Within the fresh group, and then among repeats (oldest touch first, so the list rotates):
// cooling whale (5-6d) → whale 7+ → 7-13d → 14-29d → 3-6d → 2d → 30d+ churn. Whales only jump the queue
// once they're actually going cold (5+ days); a 2-4d whale sits at normal priority. Cap
// AA_CAP/PIC/batch, reserving the 7w+3m share of the cap (backfilled).
// Sticky (keep the current owner), 3-strike NO_RESPONSE give-up, 3-day re-contact rest,
// day-off holds the pile. See docs/AUTO_ASSIGN_PLAN.md.
const AA_CAP = 30, AA_GIVEUP = 3, AA_REST_DAYS = 3;
// Reserved mix, held as a SHARE of the cap so it scales with the batch instead of being a
// fixed count sized for the old 15. 7 whale + 3 money out of every 15 dealt — the original
// Phase-1 split, unchanged in proportion.
const AA_WHALE_SHARE = 7 / 15, AA_MONEY_SHARE = 3 / 15;
// An agent who clears the first batch and still has shift left can open another by hand
// (?batch=2). The cap is PER BATCH, so batch 2 deals 60 for the day, not a second 30 that
// replaces the first. Capped at 4 so nobody opens an unworkable 120-player list by accident.
const AA_MAX_BATCH = 4;
// Contact parity (September objective): the target is the share of the REACHABLE pool touched
// at least once this month, so a repeat touch scores nothing. Once a milestone is met the next
// one opens automatically — the ladder never caps, it just keeps pulling.
const AA_MILESTONES = [52, 60, 70, 80, 90, 100];
// How far back a previous assignment still counts as "yours". Carry-over rides on this:
// an untouched player is re-assigned daily, so their claim stays fresh. Someone who drops
// off the list goes stale after this many days and can be dealt to anyone again — without
// it, every player ever assigned would be owned forever and the fair deal would seize up.
const AA_STICKY_DAYS = 14;
// The feed is always one day behind: snapshot "Aug 13" carries activity through Aug 12, so a
// player the data calls "quiet 6 days" has really been quiet 7. Every idle count here is aged
// by this much before ranking, which is what stops players landing in the wrong band at the
// 7 / 14 / 30-day edges. The Assigned screen shows this same aged number, so the band an agent
// sees always matches the days next to it. Only auto-assign is adjusted — the rest of the
// console still shows raw DSLD, so the two differ by a day on purpose.
const AA_LAG_DAYS = 1;
const AA_TIER_LABEL = { 1: "cooling", 2: "whale", 3: "7-13d", 4: "14-29d", 5: "3-6d", 6: "2d", 7: "30d+" };

async function computeAutoAssign(env, opts = {}) {
  const off = new Set(opts.off || []);
  // One team per call: its own brands dealt to its own agents. Never mix teams.
  const team = opts.team;
  const batch = Math.min(AA_MAX_BATCH, Math.max(1, parseInt(opts.batch, 10) || 1));
  const cap = AA_CAP * batch;
  const brands = TEAM_BRANDS[team];
  if (!brands) return { skipped: `unknown team ${team || "(none)"}`, team: team || null };

  const snapRow = await env.DB.prepare("SELECT MAX(snapshot_date) d FROM player_days").first();
  const snap = snapRow && snapRow.d;
  if (!snap) return { skipped: "no snapshots", team };

  const picRows = await env.DB.prepare(
    "SELECT username FROM users WHERE team=? AND (role='agent' OR on_leaderboard=1) ORDER BY username"
  ).bind(team).all();
  const pics = (picRows.results || []).map((r) => r.username).filter((u) => !off.has(u));
  if (!pics.length) return { skipped: `no active PICs on team ${team}`, team, pics: [], assignments: {}, summary: {} };

  const ph = brands.map(() => "?").join(",");
  const rows = (await env.DB.prepare(`
    WITH snap AS (SELECT ? d),
    fullbase AS (SELECT brand, COALESCE(CAST(NULLIF(pnl,'') AS REAL),
        COALESCE(CAST(NULLIF(lifetime_withdraw,'') AS REAL),0)-COALESCE(CAST(NULLIF(lifetime_deposit,'') AS REAL),0)) pnl
      FROM player_days WHERE snapshot_date=(SELECT d FROM snap) AND brand IN (${ph})),
    ranked AS (SELECT brand,pnl, ROW_NUMBER() OVER (PARTITION BY brand ORDER BY pnl) rn, COUNT(*) OVER (PARTITION BY brand) cnt FROM fullbase),
    cut AS (SELECT brand, pnl cutval FROM ranked WHERE rn=CAST(cnt*0.25 AS INT)+1),
    pool AS (SELECT pd.player_key, pd.brand, pd.tier_segment, pd.username,
        COALESCE(CAST(NULLIF(pd.pnl,'') AS REAL),
          COALESCE(CAST(NULLIF(pd.lifetime_withdraw,'') AS REAL),0)-COALESCE(CAST(NULLIF(pd.lifetime_deposit,'') AS REAL),0)) pnl,
        CAST(julianday((SELECT d FROM snap)) - julianday(NULLIF(pd.last_deposit_date,'')) AS INTEGER) + ${AA_LAG_DAYS} dsld
      FROM player_days pd JOIN player_telegram t ON t.player_key=pd.player_key AND t.brand=pd.brand
      WHERE pd.snapshot_date=(SELECT d FROM snap) AND pd.brand IN (${ph}))
    SELECT p.player_key, p.brand, p.tier_segment, p.username, p.pnl, p.dsld,
      CASE WHEN p.tier_segment='V' AND p.pnl<0 AND p.pnl<=c.cutval THEN 1 ELSE 0 END whale,
      (SELECT cl.assigned_to FROM contact_log cl WHERE cl.player_key=p.player_key AND cl.brand=p.brand
         AND cl.tier_segment=p.tier_segment AND cl.assigned_to IS NOT NULL AND cl.assigned_to<>''
         AND cl.snapshot_date >= date((SELECT d FROM snap),'-${AA_STICKY_DAYS} days') ORDER BY cl.snapshot_date DESC LIMIT 1) owner,
      (SELECT COUNT(*) FROM contact_log cl WHERE cl.player_key=p.player_key AND cl.brand=p.brand AND cl.tier_segment=p.tier_segment
         AND cl.status='NO_RESPONSE' AND cl.snapshot_date>=date((SELECT d FROM snap),'-20 days')) strikes,
      (SELECT MAX(cl.snapshot_date) FROM contact_log cl WHERE cl.player_key=p.player_key AND cl.brand=p.brand AND cl.tier_segment=p.tier_segment
         AND cl.status IN ('CONTACTED','RESPONDED','NO_RESPONSE','RECOVERED')) last_touch,
      -- Parity counters. Both are keyed on (player_key, brand) and NOT on tier_segment, because
      -- the department counts a person once however their tier moved during the month.
      -- mtd > 0 means this player already counts toward the rate, so contacting them again adds
      -- nothing to it. agents7 > 1 means two different agents touched them inside a week.
      (SELECT COUNT(*) FROM contact_log cl WHERE cl.player_key=p.player_key AND cl.brand=p.brand
         AND cl.status IN ('CONTACTED','RESPONDED','NO_RESPONSE','RECOVERED')
         AND substr(COALESCE(cl.contacted_at, cl.snapshot_date),1,7) = substr((SELECT d FROM snap),1,7)) mtd,
      (SELECT COUNT(DISTINCT cl.assigned_to) FROM contact_log cl WHERE cl.player_key=p.player_key AND cl.brand=p.brand
         AND cl.status IN ('CONTACTED','RESPONDED','NO_RESPONSE','RECOVERED')
         AND cl.assigned_to IS NOT NULL AND cl.assigned_to<>''
         AND cl.snapshot_date >= date((SELECT d FROM snap),'-7 days')) agents7
    FROM pool p LEFT JOIN cut c ON c.brand=p.brand
    WHERE p.dsld>=2
  `).bind(snap, ...brands, ...brands).all()).results || [];

  const restMs = Date.parse(snap + "T00:00:00Z") - AA_REST_DAYS * 86400000;
  const tierOf = (r) => {
    if (r.whale && r.dsld >= 5 && r.dsld <= 6) return 1;
    if (r.whale && r.dsld >= 7) return 2;
    if (r.dsld >= 7 && r.dsld <= 13) return 3;
    if (r.dsld >= 14 && r.dsld <= 29) return 4;
    if (r.dsld >= 3 && r.dsld <= 6) return 5;
    if (r.dsld === 2) return 6;
    if (r.dsld >= 30) return 7;
    return 0;
  };
  // FRESH FIRST, then ROTATE.
    //
    // The contact-parity target counts each reachable player once a month, so a second touch on
    // someone already contacted scores zero against it. Through the first ten days of September
    // 43% of all touches were repeats (364 of 853) and the new-player rate fell 92 → 14 a day,
    // while 693 reachable players had never been contacted at all. That is not idle agents; it
    // is the list handing back the same names. So an uncontacted player now outranks a repeat
    // outright, whatever their value.
    //
    // Inside each group the order differs on purpose:
    //   fresh   → by value (band, then biggest loss), the original Phase-1 priority
    //   repeat  → by OLDEST last touch first, so once the month's pool is exhausted the list
    //             cycles through everyone instead of favouring the same familiar names
  const cmpDeal = (a, b) => {
    if (a.fresh !== b.fresh) return a.fresh ? -1 : 1;
    if (!a.fresh) {
      const at = a.last_touch || "", bt = b.last_touch || "";
      if (at !== bt) return at < bt ? -1 : 1;
    }
    return a.tier - b.tier || a.pnl - b.pnl;
  };
  const players = rows
    .filter((r) => (r.strikes || 0) < AA_GIVEUP)                                        // 3-strike give-up
    .filter((r) => !r.last_touch || Date.parse(r.last_touch + "T00:00:00Z") < restMs)   // 3-day rest
    .map((r) => ({ ...r, tier: tierOf(r), fresh: !(r.mtd > 0) }))
    .filter((r) => r.tier > 0)
    .sort(cmpDeal);

  // Assign: sticky owner if that PIC is active; otherwise fair-deal to the PIC with the
  // fewest of that tier (ties → fewest overall), so every PIC gets the same mix.
  //
  // Day off HOLDS the pile — it does not redistribute it. A player whose owner is off waits
  // untouched until that PIC is back, exactly as the rule says. (This used to fall through to
  // toDeal, which handed an absent PIC's players to everyone else — the opposite of the rule,
  // and it would have broken continuity the first time anyone took leave.)
  const activeSet = new Set(pics);
  const load = Object.fromEntries(pics.map((p) => [p, []]));
  const held = {};
  const toDeal = [];
  for (const pl of players) {
    if (pl.owner && activeSet.has(pl.owner)) load[pl.owner].push(pl);
    else if (pl.owner && off.has(pl.owner)) (held[pl.owner] = held[pl.owner] || []).push(pl);
    else toDeal.push(pl);
  }
  for (const pl of toDeal) {
    let best = pics[0];
    for (const p of pics) {
      const cP = load[p].filter((x) => x.tier === pl.tier).length;
      const cB = load[best].filter((x) => x.tier === pl.tier).length;
      if (cP < cB || (cP === cB && load[p].length < load[best].length)) best = p;
    }
    load[best].push(pl);
  }

  // Manual pins: a human-written ASSIGNED row (updated_by <> 'auto') is a deliberate pick by the
  // ATL, so it always shows in that PIC's Assigned list — exempt from the dsld>=2 / 3-day rest /
  // give-up filters and never capped out. Distinct from the algorithm's own sticky carry-over.
  const inLoad = new Set();
  for (const p of pics) for (const x of load[p]) inLoad.add(`${x.player_key}|${x.brand}|${x.tier_segment}`);
  const pinnedRows = (await env.DB.prepare(`
    SELECT cl.player_key, cl.brand, cl.tier_segment, cl.assigned_to owner, pd.username,
      COALESCE(CAST(NULLIF(pd.pnl,'') AS REAL), COALESCE(CAST(NULLIF(pd.lifetime_withdraw,'') AS REAL),0)-COALESCE(CAST(NULLIF(pd.lifetime_deposit,'') AS REAL),0)) pnl,
      CAST(julianday((SELECT MAX(snapshot_date) FROM player_days)) - julianday(NULLIF(pd.last_deposit_date,'')) AS INTEGER) + ${AA_LAG_DAYS} dsld
    FROM contact_log cl
    JOIN player_days pd ON pd.snapshot_date=? AND pd.player_key=cl.player_key AND pd.brand=cl.brand AND pd.tier_segment=cl.tier_segment
    WHERE cl.status='ASSIGNED' AND cl.updated_by<>'auto' AND cl.brand IN (${ph})
      AND cl.assigned_to IN (${pics.map(() => "?").join(",")})
      AND cl.snapshot_date >= date(?, '-${AA_STICKY_DAYS} days')
  `).bind(snap, ...brands, ...pics, snap).all()).results || [];
  for (const r of pinnedRows) {
    const key = `${r.player_key}|${r.brand}|${r.tier_segment}`;
    if (inLoad.has(key) || !activeSet.has(r.owner)) continue;
    const t = tierOf(r) || 6;
    load[r.owner].push({ ...r, tier: t, fresh: false, whale: t <= 2 ? 1 : 0, last_touch: null, strikes: 0, mtd: 0, agents7: 0, pinned: true });
    inLoad.add(key);
  }

  // Cap each PIC: reserve the whale + money share of the cap, then backfill to it.
  const isWhale = (t) => t === 1 || t === 2, isMoney = (t) => t === 3 || t === 4;
  // Slots scale with the cap, so opening a second batch widens the whole mix rather than
  // filling the extra 30 with nothing but leftovers.
  const whaleSlots = Math.round(cap * AA_WHALE_SHARE), moneySlots = Math.round(cap * AA_MONEY_SHARE);
  const slim = (p) => ({ player_key: p.player_key, username: p.username, brand: p.brand,
    tier_segment: p.tier_segment, dsld: p.dsld, pnl: Math.round(p.pnl), whale: !!p.whale,
    band: AA_TIER_LABEL[p.tier], sticky: !!(p.owner && activeSet.has(p.owner)),
    // fresh → nobody has contacted this player this month, so they still count toward parity.
    // dupe  → two or more agents already touched them inside 7 days (over-contact).
    fresh: !!p.fresh, dupe: (p.agents7 || 0) > 1, pinned: !!p.pinned });
  const assignments = {}, summary = {};
  for (const p of pics) {
    const mine = load[p].slice().sort(cmpDeal);
    const pinned = mine.filter((x) => x.pinned);                 // manual picks: always kept
    const pool2 = mine.filter((x) => !x.pinned);
    const whales = pool2.filter((x) => isWhale(x.tier));
    const money = pool2.filter((x) => isMoney(x.tier));
    const rest = pool2.filter((x) => !isWhale(x.tier) && !isMoney(x.tier));
    let pick = [...whales.slice(0, whaleSlots), ...money.slice(0, moneySlots)];
    const leftover = [...whales.slice(whaleSlots), ...money.slice(moneySlots), ...rest].sort(cmpDeal);
    pick = pick.concat(leftover.slice(0, Math.max(0, cap - pick.length - pinned.length)));
    const final = [...pinned, ...pick].sort(cmpDeal);
    assignments[p] = final.map(slim);
    summary[p] = { total: final.length, whales: final.filter((x) => isWhale(x.tier)).length,
      money: final.filter((x) => isMoney(x.tier)).length, fresh: final.filter((x) => x.fresh).length,
      pinned: pinned.length, backlog: mine.length };
  }
  return { snapshot: snap, team, live: AUTO_ASSIGN_ENABLED, cap, batch, max_batch: AA_MAX_BATCH,
    batch_size: AA_CAP, split: `${whaleSlots}w+${moneySlots}m`,
    lag_days: AA_LAG_DAYS, pics, off: [...off], pool_size: players.length,
    fresh_pool: players.filter((x) => x.fresh).length, summary, assignments,
    held: Object.fromEntries(Object.entries(held).map(([p, arr]) => [p, arr.length])) };
}

/* ══ AUTO-ASSIGN PHASE 2 — write the deal into contact_log ═══════════════════════
   OFF until AUTO_ASSIGN_ENABLED is flipped to true and the Worker is redeployed.
   While it is off, the cron logs a skip and the console stays a preview.

   What it writes: one row per dealt player — status ASSIGNED, updated_by 'auto'.
   What it never touches:
     • a row a human wrote (updated_by <> 'auto') — a manager's manual pick stands
     • a row anyone has acted on (status past ASSIGNED) — an outcome is never undone
     • contacted_at — that column belongs to the first human touch, same as autoOutcomes
   Carry-over falls out of this: an untouched player keeps yesterday's owner (the sticky
   lookup reads these rows back), so unfinished work rolls to the next day with the same
   PIC instead of being re-dealt. Running it twice in a day is safe — same deal, no churn.
   POST /api/rtn/auto-assign/run exercises this exact function, so a dry run proves it. */
const AUTO_ASSIGN_ENABLED = false;

async function runAutoAssign(env, opts = {}) {
  const dryRun = !!opts.dryRun;
  const out = { dry: dryRun, enabled: AUTO_ASSIGN_ENABLED, teams: {} };
  for (const team of Object.keys(TEAM_BRANDS)) {
    let deal;
    try { deal = await computeAutoAssign(env, { team, off: opts.off || [] }); }
    catch (e) { out.teams[team] = { error: (e && e.message) || String(e) }; continue; }
    if (deal.skipped) { out.teams[team] = { skipped: deal.skipped }; continue; }

    const rows = [];
    for (const pic of deal.pics) for (const p of (deal.assignments[pic] || [])) rows.push({ pic, p });
    out.teams[team] = { snapshot: deal.snapshot, pics: deal.pics.length, dealt: rows.length };
    if (dryRun || !rows.length) continue;

    const stmt = env.DB.prepare(`
      INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, assigned_to, status, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ASSIGNED', 'auto', datetime('now'))
      ON CONFLICT (snapshot_date, player_key, brand, tier_segment) DO UPDATE SET
        assigned_to = excluded.assigned_to, updated_at = datetime('now')
      WHERE contact_log.updated_by = 'auto'
        AND (contact_log.status IS NULL OR contact_log.status = 'ASSIGNED')
    `);
    let written = 0;
    for (let i = 0; i < rows.length; i += 25) {
      const res = await env.DB.batch(rows.slice(i, i + 25).map((r) =>
        stmt.bind(deal.snapshot, r.p.player_key, r.p.brand, r.p.tier_segment, r.pic)));
      written += res.reduce((n, x) => n + ((x.meta && x.meta.changes) || 0), 0);
    }
    out.teams[team].written = written;
    out.teams[team].untouched = rows.length - written;   // rows a human already owns
  }
  return out;
}

// ── Lark Base → Telegram links sync ────────────────────────────────────────────
// ── Feeder kick-off ─────────────────────────────────────────────────────────
// Every brand's Google Sheets feeder is also deployed as a Web App. At 12:15 MYT this Worker
// POSTs to all of them at once, so every brand syncs together instead of each sheet's own
// Apps Script timer drifting ±15 min. The sheets keep 3/7/10 PM timers as backup runs.
// FEEDER_URLS (secret) = the Web App URLs, whitespace/comma separated. The body carries
// INGEST_TOKEN, which each feeder checks before running.
const FEEDER_CRON = "15 4 * * *";   // 04:15 UTC = 12:15 MYT — must match wrangler.toml [triggers]

function feederUrls(env) {
  return String(env.FEEDER_URLS || "").split(/[\s,]+/)
    .filter((u) => /^https:\/\/script\.google\.com\/(a\/macros\/[\w.-]+|macros)\/s\/[\w-]+\/exec$/.test(u));
}

async function kickFeeders(env) {
  const urls = feederUrls(env);
  if (!urls.length) return { skipped: "FEEDER_URLS not set", kicked: 0, ok: 0 };
  if (!env.INGEST_TOKEN) return { skipped: "INGEST_TOKEN not set", kicked: 0, ok: 0 };
  const t0 = Date.now();
  const body = JSON.stringify({ key: env.INGEST_TOKEN });
  // All requests start together. Apps Script runs doPost, then 302-redirects to its output,
  // which fetch follows, so the response is the feeder's own JSON result.
  const results = await Promise.all(urls.map(async (u) => {
    const id = ((u.match(/\/s\/([\w-]+)\/exec$/) || [])[1] || "?").slice(-6);   // short tag for logs; never log the full URL
    try {
      const res = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body, redirect: "follow" });
      const text = await res.text();
      let out = null; try { out = JSON.parse(text); } catch (e) { /* not JSON = Google error page */ }
      return out ? { id, ...out } : { id, ok: false, error: `HTTP ${res.status} (not JSON)` };
    } catch (e) { return { id, ok: false, error: (e && e.message) || String(e) }; }
  }));
  return { kicked: urls.length, ok: results.filter((r) => r.ok).length, ms: Date.now() - t0, results };
}

// Reads the "Telegram Approaching" Base → P&L1 table, Overview view, field "Telegram combine", cleans each
// livechat link and MIRRORS it into player_telegram. One-way: Lark is the single source of truth.
//   • "Telegram combine" filled → that player's Telegram link (rewritten to the shared archive form).
//   • "Telegram combine" EMPTY  → the player has no Telegram: any stored link for them is removed.
// So after a run player_telegram holds exactly what Lark holds (links typed by hand in the drawer or imported by CSV
// are replaced at the next run). Link is per (player_key, brand) — Tier is not needed.
const LARK = { HOST: "https://open.larksuite.com", BASE: "Hstmbhe1Wakn2zs9HSelYFq1gig" };
const PNL1_TABLE = "tbl2cAhlR75Kr3iI";
const PNL1_VIEWS = ["vewLlMlc1w"];   // Overview — every player (read from the live Lark URL; the 5th character is a lowercase L, not the digit 1). The old Team A/B/C views are no longer used
// Lark short brand code ("LPK") → the console's full brand ("LPK777").
const LARK_BRAND = (() => {
  const m = {};
  for (const team of Object.values(TEAM_BRANDS)) for (const full of team) m[full.replace(/\d+$/, "")] = full;
  return m;
})();
const LARK_BRAND_UP = Object.fromEntries(Object.entries(LARK_BRAND).map(([k, v]) => [k.toUpperCase(), v]));   // case-insensitive lookup

// Pull a plain string from a Lark field value (text, number, rich-text array,
// select object, url object, or a formula {type,value} wrapper).
function larkText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(larkText).join("");
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.link === "string") return v.link;
    if (v.value !== undefined) return larkText(v.value);
    return "";
  }
  return String(v);
}

// Pull the URL out of a Lark "url" field ([{link,text,type:'url'}]) — prefer link, then text.
function larkUrlField(v) {
  const arr = Array.isArray(v) ? v : [v];
  for (const el of arr) {
    if (el && typeof el === "object") { const c = el.link || el.text; if (c) return String(c); }
    else if (el) return String(el);
  }
  return "";
}

// Any livechat link → the uniform shareable archive form: archives/<chatId>?shared=true.
// The chat id is the LAST segment of "/chats/<group>/<chatId>" (or the id in "/archives/<id>").
// Handles doubled values (first link wins) and drops placeholders ("http://").
function normalizeLivechat(u) {
  let s = String(u || "").trim();
  const second = s.indexOf("https://", 8);               // de-double: drop a 2nd concatenated link
  if (second > 0) s = s.slice(0, second);
  const arc = (id) => `https://my.livechatinc.com/archives/${id}?shared=true`;
  let m = s.match(/\/archives\/([A-Za-z0-9]+)/);          // already archive form
  if (m) return arc(m[1]);
  m = s.match(/\/chats\/[A-Za-z0-9]+\/([A-Za-z0-9]+)/);   // /chats/<group>/<chatId>
  if (m) return arc(m[1]);
  m = s.match(/\/chats\/([A-Za-z0-9]+)/);                 // /chats/<chatId> (single segment)
  if (m) return arc(m[1]);
  return null;
}

async function larkFetch(path, token, init) {
  const res = await fetch(LARK.HOST + path, {
    ...(init || {}),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
  });
  const j = await res.json();
  if (j.code !== 0) throw new Error(`lark ${path} → ${j.code} ${j.msg || ""}`);
  return j;
}

async function larkToken(env) {
  const j = await larkFetch("/open-apis/auth/v3/tenant_access_token/internal", null, {
    method: "POST", body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  return j.tenant_access_token;
}

async function larkRecords(token, tableId, viewId, base = LARK.BASE) {
  const out = [];
  let pageToken = "";
  do {
    const q = `?page_size=500${viewId ? "&view_id=" + viewId : ""}${pageToken ? "&page_token=" + pageToken : ""}`;
    const j = await larkFetch(`/open-apis/bitable/v1/apps/${base}/tables/${tableId}/records${q}`, token);
    out.push(...(j.data?.items || []));
    pageToken = j.data?.has_more ? j.data.page_token : "";
  } while (pageToken);
  return out;
}

// ── Livechat / Telegram engagement (Lark "VIP RTN MYR - Customer Approaching") ─────────────
// The base keeps a small "Engagement" table that backs its Engagement chart: one row per brand
// with "false" (Livechat chats) and "true" (Telegram chats) for ONE day, the previous MYT day,
// which is what the chart shows. We read those ~26 rows and store them under that day in
// engagement_daily, so the Daily report's engagement table fills itself. (The raw monthly
// "Customer approaching" table has 12k+ rows and a new name each month, too heavy to count.)
const ENG = {
  BASE: "EqeEbFrFeaAMDSsfOqalJJ4kgNb",
  TABLE: "tblXtlXY8QFH888d",   // "Engagement"
  BRAND_FIELD: "Brand",        // short code (LPK, HOT, ...) — same codes as LARK_BRAND
  LIVECHAT_FIELD: "false",
  TELEGRAM_FIELD: "true",
};

// opts.date = the MYT day the numbers belong to (default: yesterday MYT). opts.dryRun = read only.
async function larkEngagementSync(env, opts = {}) {
  if (!env.LARK_APP_ID || !env.LARK_APP_SECRET) return { skipped: "no LARK credentials" };
  const day = /^\d{4}-\d{2}-\d{2}$/.test(opts.date || "") ? opts.date
    : new Date(Date.now() + 8 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
  const token = await larkToken(env);
  const recs = await larkRecords(token, ENG.TABLE, undefined, ENG.BASE);
  const num = (v) => { const n = Number(String(larkText(v)).replace(/,/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
  const known = new Set(TEAM_BRANDS.A.concat(TEAM_BRANDS.B, TEAM_BRANDS.C));
  const counts = {}, unknownBrands = [];
  for (const r of recs) {
    const f = r.fields || {};
    const code = larkText(f[ENG.BRAND_FIELD]).trim();
    if (!code) continue;
    const brand = LARK_BRAND[code] || (known.has(code) ? code : null);
    if (!brand) { unknownBrands.push(code); continue; }
    const c = counts[brand] || (counts[brand] = { livechat: 0, telegram: 0 });
    c.livechat += num(f[ENG.LIVECHAT_FIELD]); c.telegram += num(f[ENG.TELEGRAM_FIELD]);
  }
  const rows = Object.entries(counts).map(([brand, c]) => ({ brand, ...c }));
  const total = rows.reduce((t, r) => ({ livechat: t.livechat + r.livechat, telegram: t.telegram + r.telegram }), { livechat: 0, telegram: 0 });
  const stats = { day, read: recs.length, unknownBrands, total, rows };
  if (opts.dryRun) return { ...stats, dryRun: true };
  if (!rows.length) return { ...stats, saved: 0, note: "nothing to save" };
  await env.DB.batch(rows.map((r) => env.DB.prepare(
    `INSERT INTO engagement_daily (chat_date, brand, livechat, telegram, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (chat_date, brand) DO UPDATE SET livechat = excluded.livechat, telegram = excluded.telegram, updated_at = datetime('now')`
  ).bind(day, r.brand, r.livechat, r.telegram)));
  return { ...stats, saved: rows.length };
}

async function larkTelegramSync(env, opts = {}) {
  const dryRun = !!opts.dryRun;
  if (!env.LARK_APP_ID || !env.LARK_APP_SECRET) return { skipped: "no LARK credentials" };
  const token = await larkToken(env);
  const found = new Map();                                                 // "brand|player_key" → row (one link per player)
  let seen = 0, noKey = 0, noBrand = 0, noUrl = 0;
  // Tally: every row whose "Telegram combine" cell is NOT empty ends up in exactly one of these buckets.
  const tally = { linkCells: 0, saved: 0, duplicates: 0, unusable: 0, noBrandWithLink: 0, noKeyWithLink: 0 };
  const unusableSample = [];
  const skippedBrands = {};
  for (const viewId of PNL1_VIEWS) {
    for (const rec of await larkRecords(token, PNL1_TABLE, viewId)) {
      seen++;
      const f = rec.fields || {};
      const player_key = larkText(f["Username"]).trim();
      const brandCode = larkText(f["Brand"]).trim();
      const brand = LARK_BRAND[brandCode];
      const rawLink = larkUrlField(f["Telegram combine"]);
      const hasCell = !!String(rawLink || "").trim();
      const url = normalizeLivechat(rawLink);
      if (hasCell) tally.linkCells++;
      if (!player_key) { noKey++; if (hasCell) tally.noKeyWithLink++; continue; }
      if (!brand) { noBrand++; if (hasCell) tally.noBrandWithLink++; if (brandCode) skippedBrands[brandCode] = (skippedBrands[brandCode] || 0) + 1; continue; }
      if (!url) {                                                           // empty = no Telegram: nothing to store
        noUrl++;
        if (hasCell) { tally.unusable++; if (unusableSample.length < 5) unusableSample.push(String(rawLink).slice(0, 40)); }   // filled, but not a LiveChat chat link
        continue;
      }
      const k = `${brand}|${player_key}`;
      if (found.has(k)) tally.duplicates++;                                  // the same player listed twice: one link kept
      found.set(k, { player_key, brand, url });
    }
  }
  tally.saved = found.size;
  const rows = [...found.values()];
  if (!seen) return { skipped: "Lark returned no rows — nothing changed", seen };
  // Lark stores the player's USERNAME. Our identity is player_key = uid when the feed sends
  // one, else username. TC brands used to ship no uid, so username WAS the key and every link
  // matched. When the feeder started sending uid for those brands, player_key flipped from
  // username to uid and 2,000+ stored links silently stopped matching — reach fell from ~43%
  // to ~19% overnight and whole brands dropped out of the auto-assign pool, with nothing
  // deleted and no error anywhere. So resolve the username to the CURRENT player_key before
  // writing. A row we cannot resolve is written unchanged — the player may simply not be in
  // today's roster, and their link should still be kept for when they return.
  const idx = await env.DB.prepare(
    "SELECT brand, username, player_key FROM player_days WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM player_days)"
  ).all();
  const liveKeys = new Set(), byUsername = new Map();
  for (const r of (idx.results || [])) {
    liveKeys.add(`${r.brand}|${r.player_key}`);
    if (r.username) byUsername.set(`${r.brand}|${r.username}`, r.player_key);
  }
  let remapped = 0;
  for (const r of rows) {
    if (liveKeys.has(`${r.brand}|${r.player_key}`)) continue;          // already the real key
    const real = byUsername.get(`${r.brand}|${r.player_key}`);
    if (real && real !== r.player_key) { r.player_key = real; remapped++; }
  }

  // What the mirror would change. Every row we are about to write gets the same `stamp`; afterwards anything without that
  // stamp was not in Lark's list, so it is removed. (A stamp, not a long NOT IN list: D1 caps bound variables.)
  const existing = (await env.DB.prepare("SELECT player_key, brand FROM player_telegram").all()).results || [];
  const keep = new Set(rows.map((r) => `${r.brand}|${r.player_key}`));
  const wouldDelete = existing.filter((e) => !keep.has(`${e.brand}|${e.player_key}`)).length;
  tally.adds_up = tally.linkCells === tally.saved + tally.duplicates + tally.unusable + tally.noBrandWithLink + tally.noKeyWithLink;
  const stats = { views: PNL1_VIEWS, seen, withLink: rows.length, emptyLink: noUrl, remapped, noKey, noBrand, skippedBrands,
    tally, unusableSample, storedBefore: existing.length, wouldDelete };
  // Safety: a half-empty answer (Lark outage, lost permission, wrong view) must never wipe the links. If the new list is
  // less than half of what is stored, stop and say so; run again with ?force=1 only when that drop is real.
  if (existing.length >= 200 && rows.length < existing.length * 0.5 && !opts.force)
    return { ...stats, aborted: "Lark returned less than half of the stored links — nothing changed. Check the view, then run with force=1 if this is right.", saved: 0, deleted: 0 };
  if (dryRun) return { ...stats, dryRun: true, saved: 0, deleted: 0, sample: rows.slice(0, 10) };
  // UTC, with milliseconds ("2026-10-19 00:00:01.234"): every other writer uses datetime('now') (whole seconds), so no
  // other row can ever carry exactly this marker, not even one created in the same second as the run.
  const stamp = new Date().toISOString().slice(0, 23).replace("T", " ");
  let saved = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    await env.DB.batch(chunk.map((r) => env.DB.prepare(`
      INSERT INTO player_telegram (player_key, brand, url, updated_by, updated_at)
      VALUES (?, ?, ?, 'lark', ?)
      ON CONFLICT (player_key, brand) DO UPDATE SET url = excluded.url, updated_by = 'lark', updated_at = excluded.updated_at
    `).bind(r.player_key, r.brand, r.url, stamp)));
    saved += chunk.length;
  }
  const del = await env.DB.prepare("DELETE FROM player_telegram WHERE updated_at IS NULL OR updated_at <> ?").bind(stamp).run();   // not written by this run = not in Lark
  return { ...stats, saved, deleted: (del.meta && del.meta.changes) || 0 };
}

// ── Daily feed-health check → Lark group bot ────────────────────────────────
// Once a day (17:00 MYT) posts a "Feed reconciled" card. Green when every brand's
// data advanced today; switches to an "attention" card naming brands that are
// missing or stale. Detection mirrors the RUSH33 diagnosis: a brand is "not
// updated" when its newest last_deposit_date did NOT advance AND its daily totals
// are byte-identical to the prior snapshot (a frozen source re-fed). Dormant until
// LARK_FEED_WEBHOOK is set, so it is safe to ship ahead of the bot.
async function feedCheckReport(env, opts = {}) {
  const dryRun = !!opts.dryRun;
  if (!env.LARK_FEED_WEBHOOK && !dryRun) return { skipped: "no LARK_FEED_WEBHOOK" };

  const ds = await env.DB.prepare(
    "SELECT DISTINCT snapshot_date d FROM player_days ORDER BY snapshot_date DESC LIMIT 2"
  ).all();
  const dates = (ds.results || []).map((r) => r.d);
  const today = dates[0], prev = dates[1] || null;
  if (!today) return { skipped: "no snapshots" };

  const ag = await env.DB.prepare(
    `SELECT snapshot_date sd, brand, COUNT(*) c, ROUND(SUM(daily_deposit)) dep, MAX(last_deposit_date) nd
     FROM player_days WHERE snapshot_date IN (?, ?) GROUP BY snapshot_date, brand`
  ).bind(today, prev || today).all();
  const cur = {}, prvB = {};
  for (const r of (ag.results || [])) (r.sd === today ? cur : prvB)[r.brand] = { c: r.c, dep: r.dep, nd: r.nd };

  const expectedToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const feedArrived = today === expectedToday;
  const dataDay = new Date(new Date(today + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);

  // Per-brand status over the full 23-brand roster (so an absent brand shows too).
  const statusMap = {}, detailMap = {};
  const roster = [].concat(...Object.values(TEAM_BRANDS));
  for (const b of roster) {
    const c = cur[b], p = prvB[b];
    if (!c) { statusMap[b] = "missing"; detailMap[b] = p ? `not in today's feed (was present ${prev})` : "not in today's feed"; }
    else if (p && c.nd <= p.nd && c.dep === p.dep && c.c === p.c) {
      const behind = Math.round((new Date(dataDay + "T00:00:00Z") - new Date(c.nd + "T00:00:00Z")) / 86400000);
      const rm = ("" + Math.round(c.dep)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      statusMap[b] = "not_updated";
      detailMap[b] = `stuck at ${c.nd} (${behind}d behind), same figures as ${prev}: RM${rm}, ${c.c} players`;
    }
    else statusMap[b] = "updated";
  }
  const okCount = roster.filter((b) => statusMap[b] === "updated").length;
  const problemCount = roster.length - okCount;

  const card = buildFeedCard({ today, dataDay, expectedToday, feedArrived, total: roster.length, okCount, problemCount, statusMap, detailMap });
  if (dryRun) return { today, prev, expectedToday, feedArrived, total: roster.length, okCount, problemCount, statusMap, card };
  await larkCardPost(env, card);
  // Track today's open problems so a feeder re-run can post a resolution follow-up.
  if (feedArrived) {
    const openBrands = roster.filter((b) => statusMap[b] !== "updated");
    if (openBrands.length) {
      await env.DB.prepare(
        "INSERT INTO feed_check_state (snapshot_date, open_json, updated_at) VALUES (?, ?, datetime('now')) " +
        "ON CONFLICT (snapshot_date) DO UPDATE SET open_json = excluded.open_json, updated_at = datetime('now')"
      ).bind(today, JSON.stringify(openBrands)).run();
    } else {
      await env.DB.prepare("DELETE FROM feed_check_state WHERE snapshot_date = ?").bind(today).run();
    }
  }
  return { today, okCount, problems: problemCount, posted: true };
}

// Build the Lark interactive card: green when reconciled, orange when brands need
// attention, red when today's feed never arrived. Colour + status words only — no emoji.
function buildFeedCard({ today, dataDay, expectedToday, feedArrived, total, okCount, problemCount, statusMap, detailMap }) {
  const md = (content) => ({ tag: "div", text: { tag: "lark_md", content } });
  const hr = { tag: "hr" };
  const foot = { tag: "note", elements: [{ tag: "lark_md", content: "Automated feed check · reads the feed only, changes nothing" }] };
  const wrap = (template, title, elements) => ({ msg_type: "interactive", card: { config: { wide_screen_mode: true }, header: { template, title: { tag: "plain_text", content: title } }, elements } });

  if (!feedArrived) {
    return wrap("red", `Feed not received — ${expectedToday}`, [
      md(`**Today's feed has not arrived.** Latest data on file is **${today}**; expected **${expectedToday}**.`),
      md("The 15:00 MYT feed may be late or missing — check the feeder before the day closes."), hr, foot,
    ]);
  }
  const MARK = { updated: "✅", not_updated: "❌", missing: "❌" };
  const LABEL = { updated: "Data updated", not_updated: "Not updated", missing: "No data" };
  const teamSection = (t) => md(`**Team ${t}**\n` + TEAM_BRANDS[t].map((b) => {
    const s = statusMap[b] || "missing";
    return `${MARK[s]} **${b}** — ${LABEL[s]}`;
  }).join("\n"));
  const summary = md(`**${okCount}/${total} brands updated** · data day ${dataDay}${problemCount ? ` · ${problemCount} need attention` : ""}`);
  const els = [summary, hr, teamSection("A"), teamSection("B"), teamSection("C")];
  if (problemCount > 0) {
    const bullets = Object.keys(statusMap).filter((b) => statusMap[b] !== "updated")
      .map((b) => `• **${b}** — ${LABEL[statusMap[b]]}: ${detailMap[b] || ""}`).join("\n");
    els.push(hr, md(`**⚠️ Alerts (${problemCount}):**\n${bullets}`));
  }
  els.push(hr, foot);
  return wrap(problemCount === 0 ? "green" : "orange", `Feed check — ${today}`, els);
}

// After a flagged brand is re-fed, check whether it is now fixed; if so post a
// resolution follow-up and shrink the stored open set. A compare-and-swap on
// open_json dedupes concurrent ingest chunks so only ONE follow-up is posted.
async function feedResolutionCheck(env, ingestedBrand) {
  if (!env.LARK_FEED_WEBHOOK) return { skipped: "no webhook" };
  const today = snapshotDateMYT();
  const row = await env.DB.prepare("SELECT open_json FROM feed_check_state WHERE snapshot_date = ?").bind(today).first();
  if (!row || !row.open_json) return { skipped: "no open alerts" };
  let open;
  try { open = JSON.parse(row.open_json); } catch (e) { return { skipped: "bad state" }; }
  if (!Array.isArray(open) || !open.length || !open.includes(ingestedBrand)) return { skipped: "brand not flagged" };

  const pr = await env.DB.prepare("SELECT MAX(snapshot_date) d FROM player_days WHERE snapshot_date < ?").bind(today).first();
  const prev = pr && pr.d;
  const ph = open.map(() => "?").join(",");
  const ag = await env.DB.prepare(
    `SELECT snapshot_date sd, brand, COUNT(*) c, ROUND(SUM(daily_deposit)) dep, MAX(last_deposit_date) nd
     FROM player_days WHERE snapshot_date IN (?, ?) AND brand IN (${ph}) GROUP BY snapshot_date, brand`
  ).bind(today, prev || today, ...open).all();
  const cur = {}, prvB = {};
  for (const r of (ag.results || [])) (r.sd === today ? cur : prvB)[r.brand] = { c: r.c, dep: r.dep, nd: r.nd };

  const stillOpen = [], resolved = [];
  for (const b of open) {
    const c = cur[b], p = prvB[b];
    const fixed = c && !(p && c.nd <= p.nd && c.dep === p.dep && c.c === p.c);
    if (fixed) resolved.push({ brand: b }); else stillOpen.push(b);
  }
  if (!resolved.length) return { skipped: "nothing resolved yet" };

  const upd = await env.DB.prepare(
    "UPDATE feed_check_state SET open_json = ?, updated_at = datetime('now') WHERE snapshot_date = ? AND open_json = ?"
  ).bind(JSON.stringify(stillOpen), today, row.open_json).run();
  if (!upd.meta || upd.meta.changes !== 1) return { skipped: "raced" };

  await larkCardPost(env, buildResolutionCard({ today, resolved, stillOpen }));
  if (!stillOpen.length) await env.DB.prepare("DELETE FROM feed_check_state WHERE snapshot_date = ?").bind(today).run();
  return { resolved: resolved.map((r) => r.brand), stillOpen };
}

function buildResolutionCard({ today, resolved, stillOpen }) {
  const md = (content) => ({ tag: "div", text: { tag: "lark_md", content } });
  const foot = { tag: "note", elements: [{ tag: "lark_md", content: "Automated feed check · reads the feed only, changes nothing" }] };
  const resolvedLines = resolved.map((r) => `• **${r.brand}** — now updated`).join("\n");
  const els = [md(`**✅ Resolved (${resolved.length}):**\n${resolvedLines}`)];
  els.push(stillOpen.length ? md(`**Still open (${stillOpen.length}):** ${stillOpen.join(", ")}`) : md("**All feeds now complete.**"));
  els.push({ tag: "hr" }, foot);
  const title = stillOpen.length ? `Feed update — ${today}` : "Feed resolved — all complete";
  return { msg_type: "interactive", card: { config: { wide_screen_mode: true }, header: { template: "green", title: { tag: "plain_text", content: title } }, elements: els } };
}

// POST a card to the Lark group bot webhook. Signs the request when a secret is set
// (Lark "signature verification"): base64(HMAC-SHA256(key = timestamp\nsecret, "")).
async function larkCardPost(env, card) {
  // Secrets set via `wrangler secret put` can arrive with a leading BOM/whitespace from a
  // copy-paste source — a BOM breaks the URL fetch ("cannot load") AND the HMAC sign
  // (Lark → 19021). .trim() strips it defensively — U+FEFF (BOM) counts as JS whitespace,
  // so it also removes a leading BOM, not just spaces/newlines. A dirty secret can't break us.
  const clean = (s) => (s || "").trim();
  const url = clean(env.LARK_FEED_WEBHOOK);
  if (!url) return { skipped: "no webhook" };
  const body = { ...card };
  const secret = clean(env.LARK_FEED_SECRET);
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    body.timestamp = timestamp;
    body.sign = await larkSign(secret, timestamp);
  }
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (j.code && j.code !== 0) throw new Error(`lark webhook → ${j.code} ${j.msg || ""}`);
  return { ok: true, code: j.code ?? 0 };
}

async function larkSign(secret, timestamp) {
  const key = new TextEncoder().encode(`${timestamp}\n${secret}`);
  const ck = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", ck, new Uint8Array(0)));
  let bin = "";
  for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
  return btoa(bin);
}

/* ── Roster auto-assign (Login Check, v23) ──────────────────────────────────
   Deals any player in a tier's LATEST snapshot who has no active owner to the
   least-loaded eligible agent, keeping counts even as the roster churns. Purely
   additive: it never moves a player who already has an owner. Shared by the
   manager button (POST /api/rtn/login-check/auto-assign) and the daily cron. */
async function autoAssignOneRoster(env, brand, tier, assignedBy) {
  const latest = await env.DB.prepare(
    "SELECT MAX(snapshot_date) d FROM player_days WHERE brand = ? AND tier_segment = ?"
  ).bind(brand, tier).first();
  if (!latest || !latest.d) return { assigned: 0, reason: "no snapshot" };

  // Eligible agents = scored Team B CS agents, derived from users (not hardcoded).
  const ag = await env.DB.prepare(
    "SELECT username FROM users WHERE team = 'B' AND on_leaderboard = 1 ORDER BY username"
  ).all();
  const agents = (ag.results || []).map((r) => r.username);
  if (!agents.length) return { assigned: 0, reason: "no agents" };

  // Current load per agent in this scope, so new players top up the lightest piles.
  const loadRows = await env.DB.prepare(
    "SELECT agent, COUNT(*) n FROM player_assignment WHERE brand = ? AND tier_segment = ? AND active = 1 GROUP BY agent"
  ).bind(brand, tier).all();
  const load = {};
  agents.forEach((a) => (load[a] = 0));
  (loadRows.results || []).forEach((r) => { if (r.agent in load) load[r.agent] = r.n; });

  // Unassigned players in the latest snapshot, high value first so big fish spread.
  const un = await env.DB.prepare(`
    SELECT pd.player_key FROM player_days pd
     WHERE pd.snapshot_date = ? AND pd.brand = ? AND pd.tier_segment = ?
       AND NOT EXISTS (SELECT 1 FROM player_assignment a
                        WHERE a.brand = pd.brand AND a.tier_segment = pd.tier_segment
                          AND a.player_key = pd.player_key AND a.active = 1
                          AND a.agent IN (SELECT username FROM users))
     ORDER BY pd.daily_deposit DESC, pd.player_key
  `).bind(latest.d, brand, tier).all();
  const players = (un.results || []).map((r) => r.player_key);
  if (!players.length) return { assigned: 0, load };

  const stmts = [];
  for (const pk of players) {
    let pick = agents[0];
    for (const a of agents) if (load[a] < load[pick]) pick = a;   // least-loaded, tie-break by name
    load[pick]++;
    stmts.push(env.DB.prepare(`
      INSERT INTO player_assignment (brand, tier_segment, player_key, agent, active, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
      ON CONFLICT (brand, tier_segment, player_key) DO UPDATE SET
        agent = excluded.agent, active = 1, assigned_by = excluded.assigned_by, assigned_at = datetime('now')
    `).bind(brand, tier, pk, pick, assignedBy));
  }
  await env.DB.batch(stmts);
  return { assigned: players.length, load };
}

// Run the roster auto-assign for every scope that already has an active roster
// (i.e. one an ATL has set up). New brands generalise automatically once seeded.
async function autoAssignRosters(env, assignedBy = "cron") {
  const scopes = await env.DB.prepare(
    "SELECT DISTINCT brand, tier_segment FROM player_assignment WHERE active = 1"
  ).all();
  const out = {};
  for (const s of (scopes.results || []))
    out[`${s.brand}/${s.tier_segment}`] = await autoAssignOneRoster(env, s.brand, s.tier_segment, assignedBy);
  return out;
}

const worker = {
  async route(request, env, ctx) {
    CORS = corsFor(request);
    if (env.LARK_HOST) LARK.HOST = env.LARK_HOST;   // local preview only: point Lark calls at a mock; unset in production
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const clientIp = request.headers.get("CF-Connecting-IP") || "";  // trusted, set by Cloudflare
    const log = (actor, action, detail) => { if (ctx) ctx.waitUntil(logAct(env, clientIp, actor, action, detail)); };

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // ── POST /api/login ────────────────────────────────────────────────────────
    if (path === "/api/login" && method === "POST") {
      const { username, password } = await request.json();
      if (!username || !password) return err("Username and password required");

      const user = await env.DB.prepare(
        "SELECT * FROM users WHERE username = ?"
      ).bind(username.trim().toLowerCase()).first();

      if (!user) { await new Promise(r => setTimeout(r, 1000)); return err("Invalid credentials", 401); }

      const hash = await sha256(password + (env.PASSWORD_SALT || "lpk777salt"));
      if (hash !== user.password_hash) { await new Promise(r => setTimeout(r, 1000)); return err("Invalid credentials", 401); }

      // Update last login
      await env.DB.prepare(
        "UPDATE users SET last_login = datetime('now') WHERE username = ?"
      ).bind(user.username).run();

      const token = await makeToken(user.username, env.SESSION_SECRET);
      log(user, "login", `Signed in as ${user.role}`);
      const mgr = !!user.manage_users;
      return ok({ token, username: user.username, role: user.role,
        can_edit: !!user.can_edit || mgr, can_delete: !!user.can_delete || mgr,
        on_leaderboard: !!user.on_leaderboard, manage_users: mgr, team: user.team || null });
    }

    // ── POST /api/users/init — create first admin (only if no users exist) ─────
    if (path === "/api/users/init" && method === "POST") {
      const count = await env.DB.prepare("SELECT COUNT(*) as c FROM users").first();
      if (count.c > 0) return err("Users already exist", 403);
      const { username, password } = await request.json();
      if (!username || !password) return err("Username and password required");
      if (password.length < 8) return err("Password must be at least 8 characters");
      const hash = await sha256(password + (env.PASSWORD_SALT || "lpk777salt"));
      await env.DB.prepare(
        "INSERT INTO users (username, password_hash, role, can_edit, can_delete, on_leaderboard, manage_users) VALUES (?, ?, 'admin', 1, 1, 0, 1)"
      ).bind(username.trim().toLowerCase(), hash).run();
      return ok({ message: "Admin created successfully" });
    }

    // ── POST /api/ingest — Google Sheets feeder (INGEST_TOKEN auth) ─────────────
    // MUST stay ABOVE the requireAuth block: it authenticates with its own
    // token, not a dashboard session.
    if (path === "/api/ingest" && method === "POST") {
      return handleIngest(request, env, ctx);
    }

    // ── Widget notes API — the Customer Approaching widget adds / reads Relationship notes ──────────
    // Authenticated by ONE shared key (WIDGET_API_KEY, header x-widget-token), not a console login:
    // the widget's backend has already verified the agent through LiveChat and passes that agent's
    // name as `author`. The key opens ONLY these two routes. Kept ABOVE the requireAuth gate, like
    // /api/ingest. Notes land in the same player_notes table the console drawer shows, so they
    // appear there at once, authored "<name> (widget)".
    if (path === "/api/ext/note" || path === "/api/ext/notes" || path === "/api/ext/action" || path === "/api/ext/actions") {
      const key = request.headers.get("x-widget-token") || "";
      if (!env.WIDGET_API_KEY || !(await safeEqual(key, env.WIDGET_API_KEY))) return err("unauthorized", 401);
      const known = new Set(Object.values(TEAM_BRANDS).flat());
      // The widget sends the brand as Lark spells it (the SHORT code: FUN, VS, SPIN, PP …). Accept the short code or the
      // full name, any case, and use the full console brand from here on. Unknown → "" (rejected below / 404).
      const normBrand = (raw) => {
        const s = String(raw || "").trim().toUpperCase();
        if (!s) return "";
        for (const f of known) if (f.toUpperCase() === s) return f;
        return LARK_BRAND_UP[s] || "";
      };
      // The widget sends the username/uid it looked up (lower-cased) and the brand; map that to the console's
      // stored player_key (TC brands key on username, Zyra on uid) so the note lands on the right profile.
      const resolve = async (raw, brand) => {
        const q = String(raw || "").trim().toLowerCase();
        if (!q || !known.has(brand)) return null;
        const hit = await env.DB.prepare(
          `SELECT player_key FROM player_days WHERE brand = ? AND (lower(player_key) = ? OR lower(uid) = ? OR lower(username) = ?)
           ORDER BY snapshot_date DESC LIMIT 1`).bind(brand, q, q, q).first();
        return hit ? hit.player_key : null;
      };
      if (path === "/api/ext/notes" && method === "GET") {
        const brand = normBrand(url.searchParams.get("brand"));
        const pk = await resolve(url.searchParams.get("player_key"), brand);
        if (!pk) return err("player not found in the console", 404);
        const notes = await env.DB.prepare(
          `SELECT id, note, created_by, created_at FROM player_notes WHERE player_key = ? AND brand = ?
           ORDER BY created_at DESC, id DESC LIMIT 50`).bind(pk, brand).all();
        return ok({ player_key: pk, brand, notes: notes.results || [] });
      }
      if (path === "/api/ext/note" && method === "POST") {
        let b; try { b = await request.json(); } catch (e) { return err("invalid_json"); }
        const brand = normBrand(b && b.brand);
        const note = String((b && b.note) || "").trim();
        let author = cleanAgentName(b && b.author);
        if (!note) return err("note is empty");
        if (note.length > 2000) return err("note too long (max 2000 characters)");
        if (!author) return err("author is required");
        // The widget's agent names look like "96 Raven - VIP RTN SNR MY"; the console login is just "raven".
        // When the cleaned name matches a console username, use that username; otherwise keep the cleaned name.
        const acct = await env.DB.prepare("SELECT username FROM users WHERE lower(username) = lower(?)").bind(author).first();
        if (acct) author = acct.username;
        if (!known.has(brand)) return err("unknown brand");
        // Flood guard that survives across Worker instances: count the widget's own notes in the last minute.
        const recent = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM player_notes WHERE created_by LIKE '% (widget)' AND created_at >= datetime('now','-1 minute')").first();
        if (recent && recent.n >= WIDGET_NOTES_PER_MIN) return err("too many notes, slow down", 429);
        const pk = await resolve(b.player_key, brand);
        if (!pk) return err("player not found in the console", 404);
        await env.DB.prepare(
          "INSERT INTO player_notes (player_key, brand, note, created_by, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).bind(pk, brand, note, `${author} (widget)`).run();
        if (ctx) ctx.waitUntil(logAct(env, clientIp, { username: `widget:${author}`, role: "widget" }, "note", `Added note via widget · ${pk} (${brand})`));
        return ok({ saved: true, player_key: pk });
      }
      /* Action log (the drawer's right-hand block = contact_log). The widget files the player's NEXT ACTION as a note on
         today's contact_log row (latest snapshot, the row the console shows). It never sets a status or an assignee,
         and it is written so the automations that read this table are not disturbed:
           • an existing row keeps its status, assignee, class, updated_by AND updated_at. updated_at drives the 6h
             auto NO_RESPONSE flip and the 48h cooldown; updated_by <> 'auto' marks a manual auto-assign pin.
             Only `note` changes: the widget line is APPENDED (the agent's own text is never overwritten).
           • no row yet → one is created with status NULL, no assignee, no contacted_at (it is not a contact).
         Attribution is inside the line: "[widget · <name> · <MYT time>] <text>". */
      if (path === "/api/ext/action" && method === "POST") {
        let b; try { b = await request.json(); } catch (e) { return err("invalid_json"); }
        const brand = normBrand(b && b.brand);
        const note = String((b && b.note) || "").trim();
        let author = cleanAgentName(b && b.author);
        if (!note) return err("note is empty");
        if (note.length > 2000) return err("note too long (max 2000 characters)");
        if (!author) return err("author is required");
        if (!known.has(brand)) return err("unknown brand");
        const acct = await env.DB.prepare("SELECT username FROM users WHERE lower(username) = lower(?)").bind(author).first();
        if (acct) author = acct.username;
        const recent = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM activity_log WHERE username LIKE 'widget:%' AND ts >= datetime('now','-1 minute')").first();
        if (recent && recent.n >= WIDGET_NOTES_PER_MIN) return err("too many entries, slow down", 429);
        const q = String(b.player_key || "").trim().toLowerCase();
        const snap = await env.DB.prepare("SELECT MAX(snapshot_date) AS d FROM player_days WHERE brand = ?").bind(brand).first();
        const row = q && snap && snap.d ? await env.DB.prepare(
          `SELECT player_key, tier_segment FROM player_days WHERE brand = ? AND snapshot_date = ?
             AND (lower(player_key) = ? OR lower(uid) = ? OR lower(username) = ?) LIMIT 1`).bind(brand, snap.d, q, q, q).first() : null;
        if (!row) return err("player not found in the console's latest snapshot", 404);
        const stamp = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
        const line = `[widget · ${author} · ${stamp}] ${note}`;
        const key = [snap.d, row.player_key, brand, row.tier_segment];
        const hit = await env.DB.prepare(
          "SELECT note FROM contact_log WHERE snapshot_date = ? AND player_key = ? AND brand = ? AND tier_segment = ?").bind(...key).first();
        if (hit) {
          await env.DB.prepare(
            "UPDATE contact_log SET note = ? WHERE snapshot_date = ? AND player_key = ? AND brand = ? AND tier_segment = ?"
          ).bind(hit.note ? hit.note + "\n" + line : line, ...key).run();
        } else {
          await env.DB.prepare(
            `INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, status, note, updated_by, updated_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, datetime('now'))`).bind(...key.slice(0, 4), line, `${author} (widget)`).run();
        }
        if (ctx) ctx.waitUntil(logAct(env, clientIp, { username: `widget:${author}`, role: "widget" }, "contact", `Added action via widget · ${row.player_key} (${brand})`));
        return ok({ saved: true, player_key: row.player_key, snapshot_date: snap.d, appended: !!(hit && hit.note) });
      }
      if (path === "/api/ext/actions" && method === "GET") {
        const brand = normBrand(url.searchParams.get("brand"));
        const pk = await resolve(url.searchParams.get("player_key"), brand);
        if (!pk) return err("player not found in the console", 404);
        const rows = await env.DB.prepare(
          `SELECT snapshot_date, status, note, updated_by, updated_at FROM contact_log
            WHERE player_key = ? AND brand = ? AND note IS NOT NULL AND note <> ''
            ORDER BY snapshot_date DESC, updated_at DESC LIMIT 10`).bind(pk, brand).all();
        return ok({ player_key: pk, brand, actions: (rows.results || []).map((r) => ({
          note: r.note, status: r.status, created_by: r.updated_by, created_at: r.updated_at, snapshot_date: r.snapshot_date })) });
      }
      return err("Not found", 404);
    }

    // ── All routes below require auth ──────────────────────────────────────────
    const user = await requireAuth(request, env);
    if (!user) return err("Unauthorized", 401);

    // Per-account permissions (enforced server-side). The flags are the single source of truth;
    // a manage_users account always keeps edit+delete. The last-manager guard prevents lockout.
    // Roles: an account with a role_key gets that role's permissions; every other account keeps exactly what its old flags give it.
    const roleMap = user.role_key ? await loadRoles(env.DB) : null;
    const perms = resolvePerms(user, roleMap);
    const can = (k) => perms.has(k);
    const canManage = can("users.manage");
    // Contacts come as a pair: "any" (contact.edit / contact.delete) and "own" (contact.edit_own / contact.delete_own). canEdit / canDelete mean
    // "some version of it"; the *Any flags say whether it reaches players and notes that belong to other agents.
    const canEditAny = can("contact.edit"), canDeleteAny = can("contact.delete");
    const canEdit = canEditAny || can("contact.edit_own");
    const canDelete = canDeleteAny || can("contact.delete_own");
    const NOEDIT = () => err("View-only — your account has no edit permission", 403);
    const OWNONLY = () => err("You can only work on players assigned to you", 403);
    // Who a player is assigned to today: the day's contact row first, then the standing assignment. null = nobody (anyone may pick it up).
    const ownerOf = async (b) => {
      const row = b.snapshot_date ? await env.DB.prepare("SELECT assigned_to FROM contact_log WHERE snapshot_date = ? AND player_key = ? AND brand = ? AND tier_segment = ?")
        .bind(b.snapshot_date, b.player_key, b.brand, b.tier_segment).first() : null;
      if (row && row.assigned_to) return row.assigned_to;
      const a = await env.DB.prepare("SELECT agent FROM player_assignment WHERE brand = ? AND player_key = ? AND active = 1 ORDER BY (tier_segment = ?) DESC LIMIT 1")
        .bind(b.brand, b.player_key, b.tier_segment || "").first();
      if (a) return a.agent;
      if (b.snapshot_date) return null;
      const last = await env.DB.prepare("SELECT assigned_to FROM contact_log WHERE player_key = ? AND brand = ? AND assigned_to IS NOT NULL ORDER BY snapshot_date DESC LIMIT 1").bind(b.player_key, b.brand).first();   // notes carry no day: use the latest contact row
      return last ? last.assigned_to : null;
    };

    // Team wall: managers see every brand; everyone else is locked to their team's brands.
    // allowedBrands === null → no restriction. Else an array (empty array → sees nothing).
    const allowedBrands = can("teams.all") ? null : (TEAM_BRANDS[user.team] || []);
    // SQL fragment to AND onto a query that already has a WHERE. `col` is the brand column.
    const teamAnd = (col = "brand") =>
      allowedBrands === null ? { s: "", b: [] }
      : allowedBrands.length === 0 ? { s: " AND 1=0", b: [] }
      : { s: ` AND ${col} IN (${allowedBrands.map(() => "?").join(",")})`, b: allowedBrands };
    const brandAllowed = (b) => allowedBrands === null || allowedBrands.includes(b);

    // Work management (tasks, schedule, projects...). Routes live in worker/work/*.js.
    { const w = await handleWork({ path, method, url, request, env, user, canManage, can, perms, roles: roleMap, ok, err, log, ctx }); if (w) return w; }
    { const r = await handleRoles({ path, method, url, request, env, user, can, perms, ok, err, log, ctx }); if (r) return r; }

    // Aggregate endpoints (trend/performance/kpi) accept ?team=A|B|C so a MANAGER can narrow
    // the all-teams view to one team. Non-managers stay pinned to their own team (param ignored).
    const reqTeam = url.searchParams.get("team");
    const scopeBrands = can("teams.all") ? (TEAM_BRANDS[reqTeam] || null) : allowedBrands;
    const scopeAnd = (col = "brand") =>
      scopeBrands === null ? { s: "", b: [] }
      : scopeBrands.length === 0 ? { s: " AND 1=0", b: [] }
      : { s: ` AND ${col} IN (${scopeBrands.map(() => "?").join(",")})`, b: scopeBrands };

    // ── GET /api/me ────────────────────────────────────────────────────────────
    if (path === "/api/me" && method === "GET") {
      return ok({ username: user.username, role: user.role, can_edit: canEdit,
        can_delete: canDelete, on_leaderboard: !!user.on_leaderboard, manage_users: canManage, team: user.team || null,
        role_key: user.role_key || null, role_name: (roleMap && roleMap.get(user.role_key) || {}).name || null, perms: [...perms] });
    }

    // ── POST /api/logout — record sign-out (token is cleared client-side) ───────
    if (path === "/api/logout" && method === "POST") {
      log(user, "logout", "Signed out");
      return ok({ ok: true });
    }

    // ── GET /api/activity — audit trail (managers only) — filters: username, action, date ──
    if (path === "/api/activity" && method === "GET") {
      if (!can("activity.view")) return err("Managers only", 403);
      const fu = url.searchParams.get("username"), fa = url.searchParams.get("action"), fd = url.searchParams.get("date"), ft = url.searchParams.get("team");
      const where = [], binds = [];
      if (ft && ["A", "B", "C"].includes(ft)) { where.push("username IN (SELECT username FROM users WHERE team = ?)"); binds.push(ft); }
      if (fu) { where.push("username LIKE ?"); binds.push("%" + fu.trim().toLowerCase() + "%"); }
      if (fa && fa !== "all") { where.push("action = ?"); binds.push(fa); }
      if (fd && /^\d{4}-\d{2}-\d{2}$/.test(fd)) { where.push("date(ts, '+8 hours') = ?"); binds.push(fd); }
      const sql = "SELECT ts, username, role, action, detail, ip FROM activity_log" +
        (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY id DESC LIMIT 300";
      const rows = await env.DB.prepare(sql).bind(...binds).all();
      return ok({ logs: rows.results || [] });
    }

    // KPI inputs are write-protected — viewers can't POST them even via the raw API.
    if (method === "POST" && path.startsWith("/api/rtn/kpi/")) {
      if (!canEdit) return NOEDIT();
      log(user, "kpi", `Saved KPI input: ${path.split("/").pop()}`);
    }

    // ── GET /api/rtn/latest — latest snapshot for the RTN console ─────────────
    if (path === "/api/rtn/latest" && method === "GET") {
      const latest = await env.DB.prepare(
        "SELECT MAX(snapshot_date) AS d FROM player_days"
      ).first();
      if (!latest || !latest.d) return ok({ snapshot_date: null, rows: [] });

      const lf = teamAnd();
      const rows = await env.DB.prepare(`
        SELECT snapshot_date, player_key, brand, tier_segment, uid, username,
               entry_date, previous_tier, tier, tier_movement, grace_end_date,
               status, status_days, group_name,
               daily_deposit_count, daily_deposit, daily_withdraw_count, daily_withdraw,
               monthly_deposit, monthly_withdraw, is_mau,
               lifetime_deposit, lifetime_withdraw,
               bet, valid_bet, win_loss, last_deposit_date, register_date,
               member_days, addressing, pnl
        FROM player_days WHERE snapshot_date = ?${lf.s}
      `).bind(latest.d, ...lf.b).all();

      return ok({ snapshot_date: latest.d, rows: rows.results });
    }

    // ── GET /api/rtn/board — everything the console needs in one call ─────────
    if (path === "/api/rtn/board" && method === "GET") {
      const latest = await env.DB.prepare("SELECT MAX(snapshot_date) AS d FROM player_days").first();
      if (!latest || !latest.d) return ok({ snapshot_date: null, rows: [], contacts: [], health: [], team: [] });
      // optional ?date=YYYY-MM-DD — view a past snapshot read-only; bad/missing/unknown date falls back to latest
      const reqDate = url.searchParams.get("date");
      let target = latest.d;
      if (reqDate && /^\d{4}-\d{2}-\d{2}$/.test(reqDate)) {
        const hit = await env.DB.prepare("SELECT 1 AS x FROM player_days WHERE snapshot_date = ? LIMIT 1").bind(reqDate).first();
        if (hit) target = reqDate;
      }
      const bf = teamAnd();   // brand filter for rows + contacts
      const healthWhere = allowedBrands === null ? ""
        : allowedBrands.length ? `WHERE pd.brand IN (${allowedBrands.map(() => "?").join(",")})` : "WHERE 1=0";
      const healthBinds = allowedBrands && allowedBrands.length ? allowedBrands : [];
      // At-risk whales — Tier V players breaking their OWN deposit rhythm, each given a 0-100 CHURN-RISK
      // score = 75% rhythm-break (dsld/gap, saturates at 4×) + 25% silence depth (dsld/20). Backtested
      // leak-free across 4 as-of dates: top band churns ~14× the bottom (2% → 29%). Quiet 4-14 days,
      // ≥1.6× normal gap. Each also carries a 30-day deposit FORECAST (run-rate × 30, backtested
      // monotonic) and is ranked by VALUE-AT-RISK = forecast × risk. Full-history baseline → LIVE only.
      const showCooling = target === latest.d;
      const bfC = teamAnd("pd.brand");
      const [rows, contacts, health, team, sync, telegram, cooling, reactivation] = await Promise.all([
        env.DB.prepare(`SELECT snapshot_date, player_key, brand, tier_segment, uid, username,
            entry_date, previous_tier, tier, tier_movement, grace_end_date, status, status_days, group_name,
            daily_deposit_count, daily_deposit, daily_withdraw_count, daily_withdraw,
            monthly_deposit, monthly_withdraw, is_mau, lifetime_deposit, lifetime_withdraw,
            bet, valid_bet, win_loss, last_deposit_date, register_date, member_days, addressing, pnl
          FROM player_days WHERE snapshot_date = ?${bf.s}`).bind(target, ...bf.b).all(),
        env.DB.prepare(`SELECT * FROM contact_log WHERE (snapshot_date = ? OR updated_at >= datetime('now','-7 days'))${bf.s}`).bind(target, ...bf.b).all(),
        env.DB.prepare(`SELECT pd.brand, MAX(pd.snapshot_date) AS last_fed,
            (SELECT MAX(p2.last_deposit_date) FROM player_days p2
               WHERE p2.brand = pd.brand AND p2.snapshot_date = (SELECT MAX(p3.snapshot_date) FROM player_days p3 WHERE p3.brand = pd.brand)
            ) AS newest_dep
          FROM player_days pd ${healthWhere} GROUP BY pd.brand`).bind(...healthBinds).all(),
        env.DB.prepare(`SELECT username, role, role_key, team, on_leaderboard FROM users ORDER BY username`).all()
          .catch(() => env.DB.prepare(`SELECT username, role, team, on_leaderboard FROM users ORDER BY username`).all()),     // schema_v27 not run yet: no role_key
        env.DB.prepare("SELECT MAX(ingested_at) AS t FROM player_days WHERE snapshot_date = ?").bind(target).first(),
        env.DB.prepare("SELECT player_key, brand, url FROM player_telegram").all(),
        showCooling ? env.DB.prepare(`
          WITH latest AS (SELECT MAX(snapshot_date) d FROM player_days),
          hist AS (SELECT player_key, brand, COUNT(DISTINCT snapshot_date) AS dp,
              SUM(CASE WHEN CAST(daily_deposit AS REAL) > 0 THEN 1 ELSE 0 END) AS dd,
              SUM(CAST(daily_deposit AS REAL)) AS tot
            FROM player_days WHERE tier_segment='V'${bf.s} GROUP BY player_key, brand),
          cur AS (SELECT pd.player_key, pd.brand, pd.tier_segment, COALESCE(NULLIF(pd.uid,''), pd.username) AS player,
              (CAST(pd.lifetime_withdraw AS REAL) - CAST(pd.lifetime_deposit AS REAL)) AS pnl,
              CAST(julianday((SELECT d FROM latest)) - julianday(pd.last_deposit_date) AS INT) AS dsld
            FROM player_days pd
            WHERE pd.snapshot_date = (SELECT d FROM latest) AND pd.tier_segment='V'
              AND pd.last_deposit_date IS NOT NULL AND pd.last_deposit_date <> ''${bfC.s})
          SELECT player_key, brand, tier_segment, player, value, gap, dsld, cooling, risk, forecast,
            ROUND(forecast * risk / 100.0) AS var
          FROM (
            SELECT cur.player_key, cur.brand, cur.tier_segment, cur.player, ROUND(cur.pnl) AS value,
              ROUND(CAST(h.dp AS REAL)/h.dd, 1) AS gap, cur.dsld,
              ROUND(cur.dsld / (CAST(h.dp AS REAL)/h.dd), 1) AS cooling,
              ROUND(MIN(100, 75.0*MIN(cur.dsld/(CAST(h.dp AS REAL)/h.dd), 4)/4 + 25.0*MIN(cur.dsld, 20)/20.0)) AS risk,
              ROUND((h.tot / h.dp) * 30) AS forecast
            FROM cur JOIN hist h ON h.player_key = cur.player_key AND h.brand = cur.brand
            WHERE cur.pnl < 0 AND h.dd >= 5 AND h.dp >= 12
              AND (CAST(h.dp AS REAL)/h.dd) <= 4.0
              AND cur.dsld BETWEEN 4 AND 14
              AND cur.dsld >= 1.6 * (CAST(h.dp AS REAL)/h.dd)
          ) ORDER BY var DESC, value ASC LIMIT 25`).bind(...bf.b, ...bfC.b).all() : Promise.resolve({ results: [] }),
        // Reactivation-likelihood — LAPSED Tier V whales (quiet 15-45 days, past the cooling window), scored
        // 0-100 on odds of returning = 55% recency + 30% prior bounce-backs + 15% how regular they were.
        // Backtested: top band returned 43% in 14 days vs 6% cold (~7× lift). Ranked by odds × lifetime worth.
        showCooling ? env.DB.prepare(`
          WITH latest AS (SELECT MAX(snapshot_date) d FROM player_days),
          hist AS (SELECT player_key, brand, COUNT(DISTINCT snapshot_date) dp,
              SUM(CASE WHEN CAST(daily_deposit AS REAL) > 0 THEN 1 ELSE 0 END) dd,
              SUM(CASE WHEN group_name LIKE 'Reactivated%' THEN 1 ELSE 0 END) reacts
            FROM player_days WHERE tier_segment='V'${bf.s} GROUP BY player_key, brand),
          cur AS (SELECT pd.player_key, pd.brand, pd.tier_segment, COALESCE(NULLIF(pd.uid,''), pd.username) AS player,
              (CAST(pd.lifetime_withdraw AS REAL) - CAST(pd.lifetime_deposit AS REAL)) AS pnl,
              CAST(julianday((SELECT d FROM latest)) - julianday(pd.last_deposit_date) AS INT) AS dsld
            FROM player_days pd
            WHERE pd.snapshot_date = (SELECT d FROM latest) AND pd.tier_segment='V'
              AND pd.last_deposit_date IS NOT NULL AND pd.last_deposit_date <> ''${bfC.s})
          SELECT player_key, brand, tier_segment, player, value, dsld, odds,
            ROUND(odds * (0 - value) / 100.0) AS pri
          FROM (
            SELECT cur.player_key, cur.brand, cur.tier_segment, cur.player, ROUND(cur.pnl) AS value, cur.dsld,
              ROUND(MIN(100, 55*(1 - MIN(cur.dsld, 45)/45.0) + 30*MIN(h.reacts, 3)/3.0 + 15*(CAST(h.dd AS REAL)/h.dp))) AS odds
            FROM cur JOIN hist h ON h.player_key = cur.player_key AND h.brand = cur.brand
            WHERE cur.pnl < 0 AND h.dd >= 3 AND h.dp >= 8 AND cur.dsld BETWEEN 15 AND 45
          ) ORDER BY pri DESC LIMIT 25`).bind(...bf.b, ...bfC.b).all() : Promise.resolve({ results: [] }),
      ]);
      return ok({
        snapshot_date: target, synced_at: sync?.t || null,
        rows: rows.results, contacts: contacts.results,
        health: health.results, team: filterPeople(team.results || [], user, roleMap),
        telegram: telegram.results, cooling: cooling.results, reactivation: reactivation.results,
      });
    }

    // ── POST /api/rtn/contact — assign / set status / log outcome (upsert) ─────
    // With { clear: true } it DELETEs the row entirely (full undo: the player
    // returns to untouched and drops out of Performance counts), not just blanked.
    if (path === "/api/rtn/contact" && method === "POST") {
      const b = await request.json();
      if (!b.snapshot_date || !b.player_key || !b.brand || !b.tier_segment) return err("Missing key fields");
      if (!brandAllowed(b.brand)) return err("Not your team", 403);
      if (b.clear) {
        if (!canDelete) return err("No permission to clear contacts", 403);
        if (!canDeleteAny) {                                   // own only: a contact somebody else logged stays
          const was = await env.DB.prepare("SELECT updated_by FROM contact_log WHERE snapshot_date = ? AND player_key = ? AND brand = ? AND tier_segment = ?")
            .bind(b.snapshot_date, b.player_key, b.brand, b.tier_segment).first();
          if (was && was.updated_by && was.updated_by !== user.username) return err("You can only clear contacts you logged yourself", 403);
        }
        await env.DB.prepare(
          `DELETE FROM contact_log WHERE snapshot_date = ? AND player_key = ? AND brand = ? AND tier_segment = ?`
        ).bind(b.snapshot_date, b.player_key, b.brand, b.tier_segment).run();
        log(user, "clear", `Cleared contact · ${b.player_key} (${b.brand})`);
        return ok({ cleared: true });
      }
      if (!canEdit) return NOEDIT();
      if (!canEditAny) {                                       // own only: players assigned to someone else are off limits, and so is handing them over
        const owner = await ownerOf(b);
        if (owner && owner !== user.username) return OWNONLY();
        if (b.assigned_to && b.assigned_to !== user.username) return err("You can only assign players to yourself", 403);
      }
      // contacted_at = the real MYT calendar day the agent acted (date('now','+8 hours')),
      // NOT snapshot_date (the data day, which lags before the 15:00 feed). Set on the
      // first human write; COALESCE keeps that first-touch day on later status changes,
      // and the auto-outcome cron never writes this column so it stays put.
      await env.DB.prepare(`
        INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, class, assigned_to, status, note, updated_by, updated_at, contacted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), date('now','+8 hours'))
        ON CONFLICT (snapshot_date, player_key, brand, tier_segment) DO UPDATE SET
          class = excluded.class, assigned_to = excluded.assigned_to,
          status = excluded.status, note = excluded.note,
          updated_by = excluded.updated_by, updated_at = datetime('now'),
          contacted_at = COALESCE(contact_log.contacted_at, date('now','+8 hours'))
      `).bind(b.snapshot_date, b.player_key, b.brand, b.tier_segment,
              b.class || null, b.assigned_to || null, b.status || null,
              b.note || null, user.username).run();
      if (b.status === "RECOVERED") log(user, "recovered", `Marked RECOVERED · ${b.player_key} (${b.brand})`);
      else log(user, "contact", `${b.status ? "Status " + b.status : (b.assigned_to ? "Assigned to " + b.assigned_to : "Updated")} · ${b.player_key} (${b.brand})`);
      return ok({ saved: true });
    }

    // ══ Daily Login Check (v23) ═══════════════════════════════════════════════
    // Per-agent manual tick of Login + Deposit for an assigned Tier V roster.
    // Login/deposited are the only manual fields; the deposit AMOUNT is read from
    // the ingest (player_days.daily_deposit), which restates post-close and so
    // confirms the next day. Scope defaults to SK69 / Tier V but is generic.

    // ── GET /api/rtn/login-check?date=&agent=&brand=&tier= ──
    if (path === "/api/rtn/login-check" && method === "GET") {
      const brand = url.searchParams.get("brand") || "SK69";
      const tier = url.searchParams.get("tier") || "V";
      if (!brandAllowed(brand)) return err("Not your team", 403);
      const reqDate = url.searchParams.get("date");
      const drow = await env.DB.prepare(
        "SELECT date('now','+8 hours') AS today, (SELECT MAX(snapshot_date) FROM player_days WHERE brand = ? AND tier_segment = ?) AS latest"
      ).bind(brand, tier).first();
      const date = /^\d{4}-\d{2}-\d{2}$/.test(reqDate || "") ? reqDate : drow.today;
      const latest = drow.latest;
      // Everyone on the team can view ANY agent's roster (leave cover). Ownership still
      // belongs to one agent; who actually ticks a row is recorded in filled_by.
      const agent = url.searchParams.get("agent") || null;

      const conds = ["a.brand = ?", "a.tier_segment = ?", "a.active = 1", "a.agent IN (SELECT username FROM users)"];   // players owned by a deleted account show as unassigned
      // ? order: c=date, pdd=date, pdl=latest, pdy=date(-1 day), then brand, tier, [agent]
      const rowBinds = [date, date, latest, date, brand, tier];
      if (agent) { conds.push("a.agent = ?"); rowBinds.push(agent); }

      const rows = await env.DB.prepare(`
        SELECT a.player_key, a.agent,
               COALESCE(c.login, 0)     AS login,
               COALESCE(c.deposited, 0) AS deposited,
               c.filled_by              AS filled_by,
               COALESCE(pdl.uid, pdd.uid)           AS uid,
               COALESCE(pdl.username, pdd.username)  AS username,
               pdy.daily_deposit        AS prev_deposit,
               COALESCE(pdl.group_name, pdd.group_name) AS group_name,
               COALESCE(pdl.status, pdd.status)         AS status,
               COALESCE(pdl.entry_date, pdd.entry_date) AS entry_date,
               COALESCE(pdl.last_deposit_date, pdd.last_deposit_date) AS last_deposit
          FROM player_assignment a
          LEFT JOIN daily_login_check c
            ON c.check_date = ? AND c.brand = a.brand AND c.tier_segment = a.tier_segment AND c.player_key = a.player_key
          LEFT JOIN player_days pdd
            ON pdd.snapshot_date = ? AND pdd.brand = a.brand AND pdd.tier_segment = a.tier_segment AND pdd.player_key = a.player_key
          LEFT JOIN player_days pdl
            ON pdl.snapshot_date = ? AND pdl.brand = a.brand AND pdl.tier_segment = a.tier_segment AND pdl.player_key = a.player_key
          LEFT JOIN player_days pdy
            ON pdy.snapshot_date = date(?, '-1 day') AND pdy.brand = a.brand AND pdy.tier_segment = a.tier_segment AND pdy.player_key = a.player_key
         WHERE ${conds.join(" AND ")}
         ORDER BY a.agent, COALESCE(pdy.daily_deposit, -1) DESC, a.player_key
      `).bind(...rowBinds).all();

      // Chip row: the brand's OWN team agents (scored CS agents), each with their count.
      // Team-scoped, so a manager never sees other teams' staff here.
      const teamKey = Object.keys(TEAM_BRANDS).find((t) => TEAM_BRANDS[t].includes(brand)) || null;
      const chips = await env.DB.prepare(`
        SELECT u.username AS agent,
               (SELECT COUNT(*) FROM player_assignment a
                 WHERE a.brand = ? AND a.tier_segment = ? AND a.active = 1 AND a.agent = u.username) AS n
          FROM users u
         WHERE u.team = ? AND u.on_leaderboard = 1
         ORDER BY u.username
      `).bind(brand, tier, teamKey).all();

      // Unassigned: players in the tier's latest snapshot with no active owner. A missing
      // owner is a real gap (roster churn), never silently dropped.
      const unassigned = await env.DB.prepare(`
        SELECT pd.player_key, pd.uid, pd.username, pd.daily_deposit AS ingest_deposit, pd.group_name
          FROM player_days pd
         WHERE pd.snapshot_date = ? AND pd.brand = ? AND pd.tier_segment = ?
           AND NOT EXISTS (SELECT 1 FROM player_assignment a
                            WHERE a.brand = pd.brand AND a.tier_segment = pd.tier_segment
                              AND a.player_key = pd.player_key AND a.active = 1
                          AND a.agent IN (SELECT username FROM users))
         ORDER BY pd.daily_deposit DESC, pd.player_key
      `).bind(latest, brand, tier).all();

      return ok({
        brand, tier, date, latest,
        provisional: date === drow.today && date !== latest,   // today's feed may not be in yet
        rows: rows.results || [],
        agents: chips.results || [],
        unassigned: unassigned.results || [],
      });
    }

    // ── POST /api/rtn/login-check — upsert one player's daily tick ──
    if (path === "/api/rtn/login-check" && method === "POST") {
      if (!canEdit) return NOEDIT();
      const b = await request.json();
      const brand = b.brand || "SK69", tier = b.tier_segment || "V";
      if (!b.player_key || !b.date) return err("Missing player_key or date");
      if (!brandAllowed(brand)) return err("Not your team", 403);
      // Any team member may tick any assigned player (leave cover). The player must be
      // on the roster; filled_by records who actually did it, owner or a stand-in.
      const owner = await env.DB.prepare(
        "SELECT agent FROM player_assignment WHERE brand = ? AND tier_segment = ? AND player_key = ? AND active = 1"
      ).bind(brand, tier, b.player_key).first();
      if (!owner) return err("Player is not assigned", 409);
      await env.DB.prepare(`
        INSERT INTO daily_login_check (check_date, brand, tier_segment, player_key, login, deposited, filled_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (check_date, brand, tier_segment, player_key) DO UPDATE SET
          login = excluded.login, deposited = excluded.deposited,
          filled_by = excluded.filled_by, updated_at = datetime('now')
      `).bind(b.date, brand, tier, b.player_key,
              b.login ? 1 : 0, b.deposited ? 1 : 0, user.username).run();
      log(user, "login-check", `${b.player_key} (${brand}) login=${b.login ? 1 : 0} dep=${b.deposited ? 1 : 0}`);
      return ok({ saved: true });
    }

    // ── POST /api/rtn/login-check/assign — set/move/retire an owner (admin only) ──
    if (path === "/api/rtn/login-check/assign" && method === "POST") {
      if (!can("assign.manage")) return err("Managers only", 403);
      const b = await request.json();
      const brand = b.brand || "SK69", tier = b.tier_segment || "V";
      if (!b.player_key || !b.agent) return err("Missing player_key or agent");
      const active = b.active === 0 ? 0 : 1;
      await env.DB.prepare(`
        INSERT INTO player_assignment (brand, tier_segment, player_key, agent, active, assigned_by, assigned_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (brand, tier_segment, player_key) DO UPDATE SET
          agent = excluded.agent, active = excluded.active,
          assigned_by = excluded.assigned_by, assigned_at = datetime('now')
      `).bind(brand, tier, b.player_key, b.agent, active, user.username).run();
      log(user, "assign", `${b.player_key} (${brand}) → ${b.agent}${active ? "" : " [retired]"}`);
      return ok({ saved: true });
    }

    // ── POST /api/rtn/login-check/auto-assign — deal unassigned players evenly (admin) ──
    if (path === "/api/rtn/login-check/auto-assign" && method === "POST") {
      if (!can("assign.manage")) return err("Managers only", 403);
      const b = await request.json().catch(() => ({}));
      const brand = b.brand || "SK69", tier = b.tier_segment || "V";
      if (!brandAllowed(brand)) return err("Not your team", 403);
      const res = await autoAssignOneRoster(env, brand, tier, user.username);
      log(user, "assign", `Auto-assigned ${res.assigned || 0} new · ${brand} Tier ${tier}`);
      return ok(res);
    }

    // ── GET /api/rtn/movement — brand × date grid for one month (Movement view) ──
    // ?month=YYYY-MM (defaults to the latest month with data). Reads the daily_brand_stats
    // rollup, not player_days, so it stays fast as history grows. Rows are returned at tier
    // granularity; the client sums them for "All tiers" and rebuilds retention from the parts.
    if (path === "/api/rtn/movement" && method === "GET") {
      const mreq = url.searchParams.get("month");
      let month = /^\d{4}-\d{2}$/.test(mreq || "") ? mreq : null;
      if (!month) {
        const lm = await env.DB.prepare("SELECT MAX(substr(snapshot_date,1,7)) m FROM daily_brand_stats").first();
        month = (lm && lm.m) || null;
      }
      if (!month) return ok({ month: null, rows: [], months: [] });
      const sc = scopeAnd("brand");
      const [rows, monthsList] = await Promise.all([
        env.DB.prepare(
          `SELECT snapshot_date, brand, tier_segment, deposit, withdraw, active_vip, roster, depositors_mtd
             FROM daily_brand_stats WHERE substr(snapshot_date,1,7) = ?${sc.s}
            ORDER BY snapshot_date, brand`
        ).bind(month, ...sc.b).all(),
        env.DB.prepare(
          `SELECT DISTINCT substr(snapshot_date,1,7) m FROM daily_brand_stats ORDER BY m`
        ).all(),
      ]);
      return ok({ month, rows: rows.results || [],
        months: (monthsList.results || []).map((r) => r.m) });
    }

    // ── GET /api/rtn/trend — daily aggregates (retention trend) ───────────────
    // Adds active-depositor count + cold (7+ days since last deposit) count per day.
    // ?days=7|14|30 selects the window (default 14).
    if (path === "/api/rtn/trend" && method === "GET") {
      let n = parseInt(url.searchParams.get("days"), 10);
      if (![7, 14, 30].includes(n)) n = 14;
      const brand = url.searchParams.get("brand");        // optional: one brand, else all of the user's team
      if (brand && !brandAllowed(brand)) return err("Not your team", 403);
      const conds = [], tbinds = [];
      if (brand) { conds.push("brand = ?"); tbinds.push(brand); }
      else if (scopeBrands !== null) {
        if (scopeBrands.length === 0) conds.push("1=0");
        else { conds.push(`brand IN (${scopeBrands.map(() => "?").join(",")})`); tbinds.push(...scopeBrands); }
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const binds = [...tbinds, n];
      const t = await env.DB.prepare(
        `SELECT snapshot_date,
           COUNT(*) AS players,
           SUM(daily_deposit) AS dep,
           SUM(daily_withdraw) AS wd,
           SUM(win_loss) AS wl,
           COUNT(CASE WHEN daily_deposit > 0 THEN 1 END) AS active,
           COUNT(CASE WHEN last_deposit_date IS NOT NULL
                       AND julianday(snapshot_date) - julianday(last_deposit_date) >= 7 THEN 1 END) AS cold
         FROM player_days ${where} GROUP BY snapshot_date ORDER BY snapshot_date DESC LIMIT ?`
      ).bind(...binds).all();
      return ok(t.results);
    }

    // ── GET /api/rtn/performance?month=YYYY-MM — outcome stats, ONE calendar month ──
    // Was a rolling 30-day window, which on the 2nd of a month is ~99% last
    // month's work. Reactivation credit belongs to the month the action happened
    // (a July recovery must not count in August, even under the 14-day rule), so
    // this is a hard calendar-month filter. Defaults to the current MYT month;
    // pass ?month= to review a past one.
    //
    // Month keys on contacted_at (the REAL action day), NOT snapshot_date (the
    // board's data day). They diverge at boundaries: a contact made 1 Aug morning
    // works the 31 Jul board, so snapshot_date=31 Jul but the agent acted in
    // August. Keying on snapshot_date hid those in July (jason's 40 missing 1-Aug
    // contacts). COALESCE covers the one legacy row with no contacted_at.
    if (path === "/api/rtn/performance" && method === "GET") {
      const pf = scopeAnd();
      const q = url.searchParams.get("month");
      const month = q && /^\d{4}-\d{2}$/.test(q) ? q : snapshotDateMYT().slice(0, 7);
      // Two reads in parallel: the raw contact log (feeds the By CS/Class/Brand tables) and the
      // per-RECOVERED-player comeback depth. One row per recovered player: {agent, player_key, brand,
      // tier_segment, tier}, where tier encodes the deepest "Reactivated X Days" band (4=30+d, 3=14-29d,
      // 2=7-13d, 1=1-6d, 0=no band → treated as shallow). The frontend sums tier→weight (1.00/0.75/0.50/
      // 0.10) into each agent's Score and tags each recovered player in the drill-down. Only
      // status='RECOVERED' players appear, so the Score reconciles with the Recovered column.
      //
      // Live-band enrichment: auto-assigned and bulk-written rows carry class = NULL (only the UI
      // stamps it), so they fell into "—" in By Class. Where the stored class is NULL, derive it from
      // that row's own player_days snapshot, mirroring classifyAll() in App.jsx (same precedence:
      // GRACE, TOP_LOSS/TOP_DEP = top 20 per brand per day, BLOCKED, DSLD30/14/7, WATCH, HEALTHY).
      // Stored class still wins when present. Only the (day, brand) pairs with a NULL are ranked.
      const [logs, react] = await Promise.all([
        env.DB.prepare(`
          WITH lg AS (
            SELECT snapshot_date, contacted_at, player_key, brand, tier_segment, class, assigned_to, status, updated_by
            FROM contact_log WHERE substr(COALESCE(contacted_at, snapshot_date),1,7) = ?${pf.s}
          ),
          need AS (SELECT DISTINCT snapshot_date, brand FROM lg WHERE class IS NULL),
          rk AS (
            SELECT pd.snapshot_date, pd.brand, pd.player_key, pd.tier_segment, pd.grace_end_date, pd.last_deposit_date,
              COALESCE(pd.win_loss,0) AS wl, COALESCE(pd.daily_deposit,0) AS dd, COALESCE(pd.valid_bet,0) AS vb,
              ROW_NUMBER() OVER (PARTITION BY pd.snapshot_date, pd.brand
                ORDER BY CASE WHEN COALESCE(pd.win_loss,0) < 0 THEN 0 ELSE 1 END, COALESCE(pd.win_loss,0)) AS loss_rk,
              ROW_NUMBER() OVER (PARTITION BY pd.snapshot_date, pd.brand
                ORDER BY CASE WHEN COALESCE(pd.daily_deposit,0) > 0 AND COALESCE(pd.win_loss,0) > 0 THEN 0 ELSE 1 END,
                         COALESCE(pd.daily_deposit,0) DESC) AS dep_rk
            FROM player_days pd JOIN need n ON n.snapshot_date = pd.snapshot_date AND n.brand = pd.brand
          ),
          live AS (
            SELECT snapshot_date, brand, player_key, tier_segment,
              CASE
                WHEN julianday(grace_end_date) - julianday(snapshot_date) >= 0
                 AND julianday(grace_end_date) - julianday(snapshot_date) < 4 THEN 'GRACE'
                WHEN wl < 0 AND loss_rk <= 20 THEN 'TOP_LOSS'
                WHEN dd > 0 AND wl > 0 AND dep_rk <= 20 THEN 'TOP_DEP'
                WHEN vb > 0 AND dd = 0 AND julianday(snapshot_date) - julianday(last_deposit_date) >= 7 THEN 'BLOCKED'
                WHEN julianday(snapshot_date) - julianday(last_deposit_date) >= 30 THEN 'DSLD30'
                WHEN julianday(snapshot_date) - julianday(last_deposit_date) >= 14 THEN 'DSLD14'
                WHEN julianday(snapshot_date) - julianday(last_deposit_date) >= 7 THEN 'DSLD7'
                WHEN julianday(snapshot_date) - julianday(last_deposit_date) >= 3 THEN 'WATCH'
                ELSE 'HEALTHY' END AS cls
            FROM rk
          )
          SELECT lg.snapshot_date, lg.contacted_at, lg.player_key, lg.brand, lg.tier_segment,
            COALESCE(lg.class, live.cls) AS class, lg.assigned_to, lg.status, lg.updated_by
          FROM lg LEFT JOIN live ON live.snapshot_date = lg.snapshot_date AND live.brand = lg.brand
            AND live.player_key = lg.player_key AND live.tier_segment = lg.tier_segment`
        ).bind(month, ...pf.b).all(),
        env.DB.prepare(`
          WITH rec AS (
            SELECT assigned_to AS agent, player_key, brand, tier_segment
            FROM contact_log
            WHERE status = 'RECOVERED' AND assigned_to IS NOT NULL
              AND substr(COALESCE(contacted_at, snapshot_date), 1, 7) = ?${pf.s}
            GROUP BY assigned_to, player_key, brand, tier_segment
          )
          SELECT rec.agent, rec.player_key, rec.brand, rec.tier_segment,
            MAX(CASE pd.group_name
                  WHEN 'Reactivated 30+ Days' THEN 4
                  WHEN 'Reactivated 21-29 Days' THEN 3
                  WHEN 'Reactivated 14-20 Days' THEN 3
                  WHEN 'Reactivated 7-13 Days' THEN 2
                  WHEN 'Reactivated 3-6 Days' THEN 1
                  WHEN 'Reactivated 1-2 Days' THEN 1
                  ELSE 0 END) AS tier
          FROM rec
          LEFT JOIN player_days pd ON pd.player_key = rec.player_key AND pd.brand = rec.brand
            AND pd.tier_segment = rec.tier_segment AND pd.group_name LIKE 'Reactivated%'
            AND strftime('%Y-%m', pd.snapshot_date) = ?
          GROUP BY rec.agent, rec.player_key, rec.brand, rec.tier_segment`).bind(month, ...pf.b, month).all(),
      ]);
      // Staff who moved OUT of the viewed team: their work on the new team's brands since the move,
      // returned separately so By CS can show it as an extra "<agent> · Team X" row (and only there —
      // By Class / By Brand stay this team's own brands).
      const viewT = can("teams.all") ? (TEAM_BRANDS[reqTeam] ? reqTeam : null) : user.team;
      const moves = STAFF_MOVES.filter((m) => m.on.slice(0, 7) <= month && (m.from === viewT || m.to === viewT));
      const away = [];
      for (const m of moves.filter((x) => x.from === viewT)) {
        const nb = TEAM_BRANDS[m.to] || [];
        if (!nb.length) continue;
        const ph = nb.map(() => "?").join(",");
        const [al, ar] = await Promise.all([
          env.DB.prepare(`
            SELECT snapshot_date, contacted_at, player_key, brand, tier_segment, class, assigned_to, status, updated_by
            FROM contact_log WHERE assigned_to = ? AND brand IN (${ph})
              AND substr(COALESCE(contacted_at, snapshot_date),1,7) = ? AND substr(COALESCE(contacted_at, snapshot_date),1,10) >= ?`
          ).bind(m.user, ...nb, month, m.on).all(),
          env.DB.prepare(`
            WITH rec AS (
              SELECT player_key, brand, tier_segment FROM contact_log
              WHERE status = 'RECOVERED' AND assigned_to = ? AND brand IN (${ph})
                AND substr(COALESCE(contacted_at, snapshot_date),1,7) = ? AND substr(COALESCE(contacted_at, snapshot_date),1,10) >= ?
              GROUP BY player_key, brand, tier_segment)
            SELECT rec.player_key, rec.brand, rec.tier_segment,
              MAX(CASE pd.group_name WHEN 'Reactivated 30+ Days' THEN 4 WHEN 'Reactivated 21-29 Days' THEN 3
                WHEN 'Reactivated 14-20 Days' THEN 3 WHEN 'Reactivated 7-13 Days' THEN 2
                WHEN 'Reactivated 3-6 Days' THEN 1 WHEN 'Reactivated 1-2 Days' THEN 1 ELSE 0 END) AS tier
            FROM rec LEFT JOIN player_days pd ON pd.player_key = rec.player_key AND pd.brand = rec.brand
              AND pd.tier_segment = rec.tier_segment AND pd.group_name LIKE 'Reactivated%' AND strftime('%Y-%m', pd.snapshot_date) = ?
            GROUP BY rec.player_key, rec.brand, rec.tier_segment`
          ).bind(m.user, ...nb, month, m.on, month).all(),
        ]);
        away.push({ ...m, logs: al.results || [], reactivation: ar.results || [] });
      }
      return ok({ month, logs: logs.results, reactivation: react.results || [], moves, away });
    }

    // ── GET /api/rtn/dates — available snapshot dates (history depth) ─────────
    if (path === "/api/rtn/dates" && method === "GET") {
      const dates = await env.DB.prepare(
        "SELECT snapshot_date, COUNT(*) AS rows FROM player_days GROUP BY snapshot_date ORDER BY snapshot_date DESC LIMIT 60"
      ).all();
      return ok(dates.results);
    }

    // ── GET /api/rtn/history — one player's daily series (read-only) ──────────
    // Powers the drawer's deep "memory hooks" (biggest win, top-up, quiet-since).
    // Returns a compact chronological series; the frontend derives the facts.
    if (path === "/api/rtn/history" && method === "GET") {
      const pk = url.searchParams.get("player_key");
      const brand = url.searchParams.get("brand");
      const tier = url.searchParams.get("tier_segment");
      if (!pk || !brand || !tier) return err("Missing player_key / brand / tier_segment");
      if (!brandAllowed(brand)) return err("Not your team", 403);
      const series = await env.DB.prepare(
        `SELECT snapshot_date, daily_deposit, daily_withdraw, win_loss, daily_deposit_count
         FROM player_days
         WHERE player_key = ? AND brand = ? AND tier_segment = ?
         ORDER BY snapshot_date DESC LIMIT 90`
      ).bind(pk, brand, tier).all();
      return ok({ player_key: pk, brand, tier_segment: tier, series: (series.results || []).reverse() });
    }

    // ── GET /api/rtn/bonus-lookup?username=&brand= — what the Customer Approaching widget shows ──
    // Read-only. Reads the SAME Lark bonus tables the widget reads, with the widget's own claimable
    // rules (see "Lark bonus tables" above). Nothing is written to Lark. `username` may be the
    // username or the uid (the tables' Username column holds player_key); `brand` is the full brand.
    if (path === "/api/rtn/bonus-lookup" && method === "GET") {
      const username = (url.searchParams.get("username") || "").trim().toLowerCase();
      const brand = (url.searchParams.get("brand") || "").trim();
      if (!username || !brand) return err("Missing username / brand");
      if (!brandAllowed(brand)) return err("Not your team", 403);
      const cfg = widgetLarkCfg(env);
      if (!cfg) return err("Bonus tables are not configured yet (WIDGET_LARK is not set on the Worker)", 503);
      const ck = `${username}|${brand}`, now = Date.now();
      const hit = BONUS_CACHE.get(ck);
      if (hit && now - hit.at < BONUS_CACHE_MS) return ok({ ...hit.data, cached: true });
      let out;
      try { out = await widgetLookup(env, cfg, username, brand); }
      catch (e) { return err("Lark bonus lookup failed: " + String((e && e.message) || e).slice(0, 160), 502); }
      if (BONUS_CACHE.size > 300) BONUS_CACHE.clear();
      BONUS_CACHE.set(ck, { at: now, data: out });
      log(user, "bonus-lookup", `${username} (${brand})`);
      return ok(out);
    }

    // ── GET /api/rtn/grace-status — Grace Period challenge state for the user's brands ──
    // One Lark read per brand (cached 5 min), not one per player. { "username|brand": {a, v, e} }:
    // a = 1 activated / 0 still waiting for the customer to activate, v = the table's own text,
    // e = expiry (epoch ms). Only players that have a live (not Claimed/Expired) Grace row appear.
    if (path === "/api/rtn/grace-status" && method === "GET") {
      const cfg = widgetLarkCfg(env);
      if (!cfg || !cfg.tables.grace) return err("Grace table is not configured yet (WIDGET_LARK)", 503);
      const brands = (scopeBrands === null ? Object.values(TEAM_BRANDS).flat() : scopeBrands);
      let status;
      try { status = await graceStatusFor(env, cfg, brands); }
      catch (e) { return err("Lark Grace read failed: " + String((e && e.message) || e).slice(0, 160), 502); }
      return ok({ status });
    }

    // ── GET /api/rtn/grace-tasks — Grace players who reloaded inside their window but have not claimed ──
    // Read-only. See "Grace daily tasks" above for the rule. Team-scoped like every other read.
    if (path === "/api/rtn/grace-tasks" && method === "GET") {
      const cfg = widgetLarkCfg(env);
      if (!cfg || !cfg.tables.grace) return err("Grace table is not configured yet (WIDGET_LARK)", 503);
      const brands = (scopeBrands === null ? Object.values(TEAM_BRANDS).flat() : scopeBrands);
      let res;
      try { res = await graceTasksFor(env, cfg, brands); }
      catch (e) { return err("Grace tasks failed: " + String((e && e.message) || e).slice(0, 160), 502); }
      return ok(res);
    }

    // ── Relationship Ledger — person-level notes that resurface daily ─────────
    // Keyed on (player_key, brand): NO snapshot_date — a relationship fact
    // outlives the day it was written. All three routes require a session.

    // GET /api/rtn/notes?player_key=X&brand=Y — list a player's notes (newest first)
    if (path === "/api/rtn/notes" && method === "GET") {
      const pk = url.searchParams.get("player_key");
      const brand = url.searchParams.get("brand");
      if (!pk || !brand) return err("Missing player_key / brand");
      if (!brandAllowed(brand)) return err("Not your team", 403);
      const notes = await env.DB.prepare(
        `SELECT id, player_key, brand, note, created_by, created_at
         FROM player_notes WHERE player_key = ? AND brand = ?
         ORDER BY created_at DESC, id DESC LIMIT 50`
      ).bind(pk, brand).all();
      return ok({ player_key: pk, brand, notes: notes.results || [] });
    }

    // POST /api/rtn/notes — add a note { player_key, brand, note }
    if (path === "/api/rtn/notes" && method === "POST") {
      const b = await request.json();
      if (!canEdit) return NOEDIT();
      const note = (b.note || "").trim();
      if (!b.player_key || !b.brand || !note) return err("Missing player_key / brand / note");
      if (!brandAllowed(b.brand)) return err("Not your team", 403);
      if (!canEditAny) { const owner = await ownerOf({ player_key: b.player_key, brand: b.brand }); if (owner && owner !== user.username) return OWNONLY(); }
      if (note.length > 2000) return err("Note too long");
      await env.DB.prepare(
        `INSERT INTO player_notes (player_key, brand, note, created_by, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(b.player_key, b.brand, note, user.username).run();
      log(user, "note", `Added note · ${b.player_key} (${b.brand})`);
      return ok({ saved: true });
    }

    // DELETE /api/rtn/notes/:id — remove a note
    if (path.startsWith("/api/rtn/notes/") && method === "DELETE") {
      if (!canDelete) return err("No permission to delete notes", 403);
      const id = path.split("/").pop();
      if (!id) return err("Missing note id");
      if (!canDeleteAny) {                                     // own only: a note somebody else wrote stays
        const n = await env.DB.prepare("SELECT created_by FROM player_notes WHERE id = ?").bind(id).first();
        if (n && n.created_by && n.created_by !== user.username) return err("You can only delete notes you wrote yourself", 403);
      }
      await env.DB.prepare("DELETE FROM player_notes WHERE id = ?").bind(id).run();
      log(user, "note", `Deleted note #${id}`);
      return ok({ deleted: true });
    }

    // ── CRM — per-player follow-up + Telegram link + contact history ──────────
    // Keyed on (player_key, brand) like notes. One GET loads the follow-up date,
    // the Telegram archive link, AND the player's past contacts in a single call.

    // GET /api/rtn/crm?player_key=X&brand=Y — { crm, telegram_url, history }
    if (path === "/api/rtn/crm" && method === "GET") {
      const pk = url.searchParams.get("player_key");
      const brand = url.searchParams.get("brand");
      if (!pk || !brand) return err("Missing player_key / brand");
      if (!brandAllowed(brand)) return err("Not your team", 403);
      const crm = await env.DB.prepare(
        `SELECT player_key, brand, next_followup, updated_by, updated_at
         FROM player_crm WHERE player_key = ? AND brand = ?`
      ).bind(pk, brand).first();
      const tg = await env.DB.prepare(
        `SELECT url FROM player_telegram WHERE player_key = ? AND brand = ?`
      ).bind(pk, brand).first();
      const history = await env.DB.prepare(
        `SELECT snapshot_date, contacted_at, tier_segment, class, assigned_to, status, note, updated_by, updated_at
         FROM contact_log WHERE player_key = ? AND brand = ?
         ORDER BY snapshot_date DESC, updated_at DESC LIMIT 30`
      ).bind(pk, brand).all();
      const livechat = await env.DB.prepare(
        `SELECT id, agent, url, created_at FROM livechat_log WHERE player_key = ? AND brand = ?
         ORDER BY created_at DESC, id DESC LIMIT 50`
      ).bind(pk, brand).all();
      return ok({ player_key: pk, brand, crm: crm || null,
                  telegram_url: tg?.url || null, history: history.results || [],
                  livechat: livechat.results || [] });
    }

    // POST /api/rtn/crm — upsert { player_key, brand, next_followup }
    if (path === "/api/rtn/crm" && method === "POST") {
      if (!canEdit) return NOEDIT();
      const b = await request.json();
      if (!b.player_key || !b.brand) return err("Missing player_key / brand");
      if (!brandAllowed(b.brand)) return err("Not your team", 403);
      if (!canEditAny) { const owner = await ownerOf({ player_key: b.player_key, brand: b.brand }); if (owner && owner !== user.username) return OWNONLY(); }
      await env.DB.prepare(`
        INSERT INTO player_crm (player_key, brand, next_followup, updated_by, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (player_key, brand) DO UPDATE SET
          next_followup = excluded.next_followup,
          updated_by = excluded.updated_by, updated_at = datetime('now')
      `).bind(b.player_key, b.brand, b.next_followup || null, user.username).run();
      log(user, "contact", `Set follow-up · ${b.player_key} (${b.brand})`);
      return ok({ saved: true });
    }

    // POST /api/rtn/livechat — log a chat { player_key, brand, url }; agent = logged-in user (QA audit trail)
    if (path === "/api/rtn/livechat" && method === "POST") {
      if (!canEdit) return NOEDIT();
      const b = await request.json();
      const u = String(b.url || "").trim();
      if (!b.player_key || !b.brand || !u) return err("Missing player_key / brand / url");
      if (!brandAllowed(b.brand)) return err("Not your team", 403);
      if (!/^https?:\/\//i.test(u)) return err("LiveChat link must start with http:// or https://", 400);
      await env.DB.prepare(
        `INSERT INTO livechat_log (player_key, brand, agent, url, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(b.player_key, b.brand, user.username, u).run();
      log(user, "livechat", `Logged LiveChat · ${b.player_key} (${b.brand})`);
      const rows = await env.DB.prepare(
        `SELECT id, agent, url, created_at FROM livechat_log WHERE player_key = ? AND brand = ?
         ORDER BY created_at DESC, id DESC LIMIT 50`
      ).bind(b.player_key, b.brand).all();
      return ok({ saved: true, livechat: rows.results || [] });
    }

    // DELETE /api/rtn/livechat/:id — remove a log entry (managers only — it's an audit trail)
    if (path.startsWith("/api/rtn/livechat/") && method === "DELETE") {
      if (!can("data.sync")) return err("Managers only", 403);
      const id = path.split("/").pop();
      if (!id) return err("Missing id");
      await env.DB.prepare("DELETE FROM livechat_log WHERE id = ?").bind(id).run();
      log(user, "livechat", `Removed LiveChat log #${id}`);
      return ok({ deleted: true });
    }

    // POST /api/rtn/telegram — bulk upsert Telegram links { rows:[{player_key, brand, url}] }
    // Admin: loads/grows the Telegram-able list. ON CONFLICT updates in place (no duplicates).
    if (path === "/api/rtn/telegram" && method === "POST") {
      if (!canEdit) return NOEDIT();
      const b = await request.json();
      // Single-player edit from the drawer: { player_key, brand, url }. Empty url removes the link.
      if (b.player_key && b.brand && !Array.isArray(b.rows)) {
        const pk = String(b.player_key).trim(), brand = String(b.brand).trim(), u = String(b.url || "").trim();
        if (!canEditAny) { const owner = await ownerOf({ player_key: pk, brand }); if (owner && owner !== user.username) return OWNONLY(); }
        if (!u) {
          await env.DB.prepare(`DELETE FROM player_telegram WHERE player_key = ? AND brand = ?`).bind(pk, brand).run();
          log(user, "telegram", `Removed Telegram link · ${pk} (${brand})`);
          return ok({ deleted: true });
        }
        if (!/^https?:\/\//i.test(u)) return err("Telegram link must start with http:// or https://", 400);
        await env.DB.prepare(`
          INSERT INTO player_telegram (player_key, brand, url, updated_by, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT (player_key, brand) DO UPDATE SET
            url = excluded.url, updated_by = excluded.updated_by, updated_at = datetime('now')
        `).bind(pk, brand, u, user.username).run();
        log(user, "telegram", `Set Telegram link · ${pk} (${brand})`);
        return ok({ saved: 1 });
      }
      const rows = Array.isArray(b.rows) ? b.rows : [];
      if (!rows.length) return err("No rows");
      let saved = 0;
      for (let i = 0; i < rows.length; i += 25) {
        const chunk = rows.slice(i, i + 25).filter((r) => r && r.player_key && r.brand && r.url && /^https?:\/\//i.test(String(r.url).trim()));
        await env.DB.batch(chunk.map((r) => env.DB.prepare(`
          INSERT INTO player_telegram (player_key, brand, url, updated_by, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT (player_key, brand) DO UPDATE SET
            url = excluded.url, updated_by = excluded.updated_by, updated_at = datetime('now')
        `).bind(String(r.player_key).trim(), String(r.brand).trim(), String(r.url).trim(), user.username)));
        saved += chunk.length;
      }
      log(user, "telegram", `Bulk Telegram import · ${saved} links`);
      return ok({ saved });
    }

    // GET /api/rtn/engagement?date=YYYY-MM-DD — Livechat/Telegram chat counts per brand for one MYT day.
    if (path === "/api/rtn/engagement" && method === "GET") {
      const day = url.searchParams.get("date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return err("date=YYYY-MM-DD required", 400);
      const sc = scopeAnd("brand");
      const r = await env.DB.prepare(
        `SELECT brand, livechat, telegram, updated_at FROM engagement_daily WHERE chat_date = ?${sc.s} ORDER BY brand`
      ).bind(day, ...sc.b).all();
      return ok({ date: day, rows: r.results || [] });
    }

    // POST /api/rtn/engagement-sync?date=YYYY-MM-DD — run the Lark engagement count now (managers).
    // &dry=1 → count only, writes nothing.
    if (path === "/api/rtn/engagement-sync" && method === "POST") {
      if (!can("data.sync")) return err("Managers only", 403);
      const dryRun = url.searchParams.get("dry") === "1";
      try {
        const r = await larkEngagementSync(env, { date: url.searchParams.get("date"), dryRun });
        if (!dryRun && r.saved != null) log(user, "feed", `Engagement sync ${r.day} · ${r.saved} brands`);
        return ok(r);
      } catch (e) { return err("engagement sync: " + ((e && e.message) || e), 500); }
    }

    // POST /api/rtn/feeders/run — start every brand's feeder now, same as the 12:15 cron (managers).
    // ?dry=1 → only list how many feeder URLs are configured; starts nothing.
    if (path === "/api/rtn/feeders/run" && method === "POST") {
      if (!can("data.sync")) return err("Managers only", 403);
      if (url.searchParams.get("dry") === "1") return ok({ dryRun: true, configured: feederUrls(env).length });
      const r = await kickFeeders(env);
      log(user, "feed", `Feeders started by hand · ${r.ok ?? 0}/${r.kicked ?? 0} ok`);
      return ok(r);
    }

    // GET /api/rtn/engagement?date=YYYY-MM-DD — Livechat/Telegram chat counts per brand for one MYT day.
    if (path === "/api/rtn/engagement" && method === "GET") {
      const day = url.searchParams.get("date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return err("date=YYYY-MM-DD required", 400);
      const sc = scopeAnd("brand");
      const r = await env.DB.prepare(
        `SELECT brand, livechat, telegram, updated_at FROM engagement_daily WHERE chat_date = ?${sc.s} ORDER BY brand`
      ).bind(day, ...sc.b).all();
      return ok({ date: day, rows: r.results || [] });
    }

    // POST /api/rtn/engagement-sync?date=YYYY-MM-DD — run the Lark engagement count now (managers).
    // &dry=1 → count only, writes nothing.
    if (path === "/api/rtn/engagement-sync" && method === "POST") {
      if (!can("data.sync")) return err("Managers only", 403);
      const dryRun = url.searchParams.get("dry") === "1";
      try {
        const r = await larkEngagementSync(env, { date: url.searchParams.get("date"), dryRun });
        if (!dryRun && r.saved != null) log(user, "feed", `Engagement sync ${r.day} · ${r.saved} brands`);
        return ok(r);
      } catch (e) { return err("engagement sync: " + ((e && e.message) || e), 500); }
    }

    // POST /api/rtn/lark-sync — pull Telegram links from the Lark Base into player_telegram (managers)
    // ?dry=1 → counts (incl. how many stored links would be removed) + sample only, writes nothing.
    // ?force=1 → allow a run even if Lark returns less than half of the stored links (the safety stop).
    if (path === "/api/rtn/lark-sync" && method === "POST") {
      if (!can("data.sync")) return err("Managers only", 403);
      const dryRun = url.searchParams.get("dry") === "1";
      try {
        const r = await larkTelegramSync(env, { dryRun, force: url.searchParams.get("force") === "1" });
        if (!dryRun) log(user, "telegram", `Lark sync · ${r.saved ?? 0} links saved · ${r.deleted ?? 0} removed`);
        return ok(r);
      } catch (e) { return err("lark sync: " + ((e && e.message) || e), 500); }
    }

    // POST /api/rtn/feed-check — run the daily feed-health check now (managers).
    // ?dry=1 → compute + return the card JSON, post nothing. Otherwise posts to Lark.
    if (path === "/api/rtn/feed-check" && method === "POST") {
      if (!can("data.sync")) return err("Managers only", 403);
      const dryRun = url.searchParams.get("dry") === "1";
      try {
        const r = await feedCheckReport(env, { dryRun });
        if (!dryRun) log(user, "feed", `Feed check posted · ${r.problems ?? 0} issue(s)`);
        return ok(r);
      } catch (e) { return err("feed check: " + ((e && e.message) || e), 500); }
    }

    // GET /api/rtn/auto-assign — Phase 1 preview of the daily auto-assignment (read-only, writes nothing).
    // One team at a time: ?team=A|B|C picks whose brands are dealt to whose agents. A manager
    // follows the team switcher (defaulting to their own); an agent is pinned to their own team,
    // so the param is ignored for them. Managers may also pass ?off=user1,user2 (PICs on leave —
    // their pile is held, not redistributed). An agent only ever gets their own list back.
    /* ── GET /api/rtn/contact-rate — the September contact-parity counter ──────────────
       Rate = distinct REACHABLE players contacted at least once this calendar month, over the
       reachable pool. A repeat touch moves nothing, which is the whole reason the deal now
       ranks fresh players first.

       "Reachable" here means Telegram, because that is the only channel this database holds.
       SMS and Internal Mail are worked outside this project, so their players are neither in
       the numerator nor the denominator — the number below is the Telegram slice only.

       The milestone ladder does not stop at the 52 target: when a milestone is met the next one
       opens on its own, so clearing the objective early turns into the next push instead of an
       excuse to coast. */
    if (path === "/api/rtn/contact-rate" && method === "GET") {
      const reqT = url.searchParams.get("team");
      const team = can("teams.all") ? (TEAM_BRANDS[reqT] ? reqT : (user.team || "B")) : user.team;
      const brands = TEAM_BRANDS[team];
      if (!brands) return err(`unknown team ${team || "(none)"}`, 400);
      const ph = brands.map(() => "?").join(",");
      const today = snapshotDateMYT();
      const month = today.slice(0, 7);
      const ACTED = "('CONTACTED','RESPONDED','NO_RESPONSE','RECOVERED')";
      const snapRow = await env.DB.prepare("SELECT MAX(snapshot_date) d FROM player_days").first();
      const snap = snapRow && snapRow.d;
      if (!snap) return ok({ team, month, reachable: 0, touched: 0, rate: 0, brands: [] });

      const [byBrand, newToday, dupes] = await Promise.all([
        // Pool and progress per brand. COUNT(DISTINCT player_key) throughout: a player sitting in
        // two tiers on one day is still one person to the department, and must not count twice.
        env.DB.prepare(`
          WITH tb AS (SELECT DISTINCT player_key, brand FROM contact_log
                      WHERE substr(COALESCE(contacted_at, snapshot_date),1,7)=?
                        AND brand IN (${ph}) AND status IN ${ACTED}),
          reach AS (SELECT DISTINCT pd.brand, pd.player_key FROM player_days pd
                    JOIN player_telegram t ON t.player_key=pd.player_key AND t.brand=pd.brand
                    WHERE pd.snapshot_date=? AND pd.brand IN (${ph}))
          SELECT r.brand, COUNT(*) reachable,
                 SUM(CASE WHEN tb.player_key IS NOT NULL THEN 1 ELSE 0 END) touched
          FROM reach r LEFT JOIN tb ON tb.player_key=r.player_key AND tb.brand=r.brand
          GROUP BY r.brand`).bind(month, ...brands, snap, ...brands).all(),
        // Players whose FIRST touch of the month landed today — the only touches that moved the rate.
        env.DB.prepare(`
          SELECT COUNT(*) n FROM (
            SELECT cl.player_key, MIN(substr(COALESCE(cl.contacted_at, cl.snapshot_date),1,10)) fd
            FROM contact_log cl JOIN player_telegram t ON t.player_key=cl.player_key AND t.brand=cl.brand
            WHERE substr(COALESCE(cl.contacted_at, cl.snapshot_date),1,7)=?
              AND cl.brand IN (${ph}) AND cl.status IN ${ACTED}
            GROUP BY cl.player_key, cl.brand)
          WHERE fd=?`).bind(month, ...brands, today).all(),
        // Over-contact guard: same player, two or more different agents inside a week.
        // COUNT(*) OVER () is taken BEFORE the LIMIT, so the card can say "50 of 121" instead of
        // reporting the page size as if it were the whole problem.
        env.DB.prepare(`
          SELECT *, COUNT(*) OVER () AS total FROM (
            SELECT cl.player_key, cl.brand, COUNT(DISTINCT cl.assigned_to) agents,
                   MAX(cl.snapshot_date) last_touch
            FROM contact_log cl
            WHERE cl.snapshot_date >= date(?, '-7 days') AND cl.brand IN (${ph})
              AND cl.status IN ${ACTED} AND cl.assigned_to IS NOT NULL AND cl.assigned_to <> ''
            GROUP BY cl.player_key, cl.brand
            HAVING COUNT(DISTINCT cl.assigned_to) > 1)
          ORDER BY agents DESC, last_touch DESC LIMIT 50`).bind(snap, ...brands).all(),
      ]);

      const rows = byBrand.results || [];
      const reachable = rows.reduce((n, r) => n + (r.reachable || 0), 0);
      const touched = rows.reduce((n, r) => n + (r.touched || 0), 0);
      const rate = reachable ? (100 * touched) / reachable : 0;
      // First rung not yet cleared. At 100 there is nothing left to chase.
      const milestone = AA_MILESTONES.find((m) => rate < m) || 100;
      const target = Math.ceil((reachable * milestone) / 100);
      const need = Math.max(0, target - touched);
      // Days left counts today, so "need per day" is honest on the last day of the month.
      const dim = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
      const daysLeft = Math.max(1, dim - +today.slice(8, 10) + 1);
      return ok({
        team, month, snapshot: snap, reachable, touched,
        rate: Math.round(rate * 10) / 10,
        untouched: reachable - touched,
        milestone, milestones: AA_MILESTONES, cleared: AA_MILESTONES.filter((m) => rate >= m),
        target, need, days_left: daysLeft, need_per_day: Math.ceil(need / daysLeft),
        today_new: (newToday.results && newToday.results[0] && newToday.results[0].n) || 0,
        brands: rows.map((r) => ({ ...r, untouched: (r.reachable || 0) - (r.touched || 0) }))
          .sort((a, b) => b.untouched - a.untouched),
        overcontact: dupes.results || [],
        // Full size of the over-contact problem; the list above is capped at 50 rows.
        overcontact_total: (dupes.results && dupes.results[0] && dupes.results[0].total) || 0,
      });
    }

    if (path === "/api/rtn/auto-assign" && method === "GET") {
      const off = can("assign.manage") ? (url.searchParams.get("off") || "").split(",").map((s) => s.trim()).filter(Boolean) : [];
      const team = can("teams.all") ? (TEAM_BRANDS[reqTeam] ? reqTeam : (user.team || "B")) : user.team;
      const batch = url.searchParams.get("batch");
      try {
        const res = await computeAutoAssign(env, { off, team, batch });
        if (can("assign.manage") || res.skipped) return ok(res);
        const self = user.username;
        return ok({ ...res, pics: (res.pics || []).includes(self) ? [self] : [],
          assignments: { [self]: (res.assignments && res.assignments[self]) || [] },
          summary: { [self]: (res.summary && res.summary[self]) || { total: 0, whales: 0, money: 0, backlog: 0 } } });
      } catch (e) { return err("auto-assign: " + ((e && e.message) || e), 500); }
    }

    // POST /api/rtn/auto-assign/run — write today's deal for every team (managers).
    // ?dry=1 computes and reports the counts without writing a single row. This is the
    // same function the daily cron calls, so a dry run here proves the real job.
    if (path === "/api/rtn/auto-assign/run" && method === "POST") {
      if (!can("assign.manage")) return err("Managers only", 403);
      const dryRun = url.searchParams.get("dry") === "1";
      if (!dryRun && !AUTO_ASSIGN_ENABLED) return err("Auto-assign is OFF — flip AUTO_ASSIGN_ENABLED and redeploy, or use ?dry=1", 400);
      const off = (url.searchParams.get("off") || "").split(",").map((s) => s.trim()).filter(Boolean);
      try {
        const res = await runAutoAssign(env, { dryRun, off });
        if (!dryRun) log(user, "auto-assign", `Ran auto-assign · ${Object.entries(res.teams).map(([t, r]) => `${t}:${r.written ?? r.skipped ?? "err"}`).join(" ")}`);
        return ok(res);
      } catch (e) { return err("auto-assign run: " + ((e && e.message) || e), 500); }
    }

    // GET /api/rtn/lark-debug — peek at every Base table: name, record count, column names, one sample (managers)
    // ?base=<app_token> → look at another Base (read-only). Without ?table it then lists table ids/names only.
    // &raw=1 with ?table&n → return the first n records' fields as-is (any table shape).
    if (path === "/api/rtn/lark-debug" && method === "GET") {
      if (!can("data.sync")) return err("Managers only", 403);
      try {
        const token = await larkToken(env);
        const baseQ = url.searchParams.get("base");
        if (baseQ && !/^[A-Za-z0-9]{10,40}$/.test(baseQ)) return err("bad base", 400);
        const base = baseQ || LARK.BASE;
        if (url.searchParams.get("appinfo")) {
          const j = await larkFetch(`/open-apis/application/v6/applications/${env.LARK_APP_ID}?lang=en_us`, token);
          return ok(j.data || j);
        }
        const oneTable = url.searchParams.get("table");
        if (oneTable) {
          // Always list the table's views (id + name) so we can find Team A/B/C.
          const vj = await larkFetch(`/open-apis/bitable/v1/apps/${base}/tables/${oneTable}/views?page_size=100`, token);
          const views = (vj.data?.items || []).map((v) => ({ id: v.view_id, name: v.view_name, type: v.view_type }));
          const viewId = url.searchParams.get("view") || undefined;
          const n = Math.min(parseInt(url.searchParams.get("n") || "0", 10) || 0, 50);
          let count = null, fields = null, samples = null;
          if (viewId || n) {
            const recs = await larkRecords(token, oneTable, viewId, base);
            count = recs.length;
            fields = recs[0] ? Object.keys(recs[0].fields || {}) : [];
            if (n && url.searchParams.get("raw")) samples = recs.slice(0, n).map((r) => r.fields || {});
            else if (n) samples = recs.slice(0, n).map((r) => {
              const f = r.fields || {};
              return { Username: larkText(f["Username"]), Brand: larkText(f["Brand"]),
                tg_text: larkText(f["Telegram combine"]), tg_raw: f["Telegram combine"] };
            });
          }
          return ok({ table: oneTable, views, viewId: viewId || null, count, fields, samples });
        }
        const tj = await larkFetch(`/open-apis/bitable/v1/apps/${base}/tables?page_size=100`, token);
        const tables = tj.data?.items || [];
        if (baseQ) return ok({ base, tableCount: tables.length, tables: tables.map((t) => ({ id: t.table_id, name: t.name })) });
        const info = [];
        for (const t of tables.slice(0, 8)) {
          const recs = await larkRecords(token, t.table_id);
          info.push({ id: t.table_id, name: t.name, count: recs.length,
            fields: recs[0] ? Object.keys(recs[0].fields || {}) : [], sample: recs[0]?.fields || null });
        }
        return ok({ tableCount: tables.length, tables: info });
      } catch (e) { return err("lark debug: " + ((e && e.message) || e), 500); }
    }

    /* ══ VVIP REDEEM CODE CAMPAIGN ═══════════════════════════════════════════
       DELIBERATELY NOT TEAM-SCOPED. Every other /api/rtn/* route filters by
       teamAnd()/brandAllowed(), because an agent only works their own brands.
       Livechat is the opposite: chats are randomised across the whole shift, so
       a Team A agent regularly gets a Team C player asking to claim. These
       routes therefore let ANY signed-in agent look up and release a code for
       ANY brand — but only for a player already inside an approved event pool,
       so it exposes far less than lifting the team walls everywhere would.
       Creating / exporting / closing / reporting stays managers-only.
       ══════════════════════════════════════════════════════════════════════ */

    // Was this player actually contacted before the code was handed over?
    // The proposal's whole attribution claim ("offer before deposit") rests on
    // this. Counts only statuses that mean a real conversation happened —
    // ASSIGNED means picked up but not yet spoken to, SKIPPED means passed over.
    //
    // The window allows the event date AND the day before: contact_log rows are
    // stamped with the latest SNAPSHOT date, and the feed can lag a day, so a
    // contact made this morning may legitimately carry yesterday's date.
    // Narrower than that and honest contacts would be recorded as misses.
    const contactedBefore = async (playerKey, brand, eventDate) => {
      const hit = await env.DB.prepare(`
        SELECT 1 AS x FROM contact_log
        WHERE player_key = ? AND brand = ?
          AND snapshot_date BETWEEN date(?, '-1 day') AND ?
          AND status IN ('CONTACTED','RESPONDED','RECOVERED','NO_RESPONSE')
        LIMIT 1`).bind(playerKey, brand, eventDate, eventDate).first();
      return hit ? 1 : 0;
    };

    // ── GET /api/rtn/campaign/day?date= — events for a day (ANY signed-in user) ──
    if (path === "/api/rtn/campaign/day" && method === "GET") {
      const d = url.searchParams.get("date");
      const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : snapshotDateMYT();
      const events = await env.DB.prepare(`
        SELECT e.*,
          (SELECT COUNT(*) FROM code_assignments a WHERE a.event_id = e.id) AS assigned,
          (SELECT COUNT(*) FROM code_assignments a WHERE a.event_id = e.id AND a.claimed = 1) AS claimed
        FROM code_events e WHERE e.event_date = ? ORDER BY e.brand`).bind(day).all();
      const ids = (events.results || []).map((e) => e.id);
      let bands = { results: [] };
      if (ids.length) {
        bands = await env.DB.prepare(
          `SELECT * FROM code_bands WHERE event_id IN (${ids.map(() => "?").join(",")}) ORDER BY label`
        ).bind(...ids).all();
      }

      // Which of this team's brands can actually run a campaign. Eligibility is
      // decided by REAL uid coverage, not by the BRANDS[].prov tag: BO's audience
      // upload keys on user_id, and the tag can be wrong (OMG67 is tagged ZY but
      // ships no uid at all). Data-driven, so a brand appears by itself the day
      // its feeder starts sending uids — no hardcoded exception list to rot.
      const tb = TEAM_BRANDS[String(reqTeam || "").toUpperCase()] || [];
      let brandStats = { results: [] };
      if (tb.length) {
        brandStats = await env.DB.prepare(`
          SELECT brand, COUNT(*) AS pool,
                 SUM(CASE WHEN uid IS NOT NULL AND TRIM(uid) <> '' THEN 1 ELSE 0 END) AS with_uid
          FROM player_days
          WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM player_days)
            AND brand IN (${tb.map(() => "?").join(",")})
          GROUP BY brand ORDER BY brand`).bind(...tb).all();
      }
      return ok({ event_date: day, events: events.results, bands: bands.results, brands: brandStats.results });
    }

    // ── POST /api/rtn/campaign/event — create + shuffle + assign (managers) ──
    // Body: { event_date, brand, tier_segment, bands:[{label, code, amount}] }
    if (path === "/api/rtn/campaign/event" && method === "POST") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const b = await request.json();
      const day = String(b.event_date || "").trim();
      const brand = String(b.brand || "").trim();
      const tier = String(b.tier_segment || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return err("Bad event_date", 400);
      if (!brand || !tier) return err("Missing brand or tier", 400);

      // Shared with the 00:00 cron — one implementation of pool / shuffle / split,
      // so the manual and automatic paths can never drift apart.
      const r = await createEventFor(env, {
        date: day, brand, tier, bands: Array.isArray(b.bands) ? b.bands : [], createdBy: user.username,
      });
      if (r.error) {
        return err(r.skipped
          ? `${brand} Tier ${tier} already has an event on ${day} (${r.error})`
          : r.noUid ? `${r.error} — cannot build a BO upload list` : r.error,
          r.skipped ? 409 : 400);
      }
      log(user, "campaign", `Created ${brand} Tier ${tier} event ${day} · ${r.pool_size} players · ${r.counts.join("/")}`);
      return ok({ event_id: r.event_id, pool_size: r.pool_size, counts: r.counts, snapshot: r.snapshot });
    }

    // ── POST /api/rtn/campaign/auto-create — run the 00:00 job now (managers) ──
    // Same code path the cron uses, so testing it proves the real thing works.
    if (path === "/api/rtn/campaign/auto-create" && method === "POST") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const dry = url.searchParams.get("dry") === "1";
      const r = await autoCreateEvents(env, { dry });
      if (!dry) log(user, "campaign", `Ran auto-create manually · ${JSON.stringify(r)}`);
      return ok(r);
    }

    // ── POST /api/rtn/campaign/bands — set/replace the 2 codes (managers, draft only) ──
    if (path === "/api/rtn/campaign/bands" && method === "POST") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const b = await request.json();
      const ev = await env.DB.prepare("SELECT * FROM code_events WHERE id = ?").bind(b.event_id).first();
      if (!ev) return err("Event not found", 404);
      if (ev.status !== "draft") return err("Event is exported — codes are locked", 409);
      for (const x of (b.bands || [])) {
        await env.DB.prepare(
          "UPDATE code_bands SET code = ?, amount = ? WHERE event_id = ? AND label = ?"
        ).bind(String(x.code || "").trim(), Number(x.amount) || 0, ev.id, String(x.label).toUpperCase()).run();
      }
      log(user, "campaign", `Set codes · ${ev.brand} Tier ${ev.tier_segment} ${ev.event_date}`);
      return ok({ saved: true });
    }

    // ── GET /api/rtn/campaign/export?event_id=&label= — UID list + LOCK (managers) ──
    // Returns rows in BO's exact upload shape: one column, header user_id.
    // The FIRST export flips draft→exported via a conditional UPDATE, so two
    // managers exporting at once cannot both believe they locked it. Re-downloads
    // are always allowed (a lost file is not a reason to reshuffle).
    if (path === "/api/rtn/campaign/export" && method === "GET") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const eventId = Number(url.searchParams.get("event_id"));
      const label = String(url.searchParams.get("label") || "").toUpperCase();
      const ev = await env.DB.prepare("SELECT * FROM code_events WHERE id = ?").bind(eventId).first();
      if (!ev) return err("Event not found", 404);
      const missing = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM code_bands WHERE event_id = ? AND (code IS NULL OR TRIM(code) = '')"
      ).bind(eventId).first();
      if (missing.c) return err("Enter both BO codes before exporting", 400);

      // Never upload a short audience. If the stored pool_size and the actual
      // assignment count disagree, the event was written incompletely — exporting
      // it would hand BO a list quietly missing players, and the lock would then
      // make that permanent.
      const actual = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM code_assignments WHERE event_id = ?"
      ).bind(eventId).first();
      if (ev.pool_size != null && actual.n !== ev.pool_size) {
        return err(`Event looks incomplete — ${actual.n} players stored but pool was ${ev.pool_size}. Delete and recreate it; do not upload this list.`, 409);
      }

      const lock = await env.DB.prepare(
        "UPDATE code_events SET status = 'exported', exported_by = ?, exported_at = datetime('now') WHERE id = ? AND status = 'draft'"
      ).bind(user.username, eventId).run();
      if (lock.meta.changes) log(user, "campaign", `Exported + LOCKED ${ev.brand} Tier ${ev.tier_segment} ${ev.event_date}`);

      const list = await env.DB.prepare(
        "SELECT uid FROM code_assignments WHERE event_id = ? AND label = ? ORDER BY id"
      ).bind(eventId, label).all();
      const band = await env.DB.prepare(
        "SELECT * FROM code_bands WHERE event_id = ? AND label = ?"
      ).bind(eventId, label).first();
      return ok({
        event: { brand: ev.brand, tier_segment: ev.tier_segment, event_date: ev.event_date },
        band, locked_now: !!lock.meta.changes,
        uids: (list.results || []).map((r) => r.uid),
      });
    }

    // ── GET /api/rtn/campaign/unclaimed?event_id= — UIDs still to claim (managers) ──
    // The follow-up audience: everyone in the event who has not claimed yet, so
    // their code can be re-blasted through IM. Read-only — does NOT lock or change
    // the event, so it can be pulled any number of times during the day as the
    // list shrinks. Same BO upload shape (one column, user_id).
    if (path === "/api/rtn/campaign/unclaimed" && method === "GET") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const eventId = Number(url.searchParams.get("event_id"));
      const ev = await env.DB.prepare("SELECT * FROM code_events WHERE id = ?").bind(eventId).first();
      if (!ev) return err("Event not found", 404);
      const list = await env.DB.prepare(
        "SELECT uid FROM code_assignments WHERE event_id = ? AND claimed = 0 ORDER BY id"
      ).bind(eventId).all();
      return ok({
        event: { brand: ev.brand, tier_segment: ev.tier_segment, event_date: ev.event_date },
        uids: (list.results || []).map((r) => r.uid),
      });
    }

    // ── GET /api/rtn/campaign/find?q= — cross-brand player lookup (ANY user) ──
    // The Livechat path. One indexed row, any brand, no team filter, and it only
    // ever matches players already inside an event pool.
    if (path === "/api/rtn/campaign/find" && method === "GET") {
      const q = String(url.searchParams.get("q") || "").trim();
      if (!q) return err("Nothing to search for", 400);
      const d = url.searchParams.get("date");
      const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : snapshotDateMYT();
      const hits = await env.DB.prepare(`
        SELECT a.id, a.player_key, a.uid, a.username, a.brand, a.tier_segment, a.label,
               a.claimed, a.claimed_at, a.claimed_by, a.channel, a.blocked_at, a.blocked_by,
               a.contacted_before,
               e.id AS event_id, e.event_date, e.status,
               b.code, b.amount,
               (SELECT 1 FROM contact_log cl
                  WHERE cl.player_key = a.player_key AND cl.brand = a.brand
                    AND cl.snapshot_date BETWEEN date(e.event_date, '-1 day') AND e.event_date
                    AND cl.status IN ('CONTACTED','RESPONDED','RECOVERED','NO_RESPONSE')
                  LIMIT 1) AS contacted
        FROM code_assignments a
        JOIN code_events e ON e.id = a.event_id
        LEFT JOIN code_bands b ON b.event_id = a.event_id AND b.label = a.label
        WHERE e.event_date = ? AND (a.uid = ? OR a.username = ? OR a.player_key = ?)
        ORDER BY a.brand`).bind(day, q, q, q).all();
      return ok({ event_date: day, hits: hits.results });
    }

    // ── POST /api/rtn/campaign/release — hand the code over (any editor, any team) ──
    // Body: { assignment_id, channel }
    if (path === "/api/rtn/campaign/release" && method === "POST") {
      if (!canEdit) return NOEDIT();
      const b = await request.json();
      const row = await env.DB.prepare(`
        SELECT a.*, e.event_date, e.status, e.brand AS ebrand
        FROM code_assignments a JOIN code_events e ON e.id = a.event_id
        WHERE a.id = ?`).bind(b.assignment_id).first();
      if (!row) return err("Assignment not found", 404);
      if (row.status === "draft") return err("Event not exported yet — codes are not live", 409);
      if (row.event_date !== snapshotDateMYT()) return err(`That code was only valid on ${row.event_date}`, 409);

      const channel = String(b.channel || "").toLowerCase() === "livechat" ? "livechat" : "telegram";
      // Stamped server-side so the attribution record reflects what the database
      // knew at release, not what the client claimed. Recorded, never blocking.
      const hadContact = await contactedBefore(row.player_key, row.brand, row.event_date);
      // Conditional UPDATE, not a read-then-write: two agents clicking Release on
      // the same player at the same moment must not both succeed.
      const upd = await env.DB.prepare(`
        UPDATE code_assignments SET claimed = 1, claimed_at = datetime('now'), claimed_by = ?, channel = ?,
               contacted_before = ?
        WHERE id = ? AND claimed = 0`).bind(user.username, channel, hadContact, row.id).run();
      if (!upd.meta.changes) {
        const now = await env.DB.prepare(
          "SELECT claimed_by, claimed_at, channel FROM code_assignments WHERE id = ?"
        ).bind(row.id).first();
        return err(`Already released by ${now.claimed_by} (${now.channel}) at ${now.claimed_at}`, 409);
      }
      const band = await env.DB.prepare(
        "SELECT code, amount FROM code_bands WHERE event_id = ? AND label = ?"
      ).bind(row.event_id, row.label).first();
      log(user, "campaign", `Released ${row.label} · ${row.uid} (${row.brand}) via ${channel}${hadContact ? "" : " · NO PRIOR CONTACT"}`);
      return ok({ released: true, code: band?.code, amount: band?.amount, label: row.label, contacted_before: hadContact });
    }

    // ── POST /api/rtn/campaign/block — "showed up, under RM100" (any editor) ──
    // Recorded, never deletes, and does NOT burn the code: they can top up and
    // still claim the same day.
    if (path === "/api/rtn/campaign/block" && method === "POST") {
      if (!canEdit) return NOEDIT();
      const b = await request.json();
      const upd = await env.DB.prepare(`
        UPDATE code_assignments SET blocked_at = datetime('now'), blocked_by = ?
        WHERE id = ? AND claimed = 0`).bind(user.username, b.assignment_id).run();
      if (!upd.meta.changes) return err("Already claimed, or not found", 409);
      log(user, "campaign", `Not qualified · assignment #${b.assignment_id}`);
      return ok({ blocked: true });
    }

    // ── GET /api/rtn/campaign/assignments?event_id=&view= — the tables (managers) ──
    if (path === "/api/rtn/campaign/assignments" && method === "GET") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const eventId = Number(url.searchParams.get("event_id"));
      const view = String(url.searchParams.get("view") || "all");
      const where = view === "claimed" ? " AND a.claimed = 1"
        : view === "eligible" ? " AND a.claimed = 0" : "";
      const rows = await env.DB.prepare(`
        SELECT a.id, a.uid, a.username, a.label, a.claimed, a.claimed_at, a.claimed_by,
               a.channel, a.blocked_at, a.blocked_by, b.code, b.amount
        FROM code_assignments a
        LEFT JOIN code_bands b ON b.event_id = a.event_id AND b.label = a.label
        WHERE a.event_id = ?${where}
        ORDER BY a.claimed, a.id`).bind(eventId).all();
      return ok({ rows: rows.results });
    }

    // ── GET /api/rtn/campaign/report?date= — per-brand + per-code result (managers) ──
    if (path === "/api/rtn/campaign/report" && method === "GET") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const d = url.searchParams.get("date");
      const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : snapshotDateMYT();
      // Scope every section to one team. by_brand used to be filtered in the
      // browser while by_code and by_agent were not, so a Team B manager saw
      // Team A and C mixed into the A/B comparison and the agent list.
      const rTeam = TEAM_BRANDS[String(url.searchParams.get("team") || "").toUpperCase()];
      const tf = rTeam ? ` AND e.brand IN (${rTeam.map(() => "?").join(",")})` : "";
      const tb = rTeam || [];
      const byBrand = await env.DB.prepare(`
        SELECT e.brand, e.tier_segment, e.pool_size,
               COUNT(a.id) AS assigned,
               SUM(a.claimed) AS claimed,
               SUM(CASE WHEN a.claimed = 1 THEN b.amount ELSE 0 END) AS cost,
               SUM(CASE WHEN a.blocked_at IS NOT NULL AND a.claimed = 0 THEN 1 ELSE 0 END) AS blocked,
               -- Attribution quality: claims where CS had NOT contacted the player
               -- first. The proposal's "every recovered deposit is attributable"
               -- only holds for the rest.
               SUM(CASE WHEN a.claimed = 1 AND a.contacted_before = 0 THEN 1 ELSE 0 END) AS no_contact
        FROM code_events e
        JOIN code_assignments a ON a.event_id = e.id
        LEFT JOIN code_bands b ON b.event_id = e.id AND b.label = a.label
        WHERE e.event_date = ?${tf} GROUP BY e.id ORDER BY e.brand`).bind(day, ...tb).all();
      const byCode = await env.DB.prepare(`
        SELECT a.label, b.amount, COUNT(a.id) AS assigned, SUM(a.claimed) AS claimed
        FROM code_events e
        JOIN code_assignments a ON a.event_id = e.id
        LEFT JOIN code_bands b ON b.event_id = e.id AND b.label = a.label
        WHERE e.event_date = ?${tf} GROUP BY a.label ORDER BY a.label`).bind(day, ...tb).all();
      const byAgent = await env.DB.prepare(`
        SELECT a.claimed_by AS agent, COUNT(*) AS released
        FROM code_events e JOIN code_assignments a ON a.event_id = e.id
        WHERE e.event_date = ?${tf} AND a.claimed = 1 GROUP BY a.claimed_by ORDER BY released DESC`).bind(day, ...tb).all();
      return ok({ event_date: day, by_brand: byBrand.results, by_code: byCode.results, by_agent: byAgent.results });
    }

    // ── POST /api/rtn/campaign/delete — throw away a DRAFT event (managers) ──
    // The undo for "wrong brand / wrong codes / wrong tier". It can ONLY ever
    // touch a draft: once exported, BO holds those lists and the console must
    // keep matching them forever, so an exported event is deleted by nobody.
    // Every statement is guarded by the same status subquery rather than a
    // read-then-write, so an export landing mid-request cannot slip through:
    // if it flipped to 'exported', all three statements no-op together.
    if (path === "/api/rtn/campaign/delete" && method === "POST") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const b = await request.json();
      const id = Number(b.event_id);
      const ev = await env.DB.prepare("SELECT * FROM code_events WHERE id = ?").bind(id).first();
      if (!ev) return err("Event not found", 404);

      // The line is CLAIMS, not status. An event with a claim is real history — a
      // player was handed a code by a named agent at a known time, and that record
      // must survive regardless of status. An event with zero claims never reached
      // a player, so a wrong brand / wrong codes / mis-click is safe to erase even
      // once exported or closed. (Was draft-only, which left mistakes stuck forever.)
      const claims = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM code_assignments WHERE event_id = ? AND claimed = 1"
      ).bind(id).first();
      if (claims.n > 0) {
        return err(`${ev.brand} Tier ${ev.tier_segment} has ${claims.n} released code(s) — that history can't be deleted. Close it instead.`, 409);
      }

      // Guard every statement on the claim count, not a read-then-write, so a
      // release landing mid-request makes all three no-op together.
      const guard = "(SELECT COUNT(*) FROM code_assignments WHERE event_id = ? AND claimed = 1) = 0";
      const res = await env.DB.batch([
        env.DB.prepare(`DELETE FROM code_assignments WHERE event_id = ? AND ${guard}`).bind(id, id),
        env.DB.prepare(`DELETE FROM code_bands WHERE event_id = ? AND ${guard}`).bind(id, id),
        env.DB.prepare(`DELETE FROM code_events WHERE id = ? AND ${guard}`).bind(id, id),
      ]);
      if (!res[2].meta.changes) return err("A code was released while you were deleting — nothing removed", 409);
      log(user, "campaign", `Deleted ${ev.status.toUpperCase()} ${ev.brand} Tier ${ev.tier_segment} ${ev.event_date} · ${res[0].meta.changes} assignments · 0 claims`);
      return ok({ deleted: true, assignments_removed: res[0].meta.changes, was_status: ev.status });
    }

    // ── POST /api/rtn/campaign/close — end the event (managers) ──
    if (path === "/api/rtn/campaign/close" && method === "POST") {
      if (!can("campaigns.manage")) return err("Managers only", 403);
      const b = await request.json();
      await env.DB.prepare(
        "UPDATE code_events SET status = 'closed', closed_by = ?, closed_at = datetime('now') WHERE id = ? AND status = 'exported'"
      ).bind(user.username, b.event_id).run();
      log(user, "campaign", `Closed event #${b.event_id}`);
      return ok({ closed: true });
    }

    // ── GET /api/rtn/kpi — Stage 1 auto metrics (read-only) ───────────────────
    // Per-brand + team Tier 3 / Tier V retention % and month-to-date deposit.
    // Pool is PER-BRAND (matches the website pool); team = sum of brands.
    // retention = players in tier with >=1 deposit this month / tier pool.
    // NOTE: only counts days present in history (June 1-10 gap understates June).
    if (path === "/api/rtn/kpi" && method === "GET") {
      let month = url.searchParams.get("month");
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        const m = await env.DB.prepare("SELECT strftime('%Y-%m', MAX(snapshot_date)) AS m FROM player_days").first();
        month = m?.m || null;
      }
      if (!month) return ok({ month: null, days: 0, brands: [], team: null, retention: [], team_inputs: null, agent_marks: [], team_challenge: [], agent_inputs: [], engagement: null, reactivation: [] });
      const sc = scopeAnd();   // team scope for a manager's ?team= selection (no-op for all-teams view)
      // ── Reactivation scoring: WEIGHTED model from Aug 2026, flat count before ──────────────
      // July (and earlier) keep the original flat "count of RECOVERED players" so those numbers
      // never move. From 2026-08 the score = the agent's RECOVERED players (status='RECOVERED', by
      // contacted_at month), each weighted by how many days idle they were when they came back (feeder
      // "Reactivated X Days" band, deepest per player): 1-6d=0.10, 7-13d=0.50, 14-29d=0.75, 30+d=1.00.
      // ONLY recoveries count — a no-response contact earns nothing — so the score reconciles with the
      // Recovered count (0 recovered = 0 score). A recovered player with no Reactivated band falls back
      // to shallow (0.10). Alias stays `recovered` so the payload shape holds.
      const REACT_WEIGHTED_FROM = "2026-08";
      const reactStmt = month >= REACT_WEIGHTED_FROM
        ? env.DB.prepare(`
            WITH rec AS (
              SELECT assigned_to AS agent, player_key, brand, tier_segment
              FROM contact_log
              WHERE status = 'RECOVERED' AND assigned_to IS NOT NULL
                AND substr(COALESCE(contacted_at, snapshot_date), 1, 7) = ?${sc.s}
              GROUP BY assigned_to, player_key, brand, tier_segment
            ),
            depth AS (
              SELECT rec.agent,
                MAX(CASE pd.group_name
                      WHEN 'Reactivated 30+ Days' THEN 4
                      WHEN 'Reactivated 21-29 Days' THEN 3
                      WHEN 'Reactivated 14-20 Days' THEN 3
                      WHEN 'Reactivated 7-13 Days' THEN 2
                      WHEN 'Reactivated 3-6 Days' THEN 1
                      WHEN 'Reactivated 1-2 Days' THEN 1
                      ELSE 0 END) AS tier
              FROM rec
              LEFT JOIN player_days pd ON pd.player_key = rec.player_key AND pd.brand = rec.brand
                AND pd.tier_segment = rec.tier_segment AND pd.group_name LIKE 'Reactivated%'
                AND strftime('%Y-%m', pd.snapshot_date) = ?
              GROUP BY rec.agent, rec.player_key, rec.brand, rec.tier_segment
            )
            SELECT agent, ROUND(SUM(CASE tier WHEN 4 THEN 1.00 WHEN 3 THEN 0.75 WHEN 2 THEN 0.50 ELSE 0.10 END), 2) AS recovered
            FROM depth GROUP BY agent`).bind(month, ...sc.b, month)
        : env.DB.prepare(`SELECT assigned_to AS agent, COUNT(DISTINCT player_key) AS recovered FROM contact_log
            WHERE strftime('%Y-%m', snapshot_date) = ?${sc.s} AND status = 'RECOVERED' AND assigned_to IS NOT NULL
            GROUP BY assigned_to`).bind(month, ...sc.b);
      const [counts, deposits, cover, retention, teamInputs, agentMarks, teamChallenge, agentInputs, contactedRow, engRow, reactRows] = await Promise.all([
        // Retention from the latest snapshot's CUMULATIVE monthly deposit — captures the whole
        // month even with a mid-month history gap (a deposit can't be undone; the monthly figure
        // is month-to-date). Pool = tier members in that snapshot.
        env.DB.prepare(`SELECT brand, tier_segment AS tier,
            COUNT(DISTINCT player_key) AS pool,
            COUNT(DISTINCT CASE WHEN (monthly_deposit > 0 OR monthly_deposit_count > 0) THEN player_key END) AS dep
          FROM player_days
          WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM player_days WHERE strftime('%Y-%m', snapshot_date) = ?)${sc.s}
          GROUP BY brand, tier_segment`).bind(month, ...sc.b).all(),
        env.DB.prepare(`SELECT brand, SUM(daily_deposit) AS dep FROM player_days
          WHERE strftime('%Y-%m', snapshot_date) = ?${sc.s} GROUP BY brand`).bind(month, ...sc.b).all(),
        env.DB.prepare(`SELECT COUNT(DISTINCT snapshot_date) AS days, MIN(snapshot_date) AS first_day, MAX(snapshot_date) AS last_day
          FROM player_days WHERE strftime('%Y-%m', snapshot_date) = ?${sc.s}`).bind(month, ...sc.b).first(),
        env.DB.prepare(`SELECT brand, tier3_pct, tierv_pct, last3_pct, lastv_pct
          FROM kpi_retention WHERE month = ?${sc.s}`).bind(month, ...sc.b).all(),
        env.DB.prepare(`SELECT frt_sec, discipline, last_month_deposit, this_month_deposit
          FROM kpi_team_month WHERE month = ?`).bind(month).first(),
        env.DB.prepare(`SELECT agent, marks FROM kpi_agent_marks WHERE month = ?`).bind(month).all(),
        env.DB.prepare(`SELECT team, score FROM kpi_team_challenge WHERE month = ?`).bind(month).all(),
        env.DB.prepare(`SELECT agent, frt_sec FROM kpi_agent_month WHERE month = ?`).bind(month).all(),
        // VIPs contacted this month = distinct players the team actually reached (not just assigned/skipped).
        env.DB.prepare(`SELECT COUNT(DISTINCT player_key) AS contacted FROM contact_log
          WHERE strftime('%Y-%m', snapshot_date) = ?${sc.s}
            AND status IN ('CONTACTED','RESPONDED','RECOVERED','NO_RESPONSE')`).bind(month, ...sc.b).first(),
        env.DB.prepare(`SELECT fu_done, fu_required FROM kpi_challenge_eng WHERE month = ?`).bind(month).first(),
        // Reactivation, per agent (weighted from Aug 2026 / flat before — see reactStmt above).
        reactStmt.all(),
      ]);
      const pct = (a, b) => (b > 0 ? Math.round((a / b) * 10000) / 100 : null);
      const k = (b, t) => b + "|" + t;
      const cMap = {}, dMap = {}, brandSet = new Set();
      counts.results.forEach((r) => { cMap[k(r.brand, r.tier)] = r; brandSet.add(r.brand); });
      deposits.results.forEach((r) => { dMap[r.brand] = r.dep || 0; });
      const brands = [...brandSet].sort().map((b) => {
        const c3 = cMap[k(b, "3")] || { pool: 0, dep: 0 };
        const cV = cMap[k(b, "V")] || { pool: 0, dep: 0 };
        return {
          brand: b,
          tier3: { pool: c3.pool, deposited: c3.dep, pct: pct(c3.dep, c3.pool) },
          tierV: { pool: cV.pool, deposited: cV.dep, pct: pct(cV.dep, cV.pool) },
          deposit: dMap[b] || 0,
        };
      });
      const sum = (f) => brands.reduce((s, x) => s + f(x), 0);
      const tp3 = sum((x) => x.tier3.pool), td3 = sum((x) => x.tier3.deposited);
      const tpV = sum((x) => x.tierV.pool), tdV = sum((x) => x.tierV.deposited);
      const team = {
        tier3: { pool: tp3, deposited: td3, pct: pct(td3, tp3) },
        tierV: { pool: tpV, deposited: tdV, pct: pct(tdV, tpV) },
        deposit: sum((x) => x.deposit),
      };
      const engagement = {
        contacted: contactedRow?.contacted || 0,       // AUTO from contact_log
        fu_done: engRow?.fu_done ?? null,               // manual
        fu_required: engRow?.fu_required ?? null,       // manual
      };
      return ok({ month, days: cover?.days || 0, first_day: cover?.first_day || null,
                  last_day: cover?.last_day || null, brands, team,
                  retention: retention.results || [], team_inputs: teamInputs || null,
                  agent_marks: agentMarks.results || [], team_challenge: teamChallenge.results || [],
                  agent_inputs: agentInputs.results || [], engagement,
                  reactivation: reactRows.results || [] });
    }

    // POST /api/rtn/kpi/agent-input — upsert one agent's own KPI inputs { month, agent, frt_sec }
    if (path === "/api/rtn/kpi/agent-input" && method === "POST") {
      const b = await request.json();
      if (!b.month || !/^\d{4}-\d{2}$/.test(b.month) || !b.agent) return err("Missing/invalid month or agent");
      const num = (v) => (v === "" || v == null || isNaN(v) ? null : Number(v));
      await env.DB.prepare(`
        INSERT INTO kpi_agent_month (month, agent, frt_sec, updated_by, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (month, agent) DO UPDATE SET
          frt_sec = excluded.frt_sec, updated_by = excluded.updated_by, updated_at = datetime('now')
      `).bind(b.month, b.agent, num(b.frt_sec), user.username).run();
      return ok({ saved: true });
    }

    // POST /api/rtn/kpi/agent — upsert/delete one staff KPI mark { month, name, marks } (delete:true to remove)
    if (path === "/api/rtn/kpi/agent" && method === "POST") {
      const b = await request.json();
      const name = b.name || b.agent;
      if (!b.month || !/^\d{4}-\d{2}$/.test(b.month) || !name) return err("Missing/invalid month or name");
      if (b.delete) {
        await env.DB.prepare(`DELETE FROM kpi_agent_marks WHERE month = ? AND agent = ?`).bind(b.month, name).run();
        return ok({ deleted: true });
      }
      const num = (v) => (v === "" || v == null || isNaN(v) ? null : Number(v));
      await env.DB.prepare(`
        INSERT INTO kpi_agent_marks (month, agent, marks, updated_by, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (month, agent) DO UPDATE SET
          marks = excluded.marks, updated_by = excluded.updated_by, updated_at = datetime('now')
      `).bind(b.month, name, num(b.marks), user.username).run();
      return ok({ saved: true });
    }

    // POST /api/rtn/kpi/challenge — upsert/delete one team's score { month, name, marks } (delete:true to remove)
    if (path === "/api/rtn/kpi/challenge" && method === "POST") {
      const b = await request.json();
      const name = b.name || b.team;
      if (!b.month || !/^\d{4}-\d{2}$/.test(b.month) || !name) return err("Missing/invalid month or name");
      if (b.delete) {
        await env.DB.prepare(`DELETE FROM kpi_team_challenge WHERE month = ? AND team = ?`).bind(b.month, name).run();
        return ok({ deleted: true });
      }
      const num = (v) => (v === "" || v == null || isNaN(v) ? null : Number(v));
      await env.DB.prepare(`
        INSERT INTO kpi_team_challenge (month, team, score, updated_by, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (month, team) DO UPDATE SET
          score = excluded.score, updated_by = excluded.updated_by, updated_at = datetime('now')
      `).bind(b.month, name, num(b.marks), user.username).run();
      return ok({ saved: true });
    }

    // POST /api/rtn/kpi/challenge-eng — upsert Team Challenge manual engagement { month, fu_done, fu_required }
    if (path === "/api/rtn/kpi/challenge-eng" && method === "POST") {
      const b = await request.json();
      if (!b.month || !/^\d{4}-\d{2}$/.test(b.month)) return err("Missing/invalid month");
      const num = (v) => (v === "" || v == null || isNaN(v) ? null : Number(v));
      await env.DB.prepare(`
        INSERT INTO kpi_challenge_eng (month, fu_done, fu_required, updated_by, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (month) DO UPDATE SET
          fu_done = excluded.fu_done, fu_required = excluded.fu_required,
          updated_by = excluded.updated_by, updated_at = datetime('now')
      `).bind(b.month, num(b.fu_done), num(b.fu_required), user.username).run();
      return ok({ saved: true });
    }

    // POST /api/rtn/kpi/team — upsert team inputs { month, frt_sec, discipline, last_month_deposit, this_month_deposit }
    if (path === "/api/rtn/kpi/team" && method === "POST") {
      const b = await request.json();
      if (!b.month || !/^\d{4}-\d{2}$/.test(b.month)) return err("Missing/invalid month");
      const num = (v) => (v === "" || v == null || isNaN(v) ? null : Number(v));
      await env.DB.prepare(`
        INSERT INTO kpi_team_month (month, frt_sec, discipline, last_month_deposit, this_month_deposit, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (month) DO UPDATE SET
          frt_sec = excluded.frt_sec, discipline = excluded.discipline,
          last_month_deposit = excluded.last_month_deposit, this_month_deposit = excluded.this_month_deposit,
          updated_by = excluded.updated_by, updated_at = datetime('now')
      `).bind(b.month, num(b.frt_sec), num(b.discipline), num(b.last_month_deposit), num(b.this_month_deposit), user.username).run();
      return ok({ saved: true });
    }

    // ── Mistake log — feeds Discipline KPI. View = any user; add/delete = admin only ──
    // GET /api/rtn/mistakes?month=YYYY-MM (defaults to latest data month)
    if (path === "/api/rtn/mistakes" && method === "GET") {
      let month = url.searchParams.get("month");
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        const m = await env.DB.prepare("SELECT strftime('%Y-%m', MAX(snapshot_date)) AS m FROM player_days").first();
        month = m?.m || null;
      }
      if (!month) return ok({ month: null, mistakes: [] });
      const rows = await env.DB.prepare(
        `SELECT id, month, agent, category, points, note, brand, logged_by, created_at
         FROM mistakes WHERE month = ? ORDER BY created_at DESC, id DESC`
      ).bind(month).all();
      return ok({ month, mistakes: rows.results || [] });
    }

    // POST /api/rtn/mistakes — add a mistake { month, agent, category, points, note, brand } (admin only)
    if (path === "/api/rtn/mistakes" && method === "POST") {
      if (!can("mistakes.log")) return err("Managers only", 403);
      const b = await request.json();
      if (!b.month || !/^\d{4}-\d{2}$/.test(b.month) || !b.agent || !b.category) return err("Missing month / agent / category");
      const pts = (b.points === "" || b.points == null || isNaN(b.points)) ? 1 : Number(b.points);
      await env.DB.prepare(
        `INSERT INTO mistakes (month, agent, category, points, note, brand, logged_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(b.month, b.agent, b.category, pts, b.note || null, b.brand || null, user.username).run();
      log(user, "mistake", `Logged mistake (${b.category}, ${pts}pts) · ${b.agent}`);
      return ok({ saved: true });
    }

    // DELETE /api/rtn/mistakes/:id (admin only)
    if (path.startsWith("/api/rtn/mistakes/") && method === "DELETE") {
      if (!can("mistakes.log")) return err("Managers only", 403);
      const id = path.split("/").pop();
      if (!id) return err("Missing id");
      await env.DB.prepare("DELETE FROM mistakes WHERE id = ?").bind(id).run();
      log(user, "mistake", `Removed mistake #${id}`);
      return ok({ deleted: true });
    }

    // POST /api/rtn/kpi/retention — upsert manual retention { month, brand, tier3_pct, tierv_pct, last3_pct, lastv_pct }
    if (path === "/api/rtn/kpi/retention" && method === "POST") {
      const b = await request.json();
      if (!b.month || !/^\d{4}-\d{2}$/.test(b.month) || !b.brand) return err("Missing/invalid month or brand");
      const num = (v) => (v === "" || v == null || isNaN(v) ? null : Number(v));
      await env.DB.prepare(`
        INSERT INTO kpi_retention (month, brand, tier3_pct, tierv_pct, last3_pct, lastv_pct, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (month, brand) DO UPDATE SET
          tier3_pct = excluded.tier3_pct, tierv_pct = excluded.tierv_pct,
          last3_pct = excluded.last3_pct, lastv_pct = excluded.lastv_pct,
          updated_by = excluded.updated_by, updated_at = datetime('now')
      `).bind(b.month, b.brand, num(b.tier3_pct), num(b.tierv_pct), num(b.last3_pct), num(b.lastv_pct), user.username).run();
      return ok({ saved: true });
    }

    // ── GET /api/players ──────────────────────────────────────────────────────
    if (path === "/api/players" && method === "GET") {
      const players = await env.DB.prepare("SELECT * FROM players").all();
      const history = await env.DB.prepare("SELECT * FROM history ORDER BY date ASC").all();

      // Attach history to each player
      const histMap = {};
      for (const h of history.results) {
        if (!histMap[h.username]) histMap[h.username] = {};
        histMap[h.username][h.date] = { deposit: h.deposit, withdraw: h.withdraw, pnl: h.pnl };
      }
      const result = players.results.map(p => ({
        ...p,
        history: histMap[p.username] || {},
      }));
      return ok(result);
    }

    // ── GET /api/upload-log ────────────────────────────────────────────────────
    if (path === "/api/upload-log" && method === "GET") {
      const logs = await env.DB.prepare(
        "SELECT * FROM upload_log ORDER BY uploaded_at DESC LIMIT 90"
      ).all();
      return ok(logs.results);
    }

    // ── POST /api/upload — save daily data batch ───────────────────────────────
    if (path === "/api/upload" && method === "POST") {
      if (!can("data.sync")) return err("Managers only", 403);   // legacy v1 write — restrict to managers
      const { date, brand, players: rows, filename } = await request.json();
      if (!date || !brand || !rows || !filename) return err("Missing fields");

      let count = 0;
      const stmts = [];

      for (const row of rows) {
        const { username, tier, deposit, withdraw, pnl } = row;
        if (!username || !tier) continue;
        count++;

        // Upsert player record
        stmts.push(
          env.DB.prepare(`
            INSERT INTO players (username, tier, brand, first_seen, total_deposit, total_withdraw, total_pnl, deposit_count, all_time_high, last_deposit_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(username) DO UPDATE SET
              tier = excluded.tier,
              brand = excluded.brand,
              updated_at = datetime('now')
          `).bind(username, tier, brand, date, deposit, withdraw, pnl, deposit > 0 ? 1 : 0, deposit, deposit > 0 ? date : null)
        );

        // Upsert history row
        stmts.push(
          env.DB.prepare(`
            INSERT INTO history (username, brand, date, deposit, withdraw, pnl)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(username, date) DO UPDATE SET
              deposit = excluded.deposit,
              withdraw = excluded.withdraw,
              pnl = excluded.pnl
          `).bind(username, brand, date, deposit, withdraw, pnl)
        );
      }

      // Recalculate totals for each player in this batch
      const usernames = [...new Set(rows.map(r => r.username))];
      for (const username of usernames) {
        stmts.push(
          env.DB.prepare(`
            UPDATE players SET
              total_deposit  = (SELECT COALESCE(SUM(deposit),0)  FROM history WHERE username = ?),
              total_withdraw = (SELECT COALESCE(SUM(withdraw),0) FROM history WHERE username = ?),
              total_pnl      = (SELECT COALESCE(SUM(pnl),0)      FROM history WHERE username = ?),
              deposit_count  = (SELECT COUNT(*) FROM history WHERE username = ? AND deposit > 0),
              all_time_high  = (SELECT COALESCE(MAX(deposit),0)  FROM history WHERE username = ?),
              last_deposit_date = (SELECT MAX(date) FROM history WHERE username = ? AND deposit > 0),
              updated_at     = datetime('now')
            WHERE username = ?
          `).bind(username, username, username, username, username, username, username)
        );
      }

      // Upload log
      stmts.push(
        env.DB.prepare(`
          INSERT INTO upload_log (date, filename, brand, player_count, uploaded_by)
          VALUES (?, ?, ?, ?, ?)
        `).bind(date, filename, brand, count, user.username)
      );

      // Execute all in batch
      await env.DB.batch(stmts);
      return ok({ message: `Processed ${count} players`, count });
    }

    // ── GET /api/users (admin only — enforced) ─────────────────────────────────
    if (path === "/api/users" && method === "GET") {
      if (!canManage) return err("Managers only", 403);
      let users;
      try {
        users = await env.DB.prepare(
          "SELECT id, username, role, role_key, perm_overrides, can_edit, can_delete, on_leaderboard, manage_users, team, created_at, last_login FROM users ORDER BY created_at ASC"
        ).all();
      } catch (e) {
        try {   // schema_v28 not run yet: no perm_overrides column
          users = await env.DB.prepare(
            "SELECT id, username, role, role_key, can_edit, can_delete, on_leaderboard, manage_users, team, created_at, last_login FROM users ORDER BY created_at ASC"
          ).all();
        } catch (e2) {   // schema_v27 not run yet: no role_key column
          users = await env.DB.prepare(
            "SELECT id, username, role, can_edit, can_delete, on_leaderboard, manage_users, team, created_at, last_login FROM users ORDER BY created_at ASC"
          ).all();
        }
      }
      return ok(users.results);
    }

    // ── POST /api/users (admin only — enforced) ────────────────────────────────
    if (path === "/api/users" && method === "POST") {
      if (!canManage) return err("Managers only", 403);
      const b = await request.json();
      if (!b.username || !b.password) return err("Username and password required");
      if (b.password.length < 8) return err("Password must be at least 8 characters");
      const hash = await sha256(b.password + (env.PASSWORD_SALT || "lpk777salt"));
      const f = (v) => (v ? 1 : 0);
      const newTeam = ["A", "B", "C"].includes(b.team) ? b.team : null;
      try {
        const roleMap = b.role_key ? await loadRoles(env.DB) : null;
        const picked = b.role_key && roleMap ? roleMap.get(b.role_key) : null;
        if (b.role_key && !picked) return err("Unknown role", 400);
        if (picked) {
          // a role decides the old columns too, so every query that still reads them agrees
          const perms = rolePerms(picked, roleMap), f2 = (k) => (perms.has(k) ? 1 : 0), lc = legacyColumns(picked, roleMap);
          await env.DB.prepare(
            "INSERT INTO users (username, password_hash, role, can_edit, can_delete, on_leaderboard, manage_users, team, role_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(b.username.trim().toLowerCase(), hash, legacyColumns(picked, roleMap).role,
            lc.can_edit, lc.can_delete, f2("kpi.scored"), f2("users.manage"), newTeam, picked.key).run();
          log(user, "user", `Created account · ${b.username.trim().toLowerCase()} (${picked.name})`);
          return ok({ message: "User created" });
        }
        await env.DB.prepare(
          "INSERT INTO users (username, password_hash, role, can_edit, can_delete, on_leaderboard, manage_users, team) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(b.username.trim().toLowerCase(), hash, b.role || "viewer",
          f(b.can_edit), f(b.can_delete), f(b.on_leaderboard), f(b.manage_users), newTeam).run();
        log(user, "user", `Created account · ${b.username.trim().toLowerCase()} (${b.role || "viewer"})`);
        return ok({ message: "User created" });
      } catch (e) {
        return err("Username already exists");
      }
    }

    // ── POST /api/users/perm — update a user's role + permission flags (managers only) ──
    if (path === "/api/users/perm" && method === "POST") {
      if (!canManage) return err("Managers only", 403);
      const b = await request.json();
      if (!b.id) return err("Missing user id");
      const f = (v) => (v ? 1 : 0);
      const mgr = f(b.manage_users);
      // Guardrail: never remove the last manager (prevents locking everyone out of user admin).
      if (!mgr) {
        const target = await env.DB.prepare("SELECT username, manage_users FROM users WHERE id = ?").bind(b.id).first();
        if (target && (target.manage_users || target.username === user.username)) {
          const others = await env.DB.prepare(
            "SELECT COUNT(*) AS c FROM users WHERE manage_users = 1 AND id != ?").bind(b.id).first();
          if ((others?.c || 0) === 0) return err("Can't remove the last manager — promote someone else first", 400);
        }
      }
      const permTeam = ["A", "B", "C"].includes(b.team) ? b.team : null;
      await env.DB.prepare(
        "UPDATE users SET role = ?, can_edit = ?, can_delete = ?, on_leaderboard = ?, manage_users = ?, team = ? WHERE id = ?"
      ).bind(b.role || "viewer", f(b.can_edit), f(b.can_delete), f(b.on_leaderboard), mgr, permTeam, b.id).run();
      // the old editor sets the flags by hand, so this account leaves the role system until a role is picked again
      try { await env.DB.prepare("UPDATE users SET role_key = NULL WHERE id = ?").bind(b.id).run(); } catch (e) { /* schema_v27 not run: no column */ }
      try { await env.DB.prepare("UPDATE users SET perm_overrides = NULL WHERE id = ?").bind(b.id).run(); } catch (e) { /* schema_v28 not run: no column */ }
      log(user, "perm", `Set permissions → ${b.role || "viewer"} · user #${b.id}`);
      return ok({ saved: true });
    }

    // ── DELETE /api/users/:id (admin only) ────────────────────────────────────
    if (path.startsWith("/api/users/") && method === "DELETE") {
      if (!canManage) return err("Managers only", 403);
      const id = path.split("/").pop();
      const target = await env.DB.prepare("SELECT username, manage_users FROM users WHERE id = ?").bind(id).first();
      if (!target) return err("User not found", 404);
      if (target.username === user.username) return err("You can't delete your own account", 400);
      if (target.manage_users) {
        const others = await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE manage_users = 1 AND id != ?").bind(id).first();
        if ((others?.c || 0) === 0) return err("Can't delete the last manager — promote someone else first", 400);
      }
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      // release the players this account owned, so they show as unassigned and get dealt to someone who is still here
      const released = await env.DB.prepare("UPDATE player_assignment SET active = 0 WHERE agent = ? AND active = 1").bind(target.username).run();
      log(user, "user", `Deleted account · ${target.username}${released.meta && released.meta.changes ? ` (released ${released.meta.changes} assigned players)` : ""}`);
      return ok({ message: "User deleted" });
    }

    // ── POST /api/change-password ──────────────────────────────────────────────
    if (path === "/api/change-password" && method === "POST") {
      const { current_password, new_password } = await request.json();
      if (!new_password || new_password.length < 8) return err("New password must be at least 8 characters");
      const hash = await sha256(current_password + (env.PASSWORD_SALT || "lpk777salt"));
      if (hash !== user.password_hash) return err("Current password incorrect", 401);
      const newHash = await sha256(new_password + (env.PASSWORD_SALT || "lpk777salt"));
      await env.DB.prepare(
        "UPDATE users SET password_hash = ? WHERE username = ?"
      ).bind(newHash, user.username).run();
      return ok({ message: "Password updated" });
    }

    return err("Not found", 404);
  },

  // Cron-driven contact-log automation (schedule set in wrangler.toml [triggers]).
  async scheduled(event, env, ctx) {
    // 12:15 MYT feeder kick-off has its own cron line; it does ONLY that, so the hourly jobs
    // below don't run a second time at :15.
    if (event.cron === FEEDER_CRON) {
      ctx.waitUntil(kickFeeders(env).then(
        (r) => console.log("kickFeeders:", JSON.stringify(r)),
        (e) => console.error("kickFeeders failed:", e && e.message)
      ));
      return;
    }
    ctx.waitUntil(autoOutcomes(env).then(
      (r) => console.log("autoOutcomes:", JSON.stringify(r)),
      (e) => console.error("autoOutcomes failed:", e && e.message)
    ));
    // Lark P&L1 → player_telegram: once a day at 00:00 MYT (16:00 UTC). Cron fires hourly,
    // so gate on the hour. try/catch isolation keeps a Lark hiccup from touching autoOutcomes.
    const hourUTC = new Date(event.scheduledTime).getUTCHours();
    // Lark Engagement table → engagement_daily. The table always shows YESTERDAY (MYT), so read it
    // at 09:00 MYT and again at 14:00 MYT (01 / 06 UTC), before the 15:00 report; the second run
    // overwrites the first, so a late Lark refresh is still caught. Isolated like the other syncs.
    if (hourUTC === 1 || hourUTC === 6) {
      ctx.waitUntil(larkEngagementSync(env).then(
        (r) => console.log("larkEngagementSync:", JSON.stringify({ ...r, rows: undefined })),
        (e) => console.error("larkEngagementSync failed:", e && e.message)
      ));
    }
    if (hourUTC === 16) {
      ctx.waitUntil(larkTelegramSync(env).then(
        (r) => console.log("larkTelegramSync:", JSON.stringify(r)),
        (e) => console.error("larkTelegramSync failed:", e && e.message)
      ));
      // Same 00:00 MYT slot, but isolated: draft events for today's team.
      // Creates drafts only — never codes, never exports, never locks.
      // Gated on AUTO_CREATE_ENABLED so nothing runs until the campaign goes live.
      if (AUTO_CREATE_ENABLED) {
        ctx.waitUntil(autoCreateEvents(env).then(
          (r) => console.log("autoCreateEvents:", JSON.stringify(r)),
          (e) => console.error("autoCreateEvents failed:", e && e.message)
        ));
      } else {
        console.log("autoCreateEvents: skipped — AUTO_CREATE_ENABLED is false");
      }
    }
    // Daily feed-health check → Lark: 15:00 MYT (07:00 UTC). Dormant until LARK_FEED_WEBHOOK is set.
    if (hourUTC === 7) {
      ctx.waitUntil(feedCheckReport(env).then(
        (r) => console.log("feedCheckReport:", JSON.stringify(r)),
        (e) => console.error("feedCheckReport failed:", e && e.message)
      ));
      // Roster auto-assign: after the feed lands, deal any NEW Tier V entrants (no owner)
      // evenly across agents. Additive only — never moves an existing owner. Isolated.
      ctx.waitUntil(autoAssignRosters(env, "cron").then(
        (r) => console.log("autoAssignRosters:", JSON.stringify(r)),
        (e) => console.error("autoAssignRosters failed:", e && e.message)
      ));
    }
    // Daily auto-assign → contact_log: 16:00 MYT (08:00 UTC), an hour after the feed lands
    // so the deal is built on today's data. Gated on AUTO_ASSIGN_ENABLED — off by default,
    // so this ships dormant. Isolated: a failure here cannot touch autoOutcomes.
    if (hourUTC === 8) {
      if (AUTO_ASSIGN_ENABLED) {
        ctx.waitUntil(runAutoAssign(env).then(
          (r) => console.log("runAutoAssign:", JSON.stringify(r)),
          (e) => console.error("runAutoAssign failed:", e && e.message)
        ));
      } else {
        console.log("runAutoAssign: skipped — AUTO_ASSIGN_ENABLED is false");
      }
    }
  },
};

// Every request goes through route(); a successful change then bumps its area's live counter (worker/work/pulse.js).
export default {
  async fetch(request, env, ctx) {
    const res = await worker.route(request, env, ctx);
    liveBump(request, res, env, ctx);
    return res;
  },
  scheduled: (event, env, ctx) => worker.scheduled(event, env, ctx),
};
