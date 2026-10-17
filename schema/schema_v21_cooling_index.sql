-- ============================================================
-- groupb-tracker · Schema v21 · cooling/reactivation index (additive — no drops)
--
-- WHY: the board load runs two history CTEs (cooling + reactivation) that both do
--        SELECT ... FROM player_days WHERE tier_segment='V' GROUP BY player_key, brand
--      with NO date bound. player_days had no index on tier_segment, so each one was a
--      full table scan: measured 2.7s and 727,506 rows read on 78 days of history —
--      and it ran TWICE on every single board load. That is the console "getting slower":
--      the cost grows with every day of history, ~2,300 Tier V rows added daily.
--
-- The column order matters: tier_segment first (the filter), then the GROUP BY keys, then
-- the aggregated columns so the index covers the query and never touches the table.
--
-- Purely additive. Safe to drop again with:  DROP INDEX idx_pd_tier_key_cover;
-- Run with --remote.
-- ============================================================

-- group_name is included because the reactivation CTE counts 'Reactivated%' rows; without it
-- that query still had to fetch every row from the table (measured 490ms vs 63ms covered).
DROP INDEX IF EXISTS idx_pd_tier_key_cover;
CREATE INDEX IF NOT EXISTS idx_pd_tier_key_cover
  ON player_days (tier_segment, player_key, brand, snapshot_date, daily_deposit, group_name);
