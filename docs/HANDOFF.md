# HANDOFF.md — groupb-tracker · VIP RTN Console
**Audience:** Claude Code (and any engineer joining this project)
**Owner:** ATL — Assistant Team Leader, Team B, C9MYR VIP Retention (Malaysian online casino market)
**Status:** LIVE in production with real daily data. Handle with care.
**Last updated:** 2026-06-12

---

> **Note:** the critical operating rules below are also mirrored in `CLAUDE.md`, which Claude Code loads automatically every session. This `HANDOFF.md` is the deep reference (full domain model, strategy layer, backlog); keep the two in sync if the rules change.

## 0. Operating rules (read first)

1. **This system is LIVE.** The D1 database receives real player data daily at 15:00 MYT. Never run destructive SQL (`DELETE`, `DROP`, schema rewrites) or `wrangler deploy` without explicit approval from ATL.
2. **Never weaken the unique constraint** on `player_days` — `(player_key, snapshot_date, brand, tier_segment)`. A previous schema lacking `brand` caused silent cross-brand data corruption.
3. **Surgical edits over rewrites.** Modify existing files in place; do not regenerate whole files unless asked.
4. **ATL's style:** direct, concise, production-ready deliverables, honest critical feedback. Flag flaws proactively. No filler.
5. Environment: **Windows + PowerShell** (not WSL), wrangler v4.x. Always quote paths. For `wrangler d1` commands against production, `--remote` is mandatory — without it wrangler hits a local simulation.

---

## 1. What this system is

A daily VIP-retention action console for Team B's 6 casino brands. It ingests each brand's daily VVIP activity from Google Sheets, stores one row per player per day in Cloudflare D1, classifies every player into a behavior class (Phase 1 of a larger behavior engine), and gives the retention floor a prioritized work queue: who to contact today, with what approach, owned by which CS, with outcomes logged for save-rate measurement.

### Brand portfolio (Team B)
| Brand | Provider | Identity column | Display name |
|---|---|---|---|
| LPK777 | TC Gaming | `username` (uid is EMPTY) | username |
| ACE33 | TC Gaming | `username` (uid is EMPTY) | username |
| BM69 | Zyra Gaming | `uid` (username = long "K…" account code) | uid |
| HOT321 | Zyra Gaming | `uid` | uid |
| RM68 | Zyra Gaming | `uid` | uid |
| SK69 | Zyra Gaming | `uid` | uid |

**Canonical identity rule (critical):** `player_key = uid if non-empty else username` — derived server-side in the Worker at ingest. The frontend `dispName()` shows uid for Zyra, username for TC.

### Tier model
- VVIP 1–3 → `tier_segment = "3"` (Tier 3): volume segment, lighter handling.
- VVIP 4–7 → `tier_segment = "V"` (Tier V): high-value, personal handling, "Priority Support" sign-off.

---

## 2. Architecture (all Cloudflare)

```
Google Sheets (6 brand sheets, tabs "Daily" + "Daily V")
        │  Google Apps Script feeder per brand (daily trigger ~15:00 MYT)
        ▼  POST /api/ingest  (Bearer INGEST_TOKEN)
Cloudflare Worker  ──  groupb-tracker-api.viprtn.workers.dev   [worker/index.js]
        │  D1 binding: DB
        ▼
Cloudflare D1 (SQLite)  ──  name: groupb-tracker-db
                            id:   b817fdac-dd63-440b-8c58-869663beeec1
        ▲
Cloudflare Pages (React/Vite SPA)  ──  https://groupb-tracker.pages.dev   [src/App.jsx]
```

### Repo layout
```
vvip-console/
├─ worker\index.js          # the entire API (single file)
├─ src\App.jsx              # the entire frontend (single file) + main.jsx
├─ schema.sql               # original v1 schema (users + legacy tables)
├─ schema_v3_player_days.sql# player_days (current history table)
├─ schema_v4_contact_log.sql# contact_log (outcome layer)
├─ schema_v2_player_days.sql# OBSOLETE (entry_date axis bug) — safe to delete
├─ wrangler.toml            # worker config (root also has wrangler_bak.toml — stale)
├─ backup_before_wipe.sql   # pre-migration D1 dump (~1.3MB) — archival
├─ DEPLOY.md                # original deploy notes
├─ dist\                    # build output (Pages deploys this)
└─ apps script lives in Google Sheets, not in this repo (see §5)
```

