# VIP Retention Console — Agent Handbook

**Department:** VIP Retention (C9MYR)
**Version:** 2.0
**Effective:** 3 September 2026
**Supersedes:** Version 1.0, 1 July 2026
**Audience:** CS agents working the daily VIP retention queue
**Review cycle:** Quarterly, or on any material change to the console

---

## About this handbook

This handbook is the operating manual for the VIP Retention Console. It is issued to every agent on enrolment into the department and is the reference for day-to-day retention work.

Version 2.0 is a complete document. It incorporates all material from Version 1.0 that remains current, removes procedures that have since been retired, and documents the features introduced between July and September 2026. Where a procedure has changed, the change is stated explicitly so that agents trained on Version 1.0 are not left working from a superseded instruction.

Manager and administrator functions — user management, KPI configuration, campaign creation — are documented separately and are outside the scope of this handbook.

If any instruction here does not match the console as you find it, report it to your team lead. The console is under active development and this document must not be the thing that misleads you.

### Changes from Version 1.0

| Area | Change |
|---|---|
| Assigned list | **New.** The console now builds each agent a ranked daily contact list (Section 8) |
| Movement view | **New.** Brand performance day by day within the Changes tab (Section 13) |
| Campaigns tab | **New.** VVIP redeem code events (Section 14) |
| Cooling flag | **New.** Early churn warning for high-value players (Section 9) |
| Outcome recording | **Changed.** RECOVERED and NO_RESPONSE are now set automatically. Agents no longer mark recoveries themselves (Section 11) |
| SKIPPED status | **Retired.** No longer available |
| Tab count | Five tabs at v1.0; six at v2.0 |
| Player identity | Account ID displayed as the primary identifier, player name beneath it (Section 10) |
| Historical review | Date selection now available on all data tabs (Section 15) |

---

## Contents

1. Purpose and operating principles
2. System access
3. The console at a glance
4. The daily operating routine
5. Dashboard
6. The Daily tab
7. Priority bands and the worklist
8. The Assigned list
9. Classification framework
10. The player record
11. Recording outcomes
12. Contact playbook
13. Changes
14. Campaigns
15. Data governance and timing
16. Performance measurement
17. Glossary
18. Troubleshooting
19. Standards of work
    - Appendix A — Message templates
    - Appendix B — Quick reference

---

## 1. Purpose and operating principles

The VIP Retention Console identifies, each day, which high-value players require contact, which should be left alone, and what approach is appropriate for each.

### The principle of restraint

The department operates on a single governing principle: **restraint**.

A VIP player who receives a reward each time they go quiet learns to go quiet deliberately. Contact is therefore reserved for players showing genuine risk indicators — an approaching tier deadline, a significant loss, a funding obstruction, or a period of inactivity that is abnormal for that individual. All other players are left undisturbed.

**A decision not to contact is a legitimate and frequently correct action.** It is not inaction, and agents are not measured on volume of contact.

### Three standing rules

**1. PNL represents the player's net position.**
A negative figure indicates the player is down against the house. Such players are among the most valuable to retain. A negative PNL must never be interpreted as a negative indicator.

**2. A loss is never followed by a deposit request.**
Where a player has sustained a significant loss, communication is limited to relief and acknowledgement. "Win it back" framing is prohibited. This is a compliance requirement, not a stylistic preference.

**3. The queue order is authoritative.**
The console applies the department's prioritisation rules before the list reaches you. Targets are not selected at the agent's discretion.

---

## 2. System access

### Authentication

Access the console at the address issued by your team lead and authenticate with your assigned username and password. Sessions expire after eight hours.

### Browser requirements

**Google Chrome is the supported browser.** Agents should open the console directly in Chrome rather than following a link from within Lark, which opens an embedded browser in which clipboard functions and certain links do not operate.

**macOS users:** the shortcut ⌘⇧R activates Safari Reader mode, which removes page styling and disables all controls. If the console appears as unformatted text with no working buttons, press ⌘⇧R again to exit. The correct hard-refresh shortcut in Safari is ⌥⌘R.

