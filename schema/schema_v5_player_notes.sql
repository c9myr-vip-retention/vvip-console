-- ============================================================
-- groupb-tracker · Schema v5 · player_notes  (the Relationship Ledger)
-- ADDITIVE — creates a NEW table only. Does NOT touch player_days,
-- contact_log, or any existing table. Safe to run with --remote.
--
-- Purpose: persistent, person-level memory. A CS jots one human fact
-- about a player ("daughter's wedding next month", "annoyed about
-- withdrawal speed", "prefers Telegram") and it RESURFACES on every
-- future contact — because it is keyed on the PERSON, not the day.
--
-- Grain: (player_key, brand). Unlike contact_log there is NO
-- snapshot_date — a relationship fact is timeless and must outlive the
-- daily snapshot it was written on. Tier can change; the note follows
-- the player regardless.
-- ============================================================

CREATE TABLE IF NOT EXISTS player_notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_key   TEXT NOT NULL,                 -- uid (Zyra) else username (TC)
  brand        TEXT NOT NULL,                 -- LPK777 / BM69 / HOT321 / RM68 / SK69 / ACE33
  note         TEXT NOT NULL,                 -- the human fact
  created_by   TEXT,                          -- CS username who jotted it
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pn_player ON player_notes (player_key, brand);
