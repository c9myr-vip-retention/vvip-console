-- ============================================================
-- groupb-tracker · Schema v12 · mistakes  (per-agent mistake log)
-- ADDITIVE — creates a NEW table only. Safe with --remote.
--
-- Purpose: per-agent mistake log that auto-feeds the Discipline KPI.
-- Each mistake carries a category + a points weight (flexible, default
-- 1). Discipline score = weighted sum of the month's mistakes -> band.
-- View = any user; add/delete = admin (ATL and above) only.
-- ============================================================

CREATE TABLE IF NOT EXISTS mistakes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  month      TEXT NOT NULL,            -- 'YYYY-MM'
  agent      TEXT NOT NULL,            -- staff username the mistake is attributed to
  category   TEXT NOT NULL,            -- one of the fixed 5 categories
  points     REAL DEFAULT 1,           -- weight (flexible; default 1 = simple count)
  note       TEXT,
  brand      TEXT,                     -- optional brand context
  logged_by  TEXT,                     -- admin who logged it
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mistakes_month ON mistakes (month, agent);
