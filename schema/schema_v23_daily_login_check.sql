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
INSERT OR IGNORE INTO player_assignment (brand, tier_segment, player_key, agent, assigned_by) VALUES
('SK69','V','123325','raven','aldo'),('SK69','V','95446','raven','aldo'),('SK69','V','119534','raven','aldo'),
('SK69','V','130303','raven','aldo'),('SK69','V','113314','raven','aldo'),('SK69','V','121644','raven','aldo'),
('SK69','V','112881','raven','aldo'),('SK69','V','110711','raven','aldo'),('SK69','V','102581','raven','aldo'),
('SK69','V','106551','raven','aldo'),('SK69','V','115750','raven','aldo'),('SK69','V','118777','raven','aldo'),
('SK69','V','121232','raven','aldo'),('SK69','V','131468','raven','aldo'),('SK69','V','138768','raven','aldo'),
('SK69','V','115693','skylar','aldo'),('SK69','V','135446','skylar','aldo'),('SK69','V','97250','skylar','aldo'),
('SK69','V','101802','skylar','aldo'),('SK69','V','110069','skylar','aldo'),('SK69','V','136977','skylar','aldo'),
('SK69','V','116426','skylar','aldo'),('SK69','V','115732','skylar','aldo'),('SK69','V','103727','skylar','aldo'),
('SK69','V','109663','skylar','aldo'),('SK69','V','117966','skylar','aldo'),('SK69','V','119286','skylar','aldo'),
('SK69','V','126347','skylar','aldo'),('SK69','V','131470','skylar','aldo'),('SK69','V','94902','skylar','aldo'),
('SK69','V','103732','jason','aldo'),('SK69','V','120795','jason','aldo'),('SK69','V','108309','jason','aldo'),
('SK69','V','127061','jason','aldo'),('SK69','V','127396','jason','aldo'),('SK69','V','120870','jason','aldo'),
('SK69','V','124890','jason','aldo'),('SK69','V','100341','jason','aldo'),('SK69','V','104395','jason','aldo'),
('SK69','V','111554','jason','aldo'),('SK69','V','118206','jason','aldo'),('SK69','V','119365','jason','aldo'),
('SK69','V','128517','jason','aldo'),('SK69','V','131791','jason','aldo'),('SK69','V','99422','jason','aldo'),
('SK69','V','125178','trevor','aldo'),('SK69','V','107824','trevor','aldo'),('SK69','V','111498','trevor','aldo'),
('SK69','V','120462','trevor','aldo'),('SK69','V','106156','trevor','aldo'),('SK69','V','112168','trevor','aldo'),
('SK69','V','123388','trevor','aldo'),('SK69','V','102497','trevor','aldo'),('SK69','V','105017','trevor','aldo'),
('SK69','V','111598','trevor','aldo'),('SK69','V','118235','trevor','aldo'),('SK69','V','120176','trevor','aldo'),
('SK69','V','128819','trevor','aldo'),('SK69','V','133780','trevor','aldo'),
('SK69','V','122024','brix','aldo'),('SK69','V','115302','brix','aldo'),('SK69','V','119256','brix','aldo'),
('SK69','V','137522','brix','aldo'),('SK69','V','110623','brix','aldo'),('SK69','V','135101','brix','aldo'),
('SK69','V','124354','brix','aldo'),('SK69','V','102577','brix','aldo'),('SK69','V','106503','brix','aldo'),
('SK69','V','114400','brix','aldo'),('SK69','V','118570','brix','aldo'),('SK69','V','120982','brix','aldo'),
('SK69','V','130428','brix','aldo'),('SK69','V','134582','brix','aldo');
