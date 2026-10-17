-- ============================================================
-- groupb-tracker · Schema v14 · kpi_challenge_eng  (Team Challenge engagement)
-- ADDITIVE — creates a NEW table only. Safe with --remote.
--
-- Purpose: the manual follow-up inputs for the Team Challenge Engagement
-- category. "VIPs contacted" is auto-counted from contact_log, so only the
-- follow-up numbers are stored here. One row per month.
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_challenge_eng (
  month       TEXT PRIMARY KEY,         -- 'YYYY-MM'
  fu_done     INTEGER,                  -- completed follow-ups
  fu_required INTEGER,                  -- required follow-ups
  updated_by  TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);