### Account permissions

| Level | Capability |
|---|---|
| **Agent** | Full working access — assign, record outcomes, add notes and links |
| **View-only** | Read access only. A banner is displayed. Edit access is requested from a manager |

### Team scope

Agents are scoped to their own team's brands. The team is displayed in the console header (for example, `TEAM B · VIP RTN`). Players belonging to other teams are not visible. This restriction is enforced by the system and is intentional.

---

## 3. The console at a glance

| Tab | Function | Expected frequency |
|---|---|---|
| **Dashboard** | Portfolio position for the day | Start of shift |
| **Daily** | Primary workspace — the players requiring action | Throughout the shift |
| **Changes** | Day-over-day player movement, and brand performance by day | Once or twice daily |
| **Campaigns** | VVIP redeem code events | On campaign days |
| **Performance** | Individual and team scoring | Periodically |
| **Settings** | Password management | As required |

---

## 4. The daily operating routine

The following sequence is the department standard.

1. **Dashboard.** Establish the shape of the day — deposit direction, the size of the cold pile, and any brand not yet fed.
2. **Daily → Assigned.** Your ranked contact list is prepared. Begin here.
3. **Work the list from top to bottom.** The order reflects value and urgency.
4. **Record every contact** at the point of contact.
5. **Daily → Worklist** once the Assigned list is complete, working the priority bands in order.
6. **Leave HEALTHY and WATCH players undisturbed.** Where the guidance is to observe, observing is the required action.

---

## 5. Dashboard

The Dashboard is for orientation. Action is taken on the Daily tab.

### Summary cards

| Card | Interpretation |
|---|---|
| **Active VIPs** | Players in the pool who deposited or played |
| **Cold pile (7+)** | Players with no deposit for seven or more days. Growth here increases the weight of win-back activity |
| **Whales at risk** | Highest-value players currently cold or at an action level |
| **Deposits / Net flow / Player W/L** | The money position. A negative Player W/L indicates the house is ahead |
| **Deposit per active VIP** | Average top-up size, informing the level at which offers are pitched |

### Retention trend

Active depositors plotted against the cold pile over time. A brand selector and a 7 / 14 / 30-day range control are provided.

### Brand health

Per-brand summary ordered worst-first: player count, reach, active rate, cold count, deposits and net flow. Selecting a row charts that brand.

---

## 6. The Daily tab

The Daily tab provides four views of the same population.

| View | Purpose |
|---|---|
| **Worklist** | The guided queue, grouped into priority bands |
| **Table** | The same players in a sortable tabular format |
| **Contacted** | Players already actioned today, across the team |
| **Assigned** | Your prepared daily contact list (Section 8) |

### Brand cards

One card per brand within your team, showing player count, deposits and alert counts. Selecting a card filters the queue to that brand; selecting again clears the filter.

### Filters and tools

- **Brand** and **Class** selectors
- **All tiers / Tier 3 / Tier V**
- **My queue** — players assigned to you
- **0 dep this month** — players who have not funded at all in the current month
- **✈ On TG** — players reachable on Telegram
- **Search** — by username, UID or name
- **Export** — download the current filtered list

---

## 7. Priority bands and the worklist

The worklist groups players into bands by urgency, most urgent first. The uppermost band is **ACT NOW**, comprising tier deadlines, significant losses and cooling high-value players. These require personal handling on the day.

Each row displays the player, brand, tier and a single-line instruction describing the situation and required action.

Row indicators:
- **✈** — a Telegram or LiveChat link is held for this player
- **♛** — the player is classified as a whale

---

## 8. The Assigned list

The Assigned view provides each agent with a ranked daily contact list. It replaces discretionary target selection and is the recommended starting point for every shift.

### Eligibility

A player appears on an Assigned list only where all three conditions are met:

1. **A Telegram link is held.** Players we cannot reach are excluded.
2. **The player has been inactive for two or more days.** Active players are not disturbed.
3. **A maximum of fifteen players per agent per day.** The list is sized to be completed within a shift.

