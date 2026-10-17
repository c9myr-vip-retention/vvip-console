-- ============================================================
-- groupb-tracker · Schema v6 · player_crm  (per-player follow-up)
-- ADDITIVE — creates a NEW table only. Does NOT touch player_days,
-- contact_log, player_notes, or any existing table. Safe with --remote.
--
-- Purpose: a per-player "next follow-up" reminder date the team shares.
-- Person-level and editable in place (one row per player, overwritten
-- on save), UNLIKE player_notes which is an append-only ledger.
--
-- Grain: (player_key, brand) — same as player_notes. No snapshot_date;
-- the reminder outlives the daily snapshot. PRIMARY KEY enables upsert.
-- ============================================================

CREATE TABLE IF NOT EXISTS player_crm (
  player_key    TEXT NOT NULL,                 -- uid (Zyra) else username (TC)
  brand         TEXT NOT NULL,                 -- LPK777 / BM69 / HOT321 / RM68 / SK69 / ACE33
  next_followup TEXT,                          -- reminder date, YYYY-MM-DD (nullable)
  updated_by    TEXT,                          -- CS username who last edited
  updated_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (player_key, brand)
);
