# LAUNCH CHECKLIST — groupb-tracker
Everything to verify BEFORE officially launching the tracker to the team.
Owner: ATL · Keep in repo root. Check items off as done.

---

## 1. Data integrity (the foundation)
- [ ] Daily history stacking: `SELECT snapshot_date, COUNT(*) FROM player_days GROUP BY snapshot_date` — one row per day, no gaps since 2026-06-11
- [ ] All 6 brands × 2 tiers fed today (12 rows in the per-brand count query)
- [ ] Zero `.0` player_key artifacts (`player_key LIKE '%.0'` returns nothing)
- [ ] Spot-check 3 players end-to-end: numbers in dashboard == numbers in the Google Sheet (sheet → feeder → DB → screen)
- [ ] Zyra rows show UID, TC rows show username, everywhere (queue, worklist, drawer, export CSV)
- [ ] Sync clock shows correct MYT time after the 15:00 feed

## 2. Classification accuracy — Layer 1 audit (BEFORE trusting the classes)
- [ ] Pull 5 random players per class, verify each rule fired correctly against raw values:
  - GRACE: grace_end_date within 3 days
  - TOP LOSS: genuinely among top-20 daily loss for their brand
  - TOP DEPOSIT: deposit > 0 AND winning today
  - BLOCKED: valid_bet > 0, deposit = 0, DSLD ≥ 7
  - DSLD bands: last_deposit_date math is right
  - FRAGILE: group_name starts "Reactivated 1-6"
  - WHALE: Tier V + top-PNL quartile for their brand
- [ ] Worklist band sorting correct: biggest loss at top of ACT NOW, DSLD order in WIN-BACK
- [ ] PARKED FOR LATER: Layer 2 (save-rate divergence by class via Performance tab) and Layer 3 (30-day backtest: did at-risk players actually churn?) — run after ~30 days of history. Holdout group test per Logic Book when team is ready.

## 3. Feature QA (click everything once)
- [ ] Filters: Brand / Class dropdowns + clear chips + Clear sort all work and combine correctly
- [ ] Date selector: past date loads that day's real data, read-only banner shows, controls disabled, today fully actionable
- [ ] Worklist ↔ Table toggle: both views correct, nothing missing in either
- [ ] Drawer: approach text correct per class/tier/provider, Copy works, assign + status + note save, Clear/undo fully deletes the contact
- [ ] Clear/undo: cleared player vanishes from Performance counts
- [ ] Export: CSV downloads, clipboard list uses correct identity (UID for Zyra)
- [ ] My queue: filters to the logged-in CS's assignments only
- [ ] Performance tab: logged statuses appear under correct CS / class / brand
- [ ] Dashboard tab: KPIs, trend bars growing daily, lists populated
- [ ] Mobile / small-laptop check: table and worklist usable at smaller widths

## 4. Accounts & access
- [ ] CS accounts created (the Team B agents) as role=member, each tested login
- [ ] Each CS changed their starter password
- [ ] Settings (user management) hidden from members, visible to admin only
- [ ] PARKED: per-account edit permissions (IDEAS.md) — revisit when juniors onboard

## 5. Operations & safety
- [ ] Feeder triggers confirmed at 15:00 MYT on all 6 sheets (check trigger list in each Apps Script)
- [ ] STALE chip + banner verified (intentionally skip one feed in a test, or confirm logic visually)
- [ ] Rotate INGEST_TOKEN (it was typed into chat during setup) — `wrangler secret put INGEST_TOKEN` + update all 6 Script Properties
- [ ] Deploy commands documented and working: deploy:worker / deploy:pages (with the --branch=production fix applied or noted)
- [ ] Git: clean commit at launch state, tagged "launch" (`git tag launch`); rollback procedure understood
- [ ] Add `.gitignore` for node_modules/ and dist/ (keeps commits clean)

## 6. Team onboarding (people, not code)
- [ ] 15-min walkthrough with CS team: bands, classes, drawer flow (read approach → copy → contact → log status)
- [ ] The discipline rule communicated: EVERY contact gets a status — unlogged work doesn't count (Performance depends on it)
- [ ] RG guardrails explained: Top Loss = relief only, never "win it back"; Healthy/Watch = do not contact
- [ ] Legend (?) shown so nobody needs to memorize DSLD/PNL/Tier meanings

## 7. Launch day
- [ ] Morning-of: run the 3 health-check queries (section 1)
- [ ] Announce in team channel with the live URL + login reminders
- [ ] First week: ATL reviews Performance tab daily — checks logging discipline and early save-rate signal

## Related

- [[HANDOFF]] — deep reference
- [[DEPLOY]] — provisioning guide
- [[EXECUTED_IDEAS]] — what shipped
