// Shared state for the Contact + Players pages: board plumbing, contact map, 48h cooldown, Grace status, filters, drill.
// Reads exactly what the live Queue reads (ctx = the values App.jsx hands Queue today).
import { can } from "../perms.js";
import { useEffect, useMemo, useState } from "react";
import { api, ckey, BRAND_ORDER } from "../../App.jsx";
import { emptyFilters, filterRows } from "./logic.js";

export function useDailyBase(ctx) {
  const snap = ctx.board?.snapshot_date || "";
  const data = ctx.teamData || ctx.data || [];
  const contacts = ctx.contacts || ctx.board?.contacts || [];
  const health = ctx.board?.health || [];
  const team = ctx.board?.team || [];
  const me = ctx.me || {};
  const isAdmin = can(me, "assign.manage") || can(me, "teams.all");   // sees every agent's queue and may assign
  const readOnly = !!(ctx.readOnly || ctx.isPast);
  const brandOrder = ctx.teamBrands || BRAND_ORDER;

  const contactMap = useMemo(() => {
    const m = {};
    contacts.filter((c) => c.snapshot_date === snap).forEach((c) => (m[`${c.player_key}|${c.brand}|${c.tier_segment}`] = c));
    return m;
  }, [contacts, snap]);
  // 48h cooldown: contacted within the last 48h, do NOT re-contact (anti-spam). Distinct from churn-risk COOLING.
  const cooldownSet = useMemo(() => {
    const s = new Set(), cutoff = Date.now() - 48 * 3600 * 1000;
    contacts.forEach((c) => {
      if (c.status && c.status !== "SKIPPED" && new Date(c.updated_at + "Z").getTime() > cutoff) s.add(`${c.player_key}|${c.brand}|${c.tier_segment}`);
    });
    return s;
  }, [contacts]);
  const staleBrands = useMemo(() => health.filter((h) => h.last_fed !== snap), [health, snap]);
  const lagBrands = useMemo(() => {
    const withDep = health.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.newest_dep || ""));
    if (withDep.length < 2) return [];
    const lead = withDep.reduce((m, h) => (h.newest_dep > m ? h.newest_dep : m), "");
    return withDep.filter((h) => h.newest_dep < lead).map((h) => ({ brand: h.brand, newest_dep: h.newest_dep, lead }));
  }, [health]);

  const saveContact = (p) => ctx.saveContact(p);
  const clearContact = (p) => ctx.clearContact(p);
  return { ctx, snap, data, contacts, health, team, me, isAdmin, readOnly, isPast: !!ctx.isPast, brandOrder, contactMap, cooldownSet, staleBrands, lagBrands, saveContact, clearContact };
}

/** Filter state + the Grace activation lookup (loaded only when a view needs it, same endpoint as the live Queue). */
export function useDailyFilters(base, { stage = null, mine = false } = {}) {
  const { ctx, snap, data, contactMap, cooldownSet, me } = base;
  const [f, setF] = useState(() => emptyFilters(mine));
  const patch = (p) => setF((s) => ({ ...s, ...p }));
  const setTog = (k, v) => setF((s) => ({ ...s, tg: { ...s.tg, [k]: v === undefined ? !s.tg[k] : v } }));
  const clearAll = () => setF(emptyFilters(false));

  const [graceSt, setGraceSt] = useState(null);   // { "username|BRAND": { a: 0|1, v, e } }
  const [graceErr, setGraceErr] = useState("");
  const graceNeeded = f.tg.gnot || f.tg.gact || f.tg.gwatch || f.classes.includes("GRACE");
  useEffect(() => {
    if (!graceNeeded) return;
    let alive = true;
    setGraceErr("");
    api("/api/rtn/grace-status").then((d) => { if (alive) setGraceSt(d.status || {}); })
      .catch((e) => { if (alive) { setGraceSt(null); setGraceErr(e.message || "Could not read the Grace table"); } });
    return () => { alive = false; };
  }, [graceNeeded, snap]);
  const graceOf = (r) => (graceSt ? graceSt[`${String(r.player_key).toLowerCase()}|${r.brand}`] || null : null);

  // Deep links: from a KPI card / the alert bell (ctx.drill) or ctx.goto('queue', {brand}).
  useEffect(() => {
    const d = ctx.drill;
    if (!d) return;
    setF(() => {
      const n = emptyFilters(false);
      if (d.keys) { n.focusKeys = new Set(d.keys); n.focusLabel = d.label || "flagged"; }
      else if (d.brand) { n.brands = [d.brand]; if (d.tier) { n.tier = d.tier; n.tg.zero = true; } }
      return n;
    });
    ctx.setDrill && ctx.setDrill(null);
  }, [ctx.drill]);

  const env = { contactMap, cooldownSet, graceOf, me, stage };
  const rows = useMemo(() => filterRows(data, f, env), [data, f, contactMap, cooldownSet, graceSt, me, stage]);
  // rows with every filter applied except brand (and optionally stage), for the per-brand counts in menus and cards
  const poolNoBrand = useMemo(() => filterRows(data, f, env, { brand: true, stage: true }), [data, f, contactMap, cooldownSet, graceSt, me]);
  const graceTag = (r) => {
    const g = graceNeeded && graceSt ? graceOf(r) : null;
    return g ? { on: !!g.a, title: g.v } : null;
  };
  return { f, setF, patch, setTog, clearAll, graceSt, graceErr, graceNeeded, graceOf, graceTag, env, rows, poolNoBrand };
}

export const keyOf = ckey;
