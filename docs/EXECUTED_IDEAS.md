# EXECUTED IDEAS — groupb-tracker build session
What was actually shipped, **grouped by impact tier and ranked most-critical → least** within each group. Companion to HANDOFF.md, IDEAS.md, LAUNCH_CHECKLIST.md.
**Convention (keep doing this):** every new shipped change is slotted into the right tier by criticality, highest first. Critical = core workflow, data integrity, or a new capability. High = real feature/signal value. Usability & cosmetic = polish.
Last updated: 2026-09-30

---

## ✅ Shipped 2026-09-30 — Lost & gone (loss-then-no-show) + 30-day grid export + drawer money calendar

### 🟠 High — new signal: players who lost and then stopped coming

1. **Changes → Lost & gone** lists players who lost on the previous game day and did not play since (no deposit, no bet).
   Loss rule is switchable: withdraw ≤ deposit (matches the SPV "Daily Deposit & Withdrawal" sheet) or game win/loss < 0.
   Rows show a 7-day won/lost/no-play strip with "lost X of Y", days quiet, month deposit, and inline Telegram + Contacted
   actions (48h cooldown aware). Value-first sort (Tier V, then month deposit); KPI cards are clickable filters.
   Dates are real game days (snapshot − 1). Frontend only, reuses `/api/rtn/board` + `/api/rtn/history`. *Deployed (Pages, ec7541f).*
2. **⬇ 30-day grid** exports the SPV-style colored xlsx (UID, Member ID, Tier, per-day Deposit/Withdraw, totals) for one
   brand, replacing the hand-built BIG321 sheet. Uses `xlsx-js-style` (lazy-loaded). No-play days are grey, not red.
3. **Player drawer:** 14-day daily money strip + ▦ Month calendar popup (tap a day for its numbers, month totals, 3 months back).

---

## ✅ Shipped 2026-08-09 — Feed-health watchdog → Lark ("VIP RTN - Feed Watch" bot)

### 🔴 Critical — catches the "PIC forgot to update a brand" miss automatically

1. **Daily Lark card at 15:00 MYT** posts a per-brand data-freshness check to a group bot, grouped by
   Team A/B/C over the full 23-brand roster: ✅ Data updated / ❌ Not updated / ❌ No data. Green header
   when all current, orange naming the culprits + reason when not. Detection (`feedCheckReport` in
   worker/index.js) flags a brand STALE when its newest `last_deposit_date` did not advance AND its daily
   totals are byte-identical to the prior snapshot (the RUSH33 2026-08-08 signature), MISSING when absent
   from today's feed. Signed webhook post (`larkCardPost`/`larkSign`, HMAC), gated on `hourUTC===7`.
   Secrets: `LARK_FEED_WEBHOOK` + `LARK_FEED_SECRET`. Managers-only test route `POST /api/rtn/feed-check?dry=1`.
   *Deployed (worker).* Built after RUSH33's stale Google-Sheet feed slipped through unnoticed.

---

## ✅ Shipped 2026-08-08 — VVIP Redeem Code: August rotation aligned to the planner (team routing fix)

### 🟠 High — campaigns were routing to the wrong team for all of August

1. **August team rotation now stored by hand in `SCHEDULE_OVERRIDE`** (App.jsx + worker/index.js, kept in
   sync). August previously had no override, so `campaignDay()` fell through to the computed rotation, which
   does NOT match the planner sheet — e.g. Aug 8 computed Team A but the sheet says Team B. Tier was already
   correct (Sat/Thu = TC V + Zyra 3; Sun–Wed = TC 3 + Zyra V; Fri rest), so only team-per-date needed fixing.
   Transcribed from the planner and cross-checked against per-team pool counts (A 787/514 & 267/1563; B
   1517/235 & 456/939; C 974/360 & 334/1479) — all 27 rows consistent. September onward still falls through to
   the computed rotation. *Deployed (worker + pages).*

---

## ✅ Shipped 2026-08-08 — Daily report: Retention Rate is now month-over-month (this day vs same day last month)

### 🟠 High — a cumulative metric compared on the right axis

1. **Retention Rate in the Leadership Alignment report now compares the current snapshot to the SAME DAY ONE
   MONTH BACK** (e.g. 8 Aug vs 8 Jul), brand by brand — instead of day-over-day. Retention here = distinct
   players with `monthly_deposit>0` ÷ tier pool, which is cumulative within the month and barely moves
   day-to-day; month-over-month at the same day-of-month is the meaningful read. Deposit / Active VIP /
   Reactivation stay day-over-day. Frontend-only (`buildDailyReport` + `genReport` in App.jsx):
   `pickLastMonthSnap()` finds the same-day-last-month snapshot (nearest within 5 days; clamps day-of-month
   overflow), `genReport` fetches it, and `splitTable` gained an optional comparison baseline (cmp/cmpL/cmpHas)
   so only Retention is re-pointed. New brands with no prior-month baseline render "—"; labels follow the
   report's data-day (−1) convention. *Deployed (Pages production).*

---

## ✅ Shipped 2026-08-06 — Reactivation-likelihood (which lapsed whales will come back) — lifecycle closed

### 🟠 High — the flip side of churn: score + prioritize LAPSED whales worth winning back
1. **Reactivation-likelihood score 0-100** for lapsed Tier V whales (quiet **15-45 days**, past the cooling
   window so no overlap): `55% recency (1 − dsld/45) + 30% prior bounce-backs (count of "Reactivated" band-days,
   capped 3) + 15% how regular they were (deposit-days/present)`. **Backtested** (as-of Jul 20, 14-day return):
   monotonic — return rate 6% → 17% → 26% → 43% across bands (~7× lift). Board returns a `reactivation` array
   (parallel to `cooling`, same live-only gate; runs concurrently so no added board-load lag), ranked by
   **odds × lifetime worth**. Frontend merges to `_react`; drawer smart read reads "Lapsed 22d · reactivation
   odds 61/100 — worth chasing / a long shot" + a win-back tone. *Deployed (worker + pages).*
2. **Lifecycle now closed:** the console tracks a whale steady → **cooling** (breaking rhythm) → **lapsed**
   (winnable) — e.g. wickylim (RM96k) moved from the first cooling list to a reactivation target at 33d/odds 40.
   Flowmap remaining: **auto-segmentation** only.

---

## ✅ Shipped 2026-08-06 — Value forecast + value-at-risk (the feed now ranks by money on the line)

### 🟠 High — 30-day deposit forecast fused with churn-risk → prioritize by revenue at stake
1. **Per-whale 30-day deposit forecast** = deposit run-rate (SUM(daily_deposit)/days-present) × 30, added to
   the board `cooling` query (hist CTE `SUM(daily_deposit) AS tot`). **Backtested** (as-of Jul 6, 30-day
   actual): monotonic and well-separated — forecast bands under-1k / 1-5k / 5-20k / 20k+ saw real deposits of
   634 / 2,582 / 8,722 / 32,858 (~50× spread top-to-bottom). Slightly optimistic at the very top (~30% high,
   regression to mean — v2 fix = recency-weight/shrinkage), but the ranking is solid.
