# VVIP Console: Handover Pack

From: VIP Retention, ATL (1st PIC)
To: AI Department
Handover date: 28 Oct 2026
Status: Final, approved by the ATL on 28 Oct 2026

## 1. What it is

The VVIP Tracker console for VIP Retention Teams A, B and C. It covers:
- Daily player snapshots per brand and tier
- Contact assignment and outcomes
- KPI tracking, the daily report, the Tier V login check
- Task chat and the Live board

**It holds real player and deposit data.**

- App: https://groupb-tracker.pages.dev
- API: https://groupb-tracker-api.viprtn.workers.dev
- Source: GitHub `c9myr-vip-retention/vvip-console`, branch `main` (`bb40719` on 28 Oct 2026; the commits after `49d8830` are docs only)
- **Live version check (27 Oct 2026):** building `main` at commit `49d8830` produces `index-f3290ed1.js`, which is the same bundle the live site serves. So `main` is the live front end. The Worker cannot be checked the same way; see section 10.

Full detail (every screen, API route, scheduled job, table, permission flag and troubleshooting case) is in the **Technical appendix** at the end of this pack.

## 2. Stack

| Part | Detail |
|---|---|
| Front end | React 18 + Vite 4, mostly in one file, `src/App.jsx`. Served by Cloudflare Pages. Player classification runs in the browser. |
| API | Cloudflare Worker (`worker/index.js`, plus `perms.js` and `roles.js`). Routes are hand-written. |
| Database | Cloudflare D1 (SQLite). The schema is applied in numbered files, `schema/schema_v3` to `schema_v34`. |
| Scheduled jobs | Worker crons `0 * * * *` (hourly jobs) and `15 4 * * *` (12:15 MYT feeder kick-off) |
| Tests / lint | None |

## 3. External feeds and integrations

| Feed | How it works |
|---|---|
| Brand data | 25 Google Apps Script feeders, one per brand (`scripts/feeders/A`, `B`, `C`). They POST to `/api/ingest` with `INGEST_TOKEN`. The Worker starts them at 12:15 MYT; backup triggers run at 15:00, 19:00 and 22:00. The source Google Sheets (tabs "Daily" and "Daily V") are updated around 14:00. |
| Telegram links | Synced from the Lark Base "Telegram Approaching" P&L1 table at 00:00 MYT |
| Engagement counts | Synced from the Lark "Engagement" table at 09:00 and 14:00 MYT |
| Feed-health card | Sent to a Lark group bot at 15:00 MYT |
| Reply widget | The browser widget calls `/api/ext/*` with `WIDGET_API_KEY` |

Owner of the Apps Script projects (checked 28 Oct 2026):
- All 25 projects (24 brand feeders plus "New/Risk Extract") are owned by one Google account outside VIP Retention, not by the department. The ATL names the account holder at the handover meeting.
- The ATL has access through sharing.
- Ownership of the projects and the source sheets has to be agreed with that account's holder.
Lark apps (checked 28 Oct 2026):
- **Live app.** Every live Lark sync (Telegram, Engagement, widget bonus and grace reads) uses the one app in `LARK_APP_ID`. According to `docs/HANDOFF.md` this is the Team A ATL's "Google Drive" app (`cli_aaad54186e785ed2`), which VIP Retention does not own. Re-home it to an AI Department app, give that app *Can view* on the Lark tables, then update `LARK_APP_ID` and `LARK_APP_SECRET`.
- **Unused app.** The ATL owns one app, "VIP RTN Telegram Sync" (`cli_aac5d1c311615ed3`). It is in "Pending release" and not used by the Worker. Delete it or transfer it.
- **Feed-health card.** It uses a group custom bot webhook (`LARK_FEED_WEBHOOK`), not a developer app. It moves with the Lark group.

### 3.1 Where the feed comes from and where it is saved

**The path of one day's data:**
1. The team updates each brand's Google Sheet, tabs **"Daily"** (Tier 3) and **"Daily V"** (Tier V), at about 14:00 MYT.
2. Each sheet has its own Apps Script feeder, bound to that sheet. The source is in `scripts/feeders/<team>/`. The live copy runs inside the sheet.
3. At 12:15 MYT the Worker calls every feeder through its Web App URL (Worker secret `FEEDER_URLS`). Each feeder also has backup time triggers at 15:00, 19:00 and 22:00 MYT.
4. The feeder POSTs both tabs to `https://groupb-tracker-api.viprtn.workers.dev/api/ingest`, signed with `INGEST_TOKEN` (stored as a Script Property in each feeder and as a Worker secret).
5. The Worker saves the rows in the D1 database `groupb-tracker-db`, table **`player_days`**: one row per player, day, brand and tier. It stamps the date in MYT and updates `daily_brand_stats`.
6. The console reads `player_days` through `/api/rtn/board`.

**Brand feed sheets** (checked in Apps Script on 28 Oct 2026; every project is owned by one account outside VIP Retention):

