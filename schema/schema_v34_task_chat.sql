-- v34: task comments as a group chat. Emoji reactions on comments, and a notifications table (tags, new comments, new assignments).
-- ADDITIVE: two new tables and two indexes. Nothing existing is changed or dropped. Safe to run twice.
-- Run (production, ATL only, BEFORE deploying the Worker that uses it):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v34_task_chat.sql

CREATE TABLE IF NOT EXISTS task_reactions (
  comment_id INTEGER NOT NULL,
  emoji      TEXT NOT NULL,
  username   TEXT NOT NULL,
  task_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, emoji, username)
);
CREATE INDEX IF NOT EXISTS idx_treact_task ON task_reactions (task_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL,                  -- who it is for
  kind       TEXT NOT NULL,                  -- 'mention' | 'comment' | 'assigned'
  task_id    INTEGER,
  comment_id INTEGER,
  actor      TEXT,                           -- who did it
  text       TEXT,                           -- a short preview
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (username, read_at, id);