2. **Value-at-risk = forecast × churn-risk/100** — the at-risk feed (bell/queue) now **orders by VAR**, not
   lifetime P&L. Surfaces the whale bleeding the most *future* money, not just the biggest past whale (e.g.
   HOT321·107222: forecast RM152k, risk 88 → **RM134k at risk**, tops the board though not the largest
   lifetime). Drawer smart read adds "worth ~RM X over next 30 days — about RM Y at risk." *Deployed (worker +
   pages).* Flowmap remaining: reactivation-likelihood, auto-segmentation.

---

## ✅ Shipped 2026-08-06 — Per-whale "Smart read" (deterministic AI-style summary) in the drawer

### 🟠 High — a plain-English "why + what to say" at the top of every player's approach column
1. **`whaleSummary(p)` — deterministic smart read** (App.jsx, frontend-only). Assembles a 1-2 line natural
   read from the player's OWN data — churn-risk score, deposit rhythm (`every ~Nd, now silent Md, K× their
   rhythm`), whale status, reactivation/cold state — plus a recommended **tone** (relief check-in / soft
   touch / relief-rebate), all RG-guarded. Rendered as a blue "✦ Smart read" card above the approach angles.
   **No LLM by design:** instant, free, and hallucination-proof — critical when the rule is *never* "win it
   back". It advises the AGENT; the customer message still comes from the safe approach library below. Adapts
   per player, incl. the important "steady — no alarm" case (a Tier V whale on rhythm reads calm, not urgent).
   *Deployed (pages).* v2 upgrade path: swap the read for a live model (Cloudflare Workers AI) with a tight
   RG prompt for richer prose — needs a binding + per-call cost, deferred until requested. Flowmap remaining:
   value forecast, reactivation-likelihood, auto-segmentation.

---

## ✅ Shipped 2026-08-06 — Churn-risk score (0-100) + backtest proving the cooling signal predicts churn

### 🔴 Critical — the at-risk feed is now a graded, backtested churn-risk score, not a binary flag
1. **Backtest (leak-free) validated the cooling signal** across 4 as-of dates (Jul 4/11/16/18): flagged whales
   churned at **18-26%** vs **2-4%** for healthy ones — a steady **6.5×-9× lift**, "other quiet" always in
   between. Baseline computed only from ≤ as-of, outcome only from > as-of. Proven, not plausible.
2. **Churn-risk score 0-100** shipped: `risk = 75% rhythm-break (dsld/gap, saturates 4×) + 25% silence depth
   (dsld/20)`. Backtested monotonic — churn 2% → 13% → 17% → 29% across bands (~14× top-vs-bottom). The board
   `cooling` feed now carries `risk` per whale, dsld window 4-14, **ordered by risk then value**. UI: bell
   "N whales at churn-risk — act now"; drawer badge `❄ CHURN RISK 91` + why-line; queue `❄ RISK 91`.
   *Deployed (worker + pages).* v2 idea: add a frequency-decline term to sharpen the mid-bands. Still on the
   flowmap and NOT built: value forecast, per-whale AI summary, reactivation-likelihood, auto-segmentation.

---

## ✅ Shipped 2026-08-06 — Predictive: early-cooling whale detection (first behavioral/prediction feature)

### 🔴 Critical — the console now predicts, not just describes: whales breaking their OWN deposit rhythm
1. **Per-player baseline + deviation engine ("cooling whales")** — the first use of the 57-day time-series for
   prediction. For each Tier V whale we compute their **normal deposit cadence** (`days_present / deposit_days`)
   and flag when current silence breaks it: quiet **4–10 days AND ≥1.6× their own gap**, ranked by value
   (derived pnl = lifetime_withdraw − lifetime_deposit, most-negative = most valuable). Smarter than the old
   fixed "DSLD 5–6" rule — it's relative to each player's normal and value-ranked. Worker: `/api/rtn/board`
   now returns a team-scoped `cooling` array (only on the LIVE snapshot; ~1s extra scan). Frontend: merged into
   player rows as `_cool2`, driving (a) a **notification-bell alert** "❄ N whales cooling — act now" that
   deep-links the Daily queue to exactly those whales, (b) the **drawer** badge `❄ COOLING · 2.5×` + why-line
   "Quiet 6d vs ~2d normal", (c) the queue-row badge. Proven live: surfaced mi2t01 (LPK777, RM509k lifetime,
   silent 6d) and ~RM850k of still-winnable value across ~15 whales the fixed rule missed. *Deployed (worker +
   pages).* **Next:** backtest (do early flags actually predict churn?), then Layers 2–3 (churn-risk score,
   value forecast). This is stage ② of the [player-intelligence flowmap].

---

## ✅ Shipped 2026-08-06 — Performance tables: sortable columns, click-to-filter, per-player depth tags

### 🟡 Usability — the By CS/Class/Brand tables became an interactive analysis tool
1. **Three additions to the shared `PerfBlock`** (so all three tables get them): (a) **click any column header
   to sort** (▾/▴ direction toggle; By CS defaults to Score desc); (b) **click a count to filter the drill-down**
   to just those players — Recovered shows the recovered set, No resp./Responded/Contacted/Actioned likewise,
   the clicked cell highlights, clicking the row name still shows all; (c) **each recovered player is tagged
   with its comeback-depth band** in the drill-down (e.g. `· 7–13d ×0.50`), so the Score is fully traceable to
   players. To feed (c), `/api/rtn/performance` now returns the reactivation data **per recovered player**
   `{agent, player_key, brand, tier_segment, tier}` (was per-agent aggregates); the frontend folds it into the
   per-agent Score + band counts AND a per-player tier map. Verified the per-player rows re-aggregate to the
   same scores (jason 8.45, trevor 5.50). *Deployed (worker + pages).*

---

## ✅ Shipped 2026-08-06 — Reactivation score is now recovered-anchored (only RECOVERED players count)

### 🟠 High — the weighted score reconciles with the Recovered count; no-response contacts earn nothing
1. **Reactivation scoring switched from return-anchored to recovered-anchored** (worker `/api/rtn/kpi`
   `reactStmt` + `/api/rtn/performance`, both to identical logic). The first weighted build credited the
   most-recent contact of ANY status (`CONTACTED/RESPONDED/NO_RESPONSE/RECOVERED`) before a player's return
   — which credited **skylar 0.10 while she had 0 RECOVERED** (traced to a NO_RESPONSE contact on a
   1-2-day-idle player who self-returned). **Now:** score = the agent's `status='RECOVERED'` players (by
   `contacted_at` month), each weighted by comeback depth (deepest "Reactivated X Days" band): 1-6d=0.10,
   7-13d=0.50, 14-29d=0.75, 30+d=1.00. Only recoveries count, so bands sum to the Recovered column and
   **0 recovered = 0 score** (skylar/raven drop to no-score). `no_band` fallback = shallow 0.10 (0 cases in
   Aug). New Aug numbers: jason 7.55→**8.45** (bands 17/12/1/0 = 30 recovered), trevor 6.75→**5.50**. July
   still frozen flat. *Deployed (worker only — frontend shape unchanged).*

---

## ✅ Shipped 2026-08-06 — Reactivation Score + depth breakdown on the Performance "By CS" table

### 🟠 High — the weighted reactivation score is now visible per agent, with the detail behind it
1. **By CS gets a `Score` column + a drill-down depth breakdown** (worker `/api/rtn/performance` now also
   returns a per-agent weighted `reactivation` array; App.jsx `PerfBlock` renders it for By CS only). The
   table used to show only a raw RECOVERED count; now each agent also has the **weighted Score** (same
   depth-weighted logic as the KPI `reactStmt` — credited to the most recent same-month contact, one count
   per player), and expanding a row shows the split: `1–6d ×0.10 · 7–13d ×0.50 · 14–29d ×0.75 · 30+d ×1.00
   = total`, with the letter grade held until month-end. Score is opt-in per table (a `react` prop), so By
   Class / By Brand are untouched. Verified live: jason 7.55, trevor 6.75. *Deployed (worker + pages).*
   - **Recovered vs Score sit side by side and measure differently** — Recovered is the old auto-flip status
     count, Score is the new return-anchored weighting. Both labeled so agents aren't confused. This is the
     first place the weighted reactivation number surfaces on-screen (the old Base/Bonus scorecard stays off).

---

## ✅ Shipped 2026-08-06 — Campaigns run for uid'd players (partial-uid brands no longer blocked)

### 🟠 High — a brand with one missing uid now runs for the rest, instead of being blocked whole
1. **Campaign eligibility relaxed from 100%-uid to ≥1-uid** (worker `createEventFor` + App.jsx
   `eligibleBrands`/`blockedBrands`). The old rule required **every** player in a brand to have a uid
   (BO's audience upload keys on `user_id`); a single blank uid blocked the whole brand. **AC69** (new Team
   C Zyra, first data 2026-08-05) had **1 of 58** players with an empty uid (`K2917848715615942`, a real
   Tier-3 player whose source-sheet uid cell was blank), so it never appeared in Campaigns. **The fix:** the
   pool query now excludes uid-less players (`AND uid IS NOT NULL AND TRIM(uid) <> ''`) and the brand runs
   for the rest; eligibility is `with_uid > 0`. **Zero-uid brands stay fully blocked** — TC brands (ACE33,
   LPK777…) and OMG67 (Zyra-tagged but ships no uid) come back with an empty pool and are rejected, so the
   promo still can't run on them. Verified: AC69 → eligible (pool 39 of 40 Tier 3, 18 Tier V); BM69 158/158
   still in; ACE33/LPK777/OMG67 (uid 0) still out. *Deployed (worker + pages).*

---

## ✅ Shipped 2026-08-06 — Reactivation KPI switched to a weighted, depth-scored model (Aug 2026+)

### 🟠 High — a reactivation is scored by how cold the player was when they returned, not a flat 1
1. **Weighted reactivation score, cutover 2026-08** (worker `/api/rtn/kpi`, `reactStmt`). The old metric
   counted every recovered player as **1**, so nudging a 1-day-idle player who'd have returned anyway scored
   the same as winning back a 40-day churn. Proof from July: jason logged **184** "reactivations", but **52%**
   of all team recoveries were players idle ≤6 days; raven did the most genuine deep-churn work (80 of 85) yet
   ranked 3rd on the flat board. **The fix:** each recovered player is weighted by idle-days **at return** (the
   feeder's "Reactivated X Days" band): 1–6d = **0.10**, 7–13d = **0.50**, 14–29d = **0.75**, 30+d = **1.00**.
   Credit needs a documented contact BEFORE the redeposit inside a depth window (**3 days** for 1–6d returns,
   **7 days** for 7d+), most recent qualifying contact wins, each player counts once (deepest return).
   Re-weighted July: jason 184 → ~44, raven rises to co-top, edwin's 208-save volume exposed at 40.6.
   *Deployed (worker only).*
   - **July is frozen:** date-guarded (`month >= "2026-08"`) — July and earlier keep the original flat count
     byte-for-byte, so those numbers never move.
   - **A July approach never carries into August:** the qualifying contact must be in the SAME calendar month
     as the return. Extends the month-attribution rule shipped for Performance on 2026-08-03.
   - **Grade bands (weighted pts/month), set from the July spread** (avg ~20, median ~11, top ~44):
     Outstanding ≥ 35 · Good 25–34 · Passed 15–24 · Failed 8–14 · Total Failure < 8. **Not yet wired into the
     app** — the in-app scorecard is still gated off (`KPI_ENABLED = false`); August grading runs in the Cowork
     sheet with the same query. When the scorecard is re-enabled, its old bonus bands must be swapped to these.
     One-month base — revisit after 2–3 months, and prorate part-timers by working days.

---

## ✅ Shipped 2026-08-03 — Contact records show the real action day + Performance counts the calendar month

### 🔴 Critical — data integrity: a contact now records WHEN the agent actually acted
1. **`contacted_at` — the real MYT action day, not the lagging data day** (schema **v21**, additive column).
   **The bug:** a contact was stamped with `snapshot_date` (the board's *data* day). Before the daily
   feed lands at 15:00 MYT the latest snapshot is still *yesterday*, so a contact made this morning was
   filed — and displayed — as yesterday (agents contacting on 3 Aug saw 2 Aug). **The fix:** the contact
   save now also writes `contacted_at = date('now','+8 hours')` — the real calendar day — set on the first
   human write and preserved across later status changes with `COALESCE`. The auto-outcome cron only writes
   `status`/`updated_at`, so it never disturbs it. The console shows `contacted_at` everywhere the contact
   date appears (By CS/Class/Brand drill, the drawer's contact ledger, the CSV export), falling back to
   `snapshot_date` for pre-migration rows. Verified end-to-end: a contact on the 08-01 board saved 08-03
   reads **08-03**, and survives a cron NO_RESPONSE flip. *Deployed (D1 + worker + pages).*
   - **Backfill:** 37 pre-fix rows that a **human** last touched were set from `date(updated_at,'+8h')` —
     their real save day — fixing history too (jason's earlier morning contacts moved forward a day where
     they'd been off). **2,764 auto-resolved rows left as-is:** the cron had overwritten their human
     contact time, so it's unrecoverable; they keep the `snapshot_date` fallback. Credit timing is
     unaffected — month attribution keys on `snapshot_date`, so recoveries still count in the right month.

### 🟠 High — Performance counts one calendar month, not a rolling 30 days
2. **Save-rate tables switched from `snapshot_date >= now-30d` to a hard calendar month** (defaults to the
   current MYT month; `?month=YYYY-MM` to review a past one). On the 2nd of a month the rolling window was
   ~99% last month's work — jason showed 184 recovered / 574 actioned when his real August figures were
   6 / 51. This enforces the reactivation-credit rule Aldo confirmed: **a recovery counts in the month it
   happened** (a July recovery must not count in August, even under the 14-day condition). Added a **month
   picker** (last 6 months) on the Performance tab and an **Export contacts CSV** button (raw log behind the
   tables: date, agent, player, brand, tier, class, status). *Deployed (worker + pages).*

---

## ✅ Shipped 2026-07-18 — Campaigns tab · VVIP Redeem Code module

Replaces the Lark Base tracker for the redeem-code promo. Zyra brands, Tier 3 + V, whole-tier pool.
CS verifies a RM100+ deposit (cumulative over the day), then releases one of two BO codes.
**Not in scope (deliberate):** no BO API, no auto-blast, no KPI wiring, no calendar yet.

### 🔴 Critical — data integrity: the assignment must match what BO received, forever
1. **Export locks the event permanently.** Downloading a UID list flips `draft → exported` via a
   *conditional* UPDATE (`WHERE id = ? AND status = 'draft'`), so two managers exporting at the same
   second cannot both believe they locked it. After that: no reshuffle, no code edit, no delete — BO
   holds those lists and the console must keep matching them. Re-downloading a lost file is always
   allowed and changes nothing. **Why it's critical:** a reshuffle after upload would silently hand
   players a code BO never issued them.
2. **A player physically cannot land in both code lists.** `UNIQUE (event_id, player_key)` enforces
   one assignment per player per event at the *database* level, not in the UI — which is what makes a
   double claim impossible even with a frontend bug. Verified against the real 149-player BM69 pool:
   overlap 0, nobody lost or invented.
3. **Release and delete are race-safe.** Release is a conditional UPDATE (`WHERE id = ? AND claimed = 0`),
   so two agents clicking at once → one wins, the other is told who already released it and when.
   Delete guards every statement with the same `status = 'draft'` subquery, so an export landing
   mid-request makes all three statements no-op together instead of half-deleting.
4. **Missing UID fails loudly.** Event creation refuses if any player has no `uid` — BO's audience
   upload keys on `user_id`, so a short list would silently under-deliver. This is also the guard that
   stops the promo being run on the TC brands (LPK777 / ACE33 have no uid).

### 🟠 High — the module itself
5. **Server-side crypto shuffle, 50/50 split.** Fisher–Yates over `crypto.getRandomValues` — the BO
   redeem system has no randomiser, so "luck" *is* this shuffle and it must be unreproducible.
   Fresh every event, never carried across cycles. Remainder on an odd pool goes to the **cheaper**
   code (149 → 75×A / 74×B). Tested over 400 runs: every player lands in A 44.8–56.8% of the time.
   `CODE_BANDS` is config in **both** `worker/index.js` and `App.jsx` — reverting to 4 bands
   (8/12/15/18 @ 40/30/20/10) means editing both copies.
6. **CSV export in BO's exact shape** — one column, header `user_id`, UID written as stored (never
   padded or reformatted; brand UID lengths run 2–8 digits). One file per code.
7. **Campaigns tab visible to EVERY agent, not team-scoped** — the deliberate exception to
   `teamAnd()`/`brandAllowed()`. Livechat randomises chats across the shift, so a Team A agent
   regularly gets a Team C player wanting to claim. Lookup + release are open to all; create, export,
   close, delete and the report stay managers-only. Far narrower than lifting the team walls globally.
8. **Release flow** — find player → confirm popup (guards against a mis-click) → the *channel is the
   button* (Release via Telegram / via Livechat), so choosing it costs no extra step. Codes are masked
   in the manager table until released. "Not qualified" records an under-RM100 attempt **without
   burning the code** — they can top up and still claim the same day.
9. **Tables + report** — eligible (gold, the work) split A | B side by side, claimed dimmed beneath;
   colour is spent only on exceptions. Shared "Show per page" pager reusing Daily's markup. Report
   covers per brand, per code (the built-in A/B experiment) and per agent.

### 🟡 Notes & known gaps
10. **No class/flag filtering** — FRAGILE / TOP_LOSS / cooling are deliberately ignored: this is a
    campaign to a tier, not a retention approach. Side benefit: the pool is a plain SQL query, so no
    mirror of the frontend's `classifyAll` on the server and no drift risk.
11. **Untested path: nobody has released a code yet.** Shuffle, constraints, delete and export lock
    are verified (delete confirmed in production); the claim flow is not.
12. **Next:** calendar-driven scheduling (team days), same-day follow-up for the unclaimed (their code
    dies at midnight, so a *next-day* chase is useless), and the measurement work parked in
    `IDEAS.md § VVIP Redeem Code`.

---

## ✅ Shipped 2026-07-12 → 07-16 — Ingest junk-row guard + cooling-whale priority + SPV-shaped daily report

### 🔴 Critical — data integrity: non-player rows can no longer enter the feed
0. **Ingest rejects rows with no player signal** — a row that carries only a `uid` (or username) and nothing else is not a VIP. `handleIngest` now also requires at least one of `tier`, `group_name`, `register_date`, `entry_date`, `member_days`, `lifetime_deposit`, `monthly_deposit`, `last_deposit_date`; anything else is counted in `skipped`. **Why it's critical:** on 2026-07-12 a Telegram-contact list was POSTed into the feed by mistake — **180 junk rows** landed in `player_days` and tanked ONG66's retention, because every fake "player" counted as an inactive VIP. Bad rows were deleted from D1 and the guard shipped so it can't recur. *Deployed (worker) + `worker/index.js` guard.*

### 🟠 High — ACT NOW learns to prevent churn, not just react to it
1. **Cooling-whale priority (whale quiet 5–6 days)** — a Tier V top-quartile player who hasn't deposited for 5–6 days is the **last window to prevent churn** before it goes cold at 7d; previously these sat in NO ACTION. `classifyAll` adds a `_cooling` flag (a flag, not a class, so it can ride on any class); cooling whales join **ACT NOW sorted first** — above grace deadlines and big losses — 6d before 5d, most valuable first. The 5–6 day window (not exactly 6) survives a one-day feeder lag. New **COOLING** message template = gentle check-in with **no deposit push**, and the RESTRAINT do-not-contact guard is suppressed for them. ❄ COOLING tag in worklist, table and drawer. 23 cooling whales on the 2026-07-12 snapshot. *Spec: `docs/ACT_NOW_PRIORITY_SPEC.md`. Deployed (pages) + `2783c71`.*
2. **Telegram-link capture surfaced as a task** — ACT NOW header shows an **amber no-link counter**, and clicking it filters the worklist to players with no Telegram link (the capture-links view). Paired with a new **On TG** toggle on the daily worklist (default off, so non-TG players can still be worked by copying the username). The two are mutually exclusive and each drops a dismissible filter chip. *Deployed (pages) + `eab1ff4`, `8b60cb6`, `c3e4e8c`.*

### 🟠 High — daily report now matches the SPV sheet leadership already reads
3. **Report re-shaped to the SPV layout** — each metric emits **three tables** (combined / Tier 3 / Tier V), columns `Brand | prev-date | cur-date | Variance (▲▼ abs) | Change %`. Replaces the earlier two-table (current vs previous) × tier-columns layout, and drops the Team Performance heading + intro to match the reference exactly. Change % is a **consistent signed percentage** (the reference sheet printed positives as raw ratios — a formatting slip on their side, not copied). *`5e55cc0`, preceded by the tier-split version `bdbcedb`.*
4. **Top Deposit Movers** — new section under the metric tables: **top 10 players by absolute day-over-day change in daily deposit, either direction**, across all Team B brands (zero-change excluded), so it catches new big depositors *and* big drops in one list. Players display via `dispName` — **UID for Zyra, username for TC** — matching how they're identified everywhere else in the console. *`a07e605`, `77680a5`.*
5. **Dashboard tier filter** — All / Tier 3 / Tier V flows through the KPI cards, Brand Health table and list cards. The retention trend stays all-tiers (it's computed server-side) and shows a note when a tier is selected. *`bdbcedb`.*

### 🟡 Usability & process
6. **KPI scorecard + leaderboard parked behind a flag** — the Base/Bonus/FinalKPI scorecard, Team Challenge and KPI Leaderboard are gated behind **`KPI_ENABLED=false`** with an "under revision" note in their place, while the KPI system is being redesigned. Retention detail, save-rate By CS/Class/Brand, Mistake Log and Team Snapshot stay live. **Flip `KPI_ENABLED` to restore the old engine** — nothing was deleted. *`3c85c7c`.*
7. **Report whitespace fixes** — the narrative template printed empty bullets (stray dots in Lark) and a blank line after every header; now only labelled prompts, header-only for the free-form sections (Today's Top 3, Risks), single blank line between sections. *`fb49aaa`.*

---

## ✅ Shipped 2026-07-10 — Lark → Telegram auto-sync + contact ownership + date picker & responsive UI

### 🔴 Critical — data integrity: a contact can no longer be saved unowned
0. **Status click always leaves an owner** — clicking **Assigned / Contacted / Responded** in the Drawer now falls back to the **logged-in agent** when the "Assign to…" dropdown was never touched. It never overwrites an assignee a manager chose on purpose; saving a *note alone* still doesn't assign. **Why it's critical:** the reactivation bonus only counts a `RECOVERED` row that carries an `assigned_to` — an agent who forgot the dropdown was silently losing the KPI point, and their failures pooled into an anonymous "—" row in Performance (inflating their Save %). *Deployed (pages) + `d7c4389`.*
   - **Backfill:** 21 unowned July rows re-attributed → mexha 18, skylar 2, jason 1; orphans now 0. All 21 were failures (19 NO_RESPONSE, 1 RESPONDED, 1 blank), so **no reactivation points moved** — only Save % denominators, which correctly *lowered* mexha's and skylar's rates.
   - **Attribution trap (documented in HANDOFF §3):** `updated_by` is rewritten to `'auto'` by the cron, so it can't identify the agent on NO_RESPONSE/RECOVERED rows. Use `activity_log` filtered to `detail LIKE 'Status CONTACTED%'` **and matched to the row's `snapshot_date`** — "most recent action for that player" gives the wrong agent.

### 🔴 Critical — new capability: automated Telegram-link feed
1. **Lark P&L1 → `player_telegram` daily auto-sync** — replaces the manual per-player paste / one-time CSV imports with an automated one-way feed (**Lark is source of truth**). Reads the "Telegram Approaching" Base → **P&L1** table, **Team A/B/C views only** (skips Overview's blank-telegram rows), then per row: `Username`→player_key, short `Brand`→full brand (`LARK_BRAND`), and `Telegram combine`→cleaned link. `normalizeLivechat` drops placeholders, de-doubles accidental double-pastes, and rewrites every link to the uniform **`archives/<chatId>?shared=true`** form. Upserts on `(player_key, brand)`, `updated_by='lark'`, **never deletes**. Runs **daily at 00:00 MYT** via `scheduled()` (gated + isolated from `autoOutcomes`) and on-demand via **`POST /api/rtn/lark-sync`** (`?dry=1` = count+sample, no writes). Debug peek via **`GET /api/rtn/lark-debug`**. First run: **1,971 links, ~100% matched** to real players across all brands (incl. Zyra). *Deployed (worker). Full logic in HANDOFF.md §5.1.*
   - **Blocker cleared:** the Lark app needed *Can view* on P&L1 via that table's **Advanced Permissions** (base-level sharing is ignored while advanced perms are on).
   - **Limits:** never deletes (stale link lingers if a player is dropped from the sheet); tier is intentionally not synced (comes from `player_days`).
   - **Next:** optional auto-cleanup of links whose player left the Lark sheet.

### 🟠 High — snapshot date picker on every tab + responsive layout
2. **Shared `SnapshotPicker` above all data tabs** — replaced Daily's native date `<select>` (and then the unstyleable native `<input type=date>` calendar) with a custom dark **`DateCalendar`**: month nav bounded to the data range, days without a snapshot disabled, selected day in gold, range + Today shortcut in the footer. Wrapped it with **Today / Yesterday / −7d** quick jumps (timezone-safe date math) into one `SnapshotPicker` bar rendered once in `<main>` above **Dashboard, Daily, Changes, Performance**. Works because `viewDate` is global App state and `loadBoard(viewDate)` refetches for every tab. *Deployed (pages) + `750fcb2`, `9f846b1`.*
3. **Responsive / auto-size UI** — the layout no longer breaks when the window is narrowed. Root causes fixed: grids used `1fr` (= `minmax(auto,1fr)`, whose min-content floor makes cards overflow) → now **`minmax(0,1fr)`**; `.kpi-cols`/`.kpi-team-two` grid children lacked `min-width:0`, so the wide retention tables **spilled into the Performance sidebar** → fixed, and `TierTable` wrapped in `.ptbl-scroll`; wide tables (Brand Health, By CS/Class) forced **whole-page horizontal scroll** → `.perf-tbl{display:block;overflow-x:auto}` at ≤1024px so each table scrolls *inside its card*. Header + brand cards flex-wrap; breakpoints 1024/820/640/420. All rules are `max-width` media queries, so **desktop is unchanged**. *Deployed (pages) + `9f846b1`.*

### ⚙️ Infra / process
4. **`deploy:pages` targets the production branch** — the script ran `wrangler pages deploy` with no `--branch`, so it published under the git branch name (`master`) as a **Preview**, not the live URL. Flag now baked into `package.json`; `npm run deploy:pages` goes straight live. *`2d4fd9d`.*

---

## ✅ Shipped 2026-06-21 → 06-27 — Access control + Activity log + Dashboard rebuild + Notification bell + Telegram self-serve

### 🔴 Critical — new capabilities: access control + audit trail
1. **Access control — per-account roles + permissions** — 3 roles (Admin / Agent / Viewer) as presets over 4 flags (`can_edit`, `can_delete`, `on_leaderboard`, `manage_users`), set in Settings (collapsible per-user editor). **Enforced server-side** on every write route (contact / notes / CRM / Telegram / KPI) — viewers are rejected, not just hidden. `manage_users` is the single source of truth (dropped the legacy role shortcut). Guards: last-manager + self-delete protection, **8-char password minimum**. KPI leaderboard / Base-Score / mistake-log filtered to `on_leaderboard` agents. Migration `schema_v15_user_permissions.sql` (additive; aldo=Admin, raven/skylar=Agent, rest=Viewer). *Deployed (D1 + worker + pages).*
2. **Activity log — append-only audit trail** — `schema_v16_activity_log.sql`. Worker records every meaningful action with **who · when (MYT) · IP**: sign in/out, contact saves, RECOVERED, clears, notes, Telegram edits, KPI saves, mistakes, permission + user changes. Logging is fire-and-forget (`ctx.waitUntil`). `GET /api/activity` (managers-only, username/action/date filters); `POST /api/logout`. Viewer lives in Settings. *Deployed (D1 + worker + pages).*

### 🟠 High — Dashboard rebuilt (retention-first) + notification bell + Telegram self-serve
3. **Dashboard rebuild** — retention command view, NOT a copy of TC Gaming's finance dashboard. (a) **8-card themed KPI header** (Active VIPs · Cold pile 7+ · ♛ Whales at risk · Team actions · Deposits · Net flow · Player W/L · Deposit/active VIP) with **hover breakdowns** + day-over-day deltas; (b) **retention trend** — Active + Cold lines (player-count axis) and Deposits + Withdrawals (separate RM axis), **zoomed axes with min/max labels + gridlines**, **brand selector** + 7/14/30 range + clean hover card (incl. Day PNL = Dep−WD); (c) **Brand Health table** worst-first, **clickable to re-scope the trend**, with **✈ TG reach %**; (d) **4 actionable list cards** (rows open the player Drawer) incl. **"Newly cold today"**; (e) **reactivated-whale notice**. Worker `GET /api/rtn/trend` extended (active/cold counts, `?days`, `?brand`). *Deployed (worker + pages).*
4. **Notification bell** (header) — event/exception alerts only (stale/lagging feed · whales just went cold · reactivated whales), dismissible + per-day dedup, quiet when empty, click-through; built so predictive alerts slot in later. *Deployed.*
5. **Telegram self-serve** — edit links in the player **Drawer** (replaces the manual CSV/Lark Base for new links) + managers-only **bulk CSV import** in Settings (quote-tolerant, short-code→full-name mapping, preview with skipped-rows + dupes + confirm). One-time imports loaded 579 → 665 links. *Deployed (worker + pages).*

### 🟡 Usability & cosmetic
6. **9-item security/UX audit sweep** — last-manager/self-delete guard, password minimum, `manage_users` source-of-truth, dropped spoofable IP fallback, Daily drawer closes on filter change (no wrong-player), follow-up/Telegram save feedback, Bonus "discipline = count vs points" tooltip, KPI **Refresh** button, whale flag now requires a real net loss. *Deployed.*
7. **Polish** — empty-outcomes banner + "Copy names ✓"; Team snapshot card (clarified deposits are Tier 3+V only); info **ⓘ** tooltips replacing wall-of-text notes; neutral "→ 0%" delta; softened empty cards.
   - **Next:** deposit-drop **predictive alerts** vs each player's baseline (history ~ready, ~14–30 days) → slot into the bell; player **timeline** view; behavior-sequence churn classification (needs ~30 days). Then department rollout (19 brands) + LiveChat CRM.

---

## ✅ Shipped 2026-06-20 — Team Challenge + Bonus Track (FinalKPI) + Telegram in-app + polish

### 🔴 Critical — completes the KPI engine (Base → Bonus → FinalKPI)
1. **Bonus Track → FinalKPI (Stage 3)** — Bonus table under BaseKPI: Reactivation (8) + Deposit Growth (6) + Discipline (4) + FRT (2) → **AddMarks /20** → **FinalKPI = BaseKPI + AddMarks (/120)**. Unlocks only when **BaseKPI > 75** (🔒/🔓 badge; rows dim when locked). Editable config `KPI_BONUS` + `KPI_BONUS_UNLOCK` in App.jsx, bands verbatim from `KPI_ENGINE_FULL_SPEC.md`. **Reactivation auto-counts** RECOVERED players per agent from `contact_log` (Worker `GET /api/rtn/kpi` now returns `reactivation` rows); Growth/Discipline(count)/FRT from existing inputs. **KPI Leaderboard now ranks by FinalKPI** (gold `+AddMarks` chip). *Deployed (worker + pages).*
2. **Team Challenge — 4-category Team B score** (replaced the manual board) — Deposits (30, per-active-VIP) + Retention (25, active rate) + Engagement (25, contact×15 + follow-up×10) + Growth (20) → /100. Deposits/Retention/Growth auto from system data; VIPs-contacted auto from `contact_log`; follow-ups manual + DB-backed via new table `kpi_challenge_eng` + `POST /api/rtn/kpi/challenge-eng`. Deposits & Growth are **provisional** (full points as the only team; proportional ranking activates when rival teams are added). *Deployed (migration `schema_v14_kpi_challenge_eng.sql` + worker + pages).*
   - **Why:** closes the full formula chain — Base KPI → Bonus → FinalKPI per agent, plus team-vs-team. The Top-Performer challenge (FinalKPI ≥ 100) is now computable.
   - **Next:** add rival teams to Team Challenge (needs the parked 19-brand data) → proportional scoring activates; payout % mapping (deferred); tighten reactivation anti-gaming (contact-before-redeposit); move `KPI_BANDS`/targets to editable Settings config.

### 🟠 High — Telegram links move in-app (retire Lark Base/CSV)
3. **Telegram links editable in the player Drawer** — Telegram section is now Add/Edit/clear inline; saves instantly; read-only on past snapshots. Worker `POST /api/rtn/telegram` extended to accept a single `{player_key, brand, url}` (empty url removes the link); the bulk-load path is unchanged. CS captures the link the moment they get it — no more manual CSV or Lark Base for this data. *Deployed (worker + pages).*
4. **One-time Telegram migration** — imported the full list (579 links; short brand codes → full names) via additive upsert; tracker now holds **590 links** across all 6 brands. Reusable converter kept at `scripts/build_telegram_import.cjs`. *Data load only.*
   - **Why:** removes a manual two-step (Lark Base entry → periodic CSV push) and drops a Lark Base dependency ahead of its replacement.

### 🟡 Usability & cosmetic
5. **Info ⓘ tooltips** — reusable `InfoTip` (hover + keyboard-focus popup) replaces the wall-of-text help notes across Performance: Base Score, Bonus, Team Challenge (incl. the live auto-data line), Retention detail, Leaderboard, Mistake Log, save-rate blocks. "Saved ✓" feedback + empty states stay inline. *Deployed (pages).*
6. **Empty-outcomes banner** — Performance shows a notice when the month's contact log is empty, so Reactivation/Engagement/Contact 0s read as "nothing logged yet", not poor performance; auto-hides once outcomes are logged. *Deployed.*
7. **Copy names confirmation** — the KPI win-back "Copy names" button now flips to "✓ Copied" like the other copy actions. *Deployed.*

### ⚙️ Infra / process
8. **Vite honors `PORT`** (`vite.config.js`) so the preview harness can assign a port without the dev server clashing on 5173; added `.claude/launch.json` dev-server config and a `.gitignore` for `.claude/settings.local.json`.

---

## ✅ Shipped 2026-06-16 — KPI Engine (Stage 1a+1b → per-agent) + Telegram CRM

### 🔴 Critical — new capability: the KPI scorecard + auto-compute
1. **KPI Engine Stage 1a+1b — full BaseKPI /100 scorecard** (Performance tab). BaseKPI = Tier 3 (15) + Tier V (15) + Deposit Growth (20) + FRT (30) + Discipline (20), band tables verbatim from `KPI_ENGINE_FULL_SPEC.md` (`KPI_BANDS`, `KPI_TARGET` in App.jsx). Tables: `kpi_retention` (per-brand %, manual), `kpi_team_month` (FRT/discipline/deposits), retention auto-route. Worker `GET /api/rtn/kpi` + `POST /api/rtn/kpi/{retention,team}`. Retention detail = per-brand Tier3/TierV tables (drill: brand→Daily 0-deposit filter; Need number→top-N players popover). *Deployed (migrations + worker + pages).*
2. **Retention AUTO-compute** — Tier3/V now auto from **cumulative `monthly_deposit`** (latest snapshot), which captures the whole month despite the June 1–10 gap (a deposit can't be undone). Verified vs official: 5 brands match within ~1–2% (auto slightly higher = more current). **ACE33 excluded** (`RETENTION_MANUAL_BRANDS`) — ~300 of its players frozen at last-deposit 2026-05-31 (stale source data, not a mapping bug). *Deployed.*
3. **Mistake Log → auto Discipline** — table `mistakes(month,agent,category,points,note,…)`, 5 fixed categories, flexible per-mistake `points` weight. View = any user; add/delete = admin only (`user.role==='admin'` = ATL+). `MistakeLog` card in Performance. Discipline KPI auto-reads the weighted month total → band (0 mistakes = full 20). *Deployed (migration + worker + pages).*
4. **Per-agent KPI + auto leaderboard** — Base Score "Team ▾" selector (`kpiFor`); pick a staff and FRT + Discipline become THEIRS (FRT per-agent via `kpi_agent_month` + `POST /api/rtn/kpi/agent-input`; Discipline from their mistakes). **KPI Leaderboard auto-computed** from each person's BaseKPI (replaced the manual board). Tier/Growth stay team-shared. *Deployed.*
5. **Data-freshness LAG detector** — board health now returns each brand's `newest_dep`; Daily shows a LAG banner + plaque chip when a brand's deposits trail the freshest brand (catches content-stale feeds that snapshot-date checks miss — the BM69 case). *Deployed.*
   - **Why:** turns the manual Retention Rate Saver sheet into a live, mostly-auto scorecard. 4 of 5 metrics now auto-compute.
   - **Next:** fix ACE33 feed → remove from `RETENTION_MANUAL_BRANDS`; ingest LiveChat for auto FRT; Stage 3 (bonus track, auto Team Challenge); move `KPI_BANDS` to editable DB/Settings config.

### 🟠 High — feature value: Telegram CRM + drawer
6. **Telegram CRM** — table `player_telegram(player_key,brand,url)` (90 links loaded), drawer **Telegram button** (opens that player's Livechat archive, or greys "Not on Telegram"); ✈ indicator beside every player name (Worklist/Dashboard/Changes) + a sortable **✈ TG column** in the Table view. *Deployed.*
7. **Drawer redesign** — right-docked **760px two-column** + value-at-a-glance strip; left column adds **Next follow-up** (`player_crm`) + **Contact history** (from `contact_log`). *Deployed.*
8. **Feeder multi-run triggers** — Apps Script `setupDailyTrigger()` now creates 3 daily runs (`TRIGGER_HOURS=[15,19,22]`) so late source updates get caught (user runs `setupDailyTrigger` once per sheet).

### 🟡 Usability & cosmetic
9. **Performance layout** — Team KPI box (Base Score + Team Challenge) over Retention detail + By CS/Class/Brand, with auto KPI Leaderboard as a right sidebar; comma-formatted deposit inputs (`17,230,000`); double-click-to-edit guard on retention cells.

---

## ✅ Shipped 2026-06-13 — VIP humanization (Layers 1–2, live)

### 🔴 Critical — new capability: stop sending generic templates
1. **Layer 1 — Memory Hooks ("Who they are")** — drawer now shows real facts about the player (tenure, lifetime value, typical deposit, this-month rhythm, last deposit, tier move) as pills above the approach. All derived live from data already held — no worker/DB change. `buildHooks(p)` in `messageLibrary.js`; missing data is skipped (no half-facts). *Deployed.*
2. **Layer 2 — Opening Angles** — actionable classes lead with 2–3 distinct "ways in" (each a different emotional door); CS picks one and writes in their own voice using the hooks. Full template demoted to a collapsed "Stuck? Show a full example". RG/WHALE/FRAGILE guards stay pinned above the angles. No-contact classes keep the restraint note. `buildAngles(p)` / `ANGLES` in `messageLibrary.js`. *Deployed.*
   - **Why:** VIP retention ≠ standard CS. High rollers must feel known, not processed. The system's job became *context + guardrails*; the human's job is the charm.
3. **Phase 1B — Deep memory hooks (history)** — new read-only Worker route `GET /api/rtn/history` returns a player's chronological daily series; frontend `buildHistoryHooks()` derives best winning day, biggest top-up, and the standout "withdrew then went quiet" signal, merged into the "Who they are" strip (fetched on drawer open, session-cached). Additive only; degrades to nothing under 2 days of history, grows richer as snapshots stack. *Deployed (worker + pages).*
4. **Layer 4 — Relationship Ledger** — new table `player_notes` keyed on `(player_key, brand)` (NO snapshot_date — a human fact outlives the day and resurfaces on every future contact). Worker: `GET/POST /api/rtn/notes` + `DELETE /api/rtn/notes/:id`, session-gated. Drawer "Relationship notes" section between identity hooks and approach: jot a fact (📌 author + date), remove old ones; read-only on past dates. **Notes are team-shared** (continuity if a CS is off), not private per-CS. Additive migration `schema_v5_player_notes.sql` — new table only, nothing existing touched. *Deployed (D1 migration + worker + pages).*
   - **Next in this track:** tone profiles by tier (L3); variation pools to fight repetition; AI-assisted drafting (L5); optional: a 📌 indicator in the worklist/queue so CS see who has notes before opening.

---

5. **Delta view — "Changes" tab** — morning feed of what changed vs the previous snapshot: Returned (cold→deposited, a win to acknowledge), Entered grace, Went colder (class escalation), Tier dropped, New on the list. Fetches the prior snapshot via the existing board `?date=` param + same `classifyAll`, diffs client-side. Read feed with assigned/status tags, top-12 + Show all, graceful empty states. Frontend-only, no worker/DB. First buildable-now item from the roadmap. *Deployed (pages).*
6. **Changes → "portfolio movement" redesign + clickable drawer** — reworked the Delta page so it stops cloning Daily: a headline summary line with colored net direction (cooling/warming), per-brand rollup (fastest-bleeding first), a new **Priority changes** band (high-value players slipping — value-sorted by pnl), value-sorted Went colder, and direction-colored arrows + left borders (green warmed · red worsened · blue new) so the page reads as *flow*, not an action queue. Returned rows carry an "acknowledge & thank, don't over-reward" note. Standalone grace/tier-drop bands dropped (grace stays in Daily; demotions fold into Priority). Rows now open the **shared Drawer** over a flattened mover list (Prev/Next walks the movers), so a CS can act in place. Decision: Changes stays a standalone page to grow into a movement command center. *Deployed.*
   - **Next in this track:** mirror the movement summary + brand rollup onto the Dashboard as a "Today's movement" card; tighten `tierNum` once the real tier label format is confirmed; Player timeline view (~day 14, as history deepens).

## ✅ Shipped earlier session — by criticality

### 🔴 Critical — core workflow · data integrity · new capability
1. **Worklist redesign (the big one)** — Daily tab transformed from a flat ~2,700-row table into an action worklist:
   - View toggle: **Worklist** (default) / **Table** (old view preserved).
   - Priority bands: ACT NOW (red) · TODAY (orange) · WIN-BACK (yellow) · NO ACTION (muted, collapsed — kills the infinite scroll).
   - Plain-language instruction per row, right-aligned scannable amounts, visual hierarchy by urgency, "Show all N" per band.
   - Legend ("?") explaining DSLD / PNL / Tier / Whale / FRAGILE in plain words.
   - Sort fixed: biggest loss first in ACT NOW, DSLD order in WIN-BACK; ACT NOW tightened to ~15 (whale+meaningful-loss or top-10 losses).
2. **Message Library v1.0 — authored + wired in + live** (`src/messageLibrary.js` + `MESSAGES_GUIDE.md`) — all approach messages, RG guards, and worklist instructions in one editable file (class × tier matrix, 12 live variables, composable guards, 中文/BM-ready, de-laddered DSLD tones). Drawer → `buildMessage()`, worklist → `buildInstruction()`; hardcoded `buildApproach` (plus dead `HOOK` / `niceName`) deleted from App.jsx. Editing CS copy is now a single-file change.
3. **Date-by-date viewing** — date dropdown lists available snapshots; defaults to latest/today; past dates load on demand (page stays light) and are READ-ONLY with a banner; only today is actionable. (Touched the worker — read-only date filter.)
4. **Clear / undo contact** — accidental action-log clicks can be fully removed; the contact_log row is deleted so the player no longer counts in Performance and returns to untouched. (Protects measurement integrity.)

### 🟠 High — feature / signal value
5. **Worklist refinements (polish pass)** — each band shows top 10 by default with **Show all N / Show less** (NO ACTION paginated too, so 1,600+ healthy players never render at once); key amount moved out of the sentence into its own right-aligned bold column, vertically aligned for at-a-glance comparison; repeated instructions on consecutive rows dimmed so name + amount dominate; brand + tier pulled in beside the name and spelled "Tier V" / "Tier 3".
6. **Withdrawal Today column** — added beside Deposit Today (deposit + withdrawal = core money-movement signal); table widths rebalanced to stay clean.

### 🟡 Usability & cosmetic
7. **Clearable filter chips** — each active filter (Brand, Class, Tier, search) shows a removable "x" to reset it individually.
8. **Hover-dropdown fix** — Brand and Class menus no longer vanish before the cursor reaches them (button + menu act as one hover zone with a close delay).
9. **Renamed "Today" → "Daily"** — honest name now that the page shows any date.
10. **Date selector placement + styling** — moved to the right of the filter row above the count, restyled to match the Brand/Class buttons.

---

## ✅ Earlier foundational build (pre-session, already live) — by criticality
- Security hardening: CORS lockdown, admin-role enforcement, login delay, .0 identity sanitizer.
- Performance tab (save-rate By CS / Class / Brand) — the measurement loop.
- Whale classification (top-PNL Tier V) with ♛ marker + personal-handling guard.
- Zyra-vs-TC identity fix (Zyra shows UID, TC shows username) everywhere.
- Management Dashboard tab (Net flow, top dep/wd, reactivated, whales-at-risk, tier breakdown, deposit trend).
- Brand & Class converted to dropdown menus (from flat chip strip).
- Snapshot badge + sync clock (MYT) so data freshness is always visible.

## ✅ Infrastructure / process
- Migrated dev to **Claude Code** (native Windows install) with CLAUDE.md + HANDOFF.md context.
- Moved project out of OneDrive to `C:\Dev\groupb-tracker` (sync-lock fix).
- Git baseline + working commits as rollback points.
- Confirmed daily pipeline healthy: history stacking, all 6 brands × 2 tiers feeding, zero .0 artifacts.
- Established working rhythm: plan in chat → prompt Claude Code → review diff → deploy → commit.
- Deploy gotcha standardized: Pages must deploy to the **`production`** branch (`npm run deploy:pages -- --branch=production --commit-dirty=true`) to update the live domain — a plain deploy lands on a preview URL.

---

## Parked (see IDEAS.md)
- Class-card grouping (Option C)
- Per-account edit permissions
- Dashboard enrichment (per-brand drill-down, participation %, at-risk KPI, 7-day window)
- Alerts page + deposit drop/rise % alerts
- **Message library enrichment** (humanization track): ✅ Memory Hooks + ✅ Opening Angles shipped 2026-06-13. Remaining: Phase 1B deep history hooks (per-player history endpoint), tone profiles by tier (L3), relationship ledger / resurfacing CS note (L4), variation pools to fight repetition, AI-assisted drafting (L5)

## Related

- [[HANDOFF]] — deep reference
- [[IDEAS]] — parked features
- [[LAUNCH_CHECKLIST]] — pre-launch checks
- [[CLAUDE]] — operating rules
