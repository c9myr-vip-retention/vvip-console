# ACT NOW — Priority Spec

**Status: SHIPPED 2026-07-12.** ATL chose **days 5–6** (§5 option b). Cooling whales now flag as `_cooling` and sort to the TOP of ACT NOW, with a ❄ COOLING tag, a "gentle check-in, no deposit push" message, and the RESTRAINT guard suppressed. The filter-relative top-10 loss rule and the flat RM 2,000 threshold were **left as-is** (not removed) — revisit if desired.
**Date:** 2026-07-10 · Baseline snapshot: `2026-07-10` (Team B, 3,404 players)

---

## 1. The rule

> **PRIORITY = a whale who has not deposited for 6 days.**

One condition. Nothing else qualifies as priority.

**Why this one:**
- **Highest value** — a whale is, by definition, your most profitable customer.
- **Last reversible moment** — at day 7 he is cold (`DSLD7`). Today is the last day this is *prevention*; tomorrow it is *reactivation*, which is measurably harder.
- **Still reachable** — he hasn't left, he's drifting.

Everything else (grace deadlines, big losses today, whales at day 3–5) is *important*. It is not *priority*.

---

## 2. Definitions (as already implemented — do not redefine)

| Term | Definition | Source |
|---|---|---|
| `pnl` | Feeder value if present, else `lifetime_withdraw − lifetime_deposit`. **Negative = player has lost = high value.** | [App.jsx:154](../src/App.jsx#L154) |
| **whale** | `tier_segment === 'V'` **AND** `pnl < 0` **AND** `pnl <= whaleCut[brand]`, where `whaleCut[brand]` is that brand's **25th-percentile pnl** (most-negative quartile). Computed per brand, across all brands present. | [App.jsx:165](../src/App.jsx#L165), [App.jsx:176](../src/App.jsx#L176) |
| `dsld` | Days since last deposit = `days(last_deposit_date, snapshot_date)`. Null `last_deposit_date` → `dsld` is null. | [App.jsx:169](../src/App.jsx#L169) |
| **cold** | `dsld >= 7` (`DSLD7`/`DSLD14`/`DSLD30`) | [App.jsx:182](../src/App.jsx#L182) |

**Priority predicate:**
```
isPriority(r) = r._whale && r._dsld === 6
```

---

## 3. Critical implementation note

`_cls` **cannot** be used to find these players. Classification is first-match precedence
([App.jsx:177](../src/App.jsx#L177)): a whale at `dsld = 6` normally lands in `WATCH`, but if he also happens
to be among his brand's 20 worst losses today he becomes `TOP_LOSS` instead, and he'd be missed.

**Therefore `isPriority` must be an independent flag computed from `_whale` + `_dsld`, evaluated
regardless of `_cls`.** Same pattern as the existing `_whale` / `_fragile` flags.

---

## 4. Baseline numbers (2026-07-10, Team B)

| Segment | Count |
|---|---|
| **PRIORITY — whales at exactly 6 days** | **6** |
| Whales at 5 days | 8 |
| Whales at 3–4 days | 37 |
| All cooling whales (3–6 days) | 51 |
| Whales already cold (7+ days) | 83 |
| Total whales | 335 |

Cooling whales by brand (3–6d): ACE33 20 · JK32 12 · LPK777 6 · HOT321 5 · SK69 5 · BM69 2 · RM68 1.

**Note:** 83 whales have already slipped past the window. The 25/12/8/6 spread across days 3/4/5/6 is
**not a funnel** — it is four different groups on one day, not one cohort decaying. Drop-off rate is
unknown and must be measured (§7).

---

## 5. Risk: the one-day window is brittle

`dsld === 6` is a **single-day** window. Two ways a whale slips through silently:

1. **Feed lag.** `snapshot_date` is the *ingest* date, not the data date, and the feeder can lag
   (see memory `data-freshness-lag`). If a day is skipped, `dsld` can jump **5 → 7**, and the player
   never appears in PRIORITY at all.
2. **A missed working day.** If nobody clears the list that day, the window closes permanently.

**Mitigation options (ATL to choose):**
- **(a) Keep `dsld === 6`.** Purest rule. Accepts both risks. Requires the notification bell to alert.
- **(b) `dsld IN (5,6)`.** Same intent ("last chance before cold"), survives a one-day lag. Today: 14 players.
- **(c) `dsld === 6 OR (dsld === 7 AND never contacted while cooling)`.** Catches lag-skips, but blurs
  the prevention/reactivation line.

**Recommendation: (b).** It preserves the meaning of the rule and is robust to the lag we know exists.

---

## 6. Proposed band structure

Replaces the current `WL_BANDS` ([App.jsx:191](../src/App.jsx#L191)) / grouping ([App.jsx:983](../src/App.jsx#L983)).

| Band | Contents | Sort |
|---|---|---|
| **PRIORITY** | `isPriority` only | pnl ascending (most valuable first) |
| **ACT NOW** | GRACE (`graceDays <= 3`) + whale who lost big today | GRACE by soonest deadline, then loss size |
| **PREVENT** | whales at `dsld` 3–4 (or 3–5 if §5(b) chosen) | `dsld` descending |
| **TODAY** | remaining `TOP_LOSS` / `TOP_DEP` / `BLOCKED` | amount descending |
| **WIN-BACK** | `DSLD7` / `DSLD14` / `DSLD30` | `dsld` descending, then pnl |
| **NO ACTION** | `WATCH` / `HEALTHY` | pnl ascending |

### Rules being deleted (and why)

1. **`isActLoss` top-10 rule** ([App.jsx:966](../src/App.jsx#L966)) — `bigLoss` is computed from the
   **currently filtered list**, so ACT NOW membership changes when you click a brand filter. Priority must
   be a property of the player, not of the view. Also a fixed "10" does not scale to 19 brands / 3 teams.
2. **Flat `RM 2,000` whale-loss threshold** — RM 2,000 at JK32 is not RM 2,000 at LPK777. Replace with a
   per-brand threshold (e.g. a multiple of that brand's median daily deposit), or drop the rule and keep
   only `_whale`.
3. **"Deadlines & big losses" label** — shows when zero deadlines exist (today: 0 grace players; the nearest
   grace date team-wide is **2026-07-31**). Label should reflect actual contents.

---

## 7. Must be measured before trusting this

We do **not** know whether contacting at day 3 saves more whales than at day 5 or 6. Nobody does. With 30 days
of `player_days` history (from 2026-06-11) this is answerable:

> For each whale who reached `dsld = N`, did he deposit again within 14 days — and did a contact at day `N`
> change that rate versus no contact?

Run this **before** hard-committing the day-6 threshold. If the save rate at day 3 is materially higher,
PRIORITY should move earlier and this spec's core number changes.

---

## 8. Out of scope

- Message templates / `buildApproach` — unchanged.
- `classifyAll` precedence — unchanged. PRIORITY is a flag layered on top, not a new class.
- Auto-outcome windows (`autoOutcomes`) — unchanged. See HANDOFF §3.

---

## 9. Open questions for ATL

1. §5 — pick (a) strict day 6, (b) days 5–6 *(recommended)*, or (c) lag-catching variant.
2. Should PRIORITY respect the team wall (an agent sees only his brands), or is it team-wide?
3. Keep the "whale lost big today" rule in ACT NOW, and if so with what per-brand threshold?
4. Run the §7 measurement first, or ship the split now and measure after?

## Related

- [[HANDOFF]] — deep reference
- [[AUTO_ASSIGN_PLAN]] — who-to-contact list
- [[DEPOSIT_DROP_ANALYSIS]] — deposit-drop study
- [[AGENT_HANDBOOK]] — agent workflow
