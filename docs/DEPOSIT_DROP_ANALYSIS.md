# Deposit-drop analysis — 1 Aug vs 2 Aug

**Brands:** LPK777 (3+V), JOM99 (3), MY36 (3+V), ACE33 (3+V), BM69 (V), VS96 (V), SK69 (3+V)
**Compared:** deposit on **1 Aug** vs **2 Aug**, per player, day-over-day.
**Date note:** our snapshot reflects the day before, so 1 Aug activity = snapshot `08-02`, 2 Aug = snapshot `08-03`. Run 2026-08-03.

---

## Headline

Deposits fell **RM 878k → RM 653k** from 1 Aug to 2 Aug — a **−26%** day. Of the 1,381 players who deposited on the 1st, **755 came down** on the 2nd (gross RM 473k). Here's why.

*(No month-boundary noise this time — "left the tier" is 0.4%, confirming that big chunk in the earlier report was purely the monthly reset, not real.)*

---

## Why deposits dropped — by reason

| Reason | Players | % players | RM dropped | % of drop |
|---|---|---|---|---|
| **Playing on balance — not funding** | 589 | 78.0% | 299,116 | **63.2%** |
| **Cashed out** (withdrew) | 30 | 4.0% | 53,982 | **11.4%** |
| **Heavy loss** — likely tapped out | 9 | 1.2% | 49,451 | **10.5%** |
| Quiet / between deposits (cyclical) | 108 | 14.3% | 40,606 | 8.6% |
| **Riding winnings** (money in account) | 16 | 2.1% | 27,859 | 5.9% |
| Left the tier (downgrade) | 3 | 0.4% | 2,023 | 0.4% |

---

## What each means, and the action

### 1. Playing on balance — not funding · **63% of the drop**
Still betting on the 2nd, just didn't top up. They're drawing down a balance, not leaving. **The single biggest and most recoverable group.** When the balance thins they either re-deposit or churn. **Action:** a timed reload nudge as the balance runs low — highest leverage.

### 2. Cashed out · 11%
Withdrew money on the 2nd (see the high `wd` values). Took profit/funds out. **Action:** normal after a win; watch they come back. Not churn unless it repeats.

### 3. Heavy loss — tapped out · 10.5% from just 9 players
Lost heavily on the 2nd and stopped funding. **Highest churn risk, high RM per head.** **Action:** personal CS, relief framing, never a deposit push — the responsible-gambling case.

### 4 & 5. Cyclical / Riding winnings
Cyclical = normal between-deposit gaps (day-over-day is noisy). Riding winnings = won and playing house money. Both low-priority; leave them.

---

## The whales to act on (top per reason, 1 Aug → 2 Aug)

### Heavy loss — tapped out (churn risk, handle gently)
| Brand·Tier | Player | Dep 1→2 Aug | Win/Loss | Withdrew | Still betting |
|---|---|---|---|---|---|
| LPK777·V | (removed) | 18,699 → 2,386 | −2,511 | 0 | 18,363 |
| MY36·V | (removed) | 6,970 → 2,750 | −1,637 | 700 | 49,187 |
| BM69·V | (removed) | 7,208 → 300 | −1,169 | 0 | 206,730 |
| LPK777·V | (removed) | 6,198 → 1,598 | −1,149 | 450 | 6,885 |

### Cashed out (withdrew — watch for return)
| Brand·Tier | Player | Dep 1→2 Aug | Win/Loss | Withdrew | Still betting |
|---|---|---|---|---|---|
| MY36·V | (removed) | 35,140 → 16,590 | +6,536 | 23,500 | 114,896 |
| SK69·V | (removed) | 18,890 → 12,000 | +40,126 | 33,500 | 112,321 |
| LPK777·V | (removed) | 8,400 → 2,000 | +7,950 | 9,998 | 8,436 |

### Playing on balance — not funding (the recoverable middle)
| Brand·Tier | Player | Dep 1→2 Aug | Win/Loss | Withdrew | Still betting |
|---|---|---|---|---|---|
| SK69·V | (removed) | 15,700 → 0 | −381 | 0 | 1,048 |
| LPK777·V | (removed) | 10,300 → 100 | −96 | 0 | 270 |
| MY36·3 | (removed) | 7,520 → 120 | −121 | 0 | 712 |

---

## Method
- **1 Aug** = daily_deposit on snapshot 08-02; **2 Aug** = snapshot 08-03. A player "dropped" if 2 Aug < 70% of 1 Aug.
- 2-Aug state (win_loss, withdraw, valid_bet) drives the reason label, in priority: left-tier → heavy loss (≤ −1,000) → cashed out (withdrew ≥ half prior deposit) → riding winnings (won ≥ 500, still betting) → playing-on-balance (still betting) → cold (7+ days) → cyclical.
- The full top-80 player list was removed from the repo before the AI Department handover (player data).

**Caveat:** day-over-day is inherently noisy (many players don't deposit daily), so "cyclical" is real slack, not loss. The reason labels are rule-based estimates; the player numbers are exact.

## Related

- [[ACT_NOW_PRIORITY_SPEC]] — priority rule
- [[HANDOFF]] — deep reference
- [[IDEAS]] — parked signals
