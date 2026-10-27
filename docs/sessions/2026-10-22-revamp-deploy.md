# 2026-10-22 — Console revamp deployed to production (behind `?revamp=1`)

Related: [[2026-10-22-revamp-integration]] · [[DEPLOY]] · [[HANDOFF]]

## What we worked on
- Deployed the revamp branch `feat/console-revamp-base` to production, step by step, with ATL's approval.
- Ran in the 13:50–14:10 MYT window, clear of the 15:00 data ingest.

## Done
- `npm run build` passed before deploy; git status was clean.
- Rollback points recorded before any change: Worker version `e28f9793-673d-46bf-b1fd-5e46ec11620f`; D1 time-travel bookmark `00003706-00000000-0000510c-a22cdb65cda08e54f4de109b0db9e888`.
- Ran `schema/schema_v25_work.sql` on production D1 (additive only). Confirmed `projects`, `flows`, `task_templates`, `tasks`, `schedule_items` exist. `player_days` untouched.
- Worker deployed: version `6a0ca8bb-8e40-4e74-a4f7-6c2f0b85535b`.
- Pages deployed: `e3034897.groupb-tracker.pages.dev`; live site serves `index-6e696a0b.js`.
- Without a token: `/api/work/people`, `/api/work/schedule`, `/api/work/tasks`, `/api/rtn/board` all answer 401 (routes behind the auth gate); bad login still refused.
- ATL opened the console normally (old look) and with `?revamp=1` (new design) and said both look right.

## Decisions settled
- New design stays hidden unless `?revamp=1` is used.
- The new tables stay even on rollback (old code does not use them).

## Open items
- Not tested with a token by Claude: login success, `GET /api/work/people`, `GET /api/rtn/board` data. ATL checked in the browser (the screenshot showed the `Agent H` account).
- "Retention trend" showed "Loading…" in one screenshot; confirm it finishes.
- Pull request `feat/console-revamp-base` → `main`, "Console revamp (behind ?revamp=1 flag)": ATL opens it (gh is not signed in on this PC); Developer reviews; do not merge without review.
- Wrangler on this PC is logged in as a developer's personal Gmail; Cloudflare shows that login as the deployer.

## Files touched
None in the repo besides this note. `schedule.patch.txt` (an old duplicate draft of the Schedule work) was moved out of the repo to the temp folder.

## Later the same day: changes made after the deploy (NOT deployed, NOT committed)
Built on `feat/console-revamp-base`; nothing here is live until ATL approves a deploy.
- Schedule: **Roster** view (people x days, paint a shift by click or drag), **Shift groups** (tick who is Day / Mid / Night / custom for a month, apply to the whole month), **Manage shifts & delete** (admin edits the Quick fill shift times, adds new shifts, bulk-deletes items by type and date with a count first). New table `schedule_shift_presets` in `schema/schema_v26_shift_presets.sql` (additive). The Worker falls back to the default shifts until the migration is run.
- Team workload: an agent sees their own team; an admin gets a team filter that starts on their own team. Sidebar link added for agents. Worker `/api/work/workload` is now open to all roles but scoped by team.
- New task: admin can assign one task to many people (one task each) and add observers by role or team; Checklist field now explains itself.
- Grace claims: **Load all** shows Grace rows for players not in the current board (no player panel for those).
- Shell: sync time shown in GMT+8. Number boxes no longer show the browser up/down arrows.
- Every native `<select>` in `src/App.jsx` is now the custom dropdown (`NativeSelect` in `src/revamp/ui/index.jsx`).
- Tests (local throwaway D1 only): schedule 96/96, tasks 102/102. The UI changes were built but only the Schedule screens were clicked through; the rest need a look in the browser.

## Rule from ATL
- Everything stays behind `?revamp=1` until ATL says "live". The old console (no flag) must look and behave exactly as before. The custom dropdowns, the number-box arrows and the "start on my team" default only apply when the flag is on (`NativeSelect` falls back to the plain browser select when it is off).

## Roles and permissions (built, NOT deployed, behind ?revamp=1)
- ATL asked for roles beyond admin/agent: rename them, give each its own permissions, manage it all in Settings. One function = one permission (24 of them, in 4 groups).
- A role = name + starting point (Admin / Agent / Viewer defaults, or nothing) + any switches on or off. Built-in roles can be renamed and edited too, but not deleted.
- Accounts get one role. Accounts with no role yet ("old settings") keep exactly the access they have today (`legacyPerms` in `worker/perms.js`); Settings > Accounts has a button to move them onto their roles and shows who would gain or lose access first.
- The Worker enforces it: `worker/perms.js` (catalogue + resolver), `worker/roles.js` (routes), checks in `worker/index.js` and `worker/work/*.js` now ask for a specific permission instead of "is a manager". The old columns (`role`, `can_edit`, `can_delete`, `on_leaderboard`, `manage_users`) are kept in step from the role so older queries stay right.
- Nobody can remove the last account that can manage accounts and roles (checked on role edits, role deletes and account moves).
- New migration `schema/schema_v27_roles.sql` (two new tables + one nullable `users.role_key`). Must be run on production BEFORE the Worker that uses it is deployed. Until then roles screens say "not set up" and everything else behaves as before.
- UI: Settings gets Accounts and "Roles & permissions" tabs; the sidebar and pages follow permissions (`src/revamp/perms.js`). The old console (no flag) is unchanged.
- Tests (local throwaway D1): roles 51/51, tasks 102/102, schedule 96/96, setup all pass. The suites now clean up after themselves so they can run in any order.
- Heads-up: saving an account through the OLD Settings editor takes that account off its role (it goes back to "old settings").

## Open
- ATL reports Team B shows another team's brand or teammate: waiting for ATL to explain where.
- To go live: run `schema_v26_shift_presets.sql` on production (ATL), then deploy Worker and Pages. See [[DEPLOY]].
