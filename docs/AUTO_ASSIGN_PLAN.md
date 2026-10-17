# Auto-Assign Plan — Group B (Team B)

**Goal:** the system automatically hands each PIC a fair, ranked daily list of *who to contact*, so everyone has an equal shot at their reactivation KPI. Replaces today's manual, uneven picking.

*Status: PLAN — not built yet. Numbers below are measured from the live DB, snapshot 2026-08-09.*

---

## 1. Locked decisions

| Question | Decision |
|---|---|
| What's "fair" | **Same mix** — spread whales, losses, and each idle band evenly. Not just equal headcount. |
| Brand skills | **Any PIC can take any brand.** |
| Continuity | **Sticky** — a player stays with the same PIC day to day until recovered or dropped. |
| Who is reachable | **Telegram only** — a player must have a link in `player_telegram`. |
| Floor | Only players **2+ days with no deposit** (`dsld >= 2`). |
| Priority order | **Whales/cooling first, then by KPI value (7–29 day idle), then shallow, churn last (light touch).** |
| Daily capacity | **~10 per PIC per day** (tunable). |
| Re-contact rhythm | After a contact, the player **rests 3 days**, then returns to the top if still quiet. |
| PICs | brix, jason, raven, skylar, trevor (5). Admins (aldo, c9myr) manage, no pile. |

---

## 2. What the data showed (why the plan looks like this)

- **Reachability is the real ceiling: only 27%** of Team B players have a Telegram link (Tier 3: 22%, Tier V: 42%). 73% can't be contacted, so they can never score. **Growing the Telegram DB is the single biggest KPI lever — a data/ops job, not code.**
- **Conversion by idle depth** (measured, ~60 days, KPI windows):
  - 7–13 days idle → **65%** come back · weight 0.50 → **~33 pts / 100 contacts** ⭐
  - 14–29 days → **42%** · weight 0.75 → **~29 pts / 100** ⭐
  - 1–6 days → 65% · weight 0.10 → ~7 pts / 100 (converts well, barely scores)
  - 30+ days (churn) → **8%** · weight 1.00 → ~8 pts / 100 (full weight, rarely returns)
- **The money zone is 7–29 day idle.** Shallow barely scores; churn barely converts.
- **Standing reachable pool (2D+):** ~282 players ≈ **56 per PIC**. At ~10/day this clears in a week and stays clear; the ~65% money-zone conversion drains it fast.

---

## 3. Priority ladder (top = contacted first)

1. ❄️ **Cooling whale** — Tier V, top-value, quiet 5–6 days
2. 🐋 **Whale** — Tier V, top-value, 2+ days quiet
3. **7–13 day idle** (best KPI value)
4. **14–29 day idle** (best KPI value)
5. **3–6 day idle**
6. **2 day idle** (floor)
7. **30+ day churn** — light touch only, lowest

Fairness deal: split **each rung evenly** across the 5 PICs, so everyone gets the same number of whales, same number of money-zone players, etc.

---

## 4. Daily flow

1. **Feed lands (~15:00 MYT).** Build the pool: Telegram-reachable, `dsld >= 2`.
2. **Rank** every player by the ladder above.
3. **Sticky:** keep players already assigned to an active PIC.
4. **Deal new players** to the lightest PIC in each rung (keeps the mix even).
5. **Cadence filter:** hide anyone contacted in the last 3 days (resting).
6. **Cap** each PIC's live list at ~10, filled top-down.
7. Write `assigned_to` into `contact_log` (status `ASSIGNED`, `updated_by='auto'`). **Never overwrite a PIC's manual status.**
8. PIC opens **Today** → their ranked list is ready.

**The rhythm:** contact ~10/day → each rests 3 days → still-quiet ones resurface. ~65% of money-zone players redeposit after a touch and drop off, so the list keeps draining.

---

## 5. Fixes to the flaws we found

**#2 — Recovery window 14 → 7 days.** ✅ **Done in code** (`worker/index.js`, `autoOutcomes`). The KPI only counts a comeback within 7 days for 7+ idle players; the app was crediting up to 14, so in-app scores read too high. *(Needs a Worker deploy to go live — pending your approval.)*

> **Update 2026-08-13 — the +1 day is now in code.** `AA_LAG_DAYS = 1` ages every idle count in `computeAutoAssign` before ranking, and the Assigned screen shows that same aged number (`_aaDsld`) so the band always matches the days beside it. **Only auto-assign is adjusted** — the rest of the console (classification, cold pile, dashboard, reports) still shows raw DSLD, so the two differ by a day on purpose. Making it app-wide is a separate decision with a much bigger blast radius.

