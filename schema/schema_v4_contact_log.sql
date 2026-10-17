-- ============================================================
-- groupb-tracker · Schema v4 · contact_log (additive — no drops)
-- One record per player per day: assignment, status, outcome.
-- This is the measurement layer (save rate / accountability).
-- Run with --remote.
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  player_key    TEXT NOT NULL,
  brand         TEXT NOT NULL,
  tier_segment  TEXT NOT NULL,
  class         TEXT,                 -- classification at time of action
  assigned_to   TEXT,                 -- CS username
  status        TEXT,                 -- ASSIGNED / CONTACTED / RESPONDED / RECOVERED / NO_RESPONSE / SKIPPED
  note          TEXT,
  updated_by    TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (snapshot_date, player_key, brand, tier_segment)
);

CREATE INDEX IF NOT EXISTS idx_cl_snap   ON contact_log (snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cl_player ON contact_log (player_key, brand);
CREATE INDEX IF NOT EXISTS idx_cl_cs     ON contact_log (assigned_to, snapshot_date);
