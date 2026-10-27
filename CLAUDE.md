# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Critical operating rules (read first)

This system is **LIVE in production**. The D1 database receives real player data daily at 15:00 MYT. Treat every action as if it touches production, because it does.

1. **Get explicit approval before** running destructive SQL (`DELETE`, `DROP`, schema rewrites) or `wrangler deploy` (Worker or Pages). Never do these on your own initiative.
2. **Never weaken the `player_days` unique constraint** `(player_key, snapshot_date, brand, tier_segment)`. A previous schema missing `brand` caused silent cross-brand data corruption.
3. **`--remote` is mandatory** on every `wrangler d1` command. Without it, wrangler hits a local simulation, not production — results will be misleading.
4. **Surgical, in-place edits over rewrites.** Modify existing files; don't regenerate whole files unless asked.
5. **Environment is Windows + PowerShell** (not WSL). Quote paths. Clone the repo wherever you like.
6. **Style:** direct, concise, production-ready. Flag flaws proactively; no filler.

**`docs/HANDOFF.md` is the deep reference** — full domain model, strategy layer, backlog, and known limitations. Read it when you need context beyond what's below. This file holds only what every session must see by default.

## Session summary note (Obsidian brain)

At the end of a work session, write a short summary note so decisions are not lost and enter the Obsidian graph.

