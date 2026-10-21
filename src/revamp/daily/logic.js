// Pure helpers for the Contact + Players pages. Lifted from the live Queue in src/App.jsx (bands, sort, filters, stages);
// classification itself stays in classifyAll() there. Imports from App.jsx are used only inside functions (circular import).
import { ckey } from "../../App.jsx";

export const CONTACTED_ST = ["CONTACTED", "RESPONDED", "RECOVERED", "NO_RESPONSE"];
export const TOG_KEYS = ["zero", "tgonly", "notg", "gnot", "gact", "gwatch", "open"];
export const NO_TOG = { zero: false, tgonly: false, notg: false, gnot: false, gact: false, gwatch: false, open: false, my: false };

/** Stage of a player's contact row: to contact / waiting (contacted, no outcome yet) / done (recovered, no response, skipped). */
export function stageOf(con) {
  const s = con?.status;
  if (!s || s === "ASSIGNED") return "todo";
  return s === "CONTACTED" || s === "RESPONDED" ? "wait" : "done";
}
export const isActioned = (con) => !!con?.status && con.status !== "ASSIGNED";   // same "done" rule as the live Actioned counter

export function emptyFilters(mine) {
  return { brands: [], classes: [], tier: "all", q: "", agent: "all", tg: { ...NO_TOG, my: !!mine }, focusKeys: null, focusLabel: "" };
}
export const nActive = (f) => f.classes.length + TOG_KEYS.filter((k) => f.tg[k]).length + (f.tier !== "all" ? 1 : 0) + (f.focusKeys ? 1 : 0);

