# 2026-09-30 · Console design pass + live-band fix

A frontend-design pass on the console, shipped in six batches (0 to 5), plus the save-rate live-band fix. Plan and before/after comparison: `docs/design/console-design-pass.html`.

## Shipped (all deployed with Aldo's approval)
| Commit | What |
|---|---|
| 98cb0e4 | **Live-band fix.** `/api/rtn/performance` derives class from `player_days` when `contact_log.class` is NULL (mirrors `classifyAll`). September Team B: 0 rows left in "—" (Skylar 609/609 banded). |
| ab35571 | **Batch 0, foundations.** 211 CSS hex values folded into 71 tokens (no visual change), IBM Plex Sans with tabular figures, `:focus-visible` ring, `tap()` keyboard helper for clickable rows, Esc closes the drawer, reduced motion. |
| 46e47df | **Batch 1, colour meaning.** One meaning per colour channel. DSLD classes on a blue ramp, TOP LOSS/DEP use the money colours, status is a grey-teal-green pipeline, bands are a warm ramp with spine widths 6/4/2. Gold is the logo only and ivory marks selection. "6 days" replaces "6d". |
| 3855acd | **Batch 2, Daily queue.** Band progress ("N of M done"), done rows dim the player only (ASSIGNED is not done), money-coloured amounts, 18 px checkbox, class-coloured plaque counts. |
| 6aff28e | **Batch 3, drawer.** Segmented status control plus a separate Auto group, dialog focus in and out, sentence-case sections. |
| 30924c4 | **Fix.** Drawer Next/Prev follows on-screen band order (the first ACT row used to open as 1881/3431). |
| f238a67 | **Batch 4, Dashboard.** Dual-axis trend split into Players and Money charts. Palette validated for dark mode and colour blindness. Rainbow KPI stripes removed. |
| 7db90ae | **Batch 5, other tabs and mobile.** All 6 tabs fit 375 px (Settings was 989 px), info tips open as a bottom sheet on phones, last caps labels and stray hex values cleaned up. |

## Follow-ups after review (Aldo spotted the KPI hover)
| Commit | What |
|---|---|
| 5190e9c | KPI cards: visible hover and focus state (the old one was a 1-step border shift), 4x2 tile grid, cold-pile rise shown in red (a CSS specificity bug had made it white). |
| 64a1da0 | All 14 data tables fill their card. Below 1024px they used to shrink to content width, e.g. Brand health at 125% Windows scaling. |
| 130a5f1 | Top-list amounts and ranks use tabular sans, not mono. |

Slow loading on 30 Sep was the local connection (about 3 to 5 KB/s to the Cloudflare CDN). API response time was normal at about 0.4 to 0.7s.

## Decisions
- Colours: one meaning per channel (approved). The DSLD ramp was lightened to #A9C8E8 / #6FA3DE / #4A87DB so every colour passes 4.5:1 text contrast.
- Trend colours (validated): #2FA98C teal (active, deposits), #4A87DB blue (cold), #CC7626 orange (withdrawals, dashed).
- Drawer section order deliberately **not** changed, because agents are used to it.
- Aldo sends the team brief on the colour change himself.

## Open
- The dimmed done-row look has not been seen yet with real outcomes on the board.
- The login page on a phone was not checked, because it needs a sign-out.
- `dist/` was dirty before this session and is still uncommitted.

Related: [[2026-09-30-console-ops-and-handoff]] · [[HANDOFF]]