### Priority tags

| Tag | Definition | Required handling |
|---|---|---|
| **COOLING** | High-value player inactive 5–6 days | Highest priority. The final window before the player goes cold. Personal handling |
| **WHALE** | High-value player inactive 7+ days | High priority. Personal handling |
| **REACTIVATE** | Player inactive 7–29 days | The highest-scoring range for the reactivation KPI |
| **WATCH** | Player inactive 2–6 days | Light check-in |
| **CHURN** | Player inactive 30+ days | Lowest priority. Minimal effort |

### Row indicators

**Value** — the extent to which the player is down against the house. A larger figure indicates greater retention value. A **+** prefix with the figure greyed indicates the player is ahead of the house; such players remain worth a courtesy contact but are the lowest value on the list.

**Quiet** — days since the player's last deposit.

**Risk %** — churn probability derived from the individual player's own deposit rhythm. A player who ordinarily deposits every two days and has been inactive for six is at material risk; a player who ordinarily allows ten days between deposits is not. **A dash indicates that no rhythm model exists for that player.** This is expected for the majority of rows and is deliberate: the department does not display an estimated figure in place of a measured one. Where a dash is shown, assess using Value and Quiet.

### Working the list

1. Begin at the top and work downward without reordering.
2. **Message** opens the player's Telegram conversation.
3. Selecting the **row** opens the full player record.
4. Record the contact using the **✓** control on the row, or through the player record where a note is required.
5. Following contact, the control becomes **Chat**, retaining access to the conversation for follow-up.
6. The progress counter at the head of the list tracks completion.

### Contact cadence

Following contact, a player enters a **three-day rest period** and will not reappear on any list during that time. If the player remains inactive after the rest period, they return to the list. After **three unsuccessful contacts**, the player is parked and the slot is released to a more recoverable player.

---

## 9. Classification framework

Each player receives exactly one classification per day. Where more than one could apply, the higher-priority classification takes precedence.

| Class | Definition | Required action |
|---|---|---|
| **GRACE** | Tier expires within three days | Assist retention of the tier. A top-up request is appropriate |
| **TOP LOSS** | Among the day's largest losses on the brand | Relief only. No deposit request under any circumstances |
| **TOP DEPOSIT** | Deposited and winning today | Genuine recognition. Not a bonus |
| **DEP-BLOCKED** | Playing this week without funding, 7+ days since deposit | Measured funding enquiry. Check for a payment obstruction |
| **DSLD 30+** | No deposit for 30 or more days | Deep win-back. Lowest-cost incentive, no pursuit |
| **DSLD 14+** | No deposit for 14–29 days | Win-back. Relationship before incentive |
| **DSLD 7+** | No deposit for 7–13 days | Early win-back. Warm, low pressure |
| **WATCH** | Inactive 3–6 days | Observe. No contact. This is normal rhythm |
| **HEALTHY** | Active and funding | No action. Restraint is the required action |

*DSLD — Days Since Last Deposit. A higher figure indicates a colder player.*

### Supplementary flags

Flags apply in addition to a classification and modify how the player is handled.

**♛ WHALE** — a top-value Tier V player. Personal handling only. Generic or templated communication is not permitted.

**❄ COOLING** — a whale who is breaking their own established deposit rhythm, typically inactive 5–6 days. This is the department's earliest churn indicator and takes precedence within ACT NOW. Handling is a gentle check-in with no deposit request.

**FRAGILE** — a player who reactivated within approximately fourteen days. All communication is softened: a smaller ask, warmer tone, and no pressure.

---

## 10. The player record

The player record is opened by selecting any player and should be reviewed before any message is composed.

### Identity

The **account identifier** is displayed on the first line — the UID for most brands, and the username for LPK777, ACE33, JOM99, PP96, MY36, OMG67 and SPIN321. The **player's name** is displayed beneath it.

Use the name in communication with the player, and the account identifier for lookups in the back office.