/** Filter rows the same way the live Queue does. skip: { brand, stage } to build per-brand / per-stage counts. */
export function filterRows(rows, f, env, skip = {}) {
  const { contactMap, cooldownSet, graceOf, me, stage } = env;
  const t = f.tg, q = (f.q || "").trim().toLowerCase();
  return rows.filter((x) => {
    const k = ckey(x), con = contactMap[k];
    if (f.focusKeys && !f.focusKeys.has(k)) return false;
    if (!skip.brand && f.brands.length && !f.brands.includes(x.brand)) return false;
    if (f.tier !== "all" && x.tier_segment !== f.tier) return false;
    if (t.gwatch) { if (!(x._graceDays != null && x._graceDays >= 0)) return false; }
    else if (f.classes.length && !f.classes.includes(x._cls)) return false;
    if (t.gnot || t.gact) {
      const g = graceOf(x);
      if (!g || (t.gact && g.a !== 1) || (t.gnot && g.a !== 0)) return false;
    }
    if (t.my && con?.assigned_to !== me?.username) return false;
    if (f.agent === "none") { if (con?.assigned_to) return false; }
    else if (f.agent !== "all" && con?.assigned_to !== f.agent) return false;
    if (t.zero && Number(x.monthly_deposit) > 0) return false;
    if (t.tgonly && !x._tg) return false;
    if (t.notg && x._tg) return false;
    if (t.open && cooldownSet.has(k)) return false;
    if (!skip.stage && stage && stage !== "all" && stageOf(con) !== stage) return false;
    if (q && !((x.username || "").toLowerCase().includes(q) || (x.uid || "").toLowerCase().includes(q) ||
      (x.addressing || "").toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Default priority order (live Queue): risk, Tier V first, biggest value first. */
export function sortPriority(rows) {
  return [...rows].sort((a, b) => {
    if (a._risk !== b._risk) return b._risk - a._risk;
    if (a.tier_segment !== b.tier_segment) return a.tier_segment === "V" ? -1 : 1;
    return (a.pnl ?? 0) - (b.pnl ?? 0);
  });
}

/** Multi-column sort for the table; sorts: [{k, dir}] (dir -1 = biggest first), falls back to priority order. */
export function sortRows(rows, sorts, env) {
  const { cooldownSet, graceWatch, graceOf, graceSt } = env;
  return [...rows].sort((a, b) => {
    if (graceWatch) {   // not activated first (still to chase), then activated, then no live Grace row; soonest deadline within each
      const ga = graceSt ? (graceOf(a) ? graceOf(a).a : 2) : 0, gb = graceSt ? (graceOf(b) ? graceOf(b).a : 2) : 0;
      if (ga !== gb) return ga - gb;
      if ((a._graceDays ?? 999) !== (b._graceDays ?? 999)) return (a._graceDays ?? 999) - (b._graceDays ?? 999);
    }
    for (const s of sorts) {
      let av, bv;
      if (s.k === "_contacted") { av = cooldownSet.has(ckey(a)) ? 0 : 1; bv = cooldownSet.has(ckey(b)) ? 0 : 1; }
      else { av = a[s.k] ?? -Infinity; bv = b[s.k] ?? -Infinity; }
      if (av !== bv) return (av < bv ? -1 : 1) * s.dir;
    }
    if (a._risk !== b._risk) return b._risk - a._risk;
    if (a.tier_segment !== b.tier_segment) return a.tier_segment === "V" ? -1 : 1;
    return (a.pnl ?? 0) - (b.pnl ?? 0);
  });
}

/** Action-first bands, exactly the live Queue's: ACT NOW = cooling + GRACE + whale/big TOP_LOSS. */
export function buildBands(filtered) {
  const losers = filtered.filter((r) => r._cls === "TOP_LOSS");
  const bigLoss = new Set([...losers].sort((a, b) => (a.win_loss ?? 0) - (b.win_loss ?? 0)).slice(0, 10).map(ckey));
  const isActLoss = (r) => r._cls === "TOP_LOSS" && ((r._whale && (r.win_loss ?? 0) <= -2000) || bigLoss.has(ckey(r)));
  const lossMag = (r) => ((r.win_loss ?? 0) < 0 ? -(r.win_loss ?? 0) : 0);
  const amt = (r) => (r._cls === "TOP_DEP" ? (r.daily_deposit ?? 0) : lossMag(r));
  const byAmt = (a, b) => amt(b) - amt(a);
  const byAct = (a, b) => {
    if (a._cooling !== b._cooling) return a._cooling ? -1 : 1;
    if (a._cooling) { if (a._dsld !== b._dsld) return b._dsld - a._dsld; return (a.pnl ?? 0) - (b.pnl ?? 0); }
    const ag = a._cls === "GRACE", bg = b._cls === "GRACE";
    if (ag !== bg) return ag ? -1 : 1;
    if (ag) return (a._graceDays ?? 9999) - (b._graceDays ?? 9999);
    return byAmt(a, b);
  };
  const byWinback = (a, b) => {
    const da = a._dsld ?? -1, db = b._dsld ?? -1;
    if (da !== db) return db - da;
    return (a.pnl ?? 0) - (b.pnl ?? 0);
  };
  const g = { ACT: [], TODAY: [], WINBACK: [], NONE: [] };
  filtered.forEach((r) => {
    if (r._cooling || r._cls === "GRACE" || isActLoss(r)) g.ACT.push(r);
    else if (r._cls === "TOP_LOSS" || r._cls === "TOP_DEP" || r._cls === "BLOCKED") g.TODAY.push(r);
    else if (r._cls === "DSLD30" || r._cls === "DSLD14" || r._cls === "DSLD7") g.WINBACK.push(r);
    else g.NONE.push(r);
  });
  g.ACT.sort(byAct); g.TODAY.sort(byAmt); g.WINBACK.sort(byWinback);
  g.NONE.sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0));
  return g;
}

/** Payload for logging a player CONTACTED today, keeping the current owner (or the actor), class and note. */
export function contactedPayload(r, snap, con, me) {
  return { snapshot_date: snap, player_key: r.player_key, brand: r.brand, tier_segment: r.tier_segment,
    status: "CONTACTED", assigned_to: con?.assigned_to || me?.username || null, class: con?.class || r._cls || null, note: con?.note || null };
}
/** Payload for handing a player to an agent; status stays as is (ASSIGNED if none). */
export function assignPayload(r, snap, con, to) {
  return { snapshot_date: snap, player_key: r.player_key, brand: r.brand, tier_segment: r.tier_segment,
    status: con?.status || "ASSIGNED", assigned_to: to, class: con?.class || r._cls || null, note: con?.note || null };
}
