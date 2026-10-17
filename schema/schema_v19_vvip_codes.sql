-- ============================================================
-- groupb-tracker · Schema v19 · VVIP Redeem Code campaign
-- ADDITIVE — creates THREE NEW tables only. Does NOT touch
-- player_days, contact_log, player_notes, player_crm,
-- player_telegram, users, activity_log or anything else.
-- Safe with --remote.
--
-- Model
--   code_events       one row per (date, brand, tier)  — the event
--   code_bands        the 2 BO redeem codes for that event (A / B)
--   code_assignments  one row per player per event — WHO GOT WHICH CODE
--
-- Why assignments are kept for EVERY player, not just claimers:
-- the unclaimed rows are the campaign's most valuable data (claim
-- rate, incremental lift vs the player's own baseline, repeat-claimer
-- segments). Storing only claims makes those permanently unanswerable.
-- See docs/IDEAS.md § "VVIP Redeem Code — measurement ideas".
-- ============================================================

-- ── The event ────────────────────────────────────────────────
-- Grain: one row per brand per tier per day. A single campaign day
-- across 5 brands = 5 rows, because each brand uploads its own
-- audience to BO separately.
CREATE TABLE IF NOT EXISTS code_events (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date         TEXT NOT NULL,        -- 'YYYY-MM-DD' (MYT) — the day codes are valid
  brand              TEXT NOT NULL,
  tier_segment       TEXT NOT NULL,        -- '3' or 'V'

  -- draft    = pool assigned, still changeable (reshuffle allowed)
  -- exported = CSVs downloaded, LOCKED FOREVER (see rule below)
  -- closed   = event day over, report final
  status             TEXT NOT NULL DEFAULT 'draft',

  pool_snapshot_date TEXT,                 -- which player_days snapshot the pool was drawn from
  pool_size          INTEGER,              -- players assigned at creation (audit: must equal COUNT of assignments)

  created_by         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  exported_by        TEXT,
  exported_at        TEXT,
  closed_by          TEXT,
  closed_at          TEXT,

  -- Rejects a duplicate event for the same brand+tier on the same day.
  UNIQUE (event_date, brand, tier_segment)
);

-- ── The 2 codes for that event ───────────────────────────────
-- The redeem codes are GENERATED IN BO, not here. We only store the
-- string + credit amount so the console can show and cost them.
-- Start/end time and turnover multiplier stay in BO — not mirrored.
--
-- Two rows per event today (A / B, 50-50). The split ratio lives in
-- CODE_BANDS config in the Worker + App.jsx, NOT here, so reverting to
-- 4 bands (8/12/15/18 @ 40/30/20/10) stays a config edit.
CREATE TABLE IF NOT EXISTS code_bands (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL,
  label        TEXT NOT NULL,              -- 'A' / 'B'
  code         TEXT NOT NULL,              -- the BO redeem code string, e.g. 'BM69JUL18A'
  amount       REAL NOT NULL,              -- credit amount in RM (A and B differ)
  assigned     INTEGER NOT NULL DEFAULT 0, -- how many players hold this code
  UNIQUE (event_id, label)
);

-- ── One row per player per event ─────────────────────────────
-- Written at event creation for the WHOLE pool. claimed=0 rows are
-- kept forever; they are the eligible-but-didn't-claim list.
--
-- uid/username are copied in at assignment time on purpose: the export
-- must reproduce byte-for-byte what BO received, even if the player
-- later leaves the tier and drops out of player_days.
CREATE TABLE IF NOT EXISTS code_assignments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id       INTEGER NOT NULL,
  player_key     TEXT NOT NULL,            -- uid (Zyra) else username (TC) — same identity as the rest of the app
  uid            TEXT,                     -- exported to BO as-is: never padded, never reformatted
  username       TEXT,
  brand          TEXT NOT NULL,
  tier_segment   TEXT NOT NULL,
  label          TEXT NOT NULL,            -- 'A' / 'B' — which code this player was randomly given

  claimed        INTEGER NOT NULL DEFAULT 0,
  claimed_at     TEXT,
  claimed_by     TEXT,                     -- the agent who released it (any team — Livechat is a shared pool)
  channel        TEXT,                     -- 'telegram' / 'livechat'

  -- "Showed up but deposits were under RM100." Recorded, not deleted, and
  -- it does NOT burn the code — they can top up and still claim the same day.
  blocked_at     TEXT,
  blocked_by     TEXT,

  -- A player can only be assigned once per event. This constraint — not a
  -- UI check — is what makes it impossible for one player to land in both
  -- the A and B upload files, which is what would allow a double claim.
  UNIQUE (event_id, player_key)
);

CREATE INDEX IF NOT EXISTS idx_ce_date     ON code_events (event_date);
CREATE INDEX IF NOT EXISTS idx_cb_event    ON code_bands (event_id);
CREATE INDEX IF NOT EXISTS idx_ca_event    ON code_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_ca_player   ON code_assignments (player_key, brand);
CREATE INDEX IF NOT EXISTS idx_ca_claimed  ON code_assignments (event_id, claimed);