- Location: `docs/sessions/YYYY-MM-DD-<topic>.md` (create the folder if missing).
- Contents: what we worked on, decisions settled (rules, numbers, choices), open items, and files touched. Keep it short. Markdown only.
- Link related docs with `[[wikilinks]]` so the note joins the graph.
- Additive, and never restate an unconfirmed item as fact.
- The note is a doc, safe to commit with your clean doc changes. Do not bundle unfinished code, and deploys or destructive SQL still need explicit approval (operating rule #1).

## Who works here and how to talk to them

- **ATL** (owner, 1st PIC): new to coding. Explain in short, simple sentences with small words. No jargon. One step at a time. Confirm before doing anything.
- **Developer** (developer, 2nd PIC): technical. Be concise and precise; normal engineering vocabulary is fine. Follows `CONTRIBUTING.md`: branch + pull request.

If you are not sure who you are working with, ask.

## What this is

A daily VIP-retention console for "GROUP B" — tracks high-roller players across 6 casino brands, classifies them by behavior, and drives a CS team's contact workflow. Frontend is a single-file React app (Vite); backend is a single-file Cloudflare Worker over a D1 (SQLite) database.

## Commands

```bash
npm run dev                # Vite dev server (frontend only; hits the deployed Worker via API_BASE)
npm run build              # Build frontend to dist/

# Deploys hit production — require explicit approval first (see operating rule #1):
npm run deploy:worker      # wrangler deploy  → the API Worker
npm run deploy:pages       # build + deploy frontend to Cloudflare Pages

# Database (D1) — live production DB; --remote is mandatory, destructive SQL needs approval:
wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema.sql                  # v1 tables (users, players, history, upload_log)
wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v3_player_days.sql   # current data table (DROPS & recreates player_days)
wrangler d1 execute groupb-tracker-db --remote --file=./schema/schema_v4_contact_log.sql   # contact_log (additive)
# (all migration files now live in ./schema/ — schema.sql, schema_v2…v16)
wrangler d1 execute groupb-tracker-db --remote --command="SELECT ..."               # ad-hoc query
```

There are **no tests and no linter** configured. `docs/DEPLOY.md` is the original step-by-step provisioning guide (Cloudflare account → D1 → secrets → deploy). Reference docs (HANDOFF, IDEAS, EXECUTED_IDEAS, specs) live in `docs/`; SQL migrations in `schema/`.

## Architecture

**Two generations of the app coexist in the code.** The live console only uses the v2/v3 path; the v1 path is legacy and should not be extended:

- **v1 (legacy, mostly dead):** browser uploads an Excel file → `POST /api/upload` → `players` / `history` / `upload_log` tables, read via `GET /api/players`. The `xlsx` dependency and these routes remain but the current frontend never calls them.
- **v2/v3 (current):** a Google Sheets feeder pushes daily rows → `POST /api/ingest` → the `player_days` table. The console reads everything through the `/api/rtn/*` routes and writes outcomes to `contact_log`.

### Data flow (current path)
1. **Ingest** — an external Sheets feeder POSTs `{brand, tier_segment, rows}` to `/api/ingest`, authed with the `INGEST_TOKEN` secret (NOT a user session). The Worker stamps `snapshot_date` itself in Malaysia time (GMT+8), derives `player_key`, cleans spreadsheet artifacts (`"123.0"`→`"123"`, `#REF!`→null), and upserts in chunks of 25.
2. **Board load** — frontend calls `GET /api/rtn/board` once on login: returns the latest snapshot's rows + recent `contact_log` + per-brand freshness (`health`) + team list, in one call.
3. **Classification** — happens entirely **client-side** in `classifyAll()` in `src/App.jsx`. This is the single source of truth for the "Behavior Book". The Worker does no classification.
4. **Action** — CS assigns/sets status/notes per player → `POST /api/rtn/contact` upserts one `contact_log` row per `(snapshot_date, player_key, brand, tier_segment)`.

### Key identity & domain rules
- **`player_key`** = `uid` if non-empty, else `username` — derived server-side at ingest. For Zyra brands `uid` is populated so the key is the uid; for TC brands (LPK777, ACE33) the `uid` column is *empty*, so it falls back to `username`. This is the canonical player identity. Rows with neither are dropped as totals/blank lines.
- **`snapshot_date`** is the daily history axis, stamped by the Worker in GMT+8 — NOT `entry_date` (which is the static tier-entry date). Upsert key is `(player_key, snapshot_date, brand, tier_segment)`.
- **Brands for Teams A, B and C**, two providers: `TC` and `ZY`/Zyra (Team B: LPK777, ACE33 are TC; BM69, HOT321, RM68, SK69, JK32, ZAS36 are Zyra). The full list and team map are `BRANDS` and `TEAMS`. Provider determines display identity (`dispName`), message hooks (`HOOK`), and copy. Defined in `BRANDS` at the top of `App.jsx`.
- **`tier_segment`** is `'3'` or `'V'` (Tier V = top whales).
- **`pnl`** is shown as *player* net (negative = the player has lost = your highest-value customer). Don't flip the sign.

### Worker (`worker/index.js`)
Single `fetch` handler, manual `if (path === ... && method === ...)` routing, no framework. **Route order matters**: `/api/login`, `/api/users/init`, and `/api/ingest` are defined *above* the `requireAuth` gate because they use their own auth (or none). Everything after the gate requires a valid session. Keep `/api/ingest` above the gate.

- **Auth**: custom stateless token = `base64("username:expires:sha256(username:expires + SESSION_SECRET)")`, 8h TTL. Passwords are `sha256(password + PASSWORD_SALT)`. Secrets (`SESSION_SECRET`, `PASSWORD_SALT`, `INGEST_TOKEN`) are set via `wrangler secret put`, never in `wrangler.toml`.
- **CORS** is computed per-request (`corsFor`) and allows `groupb-tracker.pages.dev` + localhost. Note the global `CORS` var is repopulated on every request.
- `_bak.js` / `_bak.toml` files are backups — ignore them.

### Frontend (`src/App.jsx`)
Entire app — logic, all components, and CSS (`<Style>` injects a `<style>` block) — is in this one ~7,100-line file. Tabs: **Dashboard** (management KPIs, trends), **Daily** (the `Queue` worklist/table + per-player `Drawer`), **Changes** (day-over-day movers), **Campaigns**, **Performance** (save-rate stats from `contact_log`), **Settings** (user admin). Colours are CSS tokens on `:root` (see `docs/design/console-design-pass.html`); clickable rows use the `tap()` keyboard helper.

- **`API_BASE` is hardcoded** at the top of `App.jsx` (currently `https://groupb-tracker-api.viprtn.workers.dev`). It must match the deployed Worker URL — update it if the Worker subdomain changes.
- Session token lives in `localStorage` under `session_token`.
- `classifyAll` / `buildApproach` encode the retention playbook (class precedence GRACE → TOP_LOSS → TOP_DEP → BLOCKED → DSLD30/14/7 → WATCH → HEALTHY, plus FRAGILE/WHALE flags and responsible-gambling guard rails in the message templates). Treat these as product rules, not arbitrary code.

## Related

- [[00-INDEX]] — docs map
- [[HANDOFF]] — deep reference
- [[EXECUTED_IDEAS]] — what shipped
- [[IDEAS]] — parked features
- [[DEPLOY]] — provisioning guide
- `CONTRIBUTING.md` — how the owner and the developer work together
