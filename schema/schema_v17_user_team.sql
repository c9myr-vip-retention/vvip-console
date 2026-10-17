-- ============================================================
-- groupb-tracker · Schema v17 · users.team  (per-user team lock)
-- ADDITIVE — adds ONE nullable column to the existing users table.
-- Does NOT drop or rewrite anything. Safe with --remote.
--
-- Purpose: each user is locked to one team (A / B / C) and sees only
-- that team's brands. Managers (manage_users=1) ignore this and see all.
-- NULL team + non-manager = sees nothing (forces an explicit assignment).
--
-- NOTE: `ALTER TABLE ADD COLUMN` is NOT idempotent — running it twice
-- errors with "duplicate column name: team". Run once.
-- ============================================================

ALTER TABLE users ADD COLUMN team TEXT;          -- 'A' | 'B' | 'C' | NULL

-- Seed: every existing account is Team B (the only live team today).
-- Managers see all regardless, so this only matters for non-managers.
UPDATE users SET team = 'B' WHERE team IS NULL;
