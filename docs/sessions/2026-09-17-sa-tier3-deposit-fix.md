# 2026-09-17 — SA Tier 3 deposit fix (daily report)

## What we worked on
Investigated a reported "bug" where the Daily Leadership report showed SA Tier 3 deposit = RM515 for the 15 Sep column, while the [[Movement]]/Changes page showed RM6,754 for the same day.

## Root cause (data, not formula)
On the `2026-09-16` snapshot the SA feeder pushed twice; the second push mislabeled ~100 Tier-3 players as Tier V. The ingest `tier_cleanup` (worker/index.js:488-499) then deleted those players' genuine Tier-3 rows to prevent double-counting. Result:

- `player_days` 16 Sep: Tier 3 = 46 rows / 515 (corrupted), Tier V = 144 rows / 12,295 (inflated).
- `daily_brand_stats` rollup 16 Sep: Tier 3 = 6,754 (correct — kept the first good push's total).

The report read `player_days` (515); the Changes page read the rollup (6,754). Re-running the feeder does **not** fix a past day because the Worker stamps `snapshot_date = today (MYT)`. The deleted per-player Tier-3 rows are unrecoverable from the DB.

## Decision settled
Point the daily report's **Deposit** figures at the `daily_brand_stats` rollup — the same source the Changes page uses — so it survives this class of feeder tier-mislabel. All other brand/day deposit cells are unchanged (rollup already matched player_days there). Active VIP / Retention tables still read player_days (only Deposit was flagged; the corruption is a one-day past snapshot outside tomorrow's report window).

## Files touched
- `src/App.jsx` — `buildDailyReport` `aggregate()` now takes the snapshot date and overrides `dep3`/`depV` from a `depStats` rollup lookup; `genReport` fetches `/api/rtn/movement` for the spanned months and builds `depStats`.

## Shipped
Deployed to Cloudflare Pages `production` branch (2026-09-17). Live at groupb-tracker.pages.dev.

## Open items
- Optional: restore 16 Sep SA source rows for full per-player detail (needs the source sheet; only the aggregate survives in the rollup).
- Optional: also source the report's Active VIP / Retention from the rollup for full consistency.
- Systemic: give the feeder a backfill `snapshot_date` override so a bad day can be re-pushed without a manual DB fix, and consider an ingest guard that rejects a push whose roster swings wildly vs the prior snapshot.

## Related
- [[HANDOFF]]
- [[EXECUTED_IDEAS]]
