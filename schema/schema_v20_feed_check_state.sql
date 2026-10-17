-- ============================================================
-- groupb-tracker · Schema v20 · feed_check_state
-- ADDITIVE — creates a NEW table only. Safe with --remote.
--
-- Purpose: remembers which brands the daily Feed Watch check flagged as
-- missing/not-updated for a given snapshot_date, so that when the feeder is
-- re-run (fixing the data), the ingest hook can detect the resolution and post
-- a "✅ Resolved" follow-up to Lark. Row is deleted once all brands are cleared.
-- open_json = JSON array of still-open problem brand codes.
-- ============================================================

CREATE TABLE IF NOT EXISTS feed_check_state (
  snapshot_date TEXT PRIMARY KEY,
  open_json     TEXT NOT NULL,
  updated_at    TEXT DEFAULT (datetime('now'))
);
