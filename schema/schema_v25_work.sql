-- ============================================================
-- groupb-tracker · Schema v25 · work management (tasks, projects, flows, templates, schedule)
-- ADDITIVE ONLY: every statement is CREATE ... IF NOT EXISTS. Touches no existing table.
-- NOT YET RUN ON PRODUCTION. Run only after Aldo approves:
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v25_work.sql
-- (agents: use --local against a throwaway local D1 only, never --remote)
-- Usernames (users.username) identify people. Dates are 'YYYY-MM-DD' in Malaysia time (GMT+8);
-- timestamps are UTC 'YYYY-MM-DD HH:MM:SS' (display in GMT+8).
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  privacy     TEXT NOT NULL DEFAULT 'members',   -- 'members' | 'team'
  archived    INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT,
  deleted_by  TEXT
);
CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL,
  username   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',     -- 'owner' | 'member'
  PRIMARY KEY (project_id, username)
);

CREATE TABLE IF NOT EXISTS flows (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  project_id  INTEGER,                           -- NULL = ad hoc
  admin_user  TEXT,                              -- flow administrator
  default_assignee TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT,
  deleted_by  TEXT
);

CREATE TABLE IF NOT EXISTS task_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  deadline   TEXT NOT NULL DEFAULT '1 day',      -- 'Same day' | '1 day' | '2 days' | '3 days' | '7 days' | 'No deadline'
  assignee   TEXT,                               -- default assignee (agents creating from it get themselves)
  checklist  TEXT,                               -- JSON array of strings
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'progress' | 'done' | 'deferred'
  high_priority INTEGER NOT NULL DEFAULT 0,
  owner         TEXT NOT NULL,                    -- creator / "set by"
  assignee      TEXT NOT NULL,                    -- responsible person
  project_id    INTEGER,
  flow_id       INTEGER,
  parent_id     INTEGER,
  due_date      TEXT,                             -- 'YYYY-MM-DD' or NULL
  due_time      TEXT,                             -- 'HH:MM' or NULL
  est_minutes   INTEGER,
  started_at    TEXT,                             -- UTC; set while status='progress'
  spent_seconds INTEGER NOT NULL DEFAULT 0,       -- accumulated across start/pause cycles
  completed_at  TEXT,
  tags          TEXT,                             -- JSON array of strings
  linked_player TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT,                             -- soft delete = Recycle bin (kept 30 days)
  deleted_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks (project_id);
-- THE RULE: one ongoing task per person. Enforced by the database, not just the UI.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_ongoing_per_person
  ON tasks (assignee) WHERE status = 'progress' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS task_checklist (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  text    TEXT NOT NULL,
  done    INTEGER NOT NULL DEFAULT 0,
  pos     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tcl_task ON task_checklist (task_id);

CREATE TABLE IF NOT EXISTS task_observers (
  task_id  INTEGER NOT NULL,
  username TEXT NOT NULL,
  PRIMARY KEY (task_id, username)
);

CREATE TABLE IF NOT EXISTS task_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL,
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tcm_task ON task_comments (task_id);

CREATE TABLE IF NOT EXISTS task_activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL,
  actor      TEXT NOT NULL,
  text       TEXT NOT NULL,                       -- e.g. 'Started the task'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tact_task ON task_activity (task_id);

-- ---------------- schedule ----------------
CREATE TABLE IF NOT EXISTS schedule_types (
  key     TEXT PRIMARY KEY,                       -- 'shift','reload','meeting','maint','report','training', or custom slug
  name    TEXT NOT NULL,
  color   TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS schedule_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type_key   TEXT NOT NULL,
  date       TEXT NOT NULL,                       -- 'YYYY-MM-DD'
  title      TEXT NOT NULL,
  start_time TEXT,                                -- 'HH:MM'
  end_time   TEXT,
  brands     TEXT,                                -- JSON array of brand codes
  who        TEXT,                                -- JSON array of usernames
  note       TEXT,
  repeat     TEXT NOT NULL DEFAULT 'none',        -- 'none' | 'daily' | 'weekly'
  off        INTEGER NOT NULL DEFAULT 0,          -- 1 = switched off (kept, not shown on the board)
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sch_date ON schedule_items (date);
CREATE TABLE IF NOT EXISTS schedule_swaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL,
  from_user  TEXT NOT NULL,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'open',        -- 'open' | 'approved' | 'declined'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schedule_types (key, name, color, builtin) VALUES
  ('shift','Agent shifts','#5F9AD6',1),
  ('reload','Reload events','#E8C547',1),
  ('meeting','Meetings','#A78BFA',1),
  ('maint','Maintenance','#EF4444',1),
  ('report','Reports & deadlines','#4CC38A',1),
  ('training','Training','#56B6C2',1);
