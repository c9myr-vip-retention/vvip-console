/* ════════════════════════════════════════════════════════════════════
   GROUP B · REPORT PHRASE BOOK  v1
   Every sentence the Daily report writes in its analysis (sections 2-5).
   Edit wording HERE — never hardcode report copy in App.jsx.

   HOW IT WORKS
   phrase(key, vars, seed) -> one sentence.
   - Each key has several wordings. The pick is fixed for a given day +
     key + brand, so pressing the button twice gives the same report,
     and the next day reads differently.
   - {variables} are filled from the numbers the report already
     calculated and checked. The phrase book never does maths.
   - A key with no wordings (a situation the code spotted but nobody
     has written words for yet) prints a plain fallback that still
     shows the numbers, and is listed by newPatterns() so the report
     can flag it. Add wordings for it here.

   EDIT RULES
   - Every wording of a key MUST use the same {variables}. The check
     at the bottom of this file throws on load if one doesn't.
   - Keep numbers in. A wording that drops a number hides data.
   - Plain, short sentences. No hype, no blame, no guesses about why.
   ════════════════════════════════════════════════════════════════════ */

export const REPORT_PHRASES = {
  /* ── Deposit vs normal (7-day average) ─────────────────────────────── */
  dep_up_tier: [
    "{brand} Tier {tier}: deposit {pct}% above its 7-day average ({today} vs {avg}, +{gap})",
    "{brand} Tier {tier} beat its normal day by {pct}% ({today} vs a 7-day average of {avg}, +{gap})",
    "{brand} Tier {tier} is running {pct}% above normal: {today} against {avg} on average (+{gap})",
    "Strong day for {brand} Tier {tier}: {today}, which is +{gap} ({pct}%) over its 7-day average of {avg}",
  ],
  dep_up_both: [
    "{brand}: deposit {pct}% above its 7-day average ({today} vs {avg}), both tiers",
    "{brand} is up in both tiers: {today} against a 7-day average of {avg} ({pct}% above)",
    "Both tiers of {brand} beat normal: {today} vs {avg} on average, {pct}% above",
  ],
  dep_down_tier: [
    "{brand} Tier {tier}: deposit {pct}% below its 7-day average ({today} vs {avg}, −{gap})",
    "{brand} Tier {tier} is {pct}% under its normal day ({today} vs a 7-day average of {avg}, −{gap})",
    "{brand} Tier {tier} came in at {today}, −{gap} ({pct}%) below its 7-day average of {avg}",
    "Weak day for {brand} Tier {tier}: {today} against {avg} on average (−{gap}, {pct}% below)",
  ],
  dep_down_both: [
    "{brand}: deposit {pct}% below its 7-day average ({today} vs {avg}), both tiers",
    "{brand} is down in both tiers: {today} against a 7-day average of {avg} ({pct}% below)",
    "Both tiers of {brand} fell short of normal: {today} vs {avg} on average, {pct}% below",
  ],
  tier_down_other_fine: [
    "Tier {tier} deposit {pct}% below its 7-day average ({today} vs {avg}); Tier {other} is close to normal ({otherPct})",
    "The drop is in Tier {tier}: {today} vs {avg} on average ({pct}% below). Tier {other} is near normal ({otherPct})",
    "Tier {tier} is {pct}% under normal ({today} vs {avg}), while Tier {other} stays close to normal ({otherPct})",
  ],
  tier_down_other_down: [
    "Tier {tier} deposit {pct}% below its 7-day average ({today} vs {avg}); Tier {other} also down ({otherPct})",
    "Both tiers are under normal: Tier {tier} {pct}% below ({today} vs {avg}), Tier {other} {otherPct}",
    "Team-wide dip: Tier {tier} is {pct}% below normal ({today} vs {avg}) and Tier {other} is {otherPct}",
  ],
  none_up: [
    "No big moves above normal today",
    "Nothing clearly above normal today",
    "No brand beat its normal day by a big margin today",
  ],
  none_down: [
    "No big moves below normal today",
    "Nothing clearly below normal today",
    "No brand fell far below its normal day today",
  ],

  /* ── Retention (vs same day last month) ───────────────────────────── */
  ret_up: [
    "{brand}: retention up {pts} pts vs last month ({was}% → {now}%)",
    "{brand} retention improved {pts} pts on last month, {was}% to {now}%",
    "{brand} is keeping more players: retention {now}%, up {pts} pts from {was}% last month",
  ],
  ret_down: [
    "{brand}: retention down {pts} pts vs last month ({was}% → {now}%)",
    "{brand} retention slipped {pts} pts on last month, {was}% to {now}%",
    "{brand} is keeping fewer players: retention {now}%, down {pts} pts from {was}% last month",
  ],

  /* ── Reactivation (vs previous day) ───────────────────────────────── */
  rct_up: [
    "{brand}: reactivation up from {was} to {now} players vs {date}",
    "{brand} brought back more players: {now} reactivated, up from {was} on {date}",
    "More comebacks at {brand}: {now} reactivated players vs {was} on {date}",
  ],
  rct_down: [
    "{brand}: reactivation down from {was} to {now} players vs {date}",
    "{brand} brought back fewer players: {now} reactivated, down from {was} on {date}",
    "Fewer comebacks at {brand}: {now} reactivated players vs {was} on {date}",
  ],

  /* ── Unusual situations (flag, don't explain) ──────────────────────── */
  extreme_move: [
    "{brand} Tier {tier} moved {pct}% vs normal ({today} vs {avg}). Very large swing, check the data before acting",
    "Unusual swing at {brand} Tier {tier}: {pct}% vs its 7-day average ({today} vs {avg}). Confirm the feed first",
  ],
  short_history: [
    "Not enough history yet to judge normal for: {brands}",
    "Skipped, fewer than 5 days of history: {brands}",
  ],
  data_late: [
    "Data late, not analyzed: {brands}",
    "No fresh data yet, left out today: {brands}",
  ],
  check_failed: [
    "⚠ check manually: deposit totals don't add up for this day",
  ],

  /* ── Section 3: actions & results ─────────────────────────────────── */
  contacts_down: [
    "{n} contacts, down from ~{avg} a day over the past week",
    "{n} contacts, below the usual ~{avg} a day",
    "{n} contacts logged, fewer than the past week's ~{avg} a day",
  ],
  contacts_up: [
    "{n} contacts, up from ~{avg} a day over the past week",
    "{n} contacts, above the usual ~{avg} a day",
    "{n} contacts logged, more than the past week's ~{avg} a day",
  ],
  contacts_flat: [
    "{n} contacts, in line with ~{avg} a day over the past week",
    "{n} contacts, about the usual ~{avg} a day",
  ],
  contacts_plain: [
    "{n} contacts",
  ],
  further_recover: [
    "Recoveries are checked against the next day's deposits, so the {rec} may still rise",
    "The {rec} recovered is not final yet; tomorrow's deposits can add more",
  ],
  further_auto: [
    "review the auto \"no response\" marking",
    "check the automatic \"no response\" marking",
  ],
  act_losers: [
    "{brand} Tier {tier}: check in with today's top losers ({names})",
    "Reach out to {brand} Tier {tier}'s biggest losers today ({names})",
    "Personal check-in for {brand} Tier {tier} top losers: {names}",
  ],
  act_cooling: [
    "{n} cooling whales (Tier V, quiet 5-6 days) → personal check-in; most in {top}",
    "{n} Tier V whales have gone quiet 5-6 days → check in before they go cold; most in {top}",
    "Catch {n} cooling whales (quiet 5-6 days) with a personal check-in; most in {top}",
  ],
  act_newcold: [
    "{n} players just hit 7 days quiet → Telegram broadcast",
    "{n} players went quiet for 7 days → include them in today's broadcast",
    "Broadcast to the {n} players who just reached 7 days without a deposit",
  ],
  act_none: [
    "No urgent action from today's data",
  ],

  /* ── Section 4: plan ──────────────────────────────────────────────── */
  plan_priority: [
    "{brand} · Tier {tier}{then}",
  ],
  // Only used when the priority is Tier V — cooling whales are always Tier V. {whales} = "1 cooling whale" / "4 cooling whales".
  plan_action_cool: [
    "Personal check-in with {brand} Tier {tier} top losers + its {whales}",
    "Call {brand} Tier {tier}'s top losers first, then its {whales}",
  ],
  plan_action: [
    "Personal check-in with {brand} Tier {tier} top losers",
    "Call {brand} Tier {tier}'s top losers first",
  ],
  plan_target: [
    "{brand} Tier {tier} back to its 7-day average ({today} → {avg})",
    "Lift {brand} Tier {tier} from {today} back to its normal {avg}",
  ],
  plan_followup: [
    "{date}, after the 3pm data update",
  ],
  act4_volume: [
    "Push contact volume back to ~{avg} a day",
    "Get contacts back up to ~{avg} a day",
  ],
  // Section 4 lists only what is NEW today, with names, so it doesn't repeat day after day.
  act4_comeback: [
    "{n} players came back on {date} → welcome-back, small ask; biggest: {names}",
    "Welcome back the {n} players who returned on {date}, starting with {names}",
    "{n} comebacks on {date} → warm welcome, keep the ask small; top: {names}",
  ],
  act4_v7: [
    "{n} Tier V players hit 7 days quiet today → personal approach: {names}",
    "{n} Tier V players just went 7 days without a deposit → reach out personally: {names}",
    "Personal approach for the {n} Tier V players who reached 7 days quiet today: {names}",
  ],
  act4_deadline: [
    "{n} players drop tier by tomorrow without a deposit → remind them: {names}",
    "Tier deadline tomorrow for {n} players → remind them today: {names}",
  ],
  act4_thank: [
    "Thank {name} ({brand}) for +{gap} on {date}",
    "Send a thank-you to {name} ({brand}): +{gap} on {date}",
  ],
  act4_none: [
    "Nothing new to act on from today's data",
  ],

  /* ── Section 5: system checks ─────────────────────────────────────── */
  support_tg: [
    "More Telegram links for {list}",
  ],
  concern_auto: [
    "{auto} of {n} contacts auto-marked \"no response\", which hides real results",
    "{auto} of {n} contacts were marked \"no response\" automatically, so real results are hidden",
  ],
  concern_late: [
    "Data late today: {brands}",
  ],
  concern_eng_missing: [
    "Livechat & Telegram numbers not synced for {date} yet",
  ],
  concern_new: [
    "New situation(s) without wording yet: {keys}",
  ],
};

