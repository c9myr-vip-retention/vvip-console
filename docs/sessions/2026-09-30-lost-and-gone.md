# 2026-09-30 — Lost & gone, 30-day grid, Team B ops

## What we worked on
- Counted open-to-contact players (29 Sep): 9,212 all teams; Team B with Telegram, outside the 48h cooldown = 185.
- Split the 185 across agents (Agent B 30%, Agent E 20%, Agent D 18%, Agent A 17%, Agent C 15%) as a CSV. Agent C's share was then moved to Agent D.
- Logged 68 Agent E/Agent A players as CONTACTED on 29 Sep (ATL confirmed they had messaged them). 32 of them had already been logged by Agent B/Agent D that evening and were moved to Agent E/Agent A on ATL's instruction. Activity log rows are tagged `bulk-log via Claude for ATL`.
- Team B vs C engagement comparison for Sep MTD.
- Built and deployed the Lost & gone panel, 30-day grid export, and drawer money calendar (see [[EXECUTED_IDEAS]]).

## Decisions
- Team engagement metrics count **contacts made** (contact_log rows), not distinct players. Follow-up = contacts after a player's first in the month. Reactivation rate = recovered players ÷ contacted players.
- Lost & gone default loss rule = withdraw ≤ deposit (matches the SPV sheet); game win/loss < 0 is a switch.
- All new views label **real game days** (snapshot − 1), matching the SPV/Excel dates.
- In the 30-day grid, 0/0 days are grey ("no play"), not red as in the hand-built Excel.
- Month view is a small popup calendar in the drawer, not a replacement for the 14-day strip.

## Numbers (Sep 1–28, Team B vs C)
- Contacts made 7,430 vs 6,725 · contacts per player 5.2 vs 4.2 · follow-ups 5,990 vs 5,115 (80.6% vs 76.1%) · reactivation 59.6% vs 37.2%.

## Open items
- Bell alert for Lost & gone not built.
- A Tier V whale losing every day can still be labelled HEALTHY / "no contact". Leadership to decide if a losing streak should change the class.
- History loads per player (~15–20s for a 300-player grid). A batch endpoint would speed it up (needs a Worker deploy).
- Month calendar popup not checked at phone width.

## Files touched
- `src/App.jsx`, `package.json`, `package-lock.json` (added `xlsx-js-style`), `docs/EXECUTED_IDEAS.md`.
- Production data: `contact_log` + `activity_log` rows for 68 Agent E/Agent A contacts on 2026-09-29.

Related: [[HANDOFF]] · [[EXECUTED_IDEAS]] · [[DEPLOY]]
