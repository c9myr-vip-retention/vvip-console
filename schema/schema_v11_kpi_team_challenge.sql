-- ============================================================
-- groupb-tracker · Schema v11 · kpi_team_challenge  (team-vs-team board)
-- ADDITIVE — creates a NEW table only. Safe with --remote.
--
-- Purpose: the manual Team Challenge board — Team B's score vs other
-- teams (spec: Team B 80.08 vs Team C 84.30 in May). One row per
-- (month, team), manually entered + ranked, like kpi_agent_marks.
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_team_challenge (
  month      TEXT NOT NULL,            -- 'YYYY-MM'
  team       TEXT NOT NULL,            -- team name
  score      REAL,                     -- team KPI score
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (month, team)
);