### Memory hooks

Verified facts drawn from the player's record: tenure, lifetime deposits, typical deposit size, current month activity, last deposit, and recent tier movement. These exist so that communication can reference something accurate.

### History hooks

Available as history accumulates: the player's best winning day, largest single top-up, and the "withdrew, then went quiet" indicator.

### Approach angles

Two or three distinct openings appropriate to the player's situation. **These are starting points, not scripts.** Messages are composed by the agent in their own words, using the hooks above.

### Guard-rail warnings

Highlighted notices stating what is prohibited for this player. These must be read before composing.

---

## 11. Recording outcomes

**Every contact must be recorded.** A player who is messaged but not recorded is not counted — neither for the agent's performance nor the team's. Unrecorded work does not exist within the system.

### Methods

**The ✓ control on the row** — a single action recording CONTACTED against the agent. Appropriate for a straightforward send.

**The player record** — used where a note is to be added or a different outcome recorded.

### Status lifecycle

| Status | Set by | Meaning |
|---|---|---|
| **ASSIGNED** | Agent | In a queue, not yet contacted |
| **CONTACTED** | Agent | Contact has been made |
| **RESPONDED** | Agent | The player has replied |
| **RECOVERED** | **System** | Set automatically when the player deposits following contact |
| **NO_RESPONSE** | **System** | Set automatically where a contact remains unanswered after six hours |

> **Change from Version 1.0.** Agents previously marked RECOVERED manually. This is no longer the case. The system monitors deposits and attributes the recovery to the agent who made the qualifying contact. This ensures the save rate reflects actual outcomes and prevents recoveries being lost through unclosed records.
>
> The SKIPPED status has been retired and is no longer available.

### Additional record fields

- **Note** — a relationship fact that resurfaces at the next contact (for example, "prefers contact after 8pm")
- **Telegram link** — add or amend the player's chat link. Only valid `http(s)` addresses are accepted
- **Follow-up** — a date on which to revisit the player

---

## 12. Contact playbook

For each classification: approved openings, and the rules that may not be broken. Full templates are provided in Appendix A.

### GRACE — tier deadline within three days
**Openings:** a personal notification to assist in securing the tier; the specific deadline date and days remaining; framing as protection of benefits already held.
**Rule:** this is the sole classification in which a top-up request is appropriate. It is framed as retaining existing benefits.

### TOP LOSS — significant loss on the day
**Openings:** plain acknowledgement of a difficult session; relief already credited; an unconditional check-in.
**Rules:** relief framing only. "Win it back" is prohibited. No deposit request. No urgency or countdown language. **This is a compliance requirement.**

### TOP DEPOSIT — deposited and winning
**Openings:** genuine acknowledgement of the result; VIP recognition; a light invitation to continue.
**Rule:** recognition rather than reward. The objective is for the player to feel remembered, not paid.

### DEP-BLOCKED — playing without funding
**Openings:** a payment enquiry; an incentive held against their next deposit; acknowledgement that their play is noted.
**Rule:** the player has not left. This is a funding enquiry, not a win-back.

### COOLING — high-value player breaking their own rhythm
**Openings:** a quiet personal check-in; acknowledgement of the gap without emphasis; confirmation that nothing went wrong previously.
**Rule:** **no deposit request.** This is preventative contact. Introducing a financial ask confirms the player's reason to disengage.

### DSLD 7+ — early win-back
**Openings:** a light acknowledgement of absence; an incentive still held; an enquiry as to whether something went wrong.
**Rule:** warm and low-effort. The habit has only recently broken and must not be oversold.

### DSLD 14+ — win-back
**Openings:** reassurance that their standing is unchanged; a direct enquiry as to what caused the disengagement; making return effortless.
**Rule:** relationship first, incentive second.

### DSLD 30+ — deep win-back
**Openings:** an open door without pursuit; the lowest-cost incentive, unconditional; appreciation regardless of outcome.
**Rule:** budget is not to be spent in pursuit at this depth.

