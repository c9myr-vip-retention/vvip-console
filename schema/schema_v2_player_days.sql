-- ============================================================
-- groupb-tracker  ·  Schema v2  ·  player_days (raw daily ingest)
-- One row per player, per day, per brand, per tier segment.
-- HISTORY ACCUMULATOR that powers the behavior engine.
-- Apply to PRODUCTION D1 with --remote (default is local simulation).
-- ============================================================
--
-- IDENTITY MODEL (provider-aware):
--   TC brands  (LPK, ACE33): username = login handle, uid is EMPTY
--   Zyra brands (BM69, etc.): uid = account id, username = account code
--   player_key = uid if present, else username  (derived in the Worker)
-- ============================================================

CREATE TABLE IF NOT EXISTS player_days (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,

  -- canonical key + ingest fields
  player_key               TEXT NOT NULL,          -- uid OR username (derived)
  entry_date               TEXT NOT NULL,          -- 'YYYY-MM-DD'
  brand                    TEXT NOT NULL,          -- LPK / BM69 / HOT321 / RM68 / SK69 / ACE33
  tier_segment             TEXT NOT NULL,          -- '3' (Daily tab) or 'V' (Daily V tab)

  -- raw identity (both kept; one is null depending on provider)
  uid                      TEXT,                   -- Zyra account id (TC: null)
  username                 TEXT,                   -- TC login handle / Zyra account code

  -- list metadata
  threshold                REAL,                   -- "Treshold $"  (errors coerced to null)
  previous_tier            TEXT,
  tier                     TEXT,
  tier_movement            TEXT,                   -- No Change / Grace / Upgrade / Downgrade / Reactivated
  grace_end_date           TEXT,                   -- 'YYYY-MM-DD' or NULL
  status                   TEXT,
  status_days              INTEGER,
  group_name               TEXT,                   -- incl. Reactivated 1-6 / 7-29 / 30+ (recency bands)

  -- daily money
  daily_deposit_count      INTEGER,
  daily_deposit            REAL,
  daily_withdraw_count     INTEGER,
  daily_withdraw           REAL,

  -- monthly money
  monthly_deposit_count    INTEGER,
  monthly_deposit          REAL,
  is_mau                   INTEGER,                -- 0 / 1
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
  win_loss                 REAL,                   -- DAILY net result
  last_deposit_date        TEXT,                   -- 'YYYY-MM-DD' or NULL
  register_date            TEXT,                   -- 'YYYY-MM-DD' or NULL
  member_days              INTEGER,
  addressing               TEXT,
  pnl                      REAL,                   -- LIFETIME net (= LTV signal)

  ingested_at              TEXT DEFAULT (datetime('now')),

  UNIQUE (player_key, entry_date, brand, tier_segment)
);

-- Query accelerators for the classification engine (Step 4)
CREATE INDEX IF NOT EXISTS idx_pd_key_date    ON player_days (player_key, entry_date);
CREATE INDEX IF NOT EXISTS idx_pd_brand_date  ON player_days (brand, entry_date);
CREATE INDEX IF NOT EXISTS idx_pd_entry_date  ON player_days (entry_date);