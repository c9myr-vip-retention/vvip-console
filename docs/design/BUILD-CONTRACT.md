# Console revamp — build contract

Shared spec for the parallel build. **Every agent reads this first.** The two HTML mockups are the visual and behaviour spec:
`docs/design/console-revamp-admin.html` and `docs/design/console-revamp-agent.html` (open in a browser; the page's script holds the logic, search it by function name, e.g. `vTasks`, `vHome`, `openTask`).

## 0. Safety rules (this system is LIVE in production)

- **Never** run `wrangler deploy`, `npm run deploy:*`, or any `wrangler d1 ... --remote`. You have no production credentials and must not seek any. Local only: `--local`.
- **Never** weaken the `player_days` unique constraint, never touch existing tables, never `DROP`/`DELETE` existing data. New tables only, in `schema/schema_v25_work.sql` (already written; extend it ONLY if you truly need a column, additively, and say so in your PR).
- **Never** push to `main`. Work on your own branch, open a PR **into `feat/console-revamp-base`** (not `main`).
- Do not edit files you do not own (section 1). If you need a change in someone else's file, write it in your PR description and work around it.
- Do not add dependencies to `package.json` unless essential; say why in the PR.
- No secrets in code. No `.env` files committed.
- Windows line endings: `worker/index.js` uses CRLF. Do not rewrite whole files; surgical edits only.

## 1. Branches and ownership

Base branch: `feat/console-revamp-base`. Your branch: `feat/revamp-<agent>`. PR target: the base branch.

| Agent | Owns (create/edit only these) |
|---|---|
| `shell-ui` | `src/revamp/ui/*`, `src/revamp/revamp.css`, `src/revamp/Shell.jsx`, `src/revamp/tokens.js`, `src/App.jsx` (the ONLY agent that edits it), `pages/Dashboard.jsx`, `pages/SettingsPage.jsx`, `pages/AccountPage.jsx` |
| `daily-a` | `pages/Contact.jsx`, `pages/Players.jsx`, any new files under `src/revamp/daily/` |
| `daily-b` | `pages/CheckIn.jsx`, `pages/GraceClaims.jsx`, `pages/Assignments.jsx`, `pages/Changes.jsx`, `pages/Performance.jsx`, new files under `src/revamp/daily2/` |
| `tasks-backend` | `worker/work/tasks.js` (+ new files under `worker/work/tasks/`) |
| `tasks-ui` | `pages/Tasks.jsx`, `pages/MyDay.jsx`, `pages/TeamWorkload.jsx`, new files under `src/revamp/tasks/` (TaskPanel, NewTaskModal, List view) |
| `task-views` | `pages/TaskViews/{Deadline,Planner,Calendar,Gantt}.jsx`, new files under `src/revamp/taskviews/` |
| `schedule` | `worker/work/schedule.js`, `pages/Schedule.jsx`, new files under `src/revamp/schedule/` |
| `work-setup` | `worker/work/projects.js`, `pages/Projects.jsx`, `Flows.jsx`, `Templates.jsx`, `Analytics.jsx`, `RecycleBin.jsx`, `TaskEfficiency.jsx`, new files under `src/revamp/setup/` |

Already on the base branch (do not rewrite; extend only if you own it): `worker/work/index.js` (mounts the three handlers after auth), `src/revamp/api/work.js` (client for every route below), `src/revamp/registry.js` (key → page), stub files for every page.

## 2. Roles and permissions (enforce in the Worker, not only the UI)

`/api/me` gives `{ username, role, manage_users, can_edit, team }`. **Admin = `manage_users` truthy.** Agent = everyone else with an account that can edit. Viewer = `can_edit` false: read-only everywhere.

- **Tasks**: admin sees/edits all. Agent sees tasks where they are assignee, owner or observer. An agent may create tasks **only for themselves** (assignee forced to self). Only the assignee starts/pauses/completes their own task. Admin may assign to anyone.
- **One ongoing task per person.** A person may have unlimited assigned tasks but only one with `status='progress'`. The DB enforces it (`uq_one_ongoing_per_person`); the API turns a violation into **409** `{error:"<name> already has an ongoing task", ongoing:{id,title}}`. A task must be **Started** before it can be **Completed** (complete from `pending` → **400**).
- **Templates**: everyone can read and *use* a template when creating a task (the New task popup has a "Start from a template" dropdown). **Only admin** can create/edit/delete templates (403 otherwise). Agents have **no** Templates page in the sidebar.
- **Flows, Analytics, Recycle bin, Team workload, Assignments, Settings**: admin only (403 for others).
- **Projects**: admin creates/edits/archives; agent sees only projects they are a member of.
- **Schedule**: everyone reads; only admin creates/edits/deletes items and types; an agent may request a swap on a shift they are on.
- **Campaigns** tab: **hide it from the new navigation. Do NOT delete the Campaigns code, routes or tables** (the live console still has the VVIP redeem-code tool; Aldo will decide separately).

## 3. API contract (`/api/work/*`, all authenticated, JSON, errors `{error}` with a real HTTP status)

Dates `YYYY-MM-DD` (Malaysia time, GMT+8); timestamps UTC `YYYY-MM-DD HH:MM:SS`. Use `c.ok(data)` / `c.err(msg, status)`; `c = { path, method, url, request, env, user, canManage, ok, err, log, ctx }`. Write an `activity_log` line with `c.log(user.username, "task", "...")` for create/delete/complete.

**Task** = `{ id, title, description, status: 'pending'|'progress'|'done'|'deferred', high_priority: 0|1, owner, assignee, project_id, flow_id, parent_id, due_date, due_time, est_minutes, started_at, spent_seconds, completed_at, tags: string[], linked_player, created_at, updated_at, observers: string[], checklist_total, checklist_done, comment_count }`

`tasks-backend` (`worker/work/tasks.js`):
- `GET /api/work/people` → `{ people: [{ username, role, team }] }` (for pickers; every authed user)
- `GET /api/work/tasks?assignee=&status=&project_id=&flow_id=&q=&include=done` → `{ tasks: Task[] }` (done tasks only if `include=done`; deleted never; scope per section 2; `assignee=` filter is admin-only)
- `GET /api/work/tasks/:id` → `{ task, checklist:[{id,text,done,pos}], observers:[username], comments:[{id,author,body,created_at}], activity:[{id,actor,text,created_at}] }`
- `POST /api/work/tasks` body `{ title*, description, assignee, due_date, due_time, est_minutes, project_id, flow_id, parent_id, tags, linked_player, high_priority, observers:[], checklist:[string], template_id }` → `{ task }` (201). Logs activity "Created the task".
- `POST /api/work/tasks/:id/update` body = any editable subset → `{ task }`
- `POST /api/work/tasks/:id/status` body `{ action: 'start'|'pause'|'complete'|'defer'|'reopen' }` → `{ task }`. `start` sets `status='progress'`, `started_at=now` (409 if the person already has one). `pause` → `pending`, adds elapsed to `spent_seconds`. `complete` only from `progress`: adds elapsed, sets `completed_at`. Each writes a `task_activity` row ("Started the task", ...).
- `POST /api/work/tasks/:id/checklist` body `{ action:'add'|'toggle'|'remove', text?, item_id? }` → `{ checklist }`
- `POST /api/work/tasks/:id/comments` body `{ body }` → `{ comments }`
- `POST /api/work/tasks/:id/delete` → `{ ok:true }` (soft delete: sets `deleted_at/deleted_by`; owner or admin)
- `GET /api/work/workload` (admin) → `{ people: [{ username, assigned, overdue, done, waiting, ongoing: null | { id, title, started_at, spent_seconds, est_minutes, checklist_done, checklist_total } }] }`. `assigned` = not done; `overdue` = not done and due before today (MYT); `waiting` = status pending.

`schedule` (`worker/work/schedule.js`):
- `GET /api/work/schedule?from=&to=` → `{ types: [{key,name,color,builtin}], items: [ScheduleItem] }` where `ScheduleItem = { id, type_key, date, title, start_time, end_time, brands:[], who:[], note, repeat:'none'|'daily'|'weekly', off }`. The client expands repeats.
- `POST /api/work/schedule/items` body `{ items: [{type_key,date,title,start_time,end_time,brands,who,note,repeat}] }` (admin; **many dates × many entries in one call**; a `shift` item must have ≥1 person; max 500 per call) → `{ created: n }`
- `POST /api/work/schedule/items/:id/update`, `/delete` (admin)
- `POST /api/work/schedule/types` (admin) `{ name, color }` → `{ type }`
- `POST /api/work/schedule/items/:id/swap` (agent, own shift) `{ note }`; `GET /api/work/schedule/swaps` (admin); `POST /api/work/schedule/swaps/:id` (admin) `{ status:'approved'|'declined' }`

`work-setup` (`worker/work/projects.js`):
- Projects: `GET /api/work/projects?archived=0|1` → `{ projects: [{ id, name, description, privacy, archived, members:[{username,role}], task_total, task_done, last_active }] }` (agent: member projects only); `GET /api/work/projects/:id`; `POST /api/work/projects` `{ id?, name, description, privacy, members:[username] }` (admin); `POST /api/work/projects/:id/archive` `{ archived }`
- Flows (admin): `GET /api/work/flows` → `{ flows: [{ id, name, project_id, project_name, admin_user, default_assignee, last_task_at, pending, in_progress, completed, efficiency, rating }] }` (efficiency = on-time share of completed); `POST /api/work/flows`; `POST /api/work/flows/:id/delete` (soft)
- Templates: `GET /api/work/templates` → `{ templates: [{ id, name, deadline, assignee, checklist:[string], created_by }] }` (everyone); `POST /api/work/templates` and `/:id/delete` **admin only**
- `GET /api/work/analytics?days=30` (admin) → `{ created_vs_completed: [{ week, created, completed }], workload: [{ username, open }], flows: [{ name, completed }], compliance: [{ username, rate }] }`
- `GET /api/work/efficiency?user=` → `{ users: [{ username, assigned, completed, on_time_rate, avg_minutes, overdue }] }` (admin: all or one; agent: self only)
- Recycle bin (admin): `GET /api/work/bin` → `{ items: [{ type:'task'|'project'|'flow'|'template', id, name, deleted_at, deleted_by }] }` (kept 30 days); `POST /api/work/bin/restore` `{ type, id }`; `POST /api/work/bin/purge` `{ type, id }` (permanent, admin, confirm in UI)

## 4. Frontend contract

- Stack: React 18 + Vite. Plain function components. Reuse the live console's CSS tokens (`:root` in `src/App.jsx` `<Style>`); `shell-ui` provides `src/revamp/revamp.css` with the mockup's classes (`.card`, `.bar`, `.seg`, `.pill`, `.prog`, `.frow`, `.tw`, `.drawer`...). Until it lands, use the class names from the mockup's `<style>`.
- **Every page is `export default function Page({ ctx })`.** `ctx` is built in `App.jsx` by `shell-ui` and contains: `{ me, viewTeam, board, data, teamData, teamBrands, contacts, dates, viewDate, setViewDate, isPast, readOnly, saveContact, clearContact, loadBoard, drill, setDrill, goto(key) }` — exactly the values the existing `Queue`, `Delta`, `Dashboard`, `Performance`, `AssignedView`, `LoginCheck`, `GraceTasks` components get today. **Daily and Dashboard pages must reuse the existing logic** (`classifyAll`, contact saving, grace rules, login-check endpoints, auto-assign): re-layout and re-house it, never re-derive it. Move shared pure helpers into new files under your own folder and import them; do not copy-paste 500-line components twice.
- Task view components (`TaskViews/*`) receive `{ tasks, people, me, onOpen(id), onChange() }`: `tasks` already scoped; they call `work.*` themselves for drag/drop date changes (`work.updateTask`) and then `onChange()`.
- API: import `{ work }` from `src/revamp/api/work.js` only. Base URL and auth come from there.
- UI kit: import `Seg, Select, MultiSelect, DatePick, Modal, DrawerPanel, toast, Avatar, BrandBadge` from `src/revamp/ui`. Props are fixed (see the file). `shell-ui` upgrades them in place (searchable dropdowns, floating calendar). Never re-implement them.
- **Mock data for development**: the live API for `/api/work/*` is not deployed. Develop against fixtures: keep them in your own folder (`<yourfolder>/fixtures.js`), enabled when `localStorage.revamp_mock === "1"`. Port the mockup's sample data. Never ship fixtures as the default.
- Local Worker (backend agents): `npx wrangler dev --local` with a throwaway local D1; apply `schema/schema.sql` then the other `schema_v*.sql` files in version order, then `schema_v25_work.sql`, **all with `--local`**. Seed a local admin and 3 agents via `POST /api/users/init` and `POST /api/users`.
- `npm run build` must pass. There is no linter or test suite; add focused tests only if cheap (plain Node scripts in `scripts/`).

## 5. Style rules (Aldo's, non-negotiable)

- Keep the live console's colours and **the brand colours everywhere** (brand identity). Layout is what changes.
- **No pill/chip filter rows.** Use dropdowns, segmented switches, or checklist menus with colour dots. Every dropdown is custom and searchable (use the kit).
- **No coloured accent bars or lines** on cards/panels/columns/nav. Only brand identity lines: brand cards' top edge, the brand-coloured left stripe on player rows, Brand-trends column headers.
- Never drop an existing function when moving it (grace claims + rule note, paste list, row selection, Mark contacted, check-in, grace filters).
- One job per page, separate sidebar pages for Contact / Check-in / Grace claims / Players / Assignments. Do not merge pages.
- No "Snapshot" label or pill. **No native scrollbar arrows**: thin dark arrowless scrollbars globally; no needless horizontal scrollbars.
- Keep simple and user friendly; no clutter.

## 6. Definition of done and the PR

1. `npm run build` passes; for backend agents the Worker bundles (`npx wrangler deploy --dry-run --outdir <tmp>`) and every route was exercised locally with `curl` (list the commands you ran).
2. Screens match the mockup (take real screenshots at 1440 wide and look at them; a CSS class clash once broke a whole page unseen).
3. Permission rules in section 2 verified (try an agent token against an admin route: expect 403).
4. PR into `feat/console-revamp-base` titled `<agent>: <what>`. Description: what was built, files touched, anything you could not do, anything you need from another agent, and the exact local test commands. No deploy, no remote DB.
