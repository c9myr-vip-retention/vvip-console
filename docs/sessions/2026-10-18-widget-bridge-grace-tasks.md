# 2026-10-18 · Widget bridge, Lark bonus reads, Grace Tasks, table tools

Built on branch `feat/paste-list-tick`, tested against a local D1 and a fake Lark, then **deployed to production on 2026-10-18** by Aldo's account (`14e65f2d…`): Worker version `c59dc7ae` (features), Pages `23fd4294` (screens), Worker version `4a857b09` (brand fix). Rollback target before this work: Worker `3cb62ff0`. The branch is pushed; the pull request is not merged into `main`.

## What was built
- **Table tools (Daily → Table):** "Paste list" (username/UID + brand lines tick those players), a tick-all header checkbox, and Grace "not activated" / "activated" toggle buttons. GRACE WATCH in the Table view shows Not activated / Activated / No live Grace row dividers.
- **Lark bonus reads (worker):** `GET /api/rtn/bonus-lookup` (drawer card "Bonuses (from widget)"), `GET /api/rtn/grace-status`, `GET /api/rtn/grace-tasks`. They read the widget's Lark tables directly, read-only, using the widget's claimable rules. Config is the `WIDGET_LARK` secret (base + table ids).
- **Grace Tasks (Daily → Grace Tasks):** activated, reloaded after activation, not claimed.
- **Widget API (key-protected):** `POST /api/ext/note`, `GET /api/ext/notes`, `POST /api/ext/action`, `GET /api/ext/actions`. Header `x-widget-token` = secret `WIDGET_API_KEY`. The key opens only these routes.

## Decisions and rules settled
- Real SW Check formula (read from Lark): `Claimed` / `Expired` / `Pass <bonus>` / `Failed` / `Activated : yyyy-MM-dd HH:mm - Pass - <bonus>`. No deposit figure in the text. Activated rows never expire; `Expried` = Time of inspection + 1 or 3 days and only matters before activation.
- Required deposit comes from the bonus: 18→100, 28→200, 38→300, 58→500, 68→600, 78→700, 88→800, 98→900, 108→1000 (`GRACE_LADDER`, overridable as `graceOpts.ladder`).
- Window = activated date → expiry date. Only deposits **after the activation day** count as certain; the activation day itself is shown as "Same-day, check time" because the console has daily totals, not times.
- The widget's `author` ("96 Raven - VIP RTN SNR MY") is cleaned to a first name and matched to a console username when one exists; stored as "<name> (widget)".
- `/api/ext/action` appends a `[widget · name · time]` line to today's `contact_log` note and never changes status, assignee, `updated_by` or `updated_at` (those drive auto NO_RESPONSE, the 48h cooldown and auto-assign pins). No row yet: created with status NULL.

## After the deploy
- Brand fix (live): the widget sends Lark's SHORT brand code (FUN, VS, SPIN, PP, LPK …). `/api/ext/*` accepts the short code or the full name (any case) and stores the full brand; the Lark reads send Lark the short code (`brandStyle` / `brandMap` overrides in `WIDGET_LARK`). Without this, brands with digits found nothing.
- Widget notes verified end to end by the user: a Relationship note and an Action log entry for FUN / 34904 both saved.
- Deploy needs `CLOUDFLARE_ACCOUNT_ID=14e65f2d50852aa895d2f46d673f7209` (wrangler lists two accounts) and no `.env.local` when building Pages.

## Open items
- Verify Grace Tasks, the Grace buttons and the drawer Bonuses card on real Lark data: one player who reloaded, one who did not. The console's Lark app needs "Can view" on any table that errors.
- Widget side (separate repo): its Grace amount reading looks wrong for the real text (takes the year); the "Time of inspection" header may be spelled "inspectiion". `CONSOLE_NOTE_TOKEN` must equal `WIDGET_API_KEY`.
- Not done: Worklist dividers for the Grace split (tags only).

## Files touched
`src/App.jsx`, `worker/index.js`, `wrangler.toml` (comment), `.gitignore` (`.dev.vars`, `.env.local`).

## Related
[[HANDOFF]] · [[EXECUTED_IDEAS]] · [[IDEAS]] · [[2026-10-17-atl-report-engagement-sync]]
