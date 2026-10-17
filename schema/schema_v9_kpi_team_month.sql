-- ============================================================
-- groupb-tracker · Schema v9 · kpi_team_month  (Stage 1b team inputs)
-- ADDITIVE — creates a NEW table only. Does NOT touch any existing
-- table. Safe with --remote.
--
-- Purpose: the manual TEAM-level inputs that complete the BaseKPI /100 —
-- FRT (response time), Discipline (mistake count), and the two deposit
-- totals for MoM growth. Retention % stays per-brand in kpi_retention;
-- this table is one row per month.
--
-- Grain: (month). month = 'YYYY-MM'. PRIMARY KEY enables upsert.
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_team_month (
  month               TEXT PRIMARY KEY,        -- 'YYYY-MM'
  frt_sec             REAL,                    -- team first-response time, seconds
  discipline          INTEGER,                 -- team mistake count
  last_month_deposit  REAL,                    -- prior month deposit total (RM) for growth
  this_month_deposit  REAL,                    -- this month deposit total (RM) for growth
  updated_by          TEXT,
  updated_at          TEXT DEFAULT (datetime('now'))
);
