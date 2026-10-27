# 2026-10-22 — Console revamp: integration of the 8 parts

Related: [[BUILD-CONTRACT]] · [[HANDOFF]] · [[DEPLOY]]

## What we worked on
- Merged the 8 revamp parts (shell-ui, work-setup, task-views, daily-a, tasks-backend, schedule, daily-b, tasks-ui) onto one branch on top of `feat/console-revamp-base`.
- The first 4 came from the original agent sessions as patch files. The other 4 were rebuilt in this session by sub-agents because their sessions could not export.
- Ran a QA pass at 1440px as admin, agent and viewer against a throwaway local Worker and D1, then fixed what it found.

## Decisions settled
- New shell stays behind `?revamp=1` (off by default). With the flag off the live console renders exactly as before.
- Task efficiency is a tab inside the Performance page (admin and agent), not a sidebar item.
- Team workload shows only the per-person cards. Assignments stays its own page.
- Brand colours on every revamp page come from `BRANDS` in `src/App.jsx` (live colours), via `brandColor()` in `src/revamp/tokens.js`.
- The live player `Drawer` in `App.jsx` was not changed; revamp pages wrap it in `.rv-live` themselves.
- Schedule: approving a swap records the decision only; the admin edits the shift to change who works it. Repeating items are edited, not dragged.

## Checks (local only, never production)
- `npm run build` passes; `wrangler deploy --dry-run` bundles.
- API tests on a fresh local D1: work-setup 64/64, tasks 101/101, schedule 65/65. Run each suite on its own fresh database (they share test users).

## Open items
- Native browser dropdowns remain inside live components reused by the revamp (Settings accounts form, Performance mistake log, Dashboard retention select, player drawer date). Fixing them changes live code: needs ATL's decision.
- "Daily lists per agent" (live `AssignedView`) still has a chip row for picking agents.
- Not yet verified against real production data or the real Lark widget (`WIDGET_LARK`).
- GitHub push from cloud sessions returns 403 (the Claude GitHub App is not installed on the org). ATL pushes from his PC.
- Before going live: ATL approves, run `schema/schema_v25_work.sql` on production, deploy Worker and Pages. Only with ATL's explicit approval.

## Files touched
`src/App.jsx` (flag, scoped styles, `Settings hideLog`), `src/revamp/**`, `worker/work/{tasks,schedule,projects}.js`, `schema/schema_v25_work.sql` (additive `deleted_by`), `scripts/test-{setup,tasks,schedule}-api.mjs`, `scripts/revamp-shell-check.cjs`.
