-- ============================================================
-- groupb-tracker · Schema v22 · daily_brand_stats (additive — no drops)
--
-- WHY: the Movement view needs a brand × date grid for a whole month. Computing that
--      live from player_days costs ~1.17s and reads 625,000+ rows for one month, and grows
--      every day. This rollup is ~46 rows per day (23 brands × 2 tiers), so the page reads
--      a few hundred rows instead of hundreds of thousands.
--
-- Kept at tier granularity so the Tier 3 / Tier V filter works without a second table.
-- "All tiers" is the sum of the two rows, EXCEPT retention, which must be rebuilt from
-- depositors_mtd / roster — averaging two tier percentages would weight a 20-player tier
-- the same as a 700-player one.
--
-- Written by the ingest for the brand+tier it just received, so it is always current.
-- Backfill for history is a one-off INSERT ... SELECT (see below).
-- Run with --remote.
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_brand_stats (
  snapshot_date  TEXT NOT NULL,
  brand          TEXT NOT NULL,
  tier_segment   TEXT NOT NULL,
  deposit        REAL,      -- sum of daily_deposit
  withdraw       REAL,      -- sum of daily_withdraw
  active_vip     INTEGER,   -- players who deposited that day
  roster         INTEGER,   -- players in the tier that day
  depositors_mtd INTEGER,   -- players with monthly_deposit > 0 (retention numerator)
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (snapshot_date, brand, tier_segment)
);

CREATE INDEX IF NOT EXISTS idx_dbs_month ON daily_brand_stats (snapshot_date, brand);

-- One-off backfill of everything already in player_days.
INSERT INTO daily_brand_stats
  (snapshot_date, brand, tier_segment, deposit, withdraw, active_vip, roster, depositors_mtd)
SELECT snapshot_date, brand, tier_segment,
       ROUND(SUM(COALESCE(CAST(NULLIF(daily_deposit,'')  AS REAL), 0))),
       ROUND(SUM(COALESCE(CAST(NULLIF(daily_withdraw,'') AS REAL), 0))),
       COUNT(CASE WHEN COALESCE(CAST(NULLIF(daily_deposit,'')   AS REAL), 0) > 0 THEN 1 END),
       COUNT(*),
       COUNT(CASE WHEN COALESCE(CAST(NULLIF(monthly_deposit,'') AS REAL), 0) > 0 THEN 1 END)
FROM player_days
GROUP BY snapshot_date, brand, tier_segment
ON CONFLICT (snapshot_date, brand, tier_segment) DO UPDATE SET
  deposit = excluded.deposit, withdraw = excluded.withdraw,
  active_vip = excluded.active_vip, roster = excluded.roster,
  depositors_mtd = excluded.depositors_mtd, updated_at = datetime('now');
