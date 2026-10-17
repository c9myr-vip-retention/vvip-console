# MESSAGES_GUIDE.md — How to edit the message library
File: `src/messageLibrary.js` · The ONLY place approach messages live.
Change a message here → `npm run build` → `npm run deploy:pages`. No other code touched.

## What lives in it
| Block | What it is | Edit when… |
|---|---|---|
| `PROVIDER_HOOKS` | Reward names per provider (TC / ZY) | A promo mechanic is renamed |
| `BRAND_PROVIDER` | Brand → provider map | A brand is added/moved |
| `GUARDS` | Safety rails (RG, FRAGILE, WHALE, RESTRAINT) | Policy wording changes |
| `TEMPLATES.EN` | The messages: class × tier ("V" and "3") | You want different copy |
| `INSTRUCTIONS.EN` | Worklist one-line row text per class | Row wording changes |

## Variables you can use inside any message
`{name}` player name (addressing → username → "Boss")
`{brand}` brand name · `{signoff}` auto: "BRAND / Priority Support" (V) or "BRAND Team" (3)
`{lossToday}` `{depositToday}` `{withdrawToday}` RM-formatted live amounts
`{dsld}` days since last deposit · `{graceDate}` `{graceDays}` grace deadline info
`{freeHook}` provider free reward · `{rebateHook}` provider rebate · `{aRebate}` with correct "a/an"
Missing data degrades gracefully — never shows "undefined" or "RM NaN".

## Rules (policy, not style)
1. TOP_LOSS = relief only. Never "win it back", never a deposit push, no countdowns.
2. WATCH / HEALTHY templates stay as "(No message…)" — restraint is the action.
3. Tier V = personal tone + Priority Support sign-off. Tier 3 = lighter + brand team.
4. Numbers in messages must come from {variables}, never typed as static examples.

## Adding a language (中文 / BM)
Copy `TEMPLATES.EN` → `TEMPLATES.ZH` (or `BM`), translate values, keep all {variables} identical.
Then call `buildMessage(player, "ZH")`. Same for `INSTRUCTIONS`.

## Adding a new class (Phase-2 cards later)
1. Add a key to `TEMPLATES.EN` (title + "V" + "3") and `INSTRUCTIONS.EN`.
2. Add any new guard to `GUARDS` and wire it in `collectGuards()`.
That's it — the drawer and worklist pick it up automatically.

## Related

- [[AGENT_HANDBOOK]] — full workflow
- [[CONSOLE_WALKTHROUGH]] — plain explainer
