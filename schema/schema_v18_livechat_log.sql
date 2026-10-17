-- ============================================================
-- groupb-tracker · Schema v18 · livechat_log  (per-player chat audit trail)
-- ADDITIVE — creates a NEW table only. Touches nothing else. Safe with --remote.
--
-- Purpose: a QA audit history of LiveChat sessions per player. Each row =
-- one logged chat: who logged it (agent), the archive URL, and when.
-- Append-only from the drawer; managers can delete a mistaken entry.
-- Keyed on (player_key, brand) like notes/crm — a relationship-level log.
-- ============================================================

CREATE TABLE IF NOT EXISTS livechat_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_key   TEXT NOT NULL,
  brand        TEXT NOT NULL,
  agent        TEXT,                         -- the logged-in user who logged the chat
  url          TEXT NOT NULL,                -- LiveChat archive link (http/https only)
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lcl_player ON livechat_log (player_key, brand);
