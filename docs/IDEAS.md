# IDEAS.md — parked features & future ideas

Features designed (some already built) but kept **out of the live system** for now. Base system
first, then add these one at a time. Ask me anytime to surface this list or re-prioritize it.

**Status:** 💡 idea · 🔨 built & tested locally, parked (not deployed) · ✅ shipped (remove once live)
**Priority:** ⭐ high · ◐ medium · ○ later
**Ready?** ✅ buildable now · ⏳ needs more accumulated daily history (per-player baselines) first

---

## At a glance — most important first

| # | Idea | Priority | Effort | Ready | Status |
|---|------|----------|--------|-------|--------|
| 1 | Per-brand drill-down (Dashboard) | ⭐ | M | ✅ | 💡 |
| 2 | Access control — per-account edit permission | ⭐ | L (worker+db+pages) | ✅ | 💡 |
| 3 | At-Risk headline KPI (Dashboard) | ⭐ | S | ✅ | 💡 |
| 4 | "Day Overview" class strip (Daily tab) | ◐ | S (pages only, code ready) | ✅ | 🔨 |
| 5 | Participation % / "Active Yesterday" | ◐ | S | ✅ | 💡 |
| 6 | Alerts page — churn warning signs | ◐ | L | ⏳ | 💡 |
| 7 | Deposit drop % / rise % alerts | ◐ | M | ⏳ | 💡 |
| 8 | 7-day reporting window (Dashboard) | ○ | M | ⏳ | 💡 |

*Ready:* ✅ = can build today · ⏳ = waiting on accumulated daily history (started 2026-06-11) so each
player has a baseline to measure against.

---

## 1. ⭐ Per-brand drill-down (Dashboard) — biggest gap

Click a single brand (LPK777, RM68, …) to view that brand's numbers in isolation. Today the Dashboard
pools everything as "Group B"; there's no way to assess one brand on its own. The data already exists
per row (`brand`), so this is a brand selector + filtering on the Dashboard. Frontend-only (`App.jsx`).

## 2. ⭐ Access control — per-account edit permission

Goal: let the master admin control who can edit the action log, to stop junior staff from changing or
manipulating contact data.

- Per-ACCOUNT permission (not just per-role): when creating a user, the master admin sets whether that
  account can edit the action log (assign / status / note / clear) or is view-only.
- Editable anytime: admin can toggle a user's edit permission later from the Settings user list,
  without deleting/recreating the account.
- Use case: senior staff get edit rights; junior staff are view-only — they see the queue but can't write.
- Simpler first step if wanted: role-based (all admins edit, all members view-only) needs no schema
  change; the per-account version below is the fuller form.

Build notes (when revisited):
- Touches all three layers: database (add an additive `can_edit` column to the users table), worker
  (enforce on /api/rtn/contact and any write route — reject writes from non-permitted accounts
  server-side, not just hidden buttons), and frontend (Settings toggle + greyed-out action controls for
  view-only users).
- Safety rules: additive schema only (never drop/rebuild the users table); default `can_edit = true` for
  all existing accounts so nothing breaks on deploy; ADMINS ALWAYS CAN EDIT regardless of the flag (so
  the master admin can never lock themselves out).
- Reuse the live past-date read-only UI (disabled controls + banner) for the view-only state.
- Risk level: highest-complexity change so far (3 deploys: worker + d1 + pages). Commit before building.

## 3. ⭐ At-Risk headline KPI (Dashboard)

Promote inactive high-tier players to a top-line Dashboard number (e.g. "Whales at risk: N"). The data
already exists (DSLD + whale logic in `classifyAll`); it just isn't surfaced as a headline. Low effort,
frontend-only.

## 4. ◐ "Day Overview" class strip on the Daily tab  🔨 built, parked

**What it is:** a compact summary above the player table. One thin line per class
(color dot · class label · plain-English meaning · count), collapsed by default — about six
lines you can scan in one glance to see the shape of the day. Click a line to expand its top 10
players inline (with a "Show all / Show less" toggle), click again to collapse. A
"DAY OVERVIEW — click a band to expand" label marks it as a summary, not a second filter.

**Why it's useful:** a first-time user can see the day at a glance and jump straight to a player,
without learning the dropdown filters first.

**How it behaves:** it does not replace the Class dropdown — the dropdown stays the filter, the
strip is just a scannable overview. Both read the same filtered/searched player set, so they always
agree. The full sortable table, filters, search, My queue, Export, and Clear sort are untouched.

**Also covers** the "player classification grouping view" idea (class cards, top 10 first with a
Show-more expand, each player appearing in exactly one class). That is this same feature.