### Deploy commands (PowerShell, from repo root)
```powershell
# Worker:
wrangler deploy
# Frontend:
npm run build
wrangler pages deploy dist --project-name=groupb-tracker
# D1 (production!):
wrangler d1 execute groupb-tracker-db --remote --file=.\<schema>.sql
wrangler d1 execute groupb-tracker-db --remote --command "SELECT ..."
```

---

## 3. Database (D1)

### `player_days` — the history accumulator (schema v3)
One row per player per brand per tier per day. The daily axis is **`snapshot_date`** (the push date, GMT+8, stamped server-side) — NOT `entry_date`, which is a static tier-entry date from the sheet and must never be used as a time axis.

Key columns: `snapshot_date, player_key, brand, tier_segment, uid, username, entry_date, previous_tier, tier, tier_movement, grace_end_date, status, status_days, group_name, daily_deposit_count, daily_deposit, daily_withdraw_count, daily_withdraw, monthly_deposit(+count), monthly_withdraw(+count), is_mau, lifetime_deposit(+count), lifetime_withdraw(+count), bet, valid_bet, win_loss, last_deposit_date, register_date, member_days, addressing, pnl, ingested_at`

- `UNIQUE (player_key, snapshot_date, brand, tier_segment)` — re-running a feed the same day overwrites that day (idempotent); a new day stacks a new row.
- `pnl` = lifetime player net (negative = player has lost = house ahead = your highest-value customers).
- `win_loss` = daily player net.
- History accumulation started **2026-06-11** (~2,718 rows/day across 12 brand-tier feeds).

### `contact_log` — the outcome/measurement layer (schema v4)
`UNIQUE (snapshot_date, player_key, brand, tier_segment)`; fields: `class, assigned_to, status, note, updated_by, updated_at`.
Status flow: `ASSIGNED → CONTACTED → RESPONDED / RECOVERED / NO_RESPONSE / SKIPPED`. Save rate = RECOVERED ÷ actioned (contacted+responded+recovered+no_response).

**Ownership rule (shipped 2026-07-10, `d7c4389`).** Clicking a status button in the Drawer falls back to the **logged-in agent** (`me.username`) when no assignee was picked, so a contact can never be saved unowned. It never overwrites an assignee a manager chose on purpose, and saving a *note alone* does not assign. Why it matters: the reactivation bonus only counts a RECOVERED row that has an `assigned_to` — before this, an agent who forgot the dropdown silently lost the point. (One-off backfill of the 21 pre-existing unowned July rows: Agent H 18, Agent B 2, Agent C 1.)

**Attribution trap.** `updated_by` looks like "who did it", but `autoOutcomes` **overwrites it with `'auto'`** whenever it flips a row. So for NO_RESPONSE/RECOVERED rows the original agent is gone from that column. To attribute an old row, query `activity_log` where `action='contact' AND detail LIKE 'Status CONTACTED%' AND detail LIKE '%<player_key> (<brand>)'`, and pick the entry whose timestamp lines up with that row's `snapshot_date` — "most recent action for that player" is **wrong** (agents touch the same player across different snapshot rows). `updated_by` IS authoritative when it isn't `'auto'`.

### Automated outcomes (`autoOutcomes`, hourly cron)
Two rules, **RECOVERED evaluated first** so a deposit always beats a stale-timeout.

1. **Auto-RECOVERED (= "reactivation").** A real contact (`CONTACTED`/`RESPONDED`/`NO_RESPONSE`) within the last **20 days**, to a player who was cold **at contact time** (feeder `group_name` ∈ Inactive 1-2 / 3-6 / 7-13 / 14-20 / 21-29 Days, or Churn), who then makes a deposit (`daily_deposit > 0`) **after** the contact and **inside the coldness window**:
   - **3 days** if they were *Inactive 1-2* or *3-6 Days*,
   - **14 days** if they were *Inactive 7-13 / 14-20 / 21-29 Days* or *Churn*.

   One recovery per player per 20-day window (skips if an existing RECOVERED is present); credit goes to the **most recent** contacting agent.
2. **Auto-NO_RESPONSE.** A `CONTACTED` row the agent hasn't updated in **6 hours** → `NO_RESPONSE`. Scans the last **7 days** of snapshots. It's about the customer not replying, not deposits — a later in-window deposit **upgrades** it back to RECOVERED on the next cron.

**Reactivation KPI bonus has no window of its own** — it is simply `COUNT(DISTINCT player_key)` of `status='RECOVERED'` per `assigned_to` for the current month (`GET /api/rtn/kpi` → `reactivation`). It requires a non-null `assigned_to`, hence the ownership rule above.