### WATCH and HEALTHY — no contact
No message is to be sent. A short quiet period is normal rhythm; contact at this stage teaches the player that inactivity produces reward. The system escalates these players automatically should the gap extend.

### Guard rails

| Guard rail | Applies to | Requirement |
|---|---|---|
| **Responsible Gambling** | TOP LOSS | Relief only. No "win it back". No countdowns |
| **FRAGILE** | Recently reactivated | Soften all communication. Reduced ask, no pressure |
| **WHALE** | Top-value Tier V | Personal handling only. No generic communication |
| **RESTRAINT** | WATCH / HEALTHY | No contact |

### Tiers and sign-off

**Tier V** — top VVIPs (levels 4–7). Personal, high-touch handling. Communication signs off as **Priority Support**.

**Tier 3** — VVIPs (levels 1–3). Lighter handling. Communication signs off as the **brand team**.

---

## 13. Changes

The Changes tab provides two views.

### Player changes

Day-over-day player movement: players who have cooled, reactivated, or crossed a classification threshold. This is the efficient method of identifying a high-value player going cold without reviewing the full queue.

### Movement

Brand performance presented day by day for a calendar month — one row per day, one column per brand.

**Metrics available:**

| Metric | Definition |
|---|---|
| **Deposit** | Total deposits for the day |
| **Net** | Deposits less withdrawals — the amount retained |
| **Active VIP** | Players who deposited that day |
| **Retention** | Players who have deposited this month as a proportion of the tier roster |

**Reading the display:**

- **Green / red** — movement against the same weekday of the previous week. This comparison is used because deposits follow a weekly cycle; comparing consecutive days produces false signals.
- **Grey arrow** — movement below 2%, treated as flat so that only material movement draws attention.
- **Outline** — the brand's highest and lowest day of the month.
- **Gold indicator** — figures identical to the previous day, indicating the brand's feed may not have refreshed. Treat as unconfirmed rather than genuinely flat.
- **Blank** — no data received for that brand that day. Never displayed as zero.

**Retention is treated differently.** It accumulates through the month and resets on the first, so no "best day" exists. Colour is applied against target — green at or above, red below. The final row shows the **month-end** figure, which is the month's retention.

A **Legend** control on the view provides this reference on screen.

---

## 14. Campaigns

The Campaigns tab manages VVIP redeem code events. On a campaign day the system allocates eligible players to code bands.

The agent's responsibilities are to release the allocated code to the player through the appropriate channel, and to mark any player who does not qualify.

**Codes are allocated per player. A code must never be issued to more than one player.**

Full procedure is documented in the Redeem Code Floor SOP.

---

## 15. Data governance and timing

**Daily feed.** Data arrives at approximately 15:00 MYT, with subsequent top-ups. Prior to this the console displays the most recent available snapshot.

**One-day lag.** The feed is always one day behind: today's snapshot carries yesterday's activity. Communication should therefore be framed as a check-in rather than a statement about the player's deposit behaviour. Where a player has in fact returned, a check-in remains appropriate; a demand does not.

**Assigned list timing.** The Quiet figure on the Assigned list is adjusted for the one-day lag and may therefore read one day higher than the DSLD shown elsewhere in the console. This is intentional.

**Monthly retention cycle.** Retention resets on the first of each month and accumulates. A figure of approximately 45% early in the month rising above 90% by month end is the normal cycle and does not indicate a problem.

**Stale and lag warnings.** Where a brand has not been fed, or its deposits are behind the other brands, a banner and indicator are displayed. That brand's inactivity list should not be relied upon until it refreshes.

**Historical review.** The date selector on each data tab permits review of previous days. Historical days are read-only; no action may be recorded against them.

---

## 16. Performance measurement

The Performance tab presents save rates and KPI scoring.

**Save rate = Recovered ÷ Actioned**, where Actioned comprises contacted, responded, recovered and no-response records. Assignments carrying no recorded outcome are excluded from Actioned. Recording every contact therefore ensures the save rate reflects actual work performed.

