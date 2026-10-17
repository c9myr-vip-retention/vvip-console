# KPI BUILD — NEXT SESSION CHECKLIST
Bring these CONFIRMED numbers so Stage 1 can be built + the exact gap math computed.
Source of truth for the build = KPI_ENGINE_FULL_SPEC.md

================================================================
## NUMBERS TO CONFIRM BEFORE BUILD

### A. Current tier populations (per brand — must match the website player pool)
Pools are PER-BRAND, not one flat team number. Roll up to the team by summing brands.
Live snapshot (2026-06-15) from player_days — confirm still current before each build:

  | Brand   | Tier 3 | Tier V |
  |---------|-------:|-------:|
  | ACE33   |   860  |  255   |
  | LPK777  |   500  |  169   |
  | SK69    |   222  |   45   |
  | RM68    |   210  |   52   |
  | HOT321  |   207  |   71   |
  | BM69    |   157  |   36   |
  | TEAM    | 2,156  |  628   |

- [ ] Confirm per-brand pools above still match the website.
  (Old "336 / 127" figure was wrong — a single outdated brand sheet, not the team total.)

### B. This month's retention (pull from tracker / confirm)
- [ ] Tier 3 retention % now: ______
- [ ] Tier V retention % now: ______

### C. Deposit numbers
- [ ] MAY total deposit (last month): RM ______  (from May scorecard — needed for Growth %)
- [ ] This month's deposit so far (MTD): RM ______

### D. This month's TARGETS (confirm current)
- [ ] Tier 3 target: ______ (scorecard: ≥92%)
- [ ] Tier V target: ______ (scorecard: ≥94.5%)
- [ ] Deposit Growth target: ______ (scorecard: ≥10%)
- [ ] Monthly deposit target RM (if used): RM ______

### E. Manual KPI inputs (team-level, for Stage 1)
- [ ] Team FRT (seconds): ______
- [ ] Team Discipline (mistake count): ______

================================================================
## WHAT GETS COMPUTED ONCE A–E ARE CONFIRMED
- Exact retention gap in PLAYERS: need_comeback = ceil(total × target%) − current_comeback
- Deposit Growth % = (this_month − may_total) / may_total → band + points
- BaseKPI /100 = T3 + TV + Growth + FRT + Discipline points
- "How many more comebacks to clear target" per tier (the actionable number for the team)

================================================================
## BUILD (Stage 1, next session — team-level Base KPI)
Per KPI_ENGINE_FULL_SPEC.md build order:
1. Worker read-only route: team Tier3 %, TierV %, this-month deposit total for a given month.
2. Tables: kpi_config (editable bands/weights/points) + kpi_month (manual: FRT, Discipline, last_month_total).
3. Settings: edit config + per-month manual input form.
4. Scorecard view: 5 metrics → band + points → BaseKPI /100, color-coded, month selector.
5. Verify auto numbers vs the manual Retention Rate Saver sheet (allow June 1–10 history gap).

================================================================
## DOC HYGIENE (done)
- KPI_ENGINE_FULL_SPEC.md = the ONE source of truth.
- KPI_RETENTION_TRACKER_PLAN.md + KPI_SCORECARD_BUILD_PLAN.md = SUPERSEDED. Archive/delete so
  Claude Code doesn't read three overlapping KPI docs.

## Related

- [[KPI_ENGINE_FULL_SPEC]] — source-of-truth spec
- [[HANDOFF]] — deep reference
