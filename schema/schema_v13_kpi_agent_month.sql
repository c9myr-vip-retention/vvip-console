-- ============================================================
-- groupb-tracker · Schema v13 · kpi_agent_month  (per-agent inputs)
-- ADDITIVE — creates a NEW table only. Safe with --remote.
--
-- Purpose: per-agent KPI inputs that aren't auto-computed. Starts with
-- FRT (each agent's own first-response time). Discipline is already
-- per-agent via the mistakes table; Tier/Growth stay team-shared.
--
-- Grain: (month, agent). PRIMARY KEY enables upsert.
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_agent_month (
  month      TEXT NOT NULL,            -- 'YYYY-MM'
  agent      TEXT NOT NULL,            -- staff username
  frt_sec    REAL,                     -- this agent's FRT (seconds)
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (month, agent)
);
