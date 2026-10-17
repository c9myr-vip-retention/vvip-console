-- ============================================================
-- groupb-tracker · Schema v10 · kpi_agent_marks  (manual leaderboard)
-- ADDITIVE — creates a NEW table only. Does NOT touch any existing
-- table. Safe with --remote.
--
-- Purpose: a manually-entered total KPI mark per staff member, per
-- month, for the Performance leaderboard. Bridges until per-agent KPI
-- (Stage 2) can auto-compute these. One row per (month, agent).
--
-- Grain: (month, agent). month = 'YYYY-MM', agent = username. PK upsert.
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_agent_marks (
  month      TEXT NOT NULL,            -- 'YYYY-MM'
  agent      TEXT NOT NULL,            -- staff username
  marks      REAL,                     -- total KPI mark
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (month, agent)
);