| Team | Brand | Feeder source in repo | Live sheet (holds the feeder) | Note |
|---|---|---|---|---|
| A | JOM99 | `scripts/feeders/A/1. JOM99.gs` | Not found | No Apps Script project found in the shared list. Confirm whether this brand still feeds. |
| A | EZ96 | `scripts/feeders/A/2. EZ96.gs` | [Open](https://docs.google.com/spreadsheets/d/1PoFCvlgUEKCITanNeSunOutcJxeRiIcmgbf7UUlTncs/edit) |  |
| A | PP96 | `scripts/feeders/A/3. PP96.gs` | [Open](https://docs.google.com/spreadsheets/d/1BZ6vxTXS9ITV0VzlxvRNZ90Dnmm-BZtedVYaz1MPsA4/edit) |  |
| A | BIG321 | `scripts/feeders/A/4. BIG321.gs` | [Open](https://docs.google.com/spreadsheets/d/1K1hYoMdFDfvmaAu2SV9arxHxH8U-04Rkauk9iT3fmnU/edit) |  |
| A | FUN36 | `scripts/feeders/A/5. FUN36.gs` | [Open](https://docs.google.com/spreadsheets/d/1SA9ItChA-tKWp8tkVFGq4V8-VRRaDZd6HxVffUuPaw0/edit) |  |
| A | JUS22 | `scripts/feeders/A/6. JUS22.gs` | [Open](https://docs.google.com/spreadsheets/d/1brjE1WkM4K8dFPwbWgykB-UnV2EI0Mf_A9aElg7sHF0/edit) |  |
| A | YES82 | `scripts/feeders/A/7. YES82.gs` | [Open](https://docs.google.com/spreadsheets/d/1PV9vhrZK-kQrF0NJOl8uWjFTQ3cTBjdIUtQez8Av5Ec/edit) |  |
| A | SA | `scripts/feeders/A/8. SA.gs` | [Open](https://docs.google.com/spreadsheets/d/10q10IZ3Fr3I-liGXURRPZ-Ac3pkZEGd1UD7iiNUlJaM/edit) |  |
| B | LPK777 | `scripts/feeders/B/1. LPK777.gs` | [Open](https://docs.google.com/spreadsheets/d/1pUWnjD9sa9wwedImTihzGuZcyvTObhX57Ku4kuRUfZw/edit) |  |
| B | BM69 | `scripts/feeders/B/2. BM69.gs` | [Open](https://docs.google.com/spreadsheets/d/1aZXopsjW95sbZDuE2z-YjaHMjZ_Q27EGVonn1LVjIlE/edit) |  |
| B | HOT321 | `scripts/feeders/B/3. HOT321.gs` | [Open](https://docs.google.com/spreadsheets/d/1yRjg6MVOWtZhxqnu7XeVtilWzUYGD2SLVjIh5m9suyg/edit) |  |
| B | RM68 | `scripts/feeders/B/4. RM68.gs` | [Open](https://docs.google.com/spreadsheets/d/1t3idXV2dDy01LmtI5wp15bB0A-W5aRIQ-yJuD1BGYEw/edit) |  |
| B | SK69 | `scripts/feeders/B/5. SK69.gs` | [Open](https://docs.google.com/spreadsheets/d/1eB-puxQEBcw-Z1ObbbrgW0eyTYPdrBa3TaX7A0vSvz8/edit) |  |
| B | ACE33 | `scripts/feeders/B/6. ACE33.gs` | [Open](https://docs.google.com/spreadsheets/d/1uZU0S5-fdVXrCe1zxzlgGOy-sTGscLo_hx_tzGh62Bo/edit) |  |
| B | JK32 | `scripts/feeders/B/7. JK32.gs` | [Open](https://docs.google.com/spreadsheets/d/1XFg9Cd2jTEI5JH3UfU_3U8pdzxIAAhmgm2Nww0dkB4g/edit) |  |
| B | ZAS36 | `scripts/feeders/B/8. ZAS36.gs` | [Open](https://docs.google.com/spreadsheets/d/1hJJ4mtuvhQhftPIjUcmNYJoCvzc1kW6JK5lefPTkTtE/edit) |  |
| C | SPIN321 | `scripts/feeders/C/1. SPIN321.gs` | [Open](https://docs.google.com/spreadsheets/d/1yuWcxGAHhZf87mHzT126xhPziibK61mR8c2U8IFu-Q4/edit) |  |
| C | MY36 | `scripts/feeders/C/2. MY36.gs` | [Open](https://docs.google.com/spreadsheets/d/1tPLLGPgAsrv2Wf_J7sHfWsBbk5fNNOa6dVS513X8xDQ/edit) |  |
| C | ONG66 | `scripts/feeders/C/3. ONG66.gs` | [Open](https://docs.google.com/spreadsheets/d/1sHm-v7DIoX_GOHq7kLi9S4VebR6zbf8hwtJfq__-BaI/edit) |  |
| C | VS96 | `scripts/feeders/C/4. VS96.gs` | [Open](https://docs.google.com/spreadsheets/d/1MT20yne_PjtU8L2jdQzW2FJqd9eHHpFIwHW-b7MzWlE/edit) |  |
| C | MAX39 | `scripts/feeders/C/5. MAX39.gs` | [Open](https://docs.google.com/spreadsheets/d/1Qm19kf5mqTKrgsQ8-b7SDJ4YUeXB3JxnAKAQOWlaKBw/edit) |  |
| C | RUSH33 | `scripts/feeders/C/6. RUSH33.gs` | [Open](https://docs.google.com/spreadsheets/d/1ycMNi_a0DCUmghc_r19qhyRvC3DuSyZXNgI1jHCz0kc/edit) |  |
| C | OMG67 | `scripts/feeders/C/7. OMG67.gs` | [Open](https://docs.google.com/spreadsheets/d/11QYFY5qNM-xyEhcdUF4FV6VE-5Ui236VfKwLhpF6D94/edit) |  |
| C | AC69 | `scripts/feeders/C/8. AC69.gs` | [Open](https://docs.google.com/spreadsheets/d/1MWyb7l5P82JEopGGgYfRGuf8VqOthp0vdHxszNW0jgc/edit) |  |
| C | OG | `scripts/feeders/C/9. OG.gs` | [Open](https://docs.google.com/spreadsheets/d/142QRJpAqKRafv7urT5JQmcs0G1rY5WqPvdGTXcI9rwQ/edit) |  |

**Other sheets in the same Apps Script list:**
- "New/Risk Extract" ([Open](https://docs.google.com/spreadsheets/d/1MpiZnDzHox-5WKJSEUR8nhxATbdl1VFdB2_nFTEf37k/edit)). It isn't referenced by the Worker code; its purpose is not confirmed.
- Three "Untitled project" scripts. They are not part of the feed.

**What the AI Department needs:**
- Edit access to every sheet above, so they can maintain the feeders.
- Each sheet's Web App URL. These are in `FEEDER_URLS`; redeploying a feeder changes its URL, so update the secret afterwards.
- When `INGEST_TOKEN` is rotated, it must be updated in all 25 feeders and in the Worker, all at the same time, or the feeds stop.

The sheets hold player data. Share them only with named AI Department staff.

## 4. Cloudflare resources

| Resource | Value |
|---|---|
| Account subdomain | `viprtn` |
| Worker | `groupb-tracker-api` |
| Pages project | `groupb-tracker`, branch `production` |
| D1 | `groupb-tracker-db`, id `b817fdac-dd63-440b-8c58-869663beeec1` |
| Var | `ENVIRONMENT=production` |
| Secrets set on the live Worker (names only, checked 28 Oct 2026) | `SESSION_SECRET`, `PASSWORD_SALT`, `INGEST_TOKEN`, `FEEDER_URLS`, `LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_FEED_WEBHOOK`, `LARK_FEED_SECRET`, `WIDGET_API_KEY`, `WIDGET_LARK` |
| Optional, not set | `LARK_HOST`, `WLARK_APP_ID`, `WLARK_APP_SECRET` |
| Cloudflare account | "Aldok.ma@orionesofttech.com's Account", id `14e65f2d50852aa895d2f46d673f7209`, under the ATL's company email |
| Cloudflare members (28 Oct 2026) | 3 members, **all Super Administrators**: the ATL's company email (2FA off), a developer's personal Gmail (2FA off), and a Team B Senior's personal Gmail (2FA on). The two personal Gmails must be removed or reduced at handover. |

### 4.1 Worker variables and secrets, one by one

Where to find them: Cloudflare dashboard > Workers & Pages > `groupb-tracker-api` > Settings > **Variables and Secrets** (Production). Secret values can't be read back, only replaced. To change one from the command line: `npx wrangler secret put <NAME>`.

| Type | Name | What it is | Used by | If you change it |
|---|---|---|---|---|
| Variable | `ENVIRONMENT` | Label, set to `production` | Nothing in the code reads it | Safe to leave as is |
| Secret | `FEEDER_URLS` | The Web App URLs of the 25 brand feeders, separated by commas or spaces | The 12:15 MYT feeder kick-off and the manual "run feeders" button | Update it whenever a feeder is redeployed, because the Web App URL changes |
| Secret | `INGEST_TOKEN` | Shared key the feeders send with their data | `/api/ingest`, and the body of the 12:15 kick-off | Must also be changed in the Script Properties of all 25 feeders, **at the same time**, or every feed stops |
| Secret | `LARK_APP_ID` | ID of the Lark app the Worker uses (today, the Team A ATL's app) | Telegram sync (00:00), Engagement sync (09:00, 14:00), widget bonus and grace lookups | Replace together with `LARK_APP_SECRET` when moving to an AI Department app. The new app needs view access on the Lark tables |
| Secret | `LARK_APP_SECRET` | Secret of that Lark app | Same as above | Rotate in the Lark developer console, then paste the new value here |
| Secret | `LARK_FEED_WEBHOOK` | URL of the Lark group bot that receives the feed-health card | The 15:00 MYT feed card | Change when the bot is recreated or moved to another group |
| Secret | `LARK_FEED_SECRET` | Signing secret of that group bot | Same as above | Must match the bot's security setting in Lark |
| Secret | `PASSWORD_SALT` | Added to every password before hashing | Login, user creation, password change | **Do not rotate.** Every stored password depends on it. Changing it locks out all users, and there's no admin password reset. **The value is not held by VIP Retention (checked 28 Oct 2026)** and Cloudflare cannot show it. Moving to another server therefore needs a password reset for every user: build an admin reset (or a one-time reset flow) first |
| Secret | `SESSION_SECRET` | Signs the 8-hour login tokens | Every logged-in request | Safe to rotate. Everyone is logged out and signs in again |
| Secret | `WIDGET_API_KEY` | Key the Livechat reply widget sends to `/api/ext/*` | The reply widget | Change it in the widget's settings too, or the widget stops |
| Secret | `WIDGET_LARK` | Settings (JSON): the Lark base and table IDs for the bonus and grace lookups | Widget lookups and the grace claims screen | Not a password. Change only when the Lark tables move |

Optional, not set today: `LARK_HOST`, `WLARK_APP_ID`, `WLARK_APP_SECRET` (a separate Lark app for the widget).

The D1 database is connected through the `DB` binding in `wrangler.toml`, not through a secret.

## 5. Commands

- Local dev: `npm run dev`. **Warning: local dev talks to the LIVE API.**
- Build: `npm run build`
- Deploy API: `npm run deploy:worker`
- Deploy front end: `npm run deploy:pages`
- Schema change: `npx wrangler d1 execute groupb-tracker-db --remote --file=./schema/<file>.sql`
- Verify a deploy: the `index-*.js` name served by the live URL must match the one in `dist/assets`.

**Deploys run from the local working tree, not from git.** Always deploy from a clean checkout of `main`.

Rollback (not documented before this pack):
- Front end: Cloudflare dashboard > Pages > `groupb-tracker` > Deployments > roll back to the previous deployment.
- Worker: Cloudflare dashboard > Workers > `groupb-tracker-api` > Deployments > roll back. Or check out the previous commit and run `npm run deploy:worker`.
- Database: there is no automatic rollback. Use D1 Time Travel (`wrangler d1 time-travel`) or the export backup.

## 6. Login and roles

- Username and password. The token is signed with `SESSION_SECRET`, lasts 8 hours and is kept in the browser's localStorage.
- Passwords are stored as `sha256(password + PASSWORD_SALT)`.
- Roles and hierarchy are in `worker/roles.js` and `worker/perms.js`. Users have a team (A, B or C), and only see the brands of their team unless they are a manager.
- Managers add users in Settings. A guard stops removal of the last manager.
- Every action is logged in `activity_log` (who, when, IP).

## 7. Main D1 tables

| Group | Tables |
|---|---|
| Core data | `player_days` (daily snapshot per player, brand and tier), `contact_log` (assignment, status, outcome) |
| Player records | `player_notes`, `player_crm`, `player_telegram`, `livechat_log` |
| KPI | `kpi_retention`, `kpi_team_month`, `kpi_agent_marks`, `kpi_team_challenge`, `kpi_agent_month`, `kpi_challenge_eng`, `mistakes` |
| Campaigns | `code_events`, `code_bands`, `code_assignments` |
| Daily | `daily_brand_stats`, `player_assignment`, `daily_login_check`, `engagement_daily`, `feed_check_state` |
| Admin | `users`, `activity_log`, plus the task chat, live pulse and attachments tables (schema v30 to v34) |
| Legacy, unused | `players`, `history`, `upload_log` |

## 8. Business rules (business owner: VIP Retention)

**Change these only with VIP Retention approval.** They drive KPIs and staff scoring.

**Data timing**
- **Data lag:** console screens show yesterday's data. A brand whose newest deposit date trails the others gets a LAG chip.
- **Downgrade:** downgrade happens on the 2nd of the month. The month pool is the screen of the 2nd; month end is the screen of the next 1st.

**Player keys and classes**
- **Player key:** uid, or username for TC brands, which have no uid. Snapshot dates are stamped in MYT.
- **Class order** (`src/App.jsx`): GRACE, TOP_LOSS, TOP_DEP, BLOCKED, DSLD30/14/7, WATCH, HEALTHY.
- **Flags:**
  - FRAGILE: recently reactivated groups.
  - WHALE: Tier V in the top PNL quartile.
  - COOLING: a whale quiet 5 to 6 days.

**Contact outcomes and reactivation**
- **Auto outcomes (hourly):**
  - RECOVERED: a contact, then a deposit within the set window (3 days if the player was inactive 1 to 6 days; 14 days if inactive 7 to 29 days or churned).
  - NO_RESPONSE: a contact not updated for 6 hours.
- **Contact must come before deposit** for any recovery credit.
- **Reactivation rate:** distinct players recovered divided by distinct players contacted. Console "Actioned" counts touches and is never the denominator.
- **Retention across brands:** weighted (sum of depositors / sum of population), never a simple average of brand percentages.

**Teams and schedules**
- **Team map:** `TEAM_BRANDS` in `worker/index.js` must match `TEAMS` in `src/App.jsx`.
- **Campaign rotation calendar:** `worker/index.js`, anchored on 2026-07-26.

**Reports and login check**
- **Report:** a deposit move is reported only when it clears both RM10,000 and 15 percent.
- **Login check:** ticked daily by hand per agent for Tier V. The deposit amount comes from the feed and confirms the next day.

## 9. Open backlog and known bugs

**Known bugs**
- Auto NO_RESPONSE floods (150 of 152 contacts on 16 Oct).
- Telegram links are never deleted, so the count is about 1,000 too high.
- 11 feeders sometimes reply with a Google page instead of JSON.
- Engagement routes are defined twice in `worker/index.js`, so the second copies never run.

**Found in the code review (28 Oct 2026)**
- `autoAssignRosters` (15:00 MYT) uses a hardcoded Team B agent list for every brand's roster.
- Any account that can log contacts can also write every `/api/rtn/kpi/*` input.
- `kpi_team_month` and `kpi_challenge_eng` have no team column, so one row per month is shared by all teams.
- Dead or unused routes: the duplicate engagement routes, `kpi/agent`, `kpi/challenge`, `/api/rtn/latest`, and the v1 `players` and `upload` routes.
- Campaigns is only reachable in the old console (`?revamp=0`).
- There is no admin password reset. Users can only change their own password.
- Which schema files have run on production is not tracked. The Worker has fallbacks for missing v27 to v34 objects.

**Gaps**
- Reactivation compares only with yesterday.
- Bulk "Mark contacted" sends one request per player.
- The Worker should confirm each feed in the database.

**Hardening**
- Move password hashing to PBKDF2.
- Add rate limiting.
- Rotate `INGEST_TOKEN`.
- Remove the hardcoded fallback salt in `worker/index.js`.

**Tech debt**
- Split `App.jsx` and the bundle.
- Add tests.
- Move to wrangler v4.

## 10. Handover status

Done before handover (27 to 28 Oct 2026):
1. **Unmerged local work saved.**
   - An old working copy's unpushed commit and uncommitted changes are on branch `handover/unmerged-local-work`.
   - They are not live and not merged. The branch is behind `main`.
2. **Player data removed from the current files.**
   - The two player CSVs are gone.
   - The schema_v23 seed rows are gone.
   - Player names are blanked in the deposit drop analysis.
3. **Personal references removed from the docs.**
   - Staff names are role titles or Agent A to N.
   - Local paths, a personal email and the personal AI workflow notes are gone.
   - Docs only; no code change.
4. **Database backup.** A full D1 export was taken on 27 Oct 2026; the checksum is kept by the ATL.

To do at handover:
1. **Live Worker check.** Confirm the live Worker matches `main` (Cloudflare dashboard > Workers > `groupb-tracker-api` > Deployments, by date).
2. **Accounts.**
   - Add the AI Department as Super Administrator on the Cloudflare account.
   - Make the AI Department owner of the GitHub org.
   - Move the Apps Script and Lark owners to company accounts.
   - **Remove any personal email from the Cloudflare members.** A past deploy ran from a developer's personal Gmail.
3. **Rotate secrets.** Do this last, after the accounts move. Follow the table in section 4.1: rotate `SESSION_SECRET`, `INGEST_TOKEN` (with all 25 feeders), `WIDGET_API_KEY` and the Lark secrets. **Do not rotate `PASSWORD_SALT`.**
4. **Git history.** Old commits still hold the removed player files. The AI Department decides whether to rewrite the history.
5. **Open developer invite.** One developer (a Team C agent) has a pending write invite. The AI Department decides whether to keep it or cancel it.
6. **Login usernames.** `schema_v15` still names real login usernames. Leave them as they are, because they are live accounts.

## 11. What the AI Department receives

| Item | How it is handed over |
|---|---|
| Code | Owner role in the GitHub organisation `c9myr-vip-retention` (repo `vvip-console`) |
| Hosting, database, secrets | Super Administrator on the Cloudflare account |
| Console admin | A manager account in Settings (`manage_users`) |
| Brand feeders (25 Apps Script projects and their sheets) | Shared or transferred by the current owner (section 3.1) |
| Lark syncs | The AI Department creates its own Lark app (section 3) |
| Database backup | Full export of 27 Oct 2026, through a company drive link, to the named owner only |
| Documentation | This file (`HANDOVER.md`) and the docs in `docs/` |

## 12. Risks and open items

| No. | Item | Risk | Action | Owner |
|---|---|---|---|---|
| 1 | Two personal Gmail accounts are Super Administrators on Cloudflare | Full control of live player data from personal accounts; one has no 2FA | Remove both at handover | ATL, at the meeting |
| 2 | The ATL's Cloudflare account has no 2FA | Account takeover | Turn on 2FA | ATL |
| 3 | All 25 feeders are owned by, and run as, an account outside VIP Retention | Feeds depend on one person's account | Transfer or share. A transfer means redeploying each feeder: the Web App URL changes, so update `FEEDER_URLS` the same day | Feeder owner and AI Department |
| 4 | The daily sheet update is manual | No data if nobody updates the sheets | VIP Retention keeps updating the "Daily" and "Daily V" tabs by about 14:00 MYT. Name who does it at the meeting | VIP Retention |
| 5 | Live Lark syncs run on another team's Lark app | Depends on another team | Create an AI Department Lark app, then swap `LARK_APP_ID` and `LARK_APP_SECRET` | AI Department |
| 6 | The `PASSWORD_SALT` value is not held | A server move can't keep existing passwords | Build a password reset before any server move | AI Department |
| 7 | The reply widget's own code is not in this repo | `WIDGET_API_KEY` can't be rotated safely without it | Find where the widget lives and who owns it | AI Department with VIP Retention |
| 8 | Old Git history still holds removed player files | Recoverable from history | Decide whether to rewrite history | AI Department |
| 9 | JOM99 has a feeder file but no live feeder project | The brand may not be feeding | Confirm the brand's status | AI Department with VIP Retention |
| 10 | Cloudflare billing owner not checked | Bills or limits tied to one person | Check Manage Account > Billing | AI Department |
| 11 | Known bugs (section 9) | Data quality | Backlog | AI Department |

## 13. Acceptance

The handover is complete when the AI Department can, without the ATL:
1. Deploy the Worker and the Pages front end from a clean `main`, and roll each back once.
2. See the next day's data arrive by 15:00 MYT, with a green feed-health card.
3. Rotate `SESSION_SECRET`, `INGEST_TOKEN` (with all 25 feeders) and `WIDGET_API_KEY`, with the console still working. Never `PASSWORD_SALT`.

## 14. Support after handover

- The ATL gives 2 weeks of Q&A support from the handover date. Answers only: no deploys, no code changes.
- Request channel and response time: agreed at the handover meeting.
- Business rule changes (section 8) need VIP Retention approval first.

## Sign-off

| | Name / role | Date |
|---|---|---|
| Handed over by | ATL, VIP Retention | |
| Received by | AI Department | |
| Acknowledged | Supervisor | |

---

# Technical appendix

Source: repo `vvip-console-shared`, branch `main`, read on 28 Oct 2026. Every statement below was checked against the code. Where the code does not settle a point, the text says "Not confirmed from code".

Quick facts:

| Item | Value |
|---|---|
| Frontend | React 18 + Vite, Cloudflare Pages project `groupb-tracker` (`https://groupb-tracker.pages.dev`) |
| Backend | One Cloudflare Worker `groupb-tracker-api` (`worker/index.js`), plain `if` routing, no framework |
| Database | Cloudflare D1, binding `DB`, database name `groupb-tracker-db` |
| API base in the browser | `API_BASE` in `src/App.jsx:21` and `src/revamp/api/work.js` (must be kept equal). `VITE_API_BASE` overrides it for local preview only |
| Session | Stateless token, 8 hours (`SESSION_TTL_HOURS`), kept in browser `localStorage` key `session_token` |
| Time axis | `snapshot_date` is stamped by the Worker in MYT (GMT+8) on every ingest |
| Tests | Local-only API test scripts in `scripts/test-*.mjs`. No linter. No CI |

Secret and variable NAMES the Worker reads (values are never in the repo):

| Name | Used for |
|---|---|
| `SESSION_SECRET` | Signs session tokens |
| `PASSWORD_SALT` | Password hashing. The code has a hardcoded fallback salt if this is missing; it must always be set in production |
| `INGEST_TOKEN` | Feeder auth on `POST /api/ingest`, and the key the Worker sends to each feeder Web App |
| `FEEDER_URLS` | The 25 feeder Web App URLs, whitespace or comma separated |
| `LARK_APP_ID`, `LARK_APP_SECRET` | Lark app for Telegram link sync, engagement sync, Lark debug, and widget table reads |
| `WLARK_APP_ID`, `WLARK_APP_SECRET` | Optional separate Lark app for the widget tables (falls back to the `LARK_*` pair) |
| `WIDGET_LARK` | JSON: widget Lark base + table ids (`pnl`, `topPnl`, `ltv`, `grace`, `risk`, `vip`, `special`, `tg28`, `redeem`, `mooncake`, `vs96`, `ca`), optional `graceOpts`, `brandStyle`, `brandMap` |
| `WIDGET_API_KEY` | Shared key for the `/api/ext/*` widget routes (header `x-widget-token`) |
| `LARK_FEED_WEBHOOK`, `LARK_FEED_SECRET` | Lark group bot for the daily feed check card (secret is optional, used for signing) |
| `LARK_HOST` | Local preview only: points Lark calls at a mock. Must be unset in production |
| `ENVIRONMENT` | Plain var in `wrangler.toml`, value `production`. Not read by the code (Not confirmed from code that anything else reads it) |

CORS (`worker/index.js:12`): allows `https://groupb-tracker.pages.dev`, any `https://<preview>.groupb-tracker.pages.dev`, and `http://localhost:<port>`. Any other origin (for example a custom domain) gets the default origin back and the browser will block the call.

---

## Appendix A. Screen guide

### A.0 How the frontend is built

- Two shells live in the same bundle:
  - **Revamp shell** (new console): `src/revamp/Shell.jsx` with pages from `src/revamp/registry.js`. This is the default for everyone.
  - **Old console**: the tab bar in `src/App.jsx` (Dashboard, Daily, Changes, Campaigns, Performance, Settings).
- Many revamp pages re-house the old components unchanged (they import `Dashboard`, `Delta`, `Drawer`, `Performance`, `AssignedView`, `ActivityLog`, `Settings` from `App.jsx`). A fix in an `App.jsx` component therefore shows up in both shells.
- Classification of players (classes GRACE, TOP_LOSS, TOP_DEP, BLOCKED, DSLD30, DSLD14, DSLD7, WATCH, HEALTHY, plus whale and fragile flags) runs only in the browser (`classifyAll` in `App.jsx`). The Worker does no classification, except a SQL mirror of it inside `GET /api/rtn/performance` for rows stored with no class.

Feature flags (`src/flags.js`):

| Flag | Default | How to change | Effect |
|---|---|---|---|
| `revamp` | ON (in `DEFAULT_ON`) | `?revamp=0` turns it off for that browser, `?revamp=1` turns it on, `?flags=reset` forgets all choices. Stored in `localStorage` key `revamp_ui` | Off = old console. On = revamp shell |
| Any other flag `name` | OFF | `?name=1` / `?name=0`, stored as `ff_<name>` | No other flag is read in the current code (Not confirmed from code that any other flag exists) |
| `revamp_mock` (localStorage, not a flag) | off | `localStorage.revamp_mock = "1"` | Revamp pages use fixture data, live polling stops. For local testing only |
| `HIDE_SHIFTS` (constant) | `true` in `src/revamp/schedule/logic.js:70` | Code change + deploy | Hides every shift screen (roster, shift times, swaps, on-duty now). Shifts are kept in the HR portal |

Live refresh: the browser polls `GET /api/work/pulse` every 10 seconds while the tab is visible (`src/revamp/live.js`). The Worker bumps a counter per area after each successful write (`worker/work/pulse.js`). Areas: `tasks`, `schedule`, `projects`, `people`, `contact`, `contactreset`, `checkin`, `player`, `kpi`, `campaign`, `feed`, plus per-person `notif` and `me` fingerprints. A `feed` bump reloads the board 30 seconds later.

Sidebar (revamp, `src/revamp/tokens.js` `NAV` + `src/revamp/perms.js` `navFor`):
- Accounts with `teams.all` get the admin layout: Overview (Dashboard, Changes, Performance), Daily work (Contact, Check-in, Grace claims, Players, Assignments), Work (Tasks, Schedule, Projects, Flows, Templates, Team workload), Task insight (Analytics), Admin (Settings).
- Others get the agent layout: My work (My day, My tasks, Schedule, Projects, Team workload), Daily work (Contact, Check-in, Grace claims, Players, Changes), Me (My performance, Settings).
- Every page is shown only if its page permission passes (`PAGE_PERM`). Pages the layout does not list are added when the role may open them.
- Page permissions only hide pages in the browser. The Worker does not check `page.*` keys. Data is still limited by function permissions and the team wall.

Shell-wide elements (`Shell.jsx`):
- Top bar: team switcher (only with `teams.all`, options All teams / A / B / C), Bell, Refresh (reloads `/api/rtn/board`), Sign out (`POST /api/logout`).
- Snapshot bar on Dashboard, Changes, Performance, Contact, Check-in, Grace claims, Players, Assignments, My performance: Today / Yesterday / minus 7 days and a calendar limited to dates from `GET /api/rtn/dates` (last 60 snapshots). It shows the last ingest time in GMT+8. A past day is read-only.
- Banners: "No snapshots yet" when the board has no snapshot; "View-only account" when the account has no edit flag.
- Sidebar badges: Contact = players still to contact; Tasks = my open tasks, red if any is overdue (re-read every 60 seconds).
- Page crash guard: a broken page shows "This page failed to load" with a Try again button instead of blanking the shell.

### A.1 Login screen

- Who: anyone.
- Shows: username and password. If the database has no users at all, a first-admin mode is available.
- Actions: sign in; create the first admin (only works while the `users` table is empty).
- Routes: `POST /api/login`, `POST /api/users/init`, then `GET /api/me`.
- Rules: usernames are lower-cased. A wrong login waits 1 second and returns 401. There is no self-service or admin password reset in the code (see Appendix F).

### A.2 Dashboard (revamp key `dash`; old tab "Dashboard")

- Who: `dashboard.view` (default: admin only). The page itself shows "Admin only".
- Shows, top to bottom:
  1. Stale-feed banner: brands in view whose `last_fed` is not the current snapshot.
  2. **Live board** (`DashStaff.jsx`): one card per person in the team in view who can work on tasks. Shows the running task with a live timer and checklist progress. Shift status shows "Shift: NA" because `HIDE_SHIFTS` is true. Clock-in, accepting chats, off-chat timer and violations show "NA" (tracking not built). People with `chat.exempt` show only the clock-in. Filters: all / on shift / off / with a task, plus a search box.
  3. **My tasks**: the My day page embedded, tasks only.
  4. **Team numbers** (old `Dashboard` component, re-housed): tier filter (All / Tier 3 / Tier V); KPI cards (Money, Players, Active VIPs, Cold pile 7+, Deposit per active VIP, Net flow, Whales at risk); Retention trend chart (7 / 14 / 30 days, one brand or all); Deposits and withdrawals by day; Active and cold players by day; Brand health table; lists (Top depositors, Top withdrawals, Newly cold today, High-value at risk). Clicking a player opens the Player drawer.
  5. **Daily report button** ("Daily report to clipboard"): builds the Daily Leadership Alignment report in Markdown and copies it. If the browser blocks the copy, a box shows the text to copy by hand.
  6. **Brands today** cards: deposit and players to contact per brand; tap a card to open Contact filtered to that brand.
- Routes: `GET /api/rtn/board` (via the shell), `GET /api/rtn/trend?days=&brand=&team=`, and for the report `GET /api/rtn/board?date=<previous snapshot>`, `GET /api/rtn/board?date=<same day last month>`, `GET /api/rtn/movement?month=` (one per month needed), `GET /api/rtn/engagement?date=<snapshot minus 1>&team=`. Live board: `GET /api/work/people`, `GET /api/work/workload`, `GET /api/work/schedule` (skipped while shifts are hidden).
- Rules: report deposit figures come from the `daily_brand_stats` rollup, not live `player_days`, so a tier mislabel by a feeder does not corrupt them. Engagement table in the report is blank if no sync exists for that day. The report's data day is the snapshot minus 1 day.

### A.3 Changes (revamp key `delta`; old tab "Changes")

- Who: `page.changes` (default: everyone).
- Shows (old `Delta` component, three views):
  - **Player changes**: today's snapshot against the previous snapshot (who came back, who cooled, who is new), with mover bands and money totals.
  - **Movement**: brand by date grid for one month (deposit, withdraw, active VIP, roster, month-to-date depositors) with a legend.
  - **Lost and gone**: players present yesterday and missing today.
- Actions: open the Player drawer, log contacts (same as Contact).
- Routes: `GET /api/rtn/board?date=<previous snapshot>`, `GET /api/rtn/movement?month=`, `GET /api/rtn/history` (Lost and gone), `POST /api/rtn/contact`.
- Rules: Movement reads `daily_brand_stats`, which the ingest keeps current. Retention in Movement is rebuilt from summed parts in the browser.

### A.4 Contact (revamp key `queue`; old tab "Daily", view "Worklist")

- Who: `page.contact` (default: everyone). Agents see their own players by default ("mine").
- Shows: the priority worklist in bands: ACT NOW (cooling whales, deadlines, big losses), TODAY (today's movers), WIN-BACK (gone quiet), NO ACTION (quiet or healthy, collapsed). Each band shows done count and progress. Stage switch: To contact / Waiting / Done / All. Filters: search, agent (admins), brand menu, class and flag menu, Grace activated or not. Bell deep-links can focus a fixed set of players.
- Actions: Mark contacted (one click), open the Player drawer, export a band or the whole filtered list as CSV (also copies usernames), legend.
- Routes: board data from the shell; `POST /api/rtn/contact`; `GET /api/rtn/grace-status` (only when the Grace filter is needed).
- Rules:
  - A 48-hour cooldown (browser rule in `src/revamp/daily/hooks.js`) marks players contacted in the last 48 hours as do-not-recontact.
  - If the Grace table cannot be read, the list still works and a note explains the activated split is hidden.
  - Stale and lag chips per brand (see A.17 and Appendix F).

### A.5 Player drawer (opens from Contact, Players, Changes, Dashboard, Grace claims, Performance)

- Who: anyone who can open the page underneath. Writing needs `contact.edit` or `contact.edit_own` (own players only).
- Shows: player identity (Zyra brands show uid, TC brands show username), class and reason, churn-risk score (from the board's `cooling` list), reactivation odds (board `reactivation` list), money calendar and deep history (last 90 snapshots), approach message suggestions (`src/messageLibrary.js`), contact history (last 30 contact rows), Relationship notes (last 50), follow-up date, Telegram link, LiveChat log (last 50), and a "Bonuses (from widget)" card loaded on demand.
- Actions: assign, set status (ASSIGNED, CONTACTED, RESPONDED, NO_RESPONSE, RECOVERED, SKIPPED), write a contact note, clear or undo the contact, add or delete a Relationship note, set the follow-up date, set or remove the Telegram link, log a LiveChat link, remove a LiveChat entry (managers), check bonuses, step to the next or previous player.
- Routes: `GET /api/rtn/history`, `GET /api/rtn/notes`, `POST /api/rtn/notes`, `DELETE /api/rtn/notes/:id`, `GET /api/rtn/crm`, `POST /api/rtn/crm`, `POST /api/rtn/telegram` (single), `POST /api/rtn/livechat`, `DELETE /api/rtn/livechat/:id`, `GET /api/rtn/bonus-lookup`, `POST /api/rtn/contact`.
- Rules:
  - Logging a LiveChat link also assigns the player to the current user and sets CONTACTED unless a later status already exists.
  - "Clear" deletes the whole `contact_log` row for that day (full undo; the player drops out of Performance).
  - Bonus lookup is on demand because each lookup is about 11 Lark reads shared with the widget. Results are cached 60 seconds per Worker instance.
  - Telegram links typed here are replaced by the next nightly Lark sync (Lark is the source of truth).

### A.6 Players (revamp key `players`; old Daily view "Table")

- Who: `page.players` (default: everyone).
- Shows: the full table of the team's players with multi-column sort, row selection, "Paste list" (username or uid plus brand lines tick those players), tick-all, Grace activated / not activated toggles.
- Actions: bulk Mark contacted, bulk assign, export CSV, open the drawer.
- Routes: board data; `POST /api/rtn/contact` (one request per player for bulk actions); `GET /api/rtn/grace-status`.

### A.7 Assignments (revamp key `assign`; old Daily view "Assigned")

- Who: `assign.manage` (default: admin). Needs one team in view (not "All teams").
- Shows:
  - **Overview**: contact parity bar (share of Telegram-reachable players contacted at least once this month, milestone ladder 52 / 60 / 70 / 80 / 90 / 100, need per day, today's new first touches), double-contact guard (same player touched by 2+ agents in 7 days, list capped at 50 with the full total), yesterday's results, load by agent, unassigned players.
  - **Daily lists per agent**: the auto-assign preview per agent (fresh first, then by band), with batch control (up to 4 batches of 30).
- Actions: assign manually or evenly (writes contact rows), Dry run (counts for every team, writes nothing), Unassign all (assigned but not yet contacted players go back to unassigned), next batch.
- Routes: `GET /api/rtn/auto-assign?team=&batch=&off=`, `GET /api/rtn/contact-rate?team=`, `POST /api/rtn/auto-assign/run?dry=1`, `POST /api/rtn/unassign`, `POST /api/rtn/contact`.
- Rules:
  - Auto-assign writing is OFF (`AUTO_ASSIGN_ENABLED = false`). The page is a preview plus manual assignment.
  - "Reachable" means a Telegram link exists in `player_telegram`. SMS and internal mail are outside this database.
  - Unassign keeps any player who already has a real status or a note (note kept, owner removed).

### A.8 Check-in, also called Login Check (revamp key `checkin`; old Daily view "Login Check")

- Who: `page.checkin` (default: everyone). Ticking needs an edit flag. Assigning needs `assign.manage`.
- Shows: per brand and tier (Tier 3 or Tier V; brand defaults to SK69 on the Worker), the assigned roster with Login and Deposit ticks, who filled each tick, previous day deposit, group label, last deposit date; agent chips with counts; unassigned players from the tier's latest snapshot. A "provisional" note when today's feed is not in yet.
- Actions: tick login / deposited for any assigned player (leave cover allowed), assign or move an owner, auto-assign new players evenly.
- Routes: `GET /api/rtn/login-check?date=&agent=&brand=&tier=`, `POST /api/rtn/login-check`, `POST /api/rtn/login-check/assign`, `POST /api/rtn/login-check/auto-assign`.
- Rules: the deposit amount is never typed; it is joined from `player_days.daily_deposit` and confirms the next day. Ticking a player with no active owner returns 409 "Player is not assigned".

### A.9 Grace claims (revamp key `grace`; old Daily view "Grace Tasks")

- Who: `page.grace` (default: everyone).
- Shows: Grace players who activated, reloaded the required single-day deposit inside the window, and have not claimed; plus the Grace players list with activated / not activated filter and "Load all" for players not on the current board.
- Actions: open the drawer, log contacts.
- Routes: `GET /api/rtn/grace-tasks`, `GET /api/rtn/grace-status`.
- Rules:
  - Needs `WIDGET_LARK` with a `grace` table; otherwise the Worker answers 503.
  - Required deposit comes from the bonus through `GRACE_LADDER` (18 to 100, 28 to 200, 38 to 300, 58 to 500, 68 to 600, 78 to 700, 88 to 800, 98 to 900, 108 to 1000), overridable by `graceOpts.ladder`.
  - Only deposits after the activation day count as certain. The activation day itself is flagged "same day, check time". Deposits are not added across days.
  - Lark rows are cached 5 minutes per brand per Worker instance. Nothing is written to Lark or D1.

### A.10 Performance (revamp key `perf`, admin) and My performance (key `mine`, agent)

- Who: `perf` needs `page.performance` (default: admin); `mine` needs `page.myperf` (default: agent and viewer, not admin). Admin retention view needs one team in view.
- Shows (admin, tab "Retention and save rate", old `Performance` component):
  - **KPI scorecard**: per-brand Tier 3 and Tier V retention (players with any deposit this month / tier pool, from the latest snapshot of the month), month-to-date deposit, manual retention overrides (double-click to edit), team FRT, last and this month deposit, per-agent FRT, reactivation score per agent, VIPs contacted, Team Challenge block, KPI leaderboard, team snapshot.
  - **Mistake log** (Discipline input).
  - **Save rate** blocks By CS, By Class, By Brand from the month's contact log, with a drill-down list. Staff moved between teams show an extra "<agent> · Team X" row in By CS (rule `STAFF_MOVES` in the Worker).
  - Tab "Task efficiency": see A.15.
- Shows (agent): own save rate, own recoveries, own task efficiency.
- Actions: change month, edit manual KPI inputs, log or remove mistakes (`mistakes.log`), open players.
- Routes: `GET /api/rtn/kpi?month=&team=`, `POST /api/rtn/kpi/retention`, `POST /api/rtn/kpi/team`, `POST /api/rtn/kpi/agent-input`, `POST /api/rtn/kpi/challenge-eng`, `GET /api/rtn/mistakes`, `POST /api/rtn/mistakes`, `DELETE /api/rtn/mistakes/:id`, `GET /api/rtn/performance?month=&team=`, `GET /api/work/efficiency`.
- Rules:
  - Month is keyed on `contacted_at` (real MYT action day), not `snapshot_date`.
  - Reactivation score from 2026-08: each RECOVERED player weighted by the deepest "Reactivated X Days" band: 1 to 6 days = 0.10, 7 to 13 = 0.50, 14 to 29 = 0.75, 30+ = 1.00; no band = 0.10. Before 2026-08: flat count.
  - Team retention is a sum of depositors over a sum of pools (weighted), not an average of brand percentages.
  - `kpi_team_month` and `kpi_challenge_eng` have no team column: one row per month for the whole console (see Appendix F).

### A.11 Campaigns (VVIP redeem codes; OLD CONSOLE ONLY)

- Where: only in the old console (`?revamp=0`), tab "Campaigns" (`App.jsx:6051`). The revamp registry has no Campaigns page.
- Who: everyone signed in can find and release; manager views (event list, create form, tables, report) show for `manage_users` in the browser, and the Worker checks `campaigns.manage`.
- Shows: the day's events per brand and tier (assigned and claimed counts), per-team brand eligibility (players with uid), a cross-brand player finder, assignment tables (all / claimed / eligible), and the day's report (by brand, by code, by agent, claims with no prior contact).
- Actions: create an event (pool = whole tier with uid, shuffled server-side with crypto RNG, split 50 / 50 into bands A and B, odd remainder to the cheaper band), set the two BO codes and amounts (draft only), export the uid list per band (first export locks the event), pull the unclaimed list, release a code to a player (Telegram or LiveChat), mark "not qualified, under RM100" (does not burn the code), close, delete (only when no code has been released), run the 00:00 auto-create by hand.
- Routes: all `/api/rtn/campaign/*` (Appendix B.6).
- Rules: release only works on the event day (MYT) and only after export. Release records whether a real contact existed on the event day or the day before (`contacted_before`). Two agents releasing at once: the second gets 409. Auto-create at 00:00 is OFF (`AUTO_CREATE_ENABLED = false`).

### A.12 My day (revamp key `home`, agent home)

- Who: `page.myday` (default: agent and viewer). The admin Dashboard embeds a tasks-only version.
- Shows: greeting, number strip (players to contact, open tasks, due today, overdue, done today), the running task with timer, my task list, today's schedule items, and daily work cards (contact next, check-in progress, Grace claims).
- Routes: `GET /api/work/tasks`, `GET /api/work/schedule`, `GET /api/rtn/login-check`, `GET /api/rtn/grace-tasks`, board data.
- Rules: cards reload on live areas `checkin`, `feed`, `contact`.

### A.13 Tasks and task chat (revamp key `tasks`)

- Who: `page.tasks`. Creating and working needs `tasks.use`. Visibility follows the role hierarchy (Appendix E).
- Shows: views List, Deadline, Planner, Calendar, Gantt over one filtered task set; the task panel (description, checklist, observers, activity, comments); the New task popup (templates, projects, flows, one task per person for multi-assign, observers).
- Task chat: comments work as a group chat with `@username` tags, emoji reactions (fixed list of 12), and attachments (max 5 files per comment, 1.2 MB each; pictures, PDF, text, CSV, Office files, zip; stored base64 in D1). Tags, new comments and new tasks create notifications shown in the Bell.
- Actions: create, update, start, pause, complete, defer, reopen, checklist add / toggle / remove, comment, react, open attachment, delete (soft, to Recycle bin).
- Routes: `/api/work/tasks*`, `/api/work/comments/:id/react`, `/api/work/attachments/:id`, `/api/work/notifications*`, `/api/work/people`.
- Rules (enforced by the Worker): one task in progress per person (unique index `uq_one_ongoing_per_person`, API answers 409). Only the assignee can start, pause or complete. Defer and reopen: assignee, owner, or `tasks.edit_any`. Reassigning needs `tasks.assign_others`. Delete needs owner or `tasks.delete_any`.

### A.14 Schedule, Projects, Flows, Templates, Team workload, Analytics

| Page (key) | Who | What it does | Routes |
|---|---|---|---|
| Schedule (`sched`) | `page.schedule` to read; `schedule.manage` or `schedule.edit_own` to add and edit; `schedule.swaps` to decide swaps | Board of reload events, meetings, maintenance, reports, training and custom types (week, lanes, month). Shift screens hidden while `HIDE_SHIFTS` is true | `/api/work/schedule*` |
| Projects (`proj`) | `page.projects`; create with `projects.use`; any project with `projects.manage` | Projects with members, privacy (members or team), archive, soft delete; detail view with tasks and activity | `/api/work/projects*` |
| Flows (`flows`) | `flows.manage` or `flows.own` | Pipelines for recurring work with live pending / in progress / done counts and on-time efficiency | `/api/work/flows*` |
| Templates (`tpl`) | read: everyone signed in (API); page: `templates.manage` or `templates.own` | Task templates (deadline, assignee, checklist) | `/api/work/templates*` |
| Team workload (`team`) | `page.workload`; all teams with `workload.all` | One card per person: running task, timer, checklist progress, assigned / overdue / done / waiting counts | `GET /api/work/workload` |
| Analytics (`ana`) | `analytics.view` | Four task charts over N days | `GET /api/work/analytics?days=` |

### A.15 Task efficiency (key `eff`, shown as a tab in Performance)

- Who: everyone sees their own; `analytics.view` sees everyone or one person.
- Shows: on-time rate (completed on or before the MYT due date) and a rating: Excellent at 85 or more, Good at 70 or more, otherwise Needs attention.
- Route: `GET /api/work/efficiency?user=&days=`.

### A.16 Settings (revamp key `set`; old tab "Settings")

Revamp tabs (`src/revamp/pages/SettingsPage.jsx`), each shown only with its permission:

| Tab | Permission | What it does | Routes |
|---|---|---|---|
| My account | `page.account` | Change own password, see own details | `POST /api/change-password` |
| Accounts | `users.manage` | Create accounts (username, password 8+ characters, role, team), give a role, personal permission exceptions, old flag editor, delete. Also hosts the old Telegram CSV import | `/api/users*`, `POST /api/rtn/telegram` (bulk) |
| Roles and permissions | `users.manage` | Ranked roles (most senior first), create, rename, change starting point, switch permissions, set "sees own team only", move up or down, delete (accounts moved first) | `/api/roles*` |
| Page access | `users.manage` | Grid of every page against every role; switch single-permission pages per role | `GET /api/roles`, `POST /api/roles/:key/update` |
| Activity log | `activity.view` | Last 300 audit rows, filters by username, action, MYT date, team | `GET /api/activity` |
| Recycle bin | `bin.manage` | Soft-deleted tasks, projects, flows, templates kept 30 days; restore or delete forever | `/api/work/bin*` |
| Task data (`tdata`) | `tasks.clear` | Wipe every task and its checklists, observers, comments and history after typing `CLEAR TASKS` | `POST /api/work/tasks/clear` |

Old console Settings (`App.jsx:3779`): account list with the old flag editor (role, can_edit, can_delete, on_leaderboard, manage_users, team), add account, change password, Telegram CSV import, Activity log.

### A.17 Bell (alerts and messages)

- Alerts are built in the browser from the board: brand not fed today (red), brand deposits lag (newest deposit date behind the freshest brand), whales that just went cold (exactly 7 days), whales at churn risk (board `cooling` list). Dismissals are stored per browser in `localStorage` key `notif_dismissed`.
- Messages come from `GET /api/work/notifications` (tags, comments, new tasks) and are marked read through `POST /api/work/notifications/read`.

### A.18 Widget-related surfaces

The Customer Approaching widget (separate repo, runs inside LiveChat) and the console share data in two directions:

| Direction | Surface | Route | Notes |
|---|---|---|---|
| Widget to console | Relationship notes written in the widget appear in the Player drawer, author shown as "<name> (widget)" | `POST /api/ext/note`, `GET /api/ext/notes` | Key `WIDGET_API_KEY` |
| Widget to console | "Next action" lines appended to today's contact row note as `[widget · <name> · <MYT time>] <text>` | `POST /api/ext/action`, `GET /api/ext/actions`, `POST /api/ext/action/remove` | Never changes status, owner, `updated_by` or `updated_at` |
| Console reads widget tables | Drawer card "Bonuses (from widget)" | `GET /api/rtn/bonus-lookup` | Needs `WIDGET_LARK` |
| Console reads widget tables | Grace claims page, Grace filters on Contact and Players | `GET /api/rtn/grace-status`, `GET /api/rtn/grace-tasks` | Needs `WIDGET_LARK.tables.grace` |

### A.19 Old console only views

Reachable with `?revamp=0`: Daily views Worklist, Table, Contacted, Assigned, Login Check, Grace Tasks; Campaigns tab; old Settings. The old Daily brand rail shows STALE and LAG chips per brand.

---

## Appendix B. API routes

Auth column key:
- **public**: no auth.
- **ingest token**: `Authorization: Bearer <INGEST_TOKEN>`.
- **widget key**: header `x-widget-token` equal to `WIDGET_API_KEY` (constant-time compare).
- **session**: `Authorization: Bearer <session token>`; the account must still exist.
- **session + X**: session plus permission X (see Appendix E). "edit" means `contact.edit` or `contact.edit_own`; "delete" means `contact.delete` or `contact.delete_own`.
- Team wall: unless the account has `teams.all`, every `/api/rtn/*` read is limited to the account's team brands (no team = no brands), except the campaign routes noted.

All `file:line` references are `worker/index.js` unless another file is named. Unknown paths return 404 `Not found` (`index.js:3984`). `OPTIONS` returns CORS headers (`index.js:1830`).

### B.1 Auth, accounts and audit

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| POST | /api/login | public | Checks username + password hash, updates `last_login`, returns token and flags, logs `login` | index.js:1835 |
| POST | /api/users/init | public | Creates the first admin, only if `users` is empty | index.js:1862 |
| GET | /api/me | session | Account, team, role key and name, full permission list | index.js:2100 |
| POST | /api/logout | session | Logs `logout` only (token is cleared in the browser) | index.js:2107 |
| GET | /api/activity | session + activity.view | Last 300 audit rows, filters username, action, date (MYT), team | index.js:2113 |
| GET | /api/users | session + users.manage | Account list (falls back if v27 or v28 columns are missing) | index.js:3871 |
| POST | /api/users | session + users.manage | Create account, with a role (`role_key`) or old flags | index.js:3893 |
| POST | /api/users/perm | session + users.manage | Old flag editor; removes `role_key` and `perm_overrides`; last-manager guard | index.js:3927 |
| DELETE | /api/users/:id | session + users.manage | Delete account (not self, not last manager); releases its `player_assignment` rows | index.js:3954 |
| POST | /api/change-password | session | Own password; needs current password; new one 8+ characters | index.js:3972 |
| GET | /api/roles | session + users.manage | Roles (ranked) plus the permission catalogue; `setup_needed` if v27 not run | roles.js:79 |
| POST | /api/roles | session + users.manage | New role at the bottom; `base`, optional `copy` | roles.js:119 |
| POST | /api/roles/:key/move | session + users.manage | Rank up or down | roles.js:142 |
| POST | /api/roles/:key/update | session + users.manage | Rename, base, overrides, reset, `sees`; resyncs old columns; last-manager guard | roles.js:157 |
| POST | /api/roles/:key/delete | session + users.manage | Soft delete; accounts moved to `move_to`; child roles rebased keeping their permissions | roles.js:157 |
| POST | /api/users/role | session + users.manage | Give an account a role (and optional team); new role clears personal exceptions | roles.js:242 |
| POST | /api/users/perms | session + users.manage | Personal exceptions on top of a role | roles.js:91 |

### B.2 Data intake, syncs and jobs run by hand

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| POST | /api/ingest | ingest token | Feeder push `{brand, tier_segment, rows}` (max 5000 rows). Upserts `player_days`, removes the same players under the other tier for that day, fills blank `group_name`, updates `daily_brand_stats`, may post a feed resolution card | index.js:1878 (handler at 797) |
| POST | /api/rtn/feeders/run | session + data.sync | Starts all feeders now (same as 12:15). `?dry=1` only counts configured URLs | index.js:2927 |
| GET | /api/rtn/engagement | session | Livechat and Telegram chat counts per brand for `?date=` | index.js:2903 |
| POST | /api/rtn/engagement-sync | session + data.sync | Lark Engagement table to `engagement_daily`; `?date=`, `?dry=1` | index.js:2915 |
| GET | /api/rtn/engagement | (duplicate) | DEAD: same path and code as 2903, never reached | index.js:2936 |
| POST | /api/rtn/engagement-sync | (duplicate) | DEAD: same path and code as 2915, never reached | index.js:2948 |
| POST | /api/rtn/lark-sync | session + data.sync | Lark P&L1 Telegram links to `player_telegram` (mirror). `?dry=1`, `?force=1` | index.js:2961 |
| POST | /api/rtn/feed-check | session + data.sync | Feed health check now; `?dry=1` returns the card without posting | index.js:2973 |
| GET | /api/rtn/lark-debug | session + data.sync | Read-only peek at Lark bases, tables, views, sample rows (`?base`, `?table`, `?view`, `?n`, `?raw`, `?appinfo`) | index.js:3109 |

No screen calls `feeders/run`, `engagement-sync`, `lark-sync`, `feed-check` or `lark-debug`. They are called by hand with a session token.

### B.3 Board, players and contacts

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| GET | /api/rtn/latest | session | Latest snapshot rows only. No screen calls it (legacy) | index.js:2134 |
| GET | /api/rtn/board | session | Main load: rows for `?date=` (or latest), contacts (that day or updated in 7 days), brand health, team list (hierarchy filtered), Telegram links, churn-risk list (top 25) and reactivation list (top 25, live day only) | index.js:2195 |
| GET | /api/rtn/board-contacts | session | Contact rows only; `?since=` returns only changed rows | index.js:2158 |
| POST | /api/rtn/contact | session + edit (clear needs delete) | Upsert one `contact_log` row; `clear: true` deletes it. Own-only accounts are limited to their own or unowned players | index.js:2294 |
| POST | /api/rtn/unassign | session + assign.manage | Takes back assigned, not yet worked players of a team for one day | index.js:2178 |
| GET | /api/rtn/dates | session | Last 60 snapshot dates with row counts | index.js:2660 |
| GET | /api/rtn/history | session | One player's last 90 snapshots | index.js:2670 |
| GET | /api/rtn/notes | session | Player notes (last 50) | index.js:2739 |
| POST | /api/rtn/notes | session + edit | Add a note (max 2000 characters) | index.js:2753 |
| DELETE | /api/rtn/notes/:id | session + delete | Delete a note (own-only accounts: own notes) | index.js:2770 |
| GET | /api/rtn/crm | session | Follow-up date, Telegram link, last 30 contacts, last 50 LiveChat logs | index.js:2788 |
| POST | /api/rtn/crm | session + edit | Set follow-up date | index.js:2815 |
| POST | /api/rtn/livechat | session + edit | Log a LiveChat link (http or https) | index.js:2833 |
| DELETE | /api/rtn/livechat/:id | session + data.sync | Remove a LiveChat log | index.js:2852 |
| POST | /api/rtn/telegram | session + edit | Single link set or remove, or bulk `rows` import | index.js:2863 |
| GET | /api/rtn/movement | session | Month grid from `daily_brand_stats`; `?month=`, `?team=` | index.js:2481 |
| GET | /api/rtn/trend | session | Daily totals for 7, 14 or 30 days; `?brand=`, `?team=` | index.js:2507 |
| GET | /api/rtn/performance | session | Month contact log with class enrichment, reactivation depth, staff moves | index.js:2546 |
| GET | /api/rtn/contact-rate | session | Contact parity counter for one team | index.js:3000 |
| GET | /api/rtn/auto-assign | session | Auto-assign preview; managers see all agents and may pass `?off=`; agents get only their own list | index.js:3077 |
| POST | /api/rtn/auto-assign/run | session + assign.manage | Writes the deal to `contact_log`. Refused unless `?dry=1` while `AUTO_ASSIGN_ENABLED` is false | index.js:3094 |

### B.4 Login Check

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| GET | /api/rtn/login-check | session | Roster, ticks, agent chips, unassigned (defaults SK69, Tier V) | index.js:2345 |
| POST | /api/rtn/login-check | session + edit | Upsert one day's login / deposited tick | index.js:2424 |
| POST | /api/rtn/login-check/assign | session + assign.manage | Set, move or retire an owner | index.js:2449 |
| POST | /api/rtn/login-check/auto-assign | session + assign.manage | Deal unassigned players evenly | index.js:2467 |

### B.5 KPI and mistakes

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| GET | /api/rtn/kpi | session | Retention per brand and tier, deposits, manual inputs, reactivation per agent, engagement | index.js:3523 |
| POST | /api/rtn/kpi/agent-input | session + edit | Per-agent FRT for a month | index.js:3636 |
| POST | /api/rtn/kpi/agent | session + edit | Staff KPI marks. No screen calls it (`ManualBoard` is defined but unused) | index.js:3650 |
| POST | /api/rtn/kpi/challenge | session + edit | Team Challenge score. No screen calls it | index.js:3669 |
| POST | /api/rtn/kpi/challenge-eng | session + edit | Manual follow-up done / required | index.js:3688 |
| POST | /api/rtn/kpi/team | session + edit | Team FRT, discipline, last and this month deposit | index.js:3703 |
| POST | /api/rtn/kpi/retention | session + edit | Manual retention percentages per brand | index.js:3759 |
| GET | /api/rtn/mistakes | session | Mistakes for a month (not team-scoped) | index.js:3720 |
| POST | /api/rtn/mistakes | session + mistakes.log | Log a mistake | index.js:3735 |
| DELETE | /api/rtn/mistakes/:id | session + mistakes.log | Remove a mistake | index.js:3749 |

All `POST /api/rtn/kpi/*` are guarded only by "edit" (`index.js:2128`), so any account that can log contacts can also write KPI inputs.

### B.6 Campaigns (VVIP redeem codes)

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| GET | /api/rtn/campaign/day | session (not team-scoped) | Events, bands and per-brand uid coverage for a day | index.js:3185 |
| POST | /api/rtn/campaign/event | session + campaigns.manage | Create, shuffle, split, assign; verifies the row count | index.js:3222 |
| POST | /api/rtn/campaign/auto-create | session + campaigns.manage | Run the 00:00 job now; `?dry=1` | index.js:3248 |
| POST | /api/rtn/campaign/bands | session + campaigns.manage | Set codes and amounts (draft only) | index.js:3257 |
| GET | /api/rtn/campaign/export | session + campaigns.manage | Uid list for one band; first call locks the event | index.js:3277 |
| GET | /api/rtn/campaign/unclaimed | session + campaigns.manage | Uids not yet claimed | index.js:3322 |
| GET | /api/rtn/campaign/find | session (any brand) | Find a player inside the day's event pools | index.js:3339 |
| POST | /api/rtn/campaign/release | session + edit (any team) | Release the code to a player | index.js:3365 |
| POST | /api/rtn/campaign/block | session + edit | Mark not qualified (keeps the code) | index.js:3402 |
| GET | /api/rtn/campaign/assignments | session + campaigns.manage | Assignment table (`view=all/claimed/eligible`) | index.js:3414 |
| GET | /api/rtn/campaign/report | session + campaigns.manage | By brand, by code, by agent; `?team=` | index.js:3431 |
| POST | /api/rtn/campaign/delete | session + campaigns.manage | Delete an event with zero claims | index.js:3475 |
| POST | /api/rtn/campaign/close | session + campaigns.manage | Close an exported event | index.js:3508 |

### B.7 Widget (Lark tables and widget key routes)

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| GET | /api/rtn/bonus-lookup | session | Claimable bonuses for one player from the widget Lark tables | index.js:2689 |
| GET | /api/rtn/grace-status | session | Live Grace state per player for the user's brands | index.js:2712 |
| GET | /api/rtn/grace-tasks | session | Grace players who reloaded but have not claimed | index.js:2724 |
| GET | /api/ext/notes | widget key | A player's notes | index.js:1910 |
| POST | /api/ext/note | widget key | Add a note as "<name> (widget)"; 60 per minute cap | index.js:1919 |
| POST | /api/ext/action | widget key | Append a widget line to today's contact row note | index.js:1952 |
| POST | /api/ext/action/remove | widget key | Remove the last matching widget line (`starts_with`, 8+ characters) | index.js:1999 |
| GET | /api/ext/actions | widget key | Last 10 contact rows with notes | index.js:2031 |

### B.8 Work management (`worker/work/*`)

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| GET | /api/work/pulse | session | Live counters plus `notif` and `me` fingerprints | work/index.js:18 |
| GET | /api/work/notifications | session | My last 40 notifications and unread count | work/chat.js:54 |
| POST | /api/work/notifications/read | session | Mark read by `ids`, `task_id` or `all` | work/chat.js:63 |
| GET | /api/work/people | session | People list (hierarchy filtered), with `tasks`, `rank`, `no_chat` | work/tasks.js:602 |
| GET | /api/work/workload | session (all teams with workload.all) | Per-person task counts and running task | work/tasks.js:603 |
| POST | /api/work/tasks/clear | session + tasks.clear | Preview or wipe all task data (`confirm: "CLEAR TASKS"`) | work/tasks.js:604 |
| GET | /api/work/attachments/:id | session (must see the task) | Download one attachment | work/tasks.js:605 |
| POST | /api/work/comments/:id/react | session | Toggle a reaction | work/tasks.js:606 |
| GET | /api/work/tasks | session | List tasks (filters assignee, status, project, flow, q, include) | work/tasks.js:607 |
| POST | /api/work/tasks | session + tasks.use | Create (others need tasks.assign_others) | work/tasks.js:609 |
| GET | /api/work/tasks/:id | session (visible) | One task with checklist, observers, comments, activity | work/tasks.js:612 |
| POST | /api/work/tasks/:id/update, /status, /checklist, /comments, /delete | session (rules in A.13) | Edit, status action, checklist, comment, soft delete | work/tasks.js:612 |
| GET | /api/work/projects | session | Projects visible to me | work/projects.js:78 |
| POST | /api/work/projects | session + projects.use or projects.manage | Create, or edit when `id` is given | work/projects.js:82 |
| GET | /api/work/projects/:id | session | Project detail | work/projects.js:114 |
| POST | /api/work/projects/:id/archive | session (owner or projects.manage) | Archive or unarchive | work/projects.js:132 |
| POST | /api/work/projects/:id/delete | session (owner or projects.manage) | Soft delete | work/projects.js:140 |
| GET / POST | /api/work/flows | session + flows.manage or flows.own | List, create or edit | work/projects.js:179 |
| POST | /api/work/flows/:id/delete | session + flows.manage or own flow | Soft delete | work/projects.js:205 |
| GET | /api/work/templates | session | List templates | work/projects.js:222 |
| POST | /api/work/templates | session + templates.manage or templates.own | Create or edit | work/projects.js:229 |
| POST | /api/work/templates/:id/delete | session + templates.manage or own | Soft delete | work/projects.js:251 |
| GET | /api/work/analytics | session + analytics.view | Task analytics | work/projects.js:384 |
| GET | /api/work/efficiency | session | Efficiency (others only with analytics.view) | work/projects.js:385 |
| GET | /api/work/bin | session + bin.manage | Binned items, last 30 days | work/projects.js:344 |
| POST | /api/work/bin/restore, /api/work/bin/purge | session + bin.manage | Restore or delete forever | work/projects.js:350 |
| GET | /api/work/schedule | session | Items, types, my swaps, shift presets for `?from=&to=` | work/schedule.js:91 |
| POST | /api/work/schedule/items | session + schedule.manage or edit_own | Add items | work/schedule.js:112 |
| POST | /api/work/schedule/items/bulk-delete | session + schedule.manage | Bulk delete (with preview) | work/schedule.js:144 |
| POST | /api/work/schedule/items/:id/update, /delete, /swap | session (manage or edit_own; swap needs schedule.swap_request) | Edit, delete, request swap | work/schedule.js:164 |
| POST | /api/work/schedule/types, /types/:key/update, /types/:key/delete | session + schedule.manage | Manage item types | work/schedule.js:213, 232 |
| POST | /api/work/schedule/shifts, /shifts/:key/update, /shifts/:key/delete | session + schedule.manage | Manage shift presets | work/schedule.js:258, 278 |
| GET | /api/work/schedule/swaps | session + schedule.swaps | Swap requests | work/schedule.js:304 |
| POST | /api/work/schedule/swaps/:id | session + schedule.swaps | Approve or decline | work/schedule.js:317 |

### B.9 Legacy v1 routes (do not extend)

| Method | Path | Auth | What it does | file:line |
|---|---|---|---|---|
| GET | /api/players | session | All rows of legacy `players` + `history`. Not team-scoped. No screen calls it | index.js:3775 |
| GET | /api/upload-log | session | Last 90 `upload_log` rows. No screen calls it | index.js:3793 |
| POST | /api/upload | session + data.sync | Legacy Excel upload into `players` / `history` / `upload_log` | index.js:3801 |

Duplicated or dead routes, summary: second `GET /api/rtn/engagement` (2936) and second `POST /api/rtn/engagement-sync` (2948) are unreachable copies; `POST /api/rtn/kpi/agent`, `POST /api/rtn/kpi/challenge`, `GET /api/rtn/latest`, `GET /api/players`, `GET /api/upload-log`, `POST /api/upload` have no caller in the frontend; `POST /api/rtn/auto-assign/run` without `?dry=1` and the 00:00 auto-create cron are switched off by constants.

---

## Appendix C. Scheduled jobs

`wrangler.toml` has two cron lines: `0 * * * *` (every hour) and `15 4 * * *` (12:15 MYT). The `scheduled()` handler is at `worker/index.js:3988`. All jobs run inside `ctx.waitUntil`, isolated, so one failure does not stop the others. Every log line starts with the job name, so search Worker logs for it.

| Cron / MYT time | Job function | What it does | Tables written | Switches | What to check if it fails |
|---|---|---|---|---|---|
| `15 4 * * *` / 12:15 daily | `kickFeeders` (index.js:1331) | POSTs `{key: INGEST_TOKEN}` to every feeder Web App at once. Each feeder then posts its Tier 3 and Tier V tabs to `/api/ingest`. This cron line runs only this job | Indirect: `player_days`, `daily_brand_stats`, `feed_check_state` (through ingest) | `FEEDER_URLS`, `INGEST_TOKEN`, constant `FEEDER_CRON` must equal the wrangler line | Log `kickFeeders:` shows `kicked`, `ok`, and per feeder a 6-character id tag. `skipped: FEEDER_URLS not set` or `INGEST_TOKEN not set`. URLs not matching `https://script.google.com/(a/macros/<domain>/)?macros/s/<id>/exec` are silently dropped |
| `0 * * * *` / every hour on the hour | `autoOutcomes` (index.js:1005) | Step 1: a real contact (CONTACTED, RESPONDED, NO_RESPONSE) in the last 20 days to an Inactive or Churn player who then deposits after the contact within 3 days (Inactive 1-2 or 3-6 days) or 7 days (7+ days or Churn) becomes RECOVERED, newest contact wins, one per player per 20 days. Step 2: CONTACTED rows not updated for 6 hours (snapshot in last 7 days) become NO_RESPONSE | `contact_log` (`status`, `updated_by='auto'`, `updated_at`) | None | Log `autoOutcomes:` with `recovered` and `no_response` counts |
| hourly, gated 01:00 and 06:00 UTC / 09:00 and 14:00 MYT | `larkEngagementSync` (index.js:1455) | Reads the Lark "Engagement" table (always yesterday MYT) and saves Livechat and Telegram counts per brand for yesterday. Second run overwrites the first | `engagement_daily` | `LARK_APP_ID`, `LARK_APP_SECRET` | Log `larkEngagementSync:` (`read`, `unknownBrands`, `saved`). `skipped: no LARK credentials`. Lark error code in `failed` line |
| hourly, gated 16:00 UTC / 00:00 MYT | `larkTelegramSync` (index.js:1485) | Mirrors Lark P&L1 table, Overview view, field "Telegram combine" into `player_telegram`. Remaps username to current `player_key`. Deletes links not in Lark | `player_telegram` | `LARK_APP_ID`, `LARK_APP_SECRET`. Safety stop if Lark returns under half of 200+ stored links | Log `larkTelegramSync:`. `aborted` = safety stop (nothing changed). `skipped: Lark returned no rows` |
| hourly, gated 16:00 UTC / 00:00 MYT | `autoCreateEvents` (index.js:218) | Creates draft campaign events for the rotation team of the day (Zyra tier by weekday; Friday rest) | `code_events`, `code_bands`, `code_assignments`, `activity_log` | `AUTO_CREATE_ENABLED = false` (index.js:65): currently logs a skip | Log `autoCreateEvents: skipped` while off |
| hourly, gated 07:00 UTC / 15:00 MYT | `feedCheckReport` (index.js:1581) | Posts the feed card to the Lark group: green all updated, orange brands missing or frozen (same deposit, count and newest deposit as the prior snapshot), red feed not received today. Saves open problem brands | `feed_check_state` | `LARK_FEED_WEBHOOK` (dormant without it), `LARK_FEED_SECRET` (signing) | Log `feedCheckReport:`. `skipped: no LARK_FEED_WEBHOOK`. Lark webhook code (for example 19021 = bad signature) |
| hourly, gated 07:00 UTC / 15:00 MYT | `autoAssignRosters` (index.js:1809) | For every brand and tier that already has an active Login Check roster, deals unassigned players of the latest snapshot to the least-loaded agent. Never moves an owner | `player_assignment` | None | Log `autoAssignRosters:` with `assigned` per scope. Eligible agents are hardcoded to `users.team = 'B'` and `on_leaderboard = 1` (index.js:1766) |
| hourly, gated 08:00 UTC / 16:00 MYT | `runAutoAssign` (index.js:1283) | Writes the daily deal as ASSIGNED rows, never over human rows or worked rows | `contact_log` | `AUTO_ASSIGN_ENABLED = false` (index.js:1281): currently logs a skip | Log `runAutoAssign: skipped` while off |
| After every scheduled run | `bumpArea(..., "contactreset")` (index.js:4067) | Tells open pages to reload all contact rows | `live_pulse` | Needs schema_v31 | Pages do not refresh by themselves if missing |
| Event: every ingest with rows | `feedResolutionCheck` (index.js:1672) | If the brand was flagged open today and is now fixed, posts a "Resolved" card and shrinks the open list | `feed_check_state` | `LARK_FEED_WEBHOOK` | Log `feedResolutionCheck:` (`skipped: raced` is normal under parallel posts) |
| Apps Script time triggers, each sheet: 15:00, 19:00, 22:00 MYT | `runFeedNow` in each `scripts/feeders/<team>/<n>. <BRAND>.gs` | Backup runs: post the "Daily" (Tier 3) and "Daily V" (Tier V) tabs to `/api/ingest` | Through ingest | Script property `INGEST_TOKEN`; triggers set by `setupDailyTrigger()` | Apps Script Executions log per sheet: line `<BRAND> <tier> [<rows>] -> <HTTP code> <reply>` |
| Apps Script Web App (on kick) | `doPost` in each feeder | Checks `key` against its own `INGEST_TOKEN`, takes a script lock (second call returns "already running"), runs `runFeedNow`, returns JSON | Through ingest | Web App must be deployed "Execute as: Me", "Who has access: Anyone" | Reply `unauthorized` = token mismatch. Google HTML page = redirect or access issue (see Appendix F) |

Notes:
- 25 feeder scripts exist: Team A 8 (JOM99, EZ96, PP96, BIG321, FUN36, JUS22, YES82, SA), Team B 8 (LPK777, BM69, HOT321, RM68, SK69, ACE33, JK32, ZAS36), Team C 9 (SPIN321, MY36, ONG66, VS96, MAX39, RUSH33, OMG67, AC69, OG). This matches `TEAM_BRANDS` in the Worker.
- `scripts/apps_script_feeder.gs` is the older generic template (no `doPost`, comment lists 7 brands). The per-brand files are the current ones.
- A feed rerun on the same MYT day overwrites that day (upsert). Last push wins for the tier.
- The feed card text says "the 15:00 MYT feed", but the main sync is 12:15. Text only.

---

## Appendix D. Database tables in detail

Column lists show key columns only. Times in `*_at` columns are UTC from `datetime('now')` unless noted. "Schema" = the file that created or changed the table.

### D.1 Player data

| Table | Purpose | Key columns | Primary / unique key | Written by | Read by | Schema |
|---|---|---|---|---|---|---|
| `player_days` | One row per player, brand, tier, day. The daily history | `snapshot_date` (MYT), `player_key` (uid, else username), `brand`, `tier_segment` ('3' or 'V'), identity, tier fields, `group_name`, daily / monthly / lifetime deposit and withdraw, `bet`, `valid_bet`, `win_loss`, `last_deposit_date`, `pnl`, `ingested_at` | UNIQUE (`player_key`, `snapshot_date`, `brand`, `tier_segment`). Never weaken this | `POST /api/ingest` only | Almost every `/api/rtn/*` read, auto-assign, autoOutcomes, feed check, campaigns, widget resolve | v3 (drops and recreates), index v21 `idx_pd_tier_key_cover` |
| `daily_brand_stats` | Rollup per day, brand, tier for Movement and the report | `deposit`, `withdraw`, `active_vip`, `roster`, `depositors_mtd` | UNIQUE (`snapshot_date`, `brand`, `tier_segment`) | Ingest (after each push) | `GET /api/rtn/movement`, Daily report | v22 |
| `player_telegram` | Telegram (LiveChat archive) link per player | `url`, `updated_by` ('lark' or a user), `updated_at` | PK (`player_key`, `brand`) | Nightly Lark sync (mirror), `POST /api/rtn/telegram`, `POST /api/rtn/lark-sync` | Board, CRM, auto-assign pool, contact-rate | v7 |
| `player_notes` | Relationship notes (no day) | `note`, `created_by`, `created_at` | `id` | `POST /api/rtn/notes`, `POST /api/ext/note` | Drawer, `GET /api/ext/notes` | v5 |
| `player_crm` | Follow-up date | `next_followup`, `updated_by` | PK (`player_key`, `brand`) | `POST /api/rtn/crm` | `GET /api/rtn/crm` | v6 |
| `livechat_log` | LiveChat links logged per player (QA trail) | `agent`, `url`, `created_at` | `id` | `POST /api/rtn/livechat` | `GET /api/rtn/crm`; delete by managers | v18 |
| `engagement_daily` | Livechat and Telegram chat counts per brand per MYT day | `chat_date`, `livechat`, `telegram` | PK (`chat_date`, `brand`) | Engagement sync (cron, manual) | `GET /api/rtn/engagement`, Daily report | v24 |
| `feed_check_state` | Brands still open after the feed check | `snapshot_date`, `open_json` | PK `snapshot_date` | Feed check, resolution check | Resolution check | v20 (feed_check_state) |

### D.2 Contact work

| Table | Purpose | Key columns | Primary / unique key | Written by | Read by | Schema |
|---|---|---|---|---|---|---|
| `contact_log` | One contact record per player per snapshot day | `class`, `assigned_to`, `status` (ASSIGNED, CONTACTED, RESPONDED, RECOVERED, NO_RESPONSE, SKIPPED, or NULL), `note`, `updated_by` ('auto' for jobs), `updated_at`, `contacted_at` (MYT first human touch day) | UNIQUE (`snapshot_date`, `player_key`, `brand`, `tier_segment`); `id` | `POST /api/rtn/contact`, `/unassign`, `autoOutcomes` cron, `runAutoAssign` (off), `/api/ext/action`, `/api/ext/action/remove` | Board, performance, KPI, auto-assign, contact-rate, campaigns (`contacted_before`), CRM | v4, v21 (`contacted_at`), v33 (index on `updated_at`) |
| `player_assignment` | Standing owner per player (Login Check rosters, also used by own-only checks) | `agent`, `active`, `assigned_by`, `assigned_at` | PK (`brand`, `tier_segment`, `player_key`) | Login Check assign and auto-assign, roster cron, account delete (sets `active = 0`) | Login Check, `ownerOf` in contact rules | v23 (also seeds the SK69 Tier V roster) |
| `daily_login_check` | Daily login and deposited ticks | `check_date` (MYT), `login`, `deposited`, `filled_by` | PK (`check_date`, `brand`, `tier_segment`, `player_key`) | `POST /api/rtn/login-check` | `GET /api/rtn/login-check` | v23 |

### D.3 Campaigns

| Table | Purpose | Key columns | Primary / unique key | Written by | Read by | Schema |
|---|---|---|---|---|---|---|
| `code_events` | One campaign event per day, brand, tier | `status` (draft, exported, closed), `pool_snapshot_date`, `pool_size`, created / exported / closed by and at | UNIQUE (`event_date`, `brand`, `tier_segment`) | Campaign create, export, close, delete, auto-create | Campaign routes | v19 |
| `code_bands` | The two BO codes per event | `label` (A or B), `code`, `amount`, `assigned` | UNIQUE (`event_id`, `label`) | Create, bands, delete | Export, find, release, report | v19 |
| `code_assignments` | Which player holds which code | `uid`, `username`, `label`, `claimed`, `claimed_at`, `claimed_by`, `channel`, `blocked_at`, `blocked_by`, `contacted_before` | UNIQUE (`event_id`, `player_key`) | Create, release, block, delete | Export, unclaimed, find, assignments, report | v19, v20 (`contacted_before`) |

### D.4 KPI inputs

| Table | Purpose | Key | Written by | Read by | Schema |
|---|---|---|---|---|---|
| `kpi_retention` | Manual retention percentages per brand | PK (`month`, `brand`) | `POST /api/rtn/kpi/retention` | `GET /api/rtn/kpi` | v8 |
| `kpi_team_month` | Team FRT, discipline, last and this month deposit. No team column | PK `month` | `POST /api/rtn/kpi/team` | `GET /api/rtn/kpi` | v9 |
| `kpi_agent_marks` | Staff KPI marks | PK (`month`, `agent`) | `POST /api/rtn/kpi/agent` (no UI caller) | `GET /api/rtn/kpi` | v10 |
| `kpi_team_challenge` | Team Challenge score per team | PK (`month`, `team`) | `POST /api/rtn/kpi/challenge` (no UI caller) | `GET /api/rtn/kpi` | v11 |
| `kpi_agent_month` | Per-agent FRT | PK (`month`, `agent`) | `POST /api/rtn/kpi/agent-input` | `GET /api/rtn/kpi` | v13 |
| `kpi_challenge_eng` | Manual follow-up done / required. No team column | PK `month` | `POST /api/rtn/kpi/challenge-eng` | `GET /api/rtn/kpi` | v14 |
| `mistakes` | Mistake log for Discipline | `id`; index (`month`, `agent`) | `POST /api/rtn/mistakes`, delete | `GET /api/rtn/mistakes` | v12 |

### D.5 Accounts, roles, audit, live

| Table | Purpose | Key columns | Key | Written by | Read by | Schema |
|---|---|---|---|---|---|---|
| `users` | Accounts | `username` (unique, lower case), `password_hash`, `role`, `can_edit`, `can_delete`, `on_leaderboard`, `manage_users`, `team` (A, B, C or NULL), `role_key`, `perm_overrides` (JSON), `last_login` | `id`; UNIQUE `username` | Init, login (`last_login`), user and role routes, change password | Every authenticated request, auto-assign agent lists | schema.sql, v15 (flags), v17 (`team`), v27 (`role_key`), v28 (`perm_overrides`), v32 (data fix) |
| `roles` | Ranked roles | `key`, `name`, `base`, `builtin`, `sort`, `deleted_at`, `sees` | PK `key` | Role routes | `loadRoles` on requests from accounts with a role | v27 (seeds admin, agent, viewer), v29 (`sees`) |
| `role_permissions` | Differences from a role's base | `perm`, `allowed` | PK (`role_key`, `perm`) | Role routes | `loadRoles` | v27, v32 |
| `activity_log` | Audit trail | `ts` (UTC), `username`, `role`, `action`, `detail`, `ip` | `id` | `logAct` on most writes, logins, widget calls, auto-create | `GET /api/activity`, widget rate cap | v16 |
| `live_pulse` | Change counters per area | `area`, `n` | PK `area` | `liveBump` after writes, `bumpArea` after cron | `GET /api/work/pulse` | v31 |
| `notifications` | Per-person messages (tags, comments, new tasks) | `username`, `kind`, `task_id`, `comment_id`, `actor`, `text`, `read_at` | `id` | Task routes via `notify` | Notification routes, pulse | v34 |

### D.6 Work management

| Table | Purpose | Key | Schema |
|---|---|---|---|
| `projects` | Projects (privacy members or team, archived, soft delete) | `id` | v25 |
| `project_members` | Members and owner | PK (`project_id`, `username`) | v25 |
| `flows` | Recurring-work pipelines | `id` | v25 |
| `task_templates` | Templates (deadline, assignee, checklist JSON) | `id` | v25 |
| `tasks` | Tasks (status pending, progress, done, deferred; timer fields; soft delete) | `id`; unique partial index one `progress` task per assignee | v25 |
| `task_checklist`, `task_observers`, `task_comments`, `task_activity` | Task detail | as named | v25 |
| `task_attachments` | Comment files, base64 in `data` | `id` | v30 |
| `task_reactions` | Emoji reactions | PK (`comment_id`, `emoji`, `username`) | v34 |
| `schedule_types`, `schedule_items`, `schedule_swaps` | Schedule board (repeat none, daily, weekly) | `key` / `id` | v25 |
| `schedule_shift_presets` | Shift time presets | PK `key` | v26 |

All written and read only through `/api/work/*` (Appendix B.8).

### D.7 Legacy and dropped

| Table | Status | Notes |
|---|---|---|
| `players`, `history`, `upload_log` | LEGACY (v1 Excel upload) | Only `/api/players`, `/api/upload-log`, `/api/upload`. No screen uses them. schema.sql |
| `player_days` as in v2 | DROPPED | v2 keyed on `entry_date`; v3 dropped and recreated it on `snapshot_date` |

Schema file notes: there are two files numbered v20 and two numbered v21 (different content). Every file says whether it is additive. v3 is destructive. `ALTER TABLE ADD COLUMN` files (v15, v17, v20 contacted_before, v21 contact_action_date, v27, v28, v29) fail if run twice. Not confirmed from code which files have been run on production; the Worker has fallbacks for missing v27, v28, v29, v30, v31 and v34 objects.

---

## Appendix E. Permissions and roles

### E.1 Model

- **Permission** = one function (key in `PERMS`, `worker/perms.js`). 50 keys in 5 groups: pages, daily, tasks, schedule, admin.
- **Role** = name + starting point (`base`) + overrides. `base` is `none`, a fixed code set (`admin`, `agent`, `viewer`), or another role's key (the role then follows that template as it is now; depth limit 5; loops refused). A role can also be a one-off copy (`copy: true`), stored with base `none` and explicit overrides.
- **Effective permissions of an account** (`resolvePerms`):
  1. Account has a `role_key` that exists: role permissions, then personal exceptions from `users.perm_overrides` (true adds, false removes). Also `tasks.view_all` is added automatically unless the account is on the most junior role, has a team, and has neither `people.above` nor `people.same_rank`.
  2. Account has no `role_key` ("old settings", `legacyPerms`): `manage_users = 1` gives every permission whose admin default is on; `can_edit` (or manager) gives `contact.edit`, `contact.edit_own`, `tasks.use`, `projects.use`, `schedule.swap_request`; `can_delete` (or manager) gives `contact.delete`, `contact.delete_own`; `on_leaderboard` gives `kpi.scored`; non-managers also get every page the agent default shows.
  3. If the roles tables are missing, everyone is treated as old settings.
- **Old columns kept in step**: when roles change, `legacyColumns` writes `role`, `can_edit`, `can_delete`, `on_leaderboard`, `manage_users` for every account on that role, so old SQL that reads these columns (for example auto-assign agent lists, roster cron, login response) stays right.
- **Old flag editor** (`POST /api/users/perm`) sets the old columns by hand and removes `role_key` and `perm_overrides`, moving the account back to old settings.

### E.2 Team wall and hierarchy

- Team wall: without `teams.all`, an account sees only its own team's brands (`TEAM_BRANDS`, `worker/index.js:31`). No team = no brands. With `teams.all`, `?team=A|B|C` narrows aggregate routes. The same team map exists as `TEAMS` in `App.jsx` and must be kept in sync.
- Campaign find and release ignore the team wall on purpose (LiveChat hands any agent any brand), but only match players inside an event pool.
- Hierarchy (`canViewPerson`): roles ranked by `sort`, most senior first. A person sees their own rank and below. More senior people are hidden unless `people.above`. For tasks, same-rank colleagues are visible only when the viewer has no team, or with `people.same_rank`. A role with `sees = {team: "own"}` limits lists to its own team's downline. Accounts without a role are outside the hierarchy.
- The hierarchy filters: team list in `/api/rtn/board`, `/api/work/people`, task visibility, project task lists, and who can be @tagged.
- `people.all` is checked only in the browser (`src/revamp/scope.js`) to show people from every team in agent pickers.

### E.3 Last-manager guard

At least one account must keep `users.manage`:
- `POST /api/users/perm`: refuses to turn off `manage_users` if no other manager exists.
- `DELETE /api/users/:id`: refuses self-delete and deleting the last manager.
- `roles.js` `locksOut`: refuses any role update, role delete, role assignment or personal exception that would leave zero accounts with `users.manage`. Error text: "Can't remove the last account that can manage accounts and roles. Give someone else that permission first."

### E.4 Every permission flag

Defaults are admin / agent / viewer (1 = on).

| Key | Group | Unlocks | Default |
|---|---|---|---|
| page.changes | pages | Changes page in the sidebar | 1/1/1 |
| page.performance | pages | Performance page (admin view) | 1/0/0 |
| page.contact | pages | Contact page | 1/1/1 |
| page.checkin | pages | Check-in page | 1/1/1 |
| page.grace | pages | Grace claims page | 1/1/1 |
| page.players | pages | Players page | 1/1/1 |
| page.tasks | pages | Tasks page | 1/1/1 |
| page.schedule | pages | Schedule page | 1/1/1 |
| page.projects | pages | Projects page | 1/1/1 |
| page.workload | pages | Team workload page | 1/1/1 |
| page.myday | pages | My day page | 0/1/1 |
| page.myperf | pages | My performance page | 0/1/1 |
| page.account | pages | My account tab in Settings | 1/1/1 |
| page.settings | pages | Settings page | 1/1/1 |
| dashboard.view | daily | Admin Dashboard page (browser check only) | 1/0/0 |
| contact.edit_own | daily | Log contacts, notes, CRM, Telegram, LiveChat on own or unowned players; Login Check ticks; campaign release and block; KPI inputs | 1/1/0 |
| contact.edit | daily | Same on any player, and assign to others | 1/1/0 |
| contact.delete_own | daily | Clear own contacts and notes | 1/1/0 |
| contact.delete | daily | Clear anyone's contacts and notes | 1/1/0 |
| assign.manage | daily | Unassign, auto-assign run, full auto-assign preview, Login Check assign and auto-assign, Assignments page | 1/0/0 |
| campaigns.manage | daily | Create, codes, export, unclaimed, tables, report, delete, close, auto-create | 1/0/0 |
| data.sync | daily | Feeders run, engagement sync, Lark sync, feed check, Lark debug, delete LiveChat logs, legacy upload | 1/0/0 |
| mistakes.log | daily | Log and delete mistakes | 1/0/0 |
| chat.exempt | daily | Live board card shows only clock-in | 0/0/0 |
| kpi.scored | daily | Counted as a scored CS agent (`on_leaderboard`): KPI, auto-assign PICs, roster cron agents | 0/1/0 |
| teams.all | daily | See every team's brands, team switcher, admin sidebar | 1/0/0 |
| people.above | daily | See people in more senior roles | 0/0/0 |
| people.same_rank | daily | See same-rank colleagues' tasks when on a team | 0/0/0 |
| people.all | daily | People from every team in pickers (browser only) | 0/0/0 |
| activity.view | daily | Activity log | 1/0/0 |
| tasks.use | tasks | Create and work on own tasks, comment | 1/1/0 |
| tasks.assign_others | tasks | Create for others, reassign, bulk assign | 1/0/0 |
| tasks.view_all | tasks | See tasks they do not hold (old-settings accounts; role accounts follow the hierarchy) | 1/0/0 |
| tasks.edit_any | tasks | Edit any task | 1/0/0 |
| tasks.delete_any | tasks | Delete any task | 1/0/0 |
| workload.all | tasks | Workload for all teams | 1/0/0 |
| projects.use | tasks | Create and manage own projects | 1/1/0 |
| projects.manage | tasks | Manage and see any project | 1/0/0 |
| flows.own | tasks | Manage flows they administer | 1/0/0 |
| flows.manage | tasks | Manage any flow | 1/0/0 |
| templates.own | tasks | Manage own templates | 1/0/0 |
| templates.manage | tasks | Manage any template | 1/0/0 |
| analytics.view | tasks | Analytics and everyone's efficiency | 1/0/0 |
| tasks.clear | tasks | Wipe all task data | 1/0/0 |
| bin.manage | tasks | Recycle bin | 1/0/0 |
| schedule.edit_own | schedule | Add and edit own schedule items | 1/0/0 |
| schedule.manage | schedule | Whole schedule, types, shifts, bulk delete | 1/0/0 |
| schedule.swaps | schedule | Decide swap requests | 1/0/0 |
| schedule.swap_request | schedule | Request a swap (hidden from role screens while shifts are hidden) | 1/1/0 |
| users.manage | admin | Accounts, roles, permissions, page access | 1/0/0 |

Browser fallback (`src/revamp/perms.js`): if `/api/me` has no `perms` (an older Worker), the UI maps old flags itself.

---

## Appendix F. Troubleshooting

Safe read-only checks below use `wrangler d1 execute groupb-tracker-db --remote --command="..."`. They return counts and brand codes only, never player rows. Always include `--remote`. Worker logs: Cloudflare dashboard, Workers, `groupb-tracker-api`, Logs (or `wrangler tail`). Each job logs its own name.

| # | Symptom | Likely cause | How to check | Fix |
|---|---|---|---|---|
| 1 | A feeder reply in `kickFeeders` logs says `HTTP 200 (not JSON)` (Google page instead of JSON) | Google's Web App redirect returned an HTML page. Past cases: data landed anyway. Other causes: Web App not deployed as "Anyone", deployment URL changed, script error page | Log line `kickFeeders:` (id tag = last 6 characters of the script id). Then check the brand landed: `SELECT brand, MAX(ingested_at) FROM player_days WHERE snapshot_date = date('now','+8 hours') GROUP BY brand` | If the brand landed, no action. If not: open that sheet's Apps Script, run `runFeedNow`, read the Executions log; redeploy the Web App (Execute as Me, Anyone) and update `FEEDER_URLS` |
| 2 | A brand shows LAG (old Daily rail chip, revamp brand chip, or Bell "deposits lag") | That brand's newest `last_deposit_date` is earlier than the freshest brand's. The feeder ran before the sheet updated | Board `health` (`newest_dep`). SQL: `SELECT brand, MAX(last_deposit_date) FROM player_days WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM player_days) GROUP BY brand` | Re-run that brand's feeder after the sheet updates (same-day push overwrites). If one value is junk text, the ingest header guard should already drop it |
| 3 | A brand shows STALE / "not fed today" | No rows for that brand in today's snapshot | `SELECT brand, MAX(snapshot_date) FROM player_days GROUP BY brand` | Run that sheet's `runFeedNow`, or `POST /api/rtn/feeders/run` (data.sync) |
| 4 | No data at 15:00 (shell says "No snapshots yet", or today missing) | 12:15 kick skipped (`FEEDER_URLS` or `INGEST_TOKEN` missing), URLs failed the regex, `INGEST_TOKEN` differs between Worker and sheets (ingest 401), or Google Sheets down | Log `kickFeeders:` at 12:15. Apps Script log of one sheet (HTTP 401 = token mismatch). `SELECT MAX(snapshot_date), MAX(ingested_at) FROM player_days` | Fix the secret or script property, then `POST /api/rtn/feeders/run`. `?dry=1` first shows how many URLs are configured |
| 5 | Feed health card missing in the Lark group | `LARK_FEED_WEBHOOK` not set (job skips), bad signing secret (Lark 19021), bot removed from the group, or a Worker error at 15:00 | Log `feedCheckReport:` at 15:00 MYT. `POST /api/rtn/feed-check?dry=1` returns the card without posting. `SELECT * FROM feed_check_state` | Set or re-paste the webhook and secret (the code trims spaces and BOM). Re-run `POST /api/rtn/feed-check` |
| 6 | Lark Telegram sync fails or links look wrong | No Lark credentials, Lark app lost "can view", wrong view, or safety stop (`aborted`, under half of stored links) | Log `larkTelegramSync:` at 00:00 MYT. `POST /api/rtn/lark-sync?dry=1` shows `seen`, `tally`, `wouldDelete`. `GET /api/rtn/lark-debug?table=<id>` lists views | Fix access or view, re-run. Use `?force=1` only when the drop is real. Links typed in the drawer are replaced at the next run by design |
| 7 | User cannot log in | Wrong password (401 after 1 second), account deleted, token older than 8 hours (401 "Unauthorized", browser drops it), `SESSION_SECRET` changed (all tokens invalid), `PASSWORD_SALT` changed (all passwords invalid), page opened on a non-allowed origin (CORS) | Activity log for `login` rows. Check the browser console for a CORS error. `SELECT COUNT(*) FROM users WHERE username = lower('<name>')` | There is no admin password reset route. Options: the user changes their own password while signed in; or delete and recreate the account (this releases its `player_assignment` rows); or a direct D1 update of `password_hash` computed with the salt (needs owner approval). Never rotate `PASSWORD_SALT` without a reset plan |
| 8 | "Can't remove the last manager" or "last account that can manage accounts" | Last-manager guard (Appendix E.3) | `SELECT COUNT(*) FROM users WHERE manage_users = 1` | Give a second account `users.manage` first, then make the change |
| 9 | Hundreds of auto NO_RESPONSE per day | `autoOutcomes` step 2 flips every CONTACTED row not updated within 6 hours. Agents set CONTACTED and do not update when the player replies. Knock-on: 3 NO_RESPONSE in 20 days removes a player from auto-assign (`AA_GIVEUP`) | `SELECT date(updated_at,'+8 hours') d, COUNT(*) FROM contact_log WHERE status = 'NO_RESPONSE' AND updated_by = 'auto' GROUP BY d ORDER BY d DESC LIMIT 7` | Process: agents mark RESPONDED promptly. Rule change (window length, scope) is a business rule: VIP Retention must approve before code changes |
| 10 | Telegram reach or engagement looks too high | Reach: `player_telegram` held stale links (old behaviour never deleted; the nightly mirror now deletes, but an aborted sync leaves stale links). Engagement: the sync adds up all Lark rows per brand, so duplicate brand rows in the Lark Engagement table double the count | `SELECT brand, COUNT(*), MAX(updated_at), SUM(updated_by = 'lark') FROM player_telegram GROUP BY brand`. `POST /api/rtn/engagement-sync?dry=1&date=YYYY-MM-DD` shows `read`, `rows`, `unknownBrands` | Clear the Lark-side duplicate, re-run engagement sync for that date. Run Lark sync (dry first) |
| 11 | Drawer bonus card or Grace page shows "WIDGET_LARK is not set" (503) or "Lark ... failed" (502) | `WIDGET_LARK` secret missing or not valid JSON with `base` and `tables`; `grace` table id missing; Lark app lacks "can view" on a table | Call `GET /api/rtn/bonus-lookup?username=<x>&brand=<b>` with a session; read the error text | Set `WIDGET_LARK` (JSON), give the Lark app view access, redeploy not needed for secrets |
| 12 | Widget cannot save notes or actions (401, 404, 429) | 401: `WIDGET_API_KEY` missing or the widget's key (its `CONSOLE_NOTE_TOKEN`) differs. 404: brand not in `TEAM_BRANDS` or player not found in the latest snapshot. 429: more than 60 widget writes per minute | Activity log rows with username `widget:<name>` | Align the keys; check the brand short code maps (`brandMap` in `WIDGET_LARK` for reads) |
| 13 | Deploy mismatch: users see old screens or missing features | Pages not deployed, browser cache, or Worker and Pages from different commits. Signs: `/api/me` has no `perms` (old Worker); `/api/work/*` returns 404 (Worker older than the revamp) | Compare the `index-<hash>.js` file name served by the live site (view page source) with `dist/assets/index-<hash>.js` from `npm run build` of the deployed commit. Check Worker version in Cloudflare (Workers, Deployments) | Redeploy the matching Pages build or Worker (owner approval). Hard refresh the browser |
| 14 | A D1 command shows empty tables or "no such table" | Command run without `--remote`, so it hit the local simulation | Look at the command line | Re-run with `--remote`. Never run local test scripts against production |
| 15 | Roster auto-assign deals Team A or C rosters to Team B agents, or "no agents" | `autoAssignOneRoster` picks agents with `team = 'B'` and `on_leaderboard = 1`, whatever the brand's team | Log `autoAssignRosters:` | Code fix needed (use the brand's team). Until then only seed rosters for Team B brands |
| 16 | Pages do not refresh by themselves | `live_pulse` table missing (schema v31), or tab hidden (polling pauses) | `SELECT * FROM live_pulse` | Run schema v31 (additive) with owner approval |
| 17 | "Event looks incomplete" on campaign export (409) | Stored `pool_size` does not match the assignment count | Campaign assignments view | Delete the draft and recreate it. Do not upload the list |
| 18 | KPI team inputs appear for the wrong team | `kpi_team_month` and `kpi_challenge_eng` have one row per month, no team column; any editor can write them | `SELECT * FROM kpi_team_month ORDER BY month DESC LIMIT 3` | Agree one owner per month, or add a team column (schema change, approval needed) |

---

## Appendix G. Read next

| Doc | What it holds |
|---|---|
| `CLAUDE.md` (repo root) | Operating rules (approval before deploy and destructive SQL, `--remote`, unique key), architecture, commands |
| `CONTRIBUTING.md` | Owner and developer roles, branch and pull request flow, local setup warning (local app writes live data) |
| `docs/00-INDEX.md` | Map of every doc |
| `docs/HANDOFF.md` | Deep reference: domain model, strategy layer, backlog, known limits |
| `docs/DEPLOY.md` | Original provisioning guide: D1, secrets, Worker and Pages deploy |
| `docs/LAUNCH_CHECKLIST.md` | Checks before launching to a team |
| `docs/EXECUTED_IDEAS.md` | What shipped, by impact |
| `docs/IDEAS.md` | Parked features |
| `docs/AUTO_ASSIGN_PLAN.md` | Auto-assign design: fairness, bands, sticky owners, give-up, rest days |
| `docs/ACT_NOW_PRIORITY_SPEC.md` | ACT NOW band rule and cooling-whale sort |
| `docs/KPI_ENGINE_FULL_SPEC.md` | KPI engine: base, bonus, Team Challenge |
| `docs/KPI_NEXT_SESSION_CHECKLIST.md` | Confirmed numbers needed for KPI stage 1 |
| `docs/performance_competition.md` | Cross-team challenge scoring |
| `docs/DEPOSIT_DROP_ANALYSIS.md` | Day-over-day deposit drop study |
| `docs/IMESSAGE_INTEGRATION_SPEC.md` | Draft spec for VVIP codes in the iMessage console |
| `docs/AGENT_HANDBOOK.md` | Agent guide to the daily queue |
| `docs/CONSOLE_WALKTHROUGH.md` | Plain explainer of the console |
| `docs/MESSAGES_GUIDE.md` | How to edit `src/messageLibrary.js` |
| `docs/NOTICE_ASSIGNED_TAB.md`, `docs/NOTICE_CONTACT_PARITY.md` | Team notices for the Assigned list and fresh-first rule |
| `docs/REDEEM_CODE_FLOOR_SOP.md`, `docs/VVIP_CODE_CONTENT_BRIEF.md` | Redeem code floor script and content brief |
| `docs/design/BUILD-CONTRACT.md` | Revamp contract: API shapes, page ctx, mock rules |
| `docs/design/*.html` | Revamp and design pass mockups (admin, agent) |
| `docs/sessions/2026-10-17-atl-report-engagement-sync.md` | Daily report, engagement sync, 12:15 feeder kick-off, open items |
| `docs/sessions/2026-10-18-widget-bridge-grace-tasks.md` | Widget API, Lark bonus reads, Grace rules |
| `docs/sessions/2026-10-22-revamp-integration.md`, `docs/sessions/2026-10-22-revamp-deploy.md` | Revamp build and deploy record, rollback points |
| Other `docs/sessions/*.md` | Earlier fixes (Tier 3 deposit fix, design pass, Lost and gone) |
| `scripts/test-*.mjs` | Local-only API tests (throwaway local D1, never `--remote`) |
