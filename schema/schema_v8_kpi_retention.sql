-- ============================================================
-- groupb-tracker · Schema v8 · kpi_retention  (Stage 1a manual inputs)
-- ADDITIVE — creates a NEW table only. Does NOT touch player_days,
-- contact_log, player_notes, player_crm, player_telegram, or any
-- existing table. Safe with --remote.
--
-- Purpose: the team types the OFFICIAL monthly retention % per brand
-- (from the real reporting source) until our player_days history holds
-- full months. Current month + last month (for the ▼ trend). Pools and
-- the players-needed math come from player_days; only the % is manual.
--
-- Grain: (month, brand). month = 'YYYY-MM'. PRIMARY KEY enables upsert.
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_retention (
  month      TEXT NOT NULL,             -- 'YYYY-MM'
  brand      TEXT NOT NULL,             -- LPK777 / BM69 / HOT321 / RM68 / SK69 / ACE33 / JK32
  tier3_pct  REAL,                      -- current-month Tier 3 retention %
  tierv_pct  REAL,                      -- current-month Tier V retention %
  last3_pct  REAL,                      -- previous-month Tier 3 % (trend only)
  lastv_pct  REAL,                      -- previous-month Tier V % (trend only)
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (month, brand)
);
