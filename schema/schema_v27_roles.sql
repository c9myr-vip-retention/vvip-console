-- v27: roles and per-function permissions (Settings > Roles).
-- ADDITIVE: two new tables, three seed rows, and ONE nullable column on users. Nothing existing is changed or dropped.
-- Every current account keeps role_key = NULL, which means "behave exactly as today" (the old flags decide). An account only moves
-- onto this system when an admin gives it a role in Settings.
-- Run (production, ATL only, BEFORE deploying the Worker that uses it):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v27_roles.sql

CREATE TABLE IF NOT EXISTS roles (
  key        TEXT PRIMARY KEY,                    -- 'admin' | 'agent' | 'viewer' (built in) or a slug
  name       TEXT NOT NULL,                       -- what the role is called; editable
  base       TEXT NOT NULL DEFAULT 'none',        -- starting permissions: admin | agent | viewer | none
  builtin    INTEGER NOT NULL DEFAULT 0,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Only the differences from the base are stored: allowed = 1 switches a permission on, 0 switches it off.
CREATE TABLE IF NOT EXISTS role_permissions (
  role_key TEXT NOT NULL,
  perm     TEXT NOT NULL,
  allowed  INTEGER NOT NULL,
  PRIMARY KEY (role_key, perm)
);

INSERT OR IGNORE INTO roles (key, name, base, builtin, sort) VALUES
  ('admin',  'Admin',  'admin',  1, 1),
  ('agent',  'Agent',  'agent',  1, 2),
  ('viewer', 'Viewer', 'viewer', 1, 3);

ALTER TABLE users ADD COLUMN role_key TEXT;
