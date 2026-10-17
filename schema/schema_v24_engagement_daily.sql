-- ============================================================
-- groupb-tracker · Schema v24 · engagement_daily  (Livechat vs Telegram chats)
-- ADDITIVE — creates a NEW table only. Does NOT touch any existing table.
-- Safe with --remote.
--
-- Purpose: daily chat counts per brand, synced from the Lark Base
-- "VIP RTN MYR - Customer Approaching" (Engagement chart: false = Livechat,
-- true = Telegram). The Daily report's "Livechat & Telegram Engagement"
-- table reads it instead of being filled by hand.
--
-- Grain: (chat_date, brand). chat_date is the MYT day the chats happened.
-- Re-syncing a day overwrites that day's numbers (upsert), never duplicates.
-- ============================================================

CREATE TABLE IF NOT EXISTS engagement_daily (
  chat_date   TEXT NOT NULL,                   -- YYYY-MM-DD, MYT
  brand       TEXT NOT NULL,                   -- full brand (LPK777, HOT321, ...)
  livechat    INTEGER NOT NULL DEFAULT 0,      -- chats where the flag is false
  telegram    INTEGER NOT NULL DEFAULT 0,      -- chats where the flag is true
  updated_at  TEXT DEFAULT (datetime('now')),  -- UTC
  PRIMARY KEY (chat_date, brand)
);
