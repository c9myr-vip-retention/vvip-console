-- v30: pictures and files attached to task comments.
-- ADDITIVE: one new table and two indexes. Nothing existing is changed or dropped.
-- Files are kept in the database as base64 text (one row each, at most about 1.2 MB of file per row). The list endpoints never read the data
-- column, only id/name/type/size; the file itself is fetched one at a time, with the person's sign-in, from GET /api/work/attachments/:id.
-- Run (production, ATL only, BEFORE deploying the Worker that uses it; safe to run twice):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v30_task_attachments.sql

CREATE TABLE IF NOT EXISTS task_attachments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL,
  comment_id INTEGER,
  name       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,                      -- bytes of the file itself
  data       TEXT NOT NULL,                         -- base64
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tatt_task ON task_attachments (task_id);
CREATE INDEX IF NOT EXISTS idx_tatt_comment ON task_attachments (comment_id);