Breakdowns are provided by agent, by classification and by brand. A team retention scoreboard and a mistakes log feed the wider departmental KPIs.

---

## 17. Glossary

| Term | Definition |
|---|---|
| **VIP / VVIP** | High-value players within the retention programme |
| **Tier 3 / Tier V** | VIP levels — 3 = VVIP 1–3, V = top VVIP 4–7 |
| **DSLD** | Days Since Last Deposit |
| **PNL** | Player net position. Negative indicates the player is down against the house |
| **Whale (♛)** | A top-value Tier V player |
| **Cooling (❄)** | A whale breaking their own deposit rhythm — earliest churn indicator |
| **Fragile** | Reactivated within approximately fourteen days |
| **Cold** | No deposit for seven or more days |
| **Grace** | The period before a player's tier expires |
| **Brand** | An individual casino site |
| **Snapshot** | A single day's data |
| **✈** | A Telegram or LiveChat link is held |
| **Money zone** | Inactivity of 7–29 days, where reactivation scores highest |

---

## 18. Troubleshooting

| Symptom | Resolution |
|---|---|
| Today's data is not present | Data lands at approximately 15:00 MYT. Check the snapshot time in the header and select Refresh |
| A figure disagrees with the feeder | Select Refresh first. The header snapshot time indicates when your page loaded; data arriving after that will not be shown until you refresh |
| A brand shows STALE or LAG | That brand has not been fed or is behind. Work the other brands |
| Copy controls do not respond | You are likely in an embedded browser. Open the console in Chrome |
| The page displays as plain text and nothing responds | Safari Reader mode is active. Press ⌘⇧R to exit |
| No editing is possible | The account is view-only. Request edit access from a manager |
| Another team's players are not visible | Correct. Agents are scoped to their own team |
| A player has no Telegram link | Add one on the player record by entering the chat URL |
| Risk shows a dash for most players | Expected. A risk score is displayed only where a deposit rhythm is established. Assess using Value and Quiet |
| A classification appears incorrect | Classifications follow fixed rules applied to the current snapshot. Where data is stale the classification will lag until the feed refreshes |
| Should a HEALTHY or WATCH player be contacted? | No |

---

## 19. Standards of work

The following are the department's expectations of every agent.

1. **Open the Assigned list at the start of every shift.** The list is prepared in advance.
2. **Work the list in the order given.** The order reflects value and urgency.
3. **Record every outcome, without exception.** Unrecorded work is not counted.
4. **Never follow a loss with a deposit request.** This is a compliance requirement.
5. **Leave HEALTHY and WATCH players undisturbed.** Restraint is a deliberate action.
6. **Report anomalies promptly** — an incorrect link, a player who should not appear, a figure that does not reconcile. The system improves only where issues are reported.

The console exists so that agent effort is directed where it produces measurable retention. Applied as documented, performance follows.

**Winning Together! Growing Forever!**

---

# Appendix A — Message templates

These are examples for adaptation, not scripts for verbatim use. Text in `{curly braces}` is populated with the player's live data. Tier **V** is the more personal variant; Tier **3** is lighter. TOP LOSS is relief only and must never contain a deposit request.

### GRACE
- **Tier V:** "Hi {name}, this is [CS] from {brand}. Your VVIP status window closes on {graceDate} — you are {graceDays} day(s) from the deadline and very close to keeping it. I can help you lock it in today so every benefit stays protected. Tell me when you're ready and I'll handle it personally. — {signoff}"
- **Tier 3:** "{name}, your {brand} VIP status expires on {graceDate} ({graceDays} day(s) left). Top up before the deadline to keep your tier benefits active. — {signoff}"

### TOP LOSS *(relief only)*
- **Tier V:** "Hi {name}, [CS] here from {brand}. Rough session today — it happens to the best. No pressure at all: {aRebate} has been credited to your account as a cushion, yours whenever you feel like it. Take your time. — {signoff}"
- **Tier 3:** "{name}, your {brand} {rebateHook} has been credited — no conditions, it's yours. Whenever you're ready, we're here. — {signoff}"

