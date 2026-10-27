-- v32: "own" versions of the permissions that touch other people's records (log contacts, clear contacts, schedule, flows, templates).
-- Every such permission now comes as a pair: "their own ..." and "any ... / others'". Before this change the single permission meant "any",
-- so anyone who had it switched OFF (on a role or personally) must also get the "own" one switched off, or they would suddenly be able
-- to work their own records. This only copies existing OFF switches over. Nothing is dropped or rewritten.
-- ADDITIVE and safe to run twice. Run (production, ATL only, BEFORE deploying the Worker that reads the new permissions):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v32_own_permissions.sql

-- roles
INSERT OR IGNORE INTO role_permissions (role_key, perm, allowed) SELECT role_key, 'contact.edit_own',   0 FROM role_permissions WHERE perm = 'contact.edit'      AND allowed = 0;
INSERT OR IGNORE INTO role_permissions (role_key, perm, allowed) SELECT role_key, 'contact.delete_own', 0 FROM role_permissions WHERE perm = 'contact.delete'    AND allowed = 0;
INSERT OR IGNORE INTO role_permissions (role_key, perm, allowed) SELECT role_key, 'schedule.edit_own',  0 FROM role_permissions WHERE perm = 'schedule.manage'   AND allowed = 0;
INSERT OR IGNORE INTO role_permissions (role_key, perm, allowed) SELECT role_key, 'flows.own',          0 FROM role_permissions WHERE perm = 'flows.manage'      AND allowed = 0;
INSERT OR IGNORE INTO role_permissions (role_key, perm, allowed) SELECT role_key, 'templates.own',      0 FROM role_permissions WHERE perm = 'templates.manage'  AND allowed = 0;

-- personal exceptions (users.perm_overrides is a JSON object such as {"contact.edit": false})
UPDATE users SET perm_overrides = json_set(perm_overrides, '$."contact.edit_own"',   json('false')) WHERE perm_overrides IS NOT NULL AND json_valid(perm_overrides) AND json_extract(perm_overrides, '$."contact.edit"')      = 0 AND json_extract(perm_overrides, '$."contact.edit_own"')   IS NULL;
UPDATE users SET perm_overrides = json_set(perm_overrides, '$."contact.delete_own"', json('false')) WHERE perm_overrides IS NOT NULL AND json_valid(perm_overrides) AND json_extract(perm_overrides, '$."contact.delete"')    = 0 AND json_extract(perm_overrides, '$."contact.delete_own"') IS NULL;
UPDATE users SET perm_overrides = json_set(perm_overrides, '$."schedule.edit_own"',  json('false')) WHERE perm_overrides IS NOT NULL AND json_valid(perm_overrides) AND json_extract(perm_overrides, '$."schedule.manage"')   = 0 AND json_extract(perm_overrides, '$."schedule.edit_own"')  IS NULL;
UPDATE users SET perm_overrides = json_set(perm_overrides, '$."flows.own"',          json('false')) WHERE perm_overrides IS NOT NULL AND json_valid(perm_overrides) AND json_extract(perm_overrides, '$."flows.manage"')      = 0 AND json_extract(perm_overrides, '$."flows.own"')          IS NULL;
UPDATE users SET perm_overrides = json_set(perm_overrides, '$."templates.own"',      json('false')) WHERE perm_overrides IS NOT NULL AND json_valid(perm_overrides) AND json_extract(perm_overrides, '$."templates.manage"') = 0 AND json_extract(perm_overrides, '$."templates.own"')      IS NULL;
