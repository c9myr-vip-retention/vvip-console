# KPI ENGINE — FULL SPEC (Base + Bonus + Team Challenge)
For groupb-tracker · the complete Team B KPI computation engine, staged by data-availability.
Status: SPEC LOCKED. Supersedes/absorbs KPI_RETENTION_TRACKER_PLAN.md + KPI_SCORECARD_BUILD_PLAN.md.
Companion to HANDOFF.md.

================================================================
## THE COMPLETE FORMULA CHAIN (from the May per-agent sheet)

Per agent:
  BaseKPI  = T3Score + TVScore + GrowthScore + FRTScore + DisciplineScore   (max 100)
             (15      + 15      + 20          + 30       + 20)
  AddMarks = ReactivationMarks + GrowthPush + DisciplineBonus + SpeedBonus   (bonus layer)
  FinalKPI = BaseKPI + AddMarks
  (Payout % maps from FinalKPI — DEFERRED, not built for now.)

Bonus track ("Extra KPI", unlocked only when BaseKPI > 75):
  | Bonus           | Weight | Bands                                            |
  |-----------------|--------|--------------------------------------------------|
  | Reactivation    | 8%     | 1 plyr=2 · 2=4 · 3=6 · ≥4=8                       |
  | Deposit Growth  | 6%     | ≥12%=2 · ≥15%=4 · ≥20%=6                          |
  | Discipline Bonus| 4%     | 0 mistakes=4 · 1=2 · ≥2=0                         |
  | FRT Bonus       | 2%     | <5s=2 · ≥5s=0                                     |

================================================================
## BASE KPI — band tables (points = actual KPI points; editable config)
FRT (sec):        ≤10→30 · 11→25 · 13→20 · 15→10 · >15→0
Discipline (mist):0–2→20 · 3–4→15 · 5–6→10 · 7–8→5 · >8→0
Deposit Growth %: ≥30→20 · 25–29.99→15 · 15–24.99→10 · 6–14.99→5 · <5→0   (target ≥10)
Tier 3 Ret %:     ≥95→15 · 93–94.99→12 · 91–92.99→8 · 89–90.99→4 · <89→0   (target ≥92)
Tier V Ret %:     ≥97.5→15 · 95.5–97.49→12 · 93.5–95.49→8 · 91.5–93.49→4 · <91.5→0 (target ≥94.5)

================================================================
## FORMULAS (locked)
Retention (month-end final; show live projection during month):
  tier ret % = (tier players with ≥1 deposit this calendar month) / (total players in tier)
  ⚠ POOL IS PER-BRAND. "total players in tier" = that brand's tier pool, and it MUST match the
    website player pool for that brand (e.g. LPK777 T3=500 / TV=169 on 2026-06-15). Compute each
    brand's ret % against its own pool, then roll up to the team — never one flat team-wide pool.
    Team totals on 2026-06-15: T3=2,156 · TV=628 (sum of all 6 Group B brands).
Deposit Growth (MoM):
  growth % = (this_month_total − last_month_total) / last_month_total
  ⚠ last_month_total = MANUAL input until a full prior month is stored (history began 2026-06-11).

================================================================
## DATA SOURCES PER METRIC — and readiness
| Metric            | Source                          | In website now? |
|-------------------|---------------------------------|-----------------|
| Tier 3 / Tier V   | Retention Report (player_days)  | ✅ AUTO now (pool PER-BRAND, matches website) |
| Deposit Growth    | player_days (MoM)               | ✅ AUTO (last-mo manual) |
| FRT               | LiveChat report                 | ⛔ MANUAL entry  |
| Discipline/mistakes| Lark Base today → tracker later| ⛔ NOT in site yet (planned) |
| Reactivation (per agent)| contact-log ownership      | ⛔ NOT wired/finished yet |

================================================================
## STAGING (build in order data becomes available — do NOT build ahead of the data)

### STAGE 1 — TEAM-LEVEL BASE KPI  (BUILDABLE NOW)
- Auto: Tier 3, Tier V, Deposit Growth (team aggregate).
- Manual: FRT, Discipline (team-level entry).
- Output: BaseKPI /100 at team level, banded + color-coded, auto-updating daily.
- Editable band/target config. Month selector. "Tracking since" note for partial months.
- THIS REPLACES the manual Retention Rate Saver sheet. Immediate win.

### STAGE 2 — PER-AGENT BREAKDOWN  (build when mistake-log + contact-log live in site)
- Requires: (a) mistake logging moved into the tracker, (b) contact-log/reactivation ownership live.
- Then split metrics per CS (Raven, Skylar, Brix, Jason, Trevor):
  each agent's T3/TV/Growth (shared team values) + own FRT + own Discipline → BaseKPI per agent.
- Output: per-agent BaseKPI table (like the May sheet).

### STAGE 3 — BONUS TRACK + TEAM CHALLENGE  (build after per-agent works)
- Extra KPI: 4 bonus metrics (>75 unlock) → AddMarks → FinalKPI per agent.
- Reactivation bonus auto from contact-log; Growth/Discipline/FRT bonus from same inputs as base.
- Team challenge: aggregate team score vs other teams (Team B was 2nd in May: 80.08 vs Team C 84.30).
- (Payout % mapping still deferred unless requested.)

================================================================
## BUILD ORDER — STAGE 1 (next session)
1. Worker route (read-only): team Tier3 %, TierV %, this-month deposit total for a given month.
2. Tables: kpi_config (bands/weights/points, editable) + kpi_month (manual fields: FRT, Discipline,
   last_month_total).
3. Settings: edit config; per-month form for manual inputs.
4. Scorecard view: 5 metrics → band + points → BaseKPI /100, color-coded, month selector.
5. VERIFY auto numbers vs the manual sheet (allow June 1–10 gap).

================================================================
## RISKS / NOTES
- Build to the data: Stages 2–3 depend on features not yet in the site (mistake-log, contact-log).
  Building them early = empty dashboards. Stage 1 is the only fully-fed layer today.
- Retention locks month-end but shows live projection — label "live vs final" clearly.
- Keep ALL band/target/weight values as EDITABLE config — they change monthly; never hardcode.
- Deposit Growth last-month total is manual until a full prior month is in history.
- All KPI queries month/date-scoped + aggregated worker-side — never load all history to browser.
- Per-agent reactivation integrity: a real recovery = contact logged BEFORE the redeposit (anti-gaming).

## Related

- [[KPI_NEXT_SESSION_CHECKLIST]] — numbers to confirm before build
- [[HANDOFF]] — deep reference
- [[performance_competition]] — cross-team challenge
- [[Team B Daily Leadership Alignment 2 July]] — leader daily report
