-- ============================================================
-- groupb-tracker · Schema v3 · player_days
-- FIX: entry_date is the player's TIER-ENTRY date (static) and
-- cannot serve as the daily axis. v3 adds snapshot_date, stamped
-- by the Worker (GMT+8) on every push. Daily history accumulates
-- on (player_key, snapshot_date, brand, tier_segment).
-- Run with --remote. DROPS the v2 table (data is re-fed from sheets).
-- ============================================================

DROP TABLE IF EXISTS player_days;

CREATE TABLE player_days (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,

  -- daily axis + canonical key
  snapshot_date            TEXT NOT NULL,          -- 'YYYY-MM-DD' (GMT+8, stamped by Worker)
  player_key               TEXT NOT NULL,          -- uid (Zyra) else username (TC)
  brand                    TEXT NOT NULL,          -- LPK777 / BM69 / HOT321 / RM68 / SK69 / ACE33
  tier_segment             TEXT NOT NULL,          -- '3' or 'V'

  -- raw identity
  uid                      TEXT,
  username                 TEXT,

  -- list metadata
  threshold                REAL,
  entry_date               TEXT,                   -- tier-entry date (static; tenure-in-tier signal)
  previous_tier            TEXT,
  tier                     TEXT,
  tier_movement            TEXT,
  grace_end_date           TEXT,
  status                   TEXT,
  status_days              INTEGER,
  group_name               TEXT,

  -- daily money
  daily_deposit_count      INTEGER,
  daily_deposit            REAL,
  daily_withdraw_count     INTEGER,
  daily_withdraw           REAL,

  -- monthly money
  monthly_deposit_count    INTEGER,
  monthly_deposit          REAL,
  is_mau                   INTEGER,
  monthly_withdraw_count   INTEGER,
  monthly_withdraw         REAL,

  -- lifetime money
  lifetime_deposit_count   INTEGER,
  lifetime_deposit         REAL,
  lifetime_withdraw_count  INTEGER,
  lifetime_withdraw        REAL,

  -- activity / outcome
  bet                      REAL,
  valid_bet                REAL,
  win_loss                 REAL,
  last_deposit_date        TEXT,
  register_date            TEXT,
  member_days              INTEGER,
  addressing               TEXT,
  pnl                      REAL,

  ingested_at              TEXT DEFAULT (datetime('now')),

  UNIQUE (player_key, snapshot_date, brand, tier_segment)
);

CREATE INDEX IF NOT EXISTS idx_pd_key_snap   ON player_days (player_key, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pd_brand_snap ON player_days (brand, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_pd_snap       ON player_days (snapshot_date);