### TOP DEPOSIT
- **Tier V:** "{name}, congratulations on a great run at {brand} today — genuinely well played. Winners get remembered here: I've flagged your account for VIP attention; anything you want arranged, tell me directly. — {signoff}"
- **Tier 3:** "Big day, {name}! {brand} luck looks good on you. Your {freeHook} is loaded — come see if the streak holds. — {signoff}"

### DEP-BLOCKED
- **Tier V:** "Hi {name}, good to see you playing at {brand} this week. Quick one — is everything okay on the deposit side? If there's any payment issue I can sort it out directly. I'm also holding a top-up reward for your next deposit. — {signoff}"
- **Tier 3:** "{name}, your luck is warming up at {brand} — top up today and grab a reward on your next deposit. Keep the streak alive. — {signoff}"

### COOLING *(no deposit request)*
- **Tier V:** "Hi {name}, this is [CS] from {brand}. I noticed it has been {dsld} quiet days — just checking in personally to make sure everything is good on your side. No pressure at all: if anything felt off last time, tell me and I will sort it directly. Your VIP benefits are fully active whenever you feel like it. — {signoff}"

### DSLD 7+ *(early win-back)*
- **Tier V:** "Hi {name}, this is [CS] from {brand}. We noticed you've been away {dsld} days — just checking everything is okay on your side. If anything didn't go smoothly last time, tell me directly and I'll settle it personally. Your VIP benefits are still active and your {freeHook} is waiting. — {signoff}"
- **Tier 3:** "Hi {name}, we miss you at {brand}! Your {freeHook} is still waiting for you. Come back anytime — we kept your spot. — {signoff}"

### DSLD 14+ *(win-back)*
- **Tier V:** "Hi {name}, [CS] from {brand} here. It's been {dsld} days and your seat is still yours — nothing has changed on our side. If something put you off last time, I'd honestly like to know so I can fix it. Your benefits remain active and your {freeHook} is ready when you are. — {signoff}"
- **Tier 3:** "{name}, it's been a while — {brand} kept your {freeHook} ready. One tap and you're back in the game. — {signoff}"

### DSLD 30+ *(deep win-back)*
- **Tier V:** "Hi {name}, [CS] from {brand}. It's been a long while and there's no pressure at all from us — the door stays open. If you ever feel like coming back, your {freeHook} is there and I'll look after it personally. Either way, thank you for the time you spent with us. — {signoff}"
- **Tier 3:** "{name}, it's been a long time — your {freeHook} at {brand} is still there if you want it. No rush, no conditions. — {signoff}"

---

# Appendix B — Quick reference

**Shift sequence**
Dashboard → Assigned → work top to bottom → record every contact → Worklist → bands in order

**Never**
- Follow a loss with a deposit request
- Send a generic message to a whale
- Contact a HEALTHY or WATCH player
- Leave a contact unrecorded

**Assigned tags, highest priority first**
COOLING → WHALE → REACTIVATE → WATCH → CHURN

**Classifications, highest priority first**
GRACE → TOP LOSS → TOP DEPOSIT → DEP-BLOCKED → DSLD 30+ → DSLD 14+ → DSLD 7+ → WATCH → HEALTHY

**Set by the agent:** ASSIGNED · CONTACTED · RESPONDED
**Set by the system:** RECOVERED · NO_RESPONSE

**Sign-off**
Tier V → Priority Support · Tier 3 → brand team

**Key timings**
Feed 15:00 MYT · one-day lag · three-day contact rest · three unsuccessful contacts then parked · fifteen players per agent per day

## Related

- [[CONSOLE_WALKTHROUGH]] — plain explainer
- [[MESSAGES_GUIDE]] — message library
- [[ACT_NOW_PRIORITY_SPEC]] — priority rule
- [[NOTICE_ASSIGNED_TAB]] — assigned list notice
- [[NOTICE_CONTACT_PARITY]] — fresh-first notice
