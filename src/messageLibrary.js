/* ════════════════════════════════════════════════════════════════════
   C9MYR · GROUP B · MESSAGE LIBRARY  v1.0  (Fable 5 Extra)
   Single source of truth for every approach message, guard rail,
   and worklist instruction. Edit THIS file — never hardcode copy
   in App.jsx again.

   HOW IT WORKS
   buildMessage(player)      -> { title, warnings[], message }   (drawer)
   buildInstruction(player)  -> one-line plain-language row text (worklist)
   Every {variable} is resolved from the player's LIVE data at render
   time — no static example numbers anywhere. Missing data degrades
   gracefully (no "undefined", no "RM NaN").

   STRUCTURE
   1. PROVIDER_HOOKS  — reward names per provider (TC / ZY)
   2. GUARDS          — composable safety rails (RG, FRAGILE, WHALE…)
   3. TEMPLATES       — class × tier matrix, EN base (中文/BM ready)
   4. INSTRUCTIONS    — worklist one-liners per class
   5. Resolver + exports

   EDIT RULES (read MESSAGES_GUIDE.md for full guide)
   - Keep {variables} exactly as spelled in VARIABLES below.
   - Tier "V" = VVIP 4–7 (personal, Priority Support sign-off).
     Tier "3" = VVIP 1–3 (lighter, brand-team sign-off).
   - TOP_LOSS copy must stay relief-only. Never "win it back",
     never a deposit push, never urgency. This is policy, not style.
   ════════════════════════════════════════════════════════════════════ */

/* ── 1. PROVIDER HOOKS ─────────────────────────────────────────────── */
export const PROVIDER_HOOKS = {
  TC: { free: "Fortune Wheel / Golden Egg spin", rebate: "Rescue Bonus rebate" },
  ZY: { free: "Lucky Wheel spin and Plinko balls", rebate: "instant Cashback" },
};

/* Brand -> provider map (keep in sync with BRANDS in App.jsx) */
export const BRAND_PROVIDER = {
  LPK777: "TC", ACE33: "TC",
  BM69: "ZY", HOT321: "ZY", RM68: "ZY", SK69: "ZY", JK32: "ZY", ZAS36: "ZY",
  // Team A
  JOM99: "TC", EZ96: "ZY", PP96: "TC", BIG321: "ZY", FUN36: "ZY", JUS22: "ZY", YES82: "ZY",
  // Team C
  SPIN321: "TC", MY36: "TC", VS96: "ZY", ONG66: "ZY", RUSH33: "ZY", MAX39: "ZY", OMG67: "TC", AC69: "ZY",
};

/* ── 2. GUARDS (composable — a player can trigger several) ─────────── */
export const GUARDS = {
  RG_TOPLOSS:
    "RG GUARD: relief framing ONLY. Never \u201cwin it back\u201d, never a deposit push, no countdowns.",
  FRAGILE:
    "FRAGILE: reactivated \u226414d \u2014 soften everything: smaller ask, warmer tone, zero pressure.",
  WHALE:
    "WHALE: top-value Tier V \u2014 personal handling only, never a generic blast.",
  RESTRAINT:
    "RESTRAINT: do not contact. Rewarding silence or normal play trains bonus-begging.",
  PAST_DATE:
    "HISTORICAL VIEW: this is a past snapshot \u2014 read-only, do not action from old data.",
};

/* ── 3. TEMPLATES — class × tier, EN base (add ZH/BM as new lang keys) ──
   Variables available (resolved live):
   {name} {brand} {lossToday} {depositToday} {withdrawToday}
   {dsld} {graceDate} {graceDays} {freeHook} {rebateHook} {signoff}     */
