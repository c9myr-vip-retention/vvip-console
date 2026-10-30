# 2026-10-30 · Own-only agents could not bulk mark contacted

## What happened
jason (role JNR, "Log contacts: Own only", moved Team B → A on 2026-10-18) got "0 saved, 84 could not be saved" on Players / Grace claims. Permissions were correct.

## Cause
The Worker's `ownerOf` treated the Check-in roster (`player_assignment`, the Tier V login/deposit roster dealt on 2026-09-15) as contact ownership. The roster was dealt before jason joined Team A, so almost every Tier V JOM99/EZ96 player belonged to another agent and was refused with "You can only work on players assigned to you". The Players page showed them as unassigned, because it only reads `contact_log`.

## Decisions
- **The Check-in roster does not own contacts.** It only decides who ticks login and deposit. Under "Own only", the owner is the agent on the day's `contact_log` row; a player with no contact today is open to the whole team. Notes / CRM / Telegram use the latest contact row.
- Bulk "Mark contacted" skips players already assigned to someone else for own-only accounts, and the toast now shows the server's reason for any failure.

## Verified
Local run of the real `worker/index.js` on a copy of today's production rows (Node + `node:sqlite`): jason saves all 2,961 Team A players; firdaus (own-only) is still refused on exactly jason's 88 contacted players.

## Shipped
- `53ec097` bulk mark: skip others' players, show the reason (Pages deployed)
- `3cdcb40` roster rows of deleted accounts no longer block (Worker deployed)
- `886ecce` roster no longer owns contacts; removed unused `keyOf` export that crashed the local dev server (Worker 42793664 deployed)

## Open
- Confirm with jason on the live console after a refresh.
- `wrangler dev --local` D1 is broken on this machine (HashIndex errors); use the Node harness approach for local Worker tests.

## Files
`worker/index.js`, `src/App.jsx`, `src/revamp/daily/hooks.js`

Related: [[HANDOFF]], [[EXECUTED_IDEAS]]
