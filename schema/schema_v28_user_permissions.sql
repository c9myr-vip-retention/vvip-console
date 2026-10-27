-- v28: personal permissions on top of a role (Settings > Accounts > Permissions).
-- ADDITIVE: ONE nullable column on users. Nothing existing is changed or dropped.
-- perm_overrides holds a small JSON object such as {"dashboard.view":true,"contact.edit":false}: true gives that account a permission its
-- role does not have, false takes away one its role has. NULL (every account today) means "exactly what the role says".
-- Run (production, ATL only, BEFORE deploying the Worker that uses it; run once only, a second run stops with "duplicate column"):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v28_user_permissions.sql

ALTER TABLE users ADD COLUMN perm_overrides TEXT;
