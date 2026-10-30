# 2026-10-27 — Bulk mark contacted, undo, Grace claims ticks

Related: [[HANDOFF]] · [[EXECUTED_IDEAS]] · [[2026-10-22-revamp-integration]]

## What we worked on
- **Players page, "Mark contacted":** it saved each player one request at a time, so rows flipped one by one. Now the writes go out 8 at a time and the board updates once, so all rows flip together.
- **Undo:** new "↩ Undo contacted" button next to "Mark contacted". Clears the contact for every ticked player that has one.
- **Grace claims page:** added the tick-all box, row ticks, "✓ Mark contacted" and "↩ Undo contacted", on both the Claims list and the Grace players list.

## Decisions
- Frontend only. No Worker change, no SQL, no deploy needed. Uses the existing `POST /api/rtn/contact` (with `clear: true` for undo).
- Undo = same as the player panel's "Clear": deletes the whole `contact_log` row (assignment, status, note). It cannot restore an earlier owner.
- Undo shows only for accounts with the delete-contact permission. The Worker still checks it; rows it refuses (for example a contact another agent logged, for an own-only account) stay ticked and are reported.
- Players that fail to save stay ticked; the rest are un-ticked.

## Open items
- Not tested in the browser; build passes. Check on a real selection after deploy.
- The old `Queue` in `src/App.jsx` (non-revamp path) still marks one by one. Not touched.
- A single Worker bulk route would be atomic and faster, but needs a Worker deploy (approval first).

## Files touched
- `src/App.jsx` (`saveContacts`, `clearContacts`, passed in `ctx`)
- `src/revamp/daily/hooks.js` (`useBulkContact`)
- `src/revamp/pages/Players.jsx`
- `src/revamp/pages/GraceClaims.jsx`
- `src/revamp/daily2/daily2.css`
