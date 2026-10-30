# 2026-10-27 — Notifications and sound

Related: [[HANDOFF]] · [[2026-10-27-bulk-mark-contacted]]

## What we worked on
- The bell already told people about: tagged, comment, new task. Added:
  - **Tasks:** completed, deferred, reopened; taken off you; title / description / due date / priority changed; added as observer; reaction on your message; deleted.
  - **Due soon / overdue:** hourly Worker cron (`taskReminders`). Due soon = 30–90 min before the due time, or 09:00 on the due date when there is no time. Overdue = assignee and owner, once.
  - **Shift swaps:** request → everyone with "Decide shift swaps" on that team; approved / declined → the requester.
  - **Your schedule changed:** shift (or any schedule item) you are on was added, edited or deleted.
  - **Players given to you:** by a leader (contact assignment), by auto-assign, and players added to your check-in list.
  - **Mistake logged against you.**
- Sound: a short two-note chime when a new unread message arrives. Mute / unmute inside the bell. Default on.
- A tab in the background keeps checking for new messages (every ~30s) so the chime and the `(n)` count in the tab title still work.

## Decisions
- No Start / Pause, checklist or contact-status pings (too noisy).
- Bursts become ONE message: players handed out or schedule items changed by the same person within 15 minutes are counted up ("30 players", "4 items"). `comment_id` holds the count for these kinds. One chime per burst.
- Overdue tasks older than a day are never reminded, so the first cron run does not flood people with old backlog.
- Reminders fire once per deadline; moving the deadline gives a new reminder.
- No sound on first page load and none for messages already read. Browsers only allow sound after one click or key press on the page.
- No SQL change: `notifications.kind` takes any text.

## Tested
- Local only (`wrangler dev --local`, throwaway D1 from all schema files): 24 checks passed, including the cron reminders run twice without duplicates and 5 parallel assignments collapsing into one message.

## Open items
- Needs a **Worker deploy** and a **Pages deploy**.
- Not done: desktop pop-up (browser Notification API); Grace "ready to claim" daily message; feed-late chime for managers.

## Files touched
- `worker/work/chat.js` (`notifyCount`, `usersWith`, `taskReminders`, `accountsWithPerms` moved here), `worker/work/tasks.js`, `worker/work/schedule.js`, `worker/index.js`
- `src/revamp/sound.js` (new), `src/revamp/live.js`, `src/revamp/Shell.jsx`