export const TEMPLATES = {
  EN: {
    GRACE: {
      title: "Tier deadline \u2014 concrete, time-locked ask",
      V: "Hi {name}, this is [CS] from {brand}. Your VVIP status window closes on {graceDate} \u2014 you are {graceDays} day(s) from the deadline and very close to keeping it. I can help you lock it in today so every benefit stays protected. Tell me when you are ready and I will handle it personally. \u2014 {signoff}",
      "3": "{name}, your {brand} VIP status expires on {graceDate} ({graceDays} day(s) left). Top up before the deadline to keep your tier benefits active. \u2014 {signoff}",
    },
    TOP_LOSS: {
      title: "Relief / rebate \u2014 care tone, zero urgency",
      V: "Hi {name}, [CS] here from {brand}. Rough session today \u2014 it happens to the best. No pressure at all: {aRebate} has been credited to your account as a cushion, yours whenever you feel like it. Take your time. \u2014 {signoff}",
      "3": "{name}, your {brand} {rebateHook} has been credited \u2014 no conditions, it is yours. Whenever you are ready, we are here. \u2014 {signoff}",
    },
    TOP_DEP: {
      title: "Recognition \u2014 relationship, not bonus",
      V: "{name}, congratulations on a great run at {brand} today \u2014 genuinely well played. Winners get remembered here: I have flagged your account for VIP attention; anything you want arranged, tell me directly. \u2014 {signoff}",
      "3": "Big day, {name}! {brand} luck looks good on you. Your {freeHook} is loaded \u2014 come see if the streak holds. \u2014 {signoff}",
    },
    BLOCKED: {
      title: "Funding nudge \u2014 they never left; NOT a win-back",
      V: "Hi {name}, good to see you playing at {brand} this week. Quick one \u2014 is everything okay on the deposit side? If there is any payment issue I can sort it out directly. I am also holding a top-up reward for your next deposit. \u2014 {signoff}",
      "3": "{name}, your luck is warming up at {brand} \u2014 top up today and grab a reward on your next deposit. Keep the streak alive. \u2014 {signoff}",
    },
    DSLD7: {
      title: "Early win-back \u2014 the habit just broke; warm and easy",
      V: "Hi {name}, this is [CS] from {brand}. We noticed you have been away {dsld} days \u2014 just checking everything is okay on your side. If anything did not go smoothly last time, tell me directly and I will settle it personally. Your VIP benefits are still active and your {freeHook} is waiting. \u2014 {signoff}",
      "3": "Hi {name}, we miss you at {brand}! Your {freeHook} is still waiting for you. Come back anytime \u2014 we kept your spot. \u2014 {signoff}",
    },
    DSLD14: {
      title: "Win-back \u2014 relationship first, reward second",
      V: "Hi {name}, [CS] from {brand} here. It has been {dsld} days and your seat is still yours \u2014 nothing has changed on our side. If something put you off last time, I would honestly like to know so I can fix it. Your benefits remain active and your {freeHook} is ready when you are. \u2014 {signoff}",
      "3": "{name}, it has been a while \u2014 {brand} kept your {freeHook} ready. One tap and you are back in the game. \u2014 {signoff}",
    },
    DSLD30: {
      title: "Deep win-back \u2014 door open, lowest-cost reward, no chase",
      V: "Hi {name}, [CS] from {brand}. No sales talk \u2014 just letting you know your VIP standing is still protected after {dsld} days and the door is open. If you ever feel like an easy session, your {freeHook} is loaded. Whatever you decide, we appreciate having you. \u2014 {signoff}",
      "3": "{name}, your {brand} account still remembers you \u2014 {freeHook} loaded, no strings. Drop by whenever it feels right. \u2014 {signoff}",
    },
    COOLING: {
      title: "Cooling whale \u2014 prevent the churn before it starts",
      V: "Hi {name}, this is [CS] from {brand}. I noticed it has been {dsld} quiet days \u2014 just checking in personally to make sure everything is good on your side. No pressure at all: if anything felt off last time, tell me and I will sort it directly. Your VIP benefits are fully active and your {freeHook} is here whenever you feel like it. \u2014 {signoff}",
      "3": "Hi {name}, this is [CS] from {brand}. I noticed it has been {dsld} quiet days \u2014 just checking in personally to make sure everything is good on your side. No pressure at all: if anything felt off last time, tell me and I will sort it directly. Your VIP benefits are fully active and your {freeHook} is here whenever you feel like it. \u2014 {signoff}",
    },
    WATCH: {
      title: "No contact \u2014 observe",
      V: "(No message. Quiet {dsld} day(s) is inside normal rhythm \u2014 contacting now trains \u201cskip a day, get a bonus\u201d. Escalates automatically if the gap stretches.)",
      "3": "(No message. Quiet {dsld} day(s) is inside normal rhythm \u2014 contacting now trains \u201cskip a day, get a bonus\u201d. Escalates automatically if the gap stretches.)",
    },
    HEALTHY: {
      title: "No contact \u2014 restraint is the action",
      V: "(No message. Healthy players who receive scheduled rewards learn to expect payment for behavior they already do free.)",
      "3": "(No message. Healthy players who receive scheduled rewards learn to expect payment for behavior they already do free.)",
    },
  },
};

