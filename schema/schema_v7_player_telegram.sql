-- ============================================================
-- groupb-tracker · Schema v7 · player_telegram  (Telegram archive links)
-- ADDITIVE — creates a NEW table only. Does NOT touch player_days,
-- contact_log, player_notes, player_crm, or any existing table.
-- Safe with --remote.
--
-- Purpose: stores the per-player Livechat "Archive Telegram" link. The
-- links are opaque Livechat ids with no derivable pattern, so the FULL
-- url is stored as-is. The drawer's Telegram button opens this link when
-- present, and greys out ("Not on Telegram") when there is no row.
--
-- Grain: (player_key, brand) — same identity the whole app uses
-- (uid for Zyra brands, username for TC brands). The PRIMARY KEY makes
-- duplicates impossible: re-adding a player UPDATES the link in place.
-- ============================================================

CREATE TABLE IF NOT EXISTS player_telegram (
  player_key  TEXT NOT NULL,                   -- uid (Zyra) else username (TC)
  brand       TEXT NOT NULL,                   -- LPK777 / BM69 / HOT321 / RM68 / SK69 / ACE33
  url         TEXT NOT NULL,                   -- full Livechat archive/chat link
  updated_by  TEXT,                            -- who loaded/edited the row
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (player_key, brand)
);
