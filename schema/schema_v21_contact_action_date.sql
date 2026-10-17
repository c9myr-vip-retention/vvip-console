-- ============================================================
-- groupb-tracker · Schema v21 · contact_log.contacted_at
-- ADDITIVE — adds ONE nullable column. Touches nothing else.
-- Safe with --remote.
--
-- Why: snapshot_date is the DATA day (the board the agent was
-- looking at). Before the daily feed lands at 15:00 MYT, that is
-- still yesterday, so a contact made this morning was stamped
-- yesterday and displayed as yesterday. contacted_at records the
-- REAL MYT calendar day the agent acted, set once on the first
-- human write and never overwritten by the auto-outcome cron
-- (which only sets status/updated_at). The console shows this
-- instead of snapshot_date.
--
-- Old rows stay NULL; the display falls back to snapshot_date for
-- them (the true past contact day can't be reconstructed).
-- ============================================================

ALTER TABLE contact_log ADD COLUMN contacted_at TEXT;   -- 'YYYY-MM-DD' MYT, real action day
