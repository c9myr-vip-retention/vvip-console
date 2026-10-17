# SESSION HANDOFF — 2026-06-19
For continuing in the **Claude Code Desktop App**. Open the project at `C:\Dev\groupb-tracker`.
This is just "where we left off" — full context lives in CLAUDE.md, HANDOFF.md, IDEAS.md, EXECUTED_IDEAS.md, KPI_ENGINE_FULL_SPEC.md.

## Where we are
Front-end work on the **Performance / KPI** tab. Already shipped (Stage 1a+1b): BaseKPI /100 scorecard,
per-agent breakdown, auto KPI Leaderboard, retention detail, Mistake Log → Discipline, Telegram CRM,
drawer redesign, Changes tab.

## Next task — NOT started, decision still OPEN
"Complete Performance + Team Challenge." The clear next spec item is **Stage 3 — Bonus Track**:
Reactivation + Growth + Discipline + FRT bonuses (unlock at BaseKPI > 75) → AddMarks →
**FinalKPI = BaseKPI + AddMarks**, per agent. Spec: `KPI_ENGINE_FULL_SPEC.md`.

Aldo hadn't yet picked the exact slice. Options on the table:
1. **Bonus Track → FinalKPI** — the main missing piece; mostly frontend. (Recommended next.)
2. **Auto reactivation count** from contact-log (anti-gaming: contact logged BEFORE redeposit).
3. **Polish the manual Team Challenge board.**

⚠ **Auto Team Challenge is BLOCKED** — it needs other teams' data (the parked 19-brand expansion).
Team Challenge stays a **manual board** for now.
Current code: `ManualBoard` component in `src/App.jsx` (~line 1491), endpoint `/api/rtn/kpi/challenge`.

## Just parked (detail in IDEAS.md, dated 2026-06-19)
- **Department rollout:** 19 brands, Teams A/B/C, ~20 users. Verdict: it handles it; only D1 storage
  grows (years, not weeks); fix = lazy loading + prune old snapshots. NOT a migration.
- **Access control REVERSED:** no team-walls (PICs back each other up; LiveChat is global). Permissions
  = edit vs view-only only.
- **LiveChat CRM** to replace Lark Base (300–500 chats/day, global pool) — its own module; real risk is
  double-handling, not load.

## Reminders for the next session
- This is **LIVE production**. Get approval before destructive SQL or any `wrangler deploy`.
- `--remote` on every `wrangler d1` command. Pages deploy → `--branch=production`.
- Talk to Aldo in plain English, concise, one step at a time, confirm before doing anything.

## Related

- [[HANDOFF]] — deep reference
- [[CLAUDE]] — operating rules
- [[EXECUTED_IDEAS]] — what shipped
- [[IDEAS]] — parked features
- [[KPI_ENGINE_FULL_SPEC]] — KPI engine spec