### `users` — dashboard logins
`username, password_hash (SHA-256 + env salt), role ('admin' | 'member')`. Admin = ATL; member = CS reps (the Team B agents).

---

## 4. Worker API (worker/index.js — single file)

Auth: session token (login) for dashboard routes; `Bearer INGEST_TOKEN` for `/api/ingest` (independent of sessions). CORS restricted to `*.groupb-tracker.pages.dev` + localhost. Failed logins delayed 1s. Admin-only enforcement on user management.

| Route | Purpose |
|---|---|
| `POST /api/login`, `GET /api/me`, `POST /api/users/init` | auth/session |
| `GET/POST /api/users`, `DELETE /api/users/:id`, `POST /api/change-password` | user mgmt (admin enforced) |
| `POST /api/ingest` | feeder upsert. Derives `player_key`, stamps `snapshot_date` (GMT+8), sanitizes float artifacts (`"123.0"`→`"123"` on uid/username/addressing), coerces `#REF!`/`#N/A`/blank → null, batched at 25 rows |
| `GET /api/rtn/board` | one-call console payload: latest snapshot rows + 7d contact_log + per-brand feed health (`last_fed`) + team list + `synced_at` |
| `POST /api/rtn/contact` | upsert assignment/status/note (stamps `updated_by`) |
| `GET /api/rtn/performance` | last-30-day contact_log rows for save-rate tables |
| `GET /api/rtn/trend` | per-snapshot aggregates (players, dep, wd, wl), last 14 |
| `GET /api/rtn/latest`, `GET /api/rtn/dates` | earlier utility routes |
| `POST /api/rtn/lark-sync` | pull Telegram links from the Lark P&L1 table → `player_telegram` (managers). `?dry=1` = count + sample only, writes nothing. Also runs daily via cron. See §5.1 |
| `GET /api/rtn/lark-debug` | manager peek at the Lark Base: table list, `?table=<id>` lists that table's views, `&view=<id>&n=<N>` samples N rows |

`INGEST_TOKEN` is a wrangler secret. Current value is known to ATL; rotation is queued (see backlog).

---

## 5. Ingest pipeline (Google Apps Script — lives in each brand's Google Sheet)

File pattern: `apps_script_feeder.gs`, one copy per brand sheet, differing only in `CONFIG.BRAND`. Reads tabs **"Daily"** (Tier 3) and **"Daily V"** (Tier V), maps columns **by header name** (column order varies), formats dates GMT+8, POSTs in batches to `/api/ingest`. Daily time trigger at **15:00 MYT** (team updates sheets at 14:00). Manual run: `runFeedNow()`. Token stored in Script Properties.

**Not yet fed (biggest strategic gap):** each sheet also has **"DR"** and **"standby"** tabs holding cold/dormant players — the precise population retention exists to recover. The active Daily tabs mean current DSLD numbers skew low. Wiring these tabs in = extend feeder CONFIG + confirm their column layout matches.

---

## 5.1 Lark → Telegram link auto-sync (shipped 2026-07-10)

Fills each player's Telegram/LiveChat link automatically from a Lark Base, replacing the manual per-player paste. **One-way: Lark is the source of truth.** Code lives in `worker/index.js` (`larkTelegramSync` + helpers `larkToken`/`larkRecords`/`larkText`/`larkUrlField`/`normalizeLivechat`, `LARK`/`LARK_BRAND`/`PNL1_TABLE`/`PNL1_TEAM_VIEWS` consts).

**When it runs**
- The Worker cron fires hourly (`0 * * * *`). Once a day, at **00:00 MYT (16:00 UTC)**, `scheduled()` also runs the sync (gated on `getUTCHours()===16`). It's wrapped in its own `.then` handler so a Lark failure can't affect the hourly `autoOutcomes` job.
- Managers can also trigger it any time via `POST /api/rtn/lark-sync` (add `?dry=1` to preview counts without writing).

