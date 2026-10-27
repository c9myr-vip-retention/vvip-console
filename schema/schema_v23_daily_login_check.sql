-- ============================================================
-- groupb-tracker · Schema v23 · Daily Login Check
-- ADDITIVE — two new tables. Does NOT touch existing tables.
-- Safe to run with --remote.
--
-- Purpose: the console ingests deposit + bet, but has no "did the
-- player log in today" signal, and no per-agent ownership of a
-- Tier V roster. This page fills that gap: each assigned agent
-- ticks Login and Deposit for their players in real time. The real
-- deposit AMOUNT is not typed by hand — it is read from the ingest
-- (player_days.daily_deposit), which restates post-close, so it
-- confirms the next day. No hand-typed figures = no fabrication risk.
-- ============================================================

-- 1) Owner map: which agent owns which player, per brand + tier.
CREATE TABLE IF NOT EXISTS player_assignment (
  brand         TEXT NOT NULL,
  tier_segment  TEXT NOT NULL,
  player_key    TEXT NOT NULL,
  agent         TEXT NOT NULL,              -- users.username (lowercase)
  active        INTEGER NOT NULL DEFAULT 1, -- 0 = archived (player left tier)
  assigned_by   TEXT,
  assigned_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand, tier_segment, player_key)
);
CREATE INDEX IF NOT EXISTS idx_assign_agent ON player_assignment(agent, active);

-- 2) Daily fill: one row per player per day. login + deposited are the
--    only manual fields. The amount is NOT stored here; it is joined
--    from player_days.daily_deposit at read time.
CREATE TABLE IF NOT EXISTS daily_login_check (
  check_date    TEXT NOT NULL,              -- YYYY-MM-DD (MYT)
  brand         TEXT NOT NULL,
  tier_segment  TEXT NOT NULL,
  player_key    TEXT NOT NULL,
  login         INTEGER NOT NULL DEFAULT 0, -- 1 = agent saw the player log in
  deposited     INTEGER NOT NULL DEFAULT 0, -- 1 = agent saw a deposit today
  filled_by     TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (check_date, brand, tier_segment, player_key)
);
CREATE INDEX IF NOT EXISTS idx_dlc_date ON daily_login_check(check_date, brand, tier_segment);

-- 3) Seed the SK69 Tier V owner map from the 2026-09-15 split.
--    Balanced round-robin by deposit rank. Re-run safe (INSERT OR IGNORE).
--    The seed rows (player ids and agent usernames) were removed before the
--    AI Department handover. The live map is in the player_assignment table.