/* ── Resolver ─────────────────────────────────────────────────────────── */
const missing = new Set();

// Small stable hash: same text in -> same number out, every time and everywhere.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    if (vars[k] === undefined || vars[k] === null) throw new Error(`missing {${k}}`);
    return String(vars[k]);
  });
}

// seed = the report date; key + brand + tier spread the picks so lines on one day differ.
export function phrase(key, vars = {}, seed = "") {
  const list = REPORT_PHRASES[key];
  if (!list || !list.length) {
    missing.add(key);
    const vals = Object.entries(vars).map(([k, v]) => `${k} ${v}`).join(", ");
    return `${key.replace(/_/g, " ")}${vals ? `: ${vals}` : ""}`;
  }
  const pick = list[hash(`${seed}|${key}|${vars.brand || ""}|${vars.tier || ""}`) % list.length];
  try { return fill(pick, vars); }
  catch (e) { return fill(list[0], vars); }   // a broken variant never blanks the line
}

// Keys used since the last reset that had no wordings; the report lists them, then resets.
export function newPatterns() { const k = [...missing]; missing.clear(); return k; }

/* ── Load-time check: every wording of a key uses the same {variables} ── */
for (const [key, list] of Object.entries(REPORT_PHRASES)) {
  const sig = (t) => [...new Set((t.match(/\{(\w+)\}/g) || []).map((m) => m.slice(1, -1)))].sort().join(", ");
  // The set most wordings agree on is the right one, so the odd one out gets named.
  const votes = {};
  list.forEach((t) => (votes[sig(t)] = (votes[sig(t)] || 0) + 1));
  const want = Object.entries(votes).sort((a, z) => z[1] - a[1])[0][0];
  list.forEach((t, i) => {
    if (sig(t) !== want) throw new Error(`reportPhrases: "${key}" wording ${i + 1} uses [${sig(t)}], expected [${want}]`);
  });
}
