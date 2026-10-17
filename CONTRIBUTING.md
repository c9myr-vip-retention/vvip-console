# Working on the VVIP Console

Welcome. This is the shared copy of the VVIP Tracker console. It's **live**: agents use it every day and it holds real player data. Please read this page once before your first change.

## Who does what

| Person | Role | Can do | Never does |
|---|---|---|---|
| Aldo | Owner (1st PIC) | Approves and merges changes, deploys, runs database commands | |
| Mexha | Developer (2nd PIC) | Reads the code, runs it locally, builds features and fixes on a branch, opens pull requests, writes docs, logs bugs | Deploys, runs anything against the live database, pushes straight to `main`, handles secrets |

Only Aldo puts changes live. If a task seems to need a deploy or a database change, write it in the pull request and Aldo takes it from there.

## One-time setup

1. Install **Git** and **Node.js 20 or newer** (LTS).
2. Clone the repo (GitHub Desktop or `git clone`).
3. In the project folder, run:
   ```
   npm install
   npm run dev
   ```
4. Open the address Vite prints (usually http://localhost:5173) and log in with **your own console account**.

**Important:** the local app talks to the **live** API. Anything you save locally (status buttons, notes, assignments, Mark contacted) writes real data that agents see. When testing, look and click around, but don't save on real players. If you need to test a write, ask Aldo first.

Your login only shows the brands your account is scoped to. That's expected.

## How to make a change

1. Get the latest code: `git checkout main` then `git pull`.
2. Make a branch per task: `git checkout -b mexha/<short-task-name>` (for example `mexha/bundle-split`).
3. Make the change. Keep it small: one task per branch.
4. Check it builds: `npm run build` must pass.
5. Check it in the browser, including phone width (375 px) if you touched layout.
6. Commit with a clear message (`fix(daily): ...`, `feat(dashboard): ...`), then push the branch.
7. Open a **pull request** into `main`. In the description, write:
   - **What** changed
   - **Why**
   - **How you tested it** (and a screenshot if it's visual)
   - **Needs deploy?** Worker, Pages, or both, and any database change Aldo has to run
8. Aldo reviews, merges and deploys. Please don't merge your own pull request.

## Never

- Never run `npm run deploy:worker`, `npm run deploy:pages`, `wrangler deploy` or `wrangler pages deploy`.
- Never run `wrangler d1 ... --remote` (that's the live database).
- Never push to `main` directly.
- Never put passwords, tokens or keys in the code. Secrets live in Cloudflare only.
- Never weaken the `player_days` unique key `(player_key, snapshot_date, brand, tier_segment)`.

## Code rules

- **Surgical edits.** Change what the task needs. Don't reformat or rewrite whole files.
- **Business rules are product rules.** `classifyAll` (classes and precedence), auto-assign, KPI and reactivation logic encode how the team works. Don't change their behaviour without Aldo agreeing in the pull request.
- **Colours come from tokens.** Use `var(--token)` from the `:root` block in `App.jsx`. Don't add new hex colours. Each colour has one meaning (see `docs/design/console-design-pass.html`).
- **Keyboard and phone.** Clickable rows and cards use the `tap()` helper. Layout must fit 375 px with no sideways page scroll.
- **No new packages** without asking in the pull request first.
- **UI text:** plain, sentence case, no em dashes in new text (house style).

## First tasks

Pick one, one branch each:

1. **Split the bundle.** The build is over 500 kB and loads slowly on phones. Load Dashboard and Campaigns only when they're opened (`React.lazy` or dynamic `import()`).
2. **Add tests and a linter.** There are none today. Start with unit tests for `classifyAll`, the core business logic.
3. **Upgrade wrangler** from 3.x to 4.x and check `npm run build` still works. Deploy testing stays with Aldo.
4. **Copy consistency.** Instruction text still says things like "Whale quiet 6d" while the amount column says "6 days". Make day counts consistent.
5. **Split `App.jsx`** (about 6,800 lines) into one file per tab. Only after task 2, so the tests catch breakage.

## Where to learn the system

- `CLAUDE.md`: the short rules and architecture overview (also read by Claude Code).
- `docs/HANDOFF.md`: the deep reference (domain model, data flow, known limits).
- `docs/00-INDEX.md`: map of all docs.
- `docs/sessions/`: what changed recently and why.

## Bugs and questions

Log bugs as **GitHub Issues**: what you did, what you expected, what happened, and a screenshot. For anything about how the team works (classes, KPI, who gets which player), ask Aldo.
