-- ═══════════════════════════════════════════════════
-- GROUP B HIGH ROLLER TRACKER — D1 Schema
-- Run this once in Cloudflare D1 console
-- ═══════════════════════════════════════════════════

-- Users table (login credentials)
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  password_hash TEXT  NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'admin',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);

-- Players table (VVIP master records)
CREATE TABLE IF NOT EXISTS players (
  username            TEXT PRIMARY KEY,
  tier                TEXT NOT NULL,
  brand               TEXT NOT NULL,
  first_seen          TEXT NOT NULL,
  total_deposit       REAL NOT NULL DEFAULT 0,
  total_withdraw      REAL NOT NULL DEFAULT 0,
  total_pnl           REAL NOT NULL DEFAULT 0,
  deposit_count       INTEGER NOT NULL DEFAULT 0,
  all_time_high       REAL NOT NULL DEFAULT 0,
  last_deposit_date   TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- History table (one row per player per day)
CREATE TABLE IF NOT EXISTS history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL,
  brand       TEXT NOT NULL,
  date        TEXT NOT NULL,
  deposit     REAL NOT NULL DEFAULT 0,
  withdraw    REAL NOT NULL DEFAULT 0,
  pnl         REAL NOT NULL DEFAULT 0,
  UNIQUE(username, date),
  FOREIGN KEY (username) REFERENCES players(username)
);

-- Upload log table
CREATE TABLE IF NOT EXISTS upload_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  filename    TEXT NOT NULL,
  brand       TEXT NOT NULL,
  player_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_history_username ON history(username);
CREATE INDEX IF NOT EXISTS idx_history_date     ON history(date);
CREATE INDEX IF NOT EXISTS idx_players_brand    ON players(brand);
CREATE INDEX IF NOT EXISTS idx_players_tier     ON players(tier);
