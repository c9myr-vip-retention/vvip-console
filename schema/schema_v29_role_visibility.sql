-- v29: which roles a role can see (Settings > Roles > "Who they can see").
-- ADDITIVE: ONE nullable column on roles. Nothing existing is changed or dropped.
-- roles.sees holds a small JSON object: {"mode":"all"} (default, same as NULL), {"mode":"rank"} (own rank and more junior, following the
-- role hierarchy), or {"mode":"list","list":["agent","viewer"]} (only these roles, plus their own).
-- Run (production, Aldo only, BEFORE deploying the Worker that uses it; run once only, a second run stops with "duplicate column"):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v29_role_visibility.sql

ALTER TABLE roles ADD COLUMN sees TEXT;
