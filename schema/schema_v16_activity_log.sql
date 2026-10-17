-- ============================================================
-- groupb-tracker · Schema v16 · activity_log  (ADDITIVE, append-only audit trail)
-- One row per meaningful action: sign in/out, contact save/clear, RECOVERED,
-- notes, Telegram edits, KPI saves, mistakes, permission + user changes.
-- ts is stored in UTC (display in GMT+8). Managers-only read. Safe with --remote.
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL DEFAULT (datetime('now')),  -- UTC
  username TEXT,
  role     TEXT,
  action   TEXT,        -- login/logout/contact/recovered/clear/note/telegram/kpi/mistake/perm/user
  detail   TEXT,        -- human-readable description
  ip       TEXT
);
CREATE INDEX IF NOT EXISTS idx_al_ts     ON activity_log (ts);
CREATE INDEX IF NOT EXISTS idx_al_user   ON activity_log (username);
CREATE INDEX IF NOT EXISTS idx_al_action ON activity_log (action);
