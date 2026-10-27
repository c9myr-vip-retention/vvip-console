-- v26: admin-managed shift times for the Schedule page (the "Quick fill a shift" list).
-- Additive only: one new table + three seed rows. Touches no existing table.
-- Run (production, ATL only): wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v26_shift_presets.sql
CREATE TABLE IF NOT EXISTS schedule_shift_presets (
  key        TEXT PRIMARY KEY,                    -- slug, e.g. 'am', 'mid-2'
  name       TEXT NOT NULL,                       -- what the shift is called on the board, e.g. 'Morning'
  start_time TEXT NOT NULL,                       -- HH:MM
  end_time   TEXT NOT NULL,                       -- HH:MM; earlier than start_time means it runs past midnight
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT                                 -- soft delete; shifts already on the board keep their own times
);
INSERT OR IGNORE INTO schedule_shift_presets (key, name, start_time, end_time, sort) VALUES
  ('am', 'Morning',   '09:00', '17:00', 1),
  ('pm', 'Afternoon', '13:00', '21:00', 2),
  ('nt', 'Night',     '21:00', '05:00', 3);
