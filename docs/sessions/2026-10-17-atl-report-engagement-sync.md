# 2026-10-17 · ATL Daily report, phrase book, Livechat/Telegram sync

Long session (5–17 Oct). Main result: the Dashboard **Daily report** button now builds the full ATL report by itself, and the Livechat/Telegram table fills from Lark. Also: Telegram pool numbers for Aug/Sep, and a Table/Assigned split that was shipped and rolled back.

## Today in short (ATL's summary)
1. Updated the daily alignment template with the comparison tables and analysis bullet points (Top Deposit Movers back too).
2. Auto sync of the engagement table (Livechat & Telegram).
3. Auto analyzer built in, with a phrase book covering the many situations and variables the report can meet. It checks its own numbers and says "check manually" when they don't add up.
4. Faster copy: about 3 s instead of 10 s.

## Shipped (all deployed with ATL's approval)
| Commit | What |
|---|---|
| a332a09 | **ATL report template** in the clipboard: sections 1–5, section 1 fully automatic. |
| aca989e | Top Deposit Movers and the Livechat & Telegram table brought back. |
| fa802e8 | **Normal-day analysis + phrase book.** Sections 2–5 compare each brand × tier with its 7-day average, report a deposit move only if it clears both RM10,000 and 15%, and rank by money. Self-checks: brand gaps must add up to the team gap ("⚠ check manually" if not), late data and short history are skipped and named, 100%+ swings are flagged. All sentences live in `src/reportPhrases.js` (40 situations, 90 wordings, rotated per day, stable within a day). |
| 4ff5eec | Worker: `lark-debug` can probe another Lark Base read-only (`?base`, `&raw`). |
| b1c5bbf | **Engagement sync.** Lark "Engagement" table → `engagement_daily` (schema v24, additive) at 09:00 and 14:00 MYT. Routes `GET /api/rtn/engagement`, `POST /api/rtn/engagement-sync` (managers, `?dry=1`). |
| 535b861 | Report fills the Livechat & Telegram table from `engagement_daily` (blank if no sync). |
| d429e30 | Report fetches run in parallel: about 10 s down to about 3 s. |

Report order now: `<date> - Leader Reporting` → comparison tables (Deposit, Active VIP, Retention, Reactivation; Overall / Tier 3 / Tier V) → Top Deposit Movers → Livechat & Telegram → template sections 1–5 → blank alignment block (Yesterday Top 3, Current Issues, Bottlenecks, Support Needed, Today's Top 3).

## Decisions
- Report analysis is **rules, not AI** (free, checkable). AI writing (Claude API, about $0.06–0.08 per report on Opus 5.5) parked as a possible step 2.
- No ✏️ draft marks in the copy (ATL's call); they can come back via `D` in `buildDailyReport`.
- "Auto learning" = new situations print a plain fallback and are listed in section 5; a human adds wordings.
- Engagement source is the small Lark "Engagement" table (always yesterday MYT), not the 12k-row monthly "Customer approaching" tables. Our Lark app already had access. NOW32 is skipped (not in `TEAM_BRANDS`).
- Telegram pool: count only links Lark still had at the time (link `updated_at` ≥ the day). Sep 30 matched Lark within 6 (3,061 vs 3,067). August is an upper bound, because links added later in the month also count.

## 12:15 feeder start (live 17 Oct, commit cd8494a)
- All 25 feeder scripts pasted, published as Web apps (Me / Anyone), and `setupDailyTrigger` run (timers now 3 / 7 / 10 PM; 1 PM dropped).
- Worker cron `15 4 * * *` POSTs to all 25 at once; URLs in the `FEEDER_URLS` secret (local copy: `exports/feeder-webapp-urls.txt`, not in git).
- Test run 17 Oct 22:25 MYT: all 25 brands ingested within about 1 minute (checked `ingested_at`). 11 replies came back as a Google page instead of JSON (Team A, BM69, ACE33, OMG67), but their data landed. The cause is Google's reply redirect, not our code (the wrong-key test returned JSON from all 25).
- Possible improvement: have the Worker confirm each brand in the database instead of trusting the reply.

## Rolled back / not live
- **Table = broadcast, Assigned = Tier V DSLD 1-6.** Deployed 8 Oct, rolled back the same day: Team B's Assigned list fell to 2, because 323 of 347 eligible Tier V players had 3+ automatic NO_RESPONSE strikes. The code is still uncommitted in `src/App.jsx` and `worker/index.js`.

## Open items
- Automatic NO_RESPONSE marks hundreds of contacts a day (150 of 152 on 16 Oct). This blocks the Table/Assigned split and makes the report's results line look bad.
- Reactivation still compares with yesterday (no 7-day history in the console).
- The Telegram link table never deletes, so the console overcounts reach by about 1,000.
- The bulk "Mark contacted" sends one request per player.

## Files touched
`src/App.jsx`, `src/reportPhrases.js` (new), `worker/index.js`, `wrangler.toml`, `schema/schema_v24_engagement_daily.sql` (new), `scripts/feeders/*/*.gs`.

## Related
[[HANDOFF]] · [[EXECUTED_IDEAS]] · [[IDEAS]] · [[2026-09-30-console-design-pass]]