/* ── 4. WORKLIST INSTRUCTIONS — one-line row text per class ────────── */
export const INSTRUCTIONS = {
  EN: {
    GRACE: "Tier expires in {graceDays}d \u2014 push top-up today",
    TOP_LOSS: "Lost today \u2014 send relief, never push deposit",
    TOP_DEP: "Deposited and winning \u2014 congratulate",
    BLOCKED: "Playing but not depositing {dsld}d \u2014 funding nudge",
    DSLD7: "No deposit {dsld} days \u2014 early win-back",
    DSLD14: "No deposit {dsld} days \u2014 win-back",
    DSLD30: "No deposit {dsld} days \u2014 deep win-back, cheapest reward",
    WATCH: "Quiet {dsld}d \u2014 observe, do not contact",
    COOLING: "\u2744 Whale quiet {dsld}d \u2014 last chance before cold: gentle check-in, no deposit push",
    HEALTHY: "Active and funding \u2014 leave alone",
  },
};

/* ── 5. RESOLVER ───────────────────────────────────────────────────── */
const looksNumeric = (s) => !s || /^[\d.]+$/.test(String(s).trim());
const fmtRM = (n) =>
  n == null || isNaN(Number(n))
    ? ""
    : "RM " + Number(n).toLocaleString("en-MY", { maximumFractionDigits: 0 });

function resolveName(p) {
  if (!looksNumeric(p.addressing)) return p.addressing;
  if (!looksNumeric(p.username)) return p.username;
  return "Boss";
}

function resolveVars(p) {
  const prov = BRAND_PROVIDER[p.brand] || "ZY";
  const hooks = PROVIDER_HOOKS[prov];
  const isV = p.tier_segment === "V";
  const rebate = hooks.rebate;
  return {
    name: resolveName(p),
    brand: p.brand || "",
    lossToday: (p.win_loss ?? 0) < 0 ? fmtRM(Math.abs(p.win_loss)) : "",
    depositToday: fmtRM(p.daily_deposit),
    withdrawToday: fmtRM(p.daily_withdraw),
    dsld: p._dsld != null ? String(p._dsld) : "a few",
    graceDate: p.grace_end_date || "the deadline",
    graceDays: p._graceDays != null && p._graceDays >= 0 ? String(p._graceDays) : "a few",
    freeHook: hooks.free,
    rebateHook: rebate,
    aRebate: (/^[aeiou]/i.test(rebate) ? "an " : "a ") + rebate, // "an instant Cashback"
    signoff: isV ? `${p.brand} / Priority Support` : `${p.brand} Team`,
  };
}

function interpolate(str, vars) {
  return String(str)
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null && vars[k] !== "" ? vars[k] : ""))
    .replace(/\s{2,}/g, " ")      // collapse doubles left by empty vars
    .replace(/\s+([,.!?])/g, "$1") // tidy space-before-punctuation
    .trim();
}

function collectGuards(p) {
  const w = [];
  if (p._cls === "TOP_LOSS") w.push(GUARDS.RG_TOPLOSS);
  if (p._fragile) w.push(GUARDS.FRAGILE);
  if (p._whale) w.push(GUARDS.WHALE);
  // A cooling whale (Tier V, quiet 5–6d) is a prevention target, NOT a restraint case.
  if ((p._cls === "WATCH" || p._cls === "HEALTHY") && !p._cooling) w.push(GUARDS.RESTRAINT);
  return w;
}

/* Drawer payload: { title, warnings[], message } */
export function buildMessage(p, lang = "EN") {
  const book = TEMPLATES[lang] || TEMPLATES.EN;
  const t = (p._cooling && book.COOLING) || book[p._cls] || book.HEALTHY;
  const tier = p.tier_segment === "V" ? "V" : "3";
  const vars = resolveVars(p);
  return {
    title: t.title,
    warnings: collectGuards(p),
    message: interpolate(t[tier] ?? t.V, vars),
  };
}

/* Worklist one-liner */
export function buildInstruction(p, lang = "EN") {
  const set = INSTRUCTIONS[lang] || INSTRUCTIONS.EN;
  return interpolate(set[p._cooling ? "COOLING" : p._cls] || set.HEALTHY, resolveVars(p));
}

