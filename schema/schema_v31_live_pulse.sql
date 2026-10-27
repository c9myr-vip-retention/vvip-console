-- v31: "live" updates. One tiny counter per area (tasks, schedule, projects, people). The Worker adds 1 to an area after every successful
-- change in it; open pages ask GET /api/work/pulse every few seconds and reload only the area whose number moved.
-- ADDITIVE: one new table. Nothing existing is changed or dropped.
-- Run (production, ATL only, BEFORE deploying the Worker that uses it; safe to run twice):
--   wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v31_live_pulse.sql

CREATE TABLE IF NOT EXISTS live_pulse (
  area TEXT PRIMARY KEY,
  n    INTEGER NOT NULL DEFAULT 0
);