**Where it reads**
- Base **"Telegram Approaching"** (`LARK.BASE = Hstmbhe1Wakn2zs9HSelYFq1gig`), table **P&L1** (`tbl2cAhlR75Kr3iI`), reading **only the Team A / Team B / Team C views** (`vewMADSF1q` / `vewToNmnfj` / `vewcZg2cfc`). The **Overview** view is skipped on purpose — it contains blank-telegram rows.
- Auth: the shared **`LARK_APP_ID` / `LARK_APP_SECRET`** Worker secrets (the Team A ATL's "Google Drive" app, `cli_aaad54186e785ed2`). The app needs *Can view* on P&L1 via that table's **Advanced Permissions** (base-level sharing alone is ignored while advanced perms are on).

**Per-row logic** (~1,972 rows/run)
1. `Username` → `player_key`. Empty → skip (`noKey`).
2. `Brand` short code → full brand via `LARK_BRAND` (strip trailing digits map: `LPK`→`LPK777`, `PP`→`PP96`, `MY`→`MY36`…). Unknown code → skip (`noBrand`, code counted in `skippedBrands`).
3. `Telegram combine` (a Lark url field) → cleaned by `normalizeLivechat`: drops placeholders (`http://`), removes an accidental second link pasted with no separator, and rewrites to the uniform **`https://my.livechatinc.com/archives/<chatId>?shared=true`** (chatId = last segment of `/chats/<group>/<chatId>`). No usable link → skip (`noUrl`).
4. Survivors upsert into **`player_telegram (player_key, brand, url, updated_by='lark', updated_at)`**, keyed on `(player_key, brand)`, in batches of 50. Existing links **overwrite**.

**Guarantees & limits**
- **Never deletes.** A player removed from the Lark sheet keeps a stale link until something overwrites it.
- **Does not touch tier** — tier comes from the daily `player_days` feed, the correct source.
- Last run: **1,971 links saved, ~100% matched** to a real `player_days` player across all brands (incl. Zyra BM69/HOT321/RM68/SK69). ~1 orphan link/run (no matching player) is harmless.

**Where it surfaces in the UI:** the **✈ Open Telegram chat** button in the player Drawer; the **✈ TG** column/flag in the Today queue (players with a link sort up); the **Dashboard "TG reach" %** per brand.

**Debugging:** call the endpoints from a logged-in manager browser with `Authorization: Bearer <localStorage.session_token>`. Don't transcribe the token from a screenshot (the hex signature OCRs wrong) — run `fetch(...)` in the console instead. `?appinfo=1` on lark-debug errors (the app lacks the self-info scope) — ignore it.

---

## 6. Frontend (src/App.jsx — single file, React + inline CSS)

Nav: **Dashboard · Today · Performance · Settings** (+ login screen, role-aware).

- **Today (action queue):** brand plaque rail (counts, deposit totals, alert breakdown like `20 loss · 15 blocked · 7 cold`, STALE chip if a brand wasn't fed today, banner naming stale brands), Brand▾/Class▾ hover dropdowns with live counts, search, tier toggle, **My queue**, **Export N** (CSV download + identity list to clipboard for blasts), progress bar (actioned X/Y), sortable columns, load-more, badges: FRAGILE (reactivated ≤14d), ♛ WHALE (top-PNL-quartile Tier V), COOLING (contacted <48h — row dimmed).
- **Player drawer:** classification + reason, **Approach panel** with a ready-to-send message from the Behavior Classification Book (name auto-fill via `addressing` fallback, Tier V vs Tier 3 variants, provider hooks: TC = Fortune Wheel/Golden Egg/Rescue Bonus; Zyra = Lucky Wheel/Plinko/Cashback), RG-guard warnings (Top Loss = relief only, never "win it back"), Copy button, assign-to-CS select, status buttons, note, **Next player →** flow, full profile (today / month / lifetime / status & tier).
- **Dashboard (management):** KPI row (deposits +Δ% vs prev day, withdrawals, net flow, player W/L with "negative = house ahead", players/MAU), deposit-trend bars (one per snapshot), top depositors/withdrawals, reactivated-and-deposited, whales-at-risk, tier breakdown.
- **Performance:** last-30-day save-rate tables **By CS / By Class / By Brand** (assigned/contacted/responded/recovered/no-response/actioned/Save% with color thresholds).
- **Settings:** change password; admin-only team management (add member/admin, remove).

### Phase-1 classification (client-side `classifyAll`, first-match precedence)
`GRACE` (grace_end ≤3d) → `TOP_LOSS` (top-20 daily loss/brand) → `TOP_DEP` (top-20 deposit + winning) → `BLOCKED` (valid_bet>0, deposit=0, DSLD≥7) → `DSLD30/14/7` → `WATCH` (3–6d, no contact) → `HEALTHY` (no contact). Overlays: FRAGILE (group_name starts "Reactivated 1-6"), WHALE. GRACE WATCH = all grace players sorted by days left (runway view; note: GRACE often shows 0 because deadlines cluster at month-end — by design).

---

## 7. The strategy layer (three reference books — keep beside the code)

1. **Segmentation Logic v1.0** — daily decision engine: one player → one contact/day, perishability-first waterfall, suppression (RG firewall, bonus-hunter), de-laddered DSLD rewards (never escalate offer by days waited), contact/spend budgets, measurement.
2. **Behavior Variable Dictionary v1.0** — ~90 variables in 13 layers incl. day-code grammar `D/B/W/X` (Deposit/Bet-only/Withdraw/Absent); tags which variables are snapshot-ready vs need history.
3. **Behavior Classification Book v1.0** — 13 cards BC-01…BC-13 (Consistent Core, Micro-Pause, Acute Churn cliff, Sporadic, Decelerating Fade, Heating, Burst, Deposit-Blocked, Winner-Flight, Loss-Shock, Withdrawal-then-Silence, Reactivated/Fragile, New) — each with detection signature, approach, message templates, and an explicit "DON'T".

**Phase 2 (not built):** a classification cron that computes day-code sequences/gaps/baselines from accumulated `player_days` history and writes a `behavior_class` — activates the cliff/fade/pause/archetype cards (incl. the mandatory-for-Malaysia **Payday Cycler**). Sensible from ~14–30 days of history (counting from 2026-06-11).

---

## 8. Known issues & honest limitations

- **Password hashing is SHA-256 + static salt** — acceptable for an internal 6-person tool, below corporate-product bar (PBKDF2/per-user salts queued).
- **Any member can update any player's contact status** (trusted-team model). An append-only `activity_log` (who · when MYT · IP) does record every meaningful action — see `GET /api/activity`, managers-only. Note `contact_log.updated_by` is *not* a reliable actor record: the cron rewrites it to `'auto'` (see §3 "Attribution trap").
- **No rate limiting** beyond the 1s failed-login delay (proper limiter needs KV/Durable Objects).
- **Dashboard trend/deltas need ≥2 snapshots** — blank on day one is correct behavior.
- Stale repo files: `schema_v2_player_days.sql`, `wrangler_bak.toml`, `worker/index_bak.js` (if present), `backup_before_wipe.sql` — archival/deletable.
- Apps Script feeder error-handling is minimal (no retry/alert on failure); feed health surfaces in the UI instead.

---

## 9. Backlog (priority order)

1. **Feed DR/standby tabs** — unlock the cold/dormant population (needs tab-name + layout confirmation from ATL, then feeder CONFIG extension; consider `source_tab` column).
2. **Players history view** — search any player across snapshots; behavior timeline; worth building once ~7+ days of history exist.
3. **Phase-2 sequence engine** — scheduled Worker (cron) computing day-codes/streaks/gaps/baselines → `behavior_class` table → surface BC cards in UI.
4. **Deposit drop/rise alerts** vs each player's own baseline (needs history).
5. **Delta view** — "what changed since yesterday": new grace entries, new tier drops, fresh churn signals.
6. **Bulk assign** (e.g., 30 Tier-3 win-backs → one CS), notes history (don't overwrite), "new data available" nudge after 15:00.
7. **Security hardening for corporate-grade**: PBKDF2 + per-user salts, audit log, password reset, session timeout, KV rate limiting, INGEST_TOKEN rotation.
8. 中文/BM translations of approach templates (Zyra Internal Mail requires EN/中文/BM).
9. **Telegram-link auto-cleanup** — the Lark sync (§5.1) never deletes, so a link stays after a player leaves the Lark sheet. Optional: prune `player_telegram` rows (`updated_by='lark'`) no longer present in the latest sync.

**Open product question (ATL to decide):** internal floor tool vs sellable corporate product — flips the priority of #7 vs #1–3.

---

## 10. Daily verification (until trust is established)

After 15:00 MYT:
```powershell
wrangler d1 execute groupb-tracker-db --remote --command "SELECT snapshot_date, COUNT(*) AS rows FROM player_days GROUP BY snapshot_date ORDER BY snapshot_date"
```
Expect one new row per day. In the UI: snapshot badge shows date + sync clock (MYT); any brand not fed today gets a STALE chip + banner.

## Related

- [[CLAUDE]] — operating rules + architecture
- [[EXECUTED_IDEAS]] — what shipped
- [[IDEAS]] — parked features
- [[LAUNCH_CHECKLIST]] — pre-launch checks
- [[DEPLOY]] — provisioning guide
- [[KPI_ENGINE_FULL_SPEC]] — KPI engine spec