**#3 — The 1-day data lag (honest version).** The feed is always a day behind (snapshot "Aug 9" = activity through Aug 8; verified: 0 same-day deposits). We **cannot** know today's deposits until tomorrow's feed — no code fixes that. What we *will* do:
- **Add +1 day** to every idle count (treat the data as one day older) — fixes band/window boundary errors.
- **Drop players who already returned** *through yesterday* before assigning — removes most wasted touches.
- **Keep messages "check-in" style**, so even a blind-spot touch on someone who just returned still lands well.
- **Accept the 1-day blind spot.** The only true cure is fresher data from the source (SPV/feeder timing).

---

## 6. Edge-case rules (decided 2026-08-10)

- **No-response give-up:** after **3** no-response touches (~9 days at the 3-day cadence), **park** the player — drop them from the active list so the slot frees for someone winnable.
- **Day off / leave:** when a PIC is off, **hold their pile** — their players wait untouched until they return; nothing is redistributed. (Simple; at-risk VIPs may be missed on off days — one-line switch to change later.)

## 6b. Decisions added 2026-08-11

- **Telegram-bind is absolute.** Every assigned player must have a `player_telegram` URL. No exceptions — an unreachable player never enters the pool, on any rung. (Already enforced by the inner join in `computeAutoAssign`.)
- **Carry-over.** Whatever a PIC does not finish out of their 30 **rolls to the next day**, still theirs. Same for a PIC on a rest/off day — the whole untouched pile waits for them. An untouched player is **not** re-dealt to another PIC and does **not** enter the 3-day rest (rest only starts after a real touch). New players only fill the empty slots under the cap.
  - *Build note:* true carry-over needs **Phase 2** to write `assigned_to`. Phase 1 re-deals from scratch on every call, so ownership is not remembered between days.
- **Open to all agents.** The Assigned view and `GET /api/rtn/auto-assign` should no longer be managers-only. Every agent sees their own list; managers can still switch between PICs.

---

## 7. Build phases

- **Phase 1 — Preview only (writes nothing).** Compute the assignment + an admin dry-run screen showing who'd go to whom and each PIC's mix. You verify fairness. *(Already demoed live on the 2026-08-09 pool.)*
- **Phase 2 — Go live behind an ON/OFF switch (starts OFF).** ✅ **Built 2026-08-12, shipped dormant.**
  - Master switch `AUTO_ASSIGN_ENABLED` in `worker/index.js` — `false` today. Flip + redeploy to go live; flip back to kill instantly.
  - Cron slot **16:00 MYT (08:00 UTC)**, an hour after the feed lands. Logs a skip while off.
  - `runAutoAssign()` deals **all three teams** and writes one `ASSIGNED` row per player, `updated_by='auto'`.
  - **Never overwrites a human.** The upsert only updates rows auto itself wrote that nobody has acted on. `contacted_at` is left to the first human touch.
  - **Carry-over is live through this.** The sticky lookup reads yesterday's auto rows back, so an untouched player keeps their PIC. Sticky now expires after `AA_STICKY_DAYS = 14` — without an expiry every player ever dealt would be owned forever and the fair deal would seize up.
  - Test without writing: `POST /api/rtn/auto-assign/run?dry=1` (managers). Same function the cron calls.
  - **Day-off now genuinely holds** (fixed 2026-08-13). A player whose owner is off is parked in a `held` bucket and dealt to nobody — previously they fell through to the redistribute path, which handed an absent PIC's players to everyone else, the exact opposite of the rule. The response reports `held: { pic: count }`.
  - **Still open:** day-off has no *input* yet. `off` is a parameter but no UI or table sets it, so the cron runs with nobody marked off.
- **Phase 3 — Tune (1 week).** Watch fairness + KPI capture; adjust cap, cadence, and order.

## 8. Guardrails

Live production. Phase 1 writes nothing. Phase 2 stays behind a switch. **Explicit approval before any Worker/Pages deploy.** No destructive SQL, no schema rewrites — `contact_log` already holds assignments.

## Related

- [[ACT_NOW_PRIORITY_SPEC]] — priority rule
- [[NOTICE_ASSIGNED_TAB]] — launch notice
- [[NOTICE_CONTACT_PARITY]] — fresh-first update
- [[HANDOFF]] — deep reference
