-- v33: an index on contact_log.updated_at, so a page that refreshes by itself can ask for "only the rows changed since X" without reading the
-- whole table (GET /api/rtn/board-contacts?since=...). ADDITIVE: one index, nothing is changed or dropped. Safe to run twice.
-- Run (production, Aldo only, BEFORE deploying the Worker that uses it):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v33_contact_updated_index.sql

CREATE INDEX IF NOT EXISTS idx_contact_log_updated ON contact_log (updated_at);