**Status:** fully built and it compiles. Not deployed. The complete implementation is saved below so
it can be re-applied exactly, whether or not it currently sits in `src/App.jsx`.

### Implementation (all inside the `Queue` component in `src/App.jsx`)

**a) State** (with the other `useState` lines near the top of `Queue`):
```jsx
const [openCls, setOpenCls] = useState({});       // { [classKey]: true } = band expanded (rows visible)
const [showAllCls, setShowAllCls] = useState({}); // { [classKey]: true } = open band showing all rows vs top 10
```

**b) Grouping** (a `useMemo`, placed right after the `counts` memo):
```jsx
// One bucket per class, in priority order, built from the SAME filtered+sorted list as the table.
// Each player lands in exactly one bucket (their _cls). Empty buckets are dropped.
const sections = useMemo(() => {
  const groups = {}; CLASS_ORDER.forEach((k) => (groups[k] = []));
  filtered.forEach((r) => groups[r._cls]?.push(r));
  return CLASS_ORDER.map((k) => ({ key: k, rows: groups[k] })).filter((s) => s.rows.length > 0);
}, [filtered]);
```

**c) Markup** (placed just above `<div className="tbl-wrap">`):
```jsx
{sections.length > 0 && (
  <div className="overview">
    <div className="overview-label">DAY OVERVIEW — click a band to expand</div>
    {sections.map(({ key: k, rows }) => {
      const open = !!openCls[k];
      const all = !!showAllCls[k];
      const shown = all ? rows : rows.slice(0, 10);
      return (
        <div key={k} className="ov-band" style={{ "--cc": CLASSES[k].color }}>
          <div className="ov-head" onClick={() => setOpenCls((o) => ({ ...o, [k]: !o[k] }))}>
            <span className="ov-caret">{open ? "▾" : "▸"}</span>
            <span className="chip-dot" style={{ background: CLASSES[k].color }} />
            <span className="ov-label" style={{ color: CLASSES[k].color }}>{CLASSES[k].label}</span>
            <span className="ov-desc">{CLASSES[k].desc}</span>
            <span className="ov-count mono">{rows.length}</span>
          </div>
          {open && (
            <div className="ov-body">
              {shown.map((r) => {
                const con = contactMap[ckey(r)];
                return (
                  <div key={ckey(r)} className="sec-row" onClick={() => setSelIdx(filtered.indexOf(r))}>
                    <span className="b-dot" style={{ background: BRANDS[r.brand]?.p }} />
                    <span className="sec-name">
                      <div className="pname">{dispName(r)}</div>
                      <div className="psub">{r.brand} · Tier {r.tier_segment}{r._fragile ? " · FRAGILE" : ""}{r._whale ? " · ♛" : ""}</div>
                    </span>
                    <span className="sec-meta mono">DSLD {r._dsld ?? "—"}</span>
                    <span className="sec-meta mono">{fmtRM(r.daily_deposit)}</span>
                    {con?.status
                      ? <span className="st-tag" style={{ "--sc": ST_COLOR[con.status] }}>{con.status.replace("_", " ")}</span>
                      : con?.assigned_to
                      ? <span className="st-tag" style={{ "--sc": "#A78BFA" }}>{con.assigned_to}</span>
                      : null}
                  </div>
                );
              })}
              {rows.length > 10 && (
                <div className="sec-more">
                  <button className="btn-ghost" onClick={() => setShowAllCls((s) => ({ ...s, [k]: !s[k] }))}>
                    {all ? "Show less" : `Show all ${rows.length}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
)}
```

**d) Drawer wiring** — for a row beyond the table's visible 200 to still open, the drawer list is the
full filtered set:
```jsx
// change: list={filtered.slice(0, limit)}  ->  list={filtered}
<Drawer list={filtered} index={selIdx} setIndex={setSelIdx} ... />
```

**e) Styles** (in the `<Style>` block, near the `.more` rule). Note the `.sec-row` / `.sec-name` /
`.sec-meta` / `.sec-more` rules are reused by the band body:
```css
.overview{display:flex;flex-direction:column;gap:6px;margin-bottom:18px}
.overview-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:2px}
.ov-band{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--cc);border-radius:9px;overflow:hidden}
.ov-head{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer}
.ov-head:hover{background:#161C28}
.ov-caret{color:var(--dim);font-size:11px;width:10px;text-align:center;flex-shrink:0}
.ov-label{font-size:12px;font-weight:700;letter-spacing:.06em;white-space:nowrap;flex-shrink:0}
.ov-desc{font-size:12px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ov-count{margin-left:auto;font-size:12px;font-weight:600;color:var(--txt);background:var(--panel2);border:1px solid var(--line);padding:1px 10px;border-radius:20px;flex-shrink:0}
.ov-body{display:flex;flex-direction:column;border-top:1px solid var(--line)}
.sec-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #1B2130;cursor:pointer}
.sec-row:last-child{border-bottom:none}
.sec-row:hover{background:#161C28}
.sec-name{flex:1;min-width:0}
.sec-meta{color:var(--dim);font-size:12px;white-space:nowrap}
.sec-more{padding:10px 14px;text-align:center;border-top:1px solid #1B2130}
```

## 5. ◐ Participation % / "Active Yesterday"

A single-number daily health pulse: what fraction of VVIPs actually played. The Dashboard doesn't
surface this today. Small Dashboard addition (uses `is_mau` / daily activity; "Active Yesterday" needs
the prior day's snapshot, which now exists).

## 6. ◐ Alerts page — churn warning signs  ⏳ needs history

A dedicated Alerts page highlighting high-value players showing warning signs — deposit drop %, deposit
rise %, sudden inactivity — so the team can act on prevention or reactivation before churn. Activates
fully once daily history accumulates per-player baselines.

## 7. ◐ Deposit drop % / rise % alerts  ⏳ needs history

Measured against each player's OWN baseline (not a flat threshold). Feeds the Alerts page (#6). Requires
accumulated daily history to compute baselines.

## 8. ○ 7-day reporting window (Dashboard)  ⏳ needs history

Frame Dashboard numbers against the last week rather than today only. Becomes meaningful once ~7+ days
of daily history have accumulated.

---

## Future ideas (add detail as they come up)

- **Department-wide rollout (19 brands · Teams A/B/C · ~20 users)** — capacity analysis + access-control reversal. See section below. Parked 2026-06-19.
- **LiveChat CRM module** (replace Lark Base · 300–500 chats/day · global pool) — see section below. Parked 2026-06-19.

---

## Useful functions & logic — roadmap (added 2026-06-13)
Sorted by when they become buildable. The recurring theme: the tool is currently a "today" tool; the high-value upgrades are all "over time" features that unlock as player_days history accumulates (history started 2026-06-11; meaningful at ~14–30 days).

### Works on a single day — buildable now / pre-launch
- **Delta view ("what changed since yesterday")** — morning feed of what's new: newly entered grace, newly gone cold, new tier drops. Turns "here's everyone" into "here's what needs attention today." Day-over-day works as soon as there are 2 snapshots.
- **Bulk actions** — assign many players (e.g. 30 win-backs) to one CS in a single action instead of one-by-one. Saves floor time at volume.
- **Notes history per player** — stop overwriting the contact note; keep a running log so "we tried X last week, no response" is visible. Institutional memory; prevents repeating failed approaches.
- **Auto-refresh / "new data" nudge** — banner when the 15:00 feed lands ("new data available — refresh") so the floor stays on current data.

### Needs accumulated history — Phase 2 (build at ~day 14–30)
- **Player history / timeline view** — click a player → see their last ~30 days as a mini-chart/trajectory ("deposited daily for 3 months, then stopped 5 days ago"). Biggest missing capability; data already accumulating.
- **Deposit drop / rise % alerts vs the player's OWN baseline** — flag a player who normally deposits RM5,000/day dropping to RM200, before DSLD even fires. Catches silent churn. Needs ~2 weeks of baseline.
- **Behavior-sequence classification (Book Phase 2 cards)** — the real intelligence: detect patterns over time — Payday Cycler (deposits around salary days), Acute Churn cliff (sudden stop after steady play), Decelerating Fade (slowly pulling away), etc. Computes day-code sequences from history → writes behavior_class. This is what makes the tool predictive (who's ABOUT to churn) rather than reactive. Needs accumulated history.

Note: do NOT build the history-dependent items early — with <2 weeks of data they show nothing useful. Let history stack, then layer them in as the killer Phase 2.

---

## Department-wide rollout — 19 brands · Teams A/B/C · ~20 users (parked 2026-06-19)

Leadership wants this console across the whole department: **19 brands total**, split into
**Team A / B / C**, ~**20 users**. Parked until the front-end (Performance / KPI) is finished.
Analysis captured so it isn't lost.

### Capacity verdict — "will it get slow / fill up?"
- **Pages.dev (host):** non-issue. Static files from a CDN; 20 users is nothing; stays fast & free.
- **Worker (API):** non-issue. 20 users is a tiny request volume.
- **D1 (database):** the only thing that grows. 19 brands ≈ **3× rows/day** (~1–1.5 GB/year vs a
  ~10 GB limit) → **years, not weeks**. When it ever bites, the fix is **prune / archive old daily
  snapshots**, NOT migrate to another platform.
- **The one real slow-down risk:** the app loads the WHOLE snapshot in one call and classifies it
  client-side. At 19 brands that single load is ~3× heavier. Fix = **lazy loading** (load a light
  summary / the user's brands first; fetch a brand's full rows only when clicked).

### Access-control decision — REVERSES earlier idea #2
Earlier plan was team-walls (each user sees only their team) as BOTH security and a load-saver.
**The real workflow kills team-walls:**
1. PICs **back each other up across teams** on rest days — a wall would block the backup.
2. The LiveChat function (below) is a **global pool** — every PIC serves any incoming chat.

So: **everyone can SEE all brands.** Permissions are redefined as **edit vs view-only** (security
only), NOT per-team visibility. Load is solved by **lazy loading**, not by walling off teams.
(Idea #2 stands but redefined: per-account *edit* permission, not per-team *visibility*.)

## LiveChat CRM module — replace Lark Base (parked 2026-06-19)

Plan: this console eventually **replaces Lark Base** for logging LiveChat engagement —
**~300–500 incoming chats/day**, handled by ~20 PICs from a **shared/global pool** (any PIC takes
any chat, not team-by-team).

- **Volume is SMALL for a database** (~1 chat/min). Server load is NOT the concern — Lark handles it;
  D1 handles it far more easily.
- **Real risk = correctness, not load:** (a) stop two PICs grabbing the **same** chat (a "claim this
  chat" lock); (b) new chats **appear live** for whoever's free (a simple poll-every-few-seconds is
  enough at this volume — no WebSockets needed).
- **Treat it as its own module** (own `chats` table + own screen) sharing the same login + database —
  NOT bolted onto the retention page. Different data, different rhythm.

### Knock-on: auto Team Challenge is blocked until the teams are in the system
The KPI **Team Challenge** can only become *automatic* (your team vs other teams) once the other
teams' brands live in the system (this expansion). Until then it stays a **manual board**.

---

## VVIP Redeem Code — measurement ideas (parked 2026-07-18)

Raised while designing the Campaigns module. **Not needed for v1** — parked deliberately. But the
storage decisions below are NOT optional: skip them and every question here becomes permanently
unanswerable, because the raw data will never have existed.

### ⏳ 1. Incremental lift — did the code CAUSE the deposit? ⭐
Claim rate flatters the campaign: it counts players who would have deposited that day anyway.
Compare event-day deposit rate against **the same players' own baseline** on non-event days
(38 days of `player_days` history already available, so this is computable without waiting).
Illustration of the shape: 13.4% deposit on event day vs 9.1% on a normal day → only **4.3pts is
real lift**, which turns "RM15 per claim" into ~RM48 per *incremental* deposit. **This is the only
number that says whether the promo is worth running at all** — and it may well look worse than the
headline. Ready now.

### ⏳ 2. Claim rate by how long the player was quiet ◐
Cross the claim result against `last_deposit_date` / DSLD. If claims concentrate in already-active
players and the 30-day-cold ignore the offer, the campaign is paying for deposits you'd get free
while missing the players it was meant to wake. Would argue for targeting by dormancy instead of
the whole tier — the opposite of the current "full tier pool" rule, so worth testing before any
such change. Needs a few events.

### ⏳ 3. Code A vs Code B — is the higher value worth it? ◐
The 50/50 split is a free A/B test: same pool size, same day, same brands, only the amount differs.
After ~12 events the claim-rate gap plus the resulting deposits tell you the right split instead of
guessing. Cheapest insight in the list — it comes free with the existing design.

### ⏳ 4. Repeat-claimer segments ○
Across events, separate: claims every time (regulars) · claimed once and never again · never claimed
in N events. The never-responders are the real question — either the offer is wrong for them or
they aren't reachable, and those need opposite fixes.

### 🔴 Storage requirements — decide at build time, not later
- Keep **every assignment forever**, not just the claims
- Record which code each player got **even when unclaimed**
- Keep the **exact pool for each date** (gives "normal day" something to compare against)
- Store the **claim timestamp**, not just a claimed flag

None of this costs anything at build time. All four ideas die without it.

## Related

- [[HANDOFF]] — deep reference
- [[EXECUTED_IDEAS]] — what shipped
- [[LAUNCH_CHECKLIST]] — pre-launch checks