/* ── 6. MEMORY HOOKS — "who this person is", from data we already hold ──
   Real facts a CS can drop into a personal message so a high roller feels
   KNOWN, not processed. Every hook is derived live from the player's row;
   missing/empty data is silently skipped (never shows a half-fact).
   Returns an ordered array of { icon, text } — highest relationship value
   first. Render order = importance order.                                */

// Compact money for big lifetime numbers: 2_400_000 -> "RM 2.4M", 38_000 -> "RM 38k"
const fmtBig = (n) => {
  const v = Number(n);
  if (n == null || isNaN(v) || v === 0) return "";
  const a = Math.abs(v);
  if (a >= 1e6) return "RM " + (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + "M";
  if (a >= 1e3) return "RM " + Math.round(v / 1e3) + "k";
  return fmtRM(v);
};

// member_days (integer) -> human tenure
const fmtTenure = (d) => {
  const n = Number(d);
  if (d == null || isNaN(n) || n < 0) return "";
  if (n < 31) return `${n}-day member — still new`;
  if (n < 365) return `${Math.round(n / 30)}-month member`;
  return `${(n / 365).toFixed(1)}-year member`;
};

/* ── 6b. DEEP MEMORY HOOKS — facts that need HISTORY, not just today ────
   Fed by GET /api/rtn/history (a player's chronological daily series).
   Surfaces the moments that make a whale feel truly known: their best
   day, their biggest top-up, and the standout "withdrew then went quiet"
   signal. Grows richer as snapshot history accumulates; with <2 days of
   data it simply returns nothing.
   series row: { snapshot_date, daily_deposit, daily_withdraw, win_loss }  */
const dayDiff = (from, to) => {
  if (!from || !to) return null;
  const a = new Date(from + "T00:00:00Z"), b = new Date(to + "T00:00:00Z");
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
};
const agoTxt = (date, today) => {
  const n = dayDiff(date, today);
  if (n == null) return date || "";
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n}d ago`;
};

export function buildHistoryHooks(series, today) {
  if (!Array.isArray(series) || series.length < 2) return [];
  const out = [];

  // Best winning day and biggest top-up across tracked history
  let best = null, bigDep = null;
  for (const r of series) {
    const wl = Number(r.win_loss);
    if (!isNaN(wl) && wl > 0 && (!best || wl > Number(best.win_loss))) best = r;
    const dp = Number(r.daily_deposit);
    if (!isNaN(dp) && dp > 0 && (!bigDep || dp > Number(bigDep.daily_deposit))) bigDep = r;
  }
  if (best) out.push({ icon: "🏆", text: `Best day +${fmtBig(best.win_loss)} (${agoTxt(best.snapshot_date, today)})` });
  if (bigDep) out.push({ icon: "💎", text: `Biggest top-up ${fmtBig(bigDep.daily_deposit)} (${agoTxt(bigDep.snapshot_date, today)})` });

  // The standout signal: last withdrawal with no deposit since — "cashed out, then quiet"
  for (let i = series.length - 1; i >= 0; i--) {
    const w = Number(series[i].daily_withdraw);
    if (!isNaN(w) && w > 0) {
      const depositedSince = series.slice(i + 1).some((r) => Number(r.daily_deposit) > 0);
      if (!depositedSince) {
        // tone:"warn" marks this as a churn signal (styled distinctly in the drawer),
        // decoupled from the icon so copy edits can't silently break the warning.
        out.push({ icon: "📤", tone: "warn", text: `Withdrew ${fmtBig(series[i].daily_withdraw)} on ${series[i].snapshot_date}, none since` });
      }
      break;
    }
  }

  return out.slice(0, 3);
}

/* ── 7. OPENING ANGLES — the "ways in", per class ──────────────────────
   VIP retention is NOT a copy-paste job. Instead of one finished message,
   give the CS 2–3 distinct doors to open the conversation — each a
   different emotional approach — and let them write it in their OWN voice
   using the Memory Hooks above. The full template (TEMPLATES) survives as
   a collapsed example for anyone who freezes. No-contact classes return
   none — for WATCH/HEALTHY, restraint IS the action.
   Each angle: { icon, label, hint }.                                     */
export const ANGLES = {
  GRACE: [
    { icon: "🤝", label: "Personal heads-up", hint: "You personally want to help them lock the tier before it lapses." },
    { icon: "⏰", label: "Concrete deadline", hint: "State the exact date and days left — make it easy to act today." },
    { icon: "🛡", label: "Protect what they have", hint: "Frame it as keeping benefits they already enjoy, not losing out." },
  ],
  TOP_LOSS: [
    { icon: "🫂", label: "Acknowledge the day", hint: "Name the rough session plainly, human to human. No spin, no upsell." },
    { icon: "🎁", label: "Quiet relief", hint: "Lead with the rebate already credited — a cushion, zero conditions." },
    { icon: "☕", label: "No-agenda check-in", hint: "Just check they're okay. No ask at all. Relationship over revenue." },
  ],
  TOP_DEP: [
    { icon: "🎉", label: "Celebrate the win", hint: "Congratulate genuinely — reference the good run today." },
    { icon: "👑", label: "VIP recognition", hint: "Make them feel remembered — flag the account for personal attention." },
    { icon: "🍀", label: "Keep the streak", hint: "Light invite to ride the momentum — easy, no pressure." },
  ],
  BLOCKED: [
    { icon: "🔧", label: "Payment check", hint: "Ask if there's a deposit issue you can sort out directly." },
    { icon: "🎁", label: "Next-deposit reward", hint: "Mention a reward waiting on their next top-up — they never left." },
    { icon: "👋", label: "Warm noticing", hint: "Acknowledge you see them playing this week — keep it friendly." },
  ],
  DSLD7: [
    { icon: "☕", label: "Casual check-in", hint: "Light 'haven't seen you lately' — warm, low effort, no pressure." },
    { icon: "🎁", label: "Reward still waiting", hint: "Their spin/bonus is still there — a gentle reason to drop by." },
    { icon: "❓", label: "What happened", hint: "Gently ask if anything didn't go smoothly last time." },
  ],
  DSLD14: [
    { icon: "🪑", label: "Seat still yours", hint: "Reassure them nothing changed — their standing is intact." },
    { icon: "❓", label: "Honest win-back", hint: "Ask what put them off — you genuinely want to fix it." },
    { icon: "🎁", label: "Easy return", hint: "One tap back in, reward ready — remove every bit of friction." },
  ],
  DSLD30: [
    { icon: "🚪", label: "Door open, no chase", hint: "No sales talk — just let them know their VIP standing is protected." },
    { icon: "🎁", label: "Lowest-cost nudge", hint: "Cheapest reward loaded, no strings — only if they feel like it." },
    { icon: "🙏", label: "Appreciation", hint: "Thank them for being a player, whatever they decide. Leave it warm." },
  ],
};

/* Ordered angles for a player's class — empty for no-contact classes */
export function buildAngles(p) {
  return ANGLES[p._cls] || [];
}

export function buildHooks(p) {
  const hooks = [];

  // 1. Tenure — how long this relationship has existed
  const tenure = fmtTenure(p.member_days);
  if (tenure) hooks.push({ icon: "⏳", text: tenure });

  // 2. Lifetime value — proof of who they are (whale credibility)
  const ltv = fmtBig(p.lifetime_deposit);
  if (ltv) hooks.push({ icon: "👑", text: `${ltv} deposited all-time` });

  // 3. Typical deposit size — so the CS pitches at the right altitude
  const cnt = Number(p.lifetime_deposit_count);
  const tot = Number(p.lifetime_deposit);
  if (cnt >= 3 && tot > 0) {
    hooks.push({ icon: "💵", text: `Usually deposits ~${fmtBig(tot / cnt)}` });
  }

  // 4. This month's rhythm — are they active right now?
  const mc = Number(p.monthly_deposit_count);
  if (mc > 0) {
    const amt = fmtBig(p.monthly_deposit);
    hooks.push({ icon: "📅", text: `${mc} deposit${mc === 1 ? "" : "s"} this month${amt ? ` · ${amt}` : ""}` });
  }

  // 5. Last deposit — a concrete moment to reference
  if (p._dsld === 0) {
    hooks.push({ icon: "✅", text: "Deposited today" });
  } else if (p.last_deposit_date) {
    const ago = p._dsld != null ? ` · ${p._dsld}d ago` : "";
    hooks.push({ icon: "💤", text: `Last deposit ${p.last_deposit_date}${ago}` });
  }

  // 6. Tier movement — momentum, a natural thing to acknowledge
  if (p.previous_tier && p.tier && p.previous_tier !== p.tier) {
    hooks.push({ icon: "↕", text: `Tier moved: ${p.previous_tier} → ${p.tier}` });
  }

  return hooks;
}
