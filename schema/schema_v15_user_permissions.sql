-- ============================================================
-- groupb-tracker · Schema v15 · user permissions  (ADDITIVE)
-- Adds 4 per-account permission flags to the users table, then seeds the
-- known accounts to their role. Safe with --remote. Never drops the table.
--
-- Roles (presets) → default flags; admin can override any box per account:
--   Admin   : edit ✓ · delete ✓ · leaderboard ✗ · manage_users ✓
--   Agent   : edit ✓ · delete ✓ · leaderboard ✓ · manage_users ✗
--   Viewer  : edit ✗ · delete ✗ · leaderboard ✗ · manage_users ✗
-- New columns DEFAULT 0 (lowest privilege) so a new account is locked down
-- until explicitly granted. The master admin keeps manage_users — never lock out.
-- ============================================================

ALTER TABLE users ADD COLUMN can_edit       INTEGER NOT NULL DEFAULT 0;  -- write the action log (assign/status/note/crm/telegram/kpi)
ALTER TABLE users ADD COLUMN can_delete     INTEGER NOT NULL DEFAULT 0;  -- clear/delete a contact or note
ALTER TABLE users ADD COLUMN on_leaderboard INTEGER NOT NULL DEFAULT 0;  -- scored CS agent (shows on KPI leaderboard)
ALTER TABLE users ADD COLUMN manage_users   INTEGER NOT NULL DEFAULT 0;  -- create/edit/delete accounts + log mistakes

-- Seed current accounts to their assigned roles
UPDATE users SET role = 'admin',  can_edit = 1, can_delete = 1, on_leaderboard = 0, manage_users = 1 WHERE username = 'aldo';
UPDATE users SET role = 'agent',  can_edit = 1, can_delete = 1, on_leaderboard = 1, manage_users = 0 WHERE username IN ('raven', 'skylar');
UPDATE users SET role = 'viewer', can_edit = 0, can_delete = 0, on_leaderboard = 0, manage_users = 0 WHERE username IN ('c9myr', 'mexha', 'test_atl');
