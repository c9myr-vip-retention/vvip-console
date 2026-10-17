# GROUP B High Roller Tracker — Deployment Guide
# Estimated time: 25–35 minutes

═══════════════════════════════════════════════════════════════
PREREQUISITES
═══════════════════════════════════════════════════════════════

1. A Cloudflare account (free) → cloudflare.com
2. Node.js installed on your computer → nodejs.org (LTS version)
3. This project folder

═══════════════════════════════════════════════════════════════
STEP 1 — Install Wrangler CLI (Cloudflare's deploy tool)
═══════════════════════════════════════════════════════════════

Open Terminal (Mac) or Command Prompt (Windows) and run:

  npm install -g wrangler

Then log in to Cloudflare:

  wrangler login

A browser window opens → log in → come back to terminal.

═══════════════════════════════════════════════════════════════
STEP 2 — Create the D1 Database
═══════════════════════════════════════════════════════════════

In terminal, navigate to this project folder:

  cd path/to/groupb-tracker

Create the database:

  wrangler d1 create groupb-tracker-db

You'll see output like:
  ✅ Successfully created DB 'groupb-tracker-db'
  database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

COPY that database_id and paste it into wrangler.toml:
  Replace: database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
  With:    database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

═══════════════════════════════════════════════════════════════
STEP 3 — Run the Database Schema
═══════════════════════════════════════════════════════════════

This creates all the tables. Run once:

  wrangler d1 execute groupb-tracker-db --file=./schema/schema.sql

You should see: "Successfully executed SQL"

═══════════════════════════════════════════════════════════════
STEP 4 — Set Environment Variables (Secrets)
═══════════════════════════════════════════════════════════════

Set your session secret (make this random, 32+ characters):

  wrangler secret put SESSION_SECRET
  → Type a random string, e.g.: Xk9mP2qL8nR5vW3jH7yC4tA1bZ6dE0f

Set your password salt (another random string):

  wrangler secret put PASSWORD_SALT
  → Type a random string, e.g.: mQ7nK3pR9xL2vB5hT8wY1cZ4jA6sE0d

SAVE THESE STRINGS SOMEWHERE SAFE — you'll need them if you
ever need to reset passwords manually.

═══════════════════════════════════════════════════════════════
STEP 5 — Deploy the Worker (API Backend)
═══════════════════════════════════════════════════════════════

  wrangler deploy

You'll see:
  ✅ Deployed groupb-tracker-api
  URL: https://groupb-tracker-api.YOUR_ACCOUNT.workers.dev

COPY that Worker URL.

═══════════════════════════════════════════════════════════════
STEP 6 — Update the API URL in the Frontend
═══════════════════════════════════════════════════════════════

Open: src/App.jsx
Find line 14:
  const API_BASE = "https://groupb-tracker-api.YOUR_SUBDOMAIN.workers.dev";

Replace with your actual Worker URL from Step 5:
  const API_BASE = "https://groupb-tracker-api.YOUR_ACCOUNT.workers.dev";

Save the file.

═══════════════════════════════════════════════════════════════
STEP 7 — Build and Deploy the Frontend
═══════════════════════════════════════════════════════════════

Install dependencies:

  npm install

Build the app:

  npm run build

Deploy to Cloudflare Pages:

  wrangler pages deploy dist --project-name=groupb-tracker

You'll see:
  ✅ Deployment complete!
  URL: https://groupb-tracker.pages.dev

That's your live dashboard URL. Share it with your team.

═══════════════════════════════════════════════════════════════
STEP 8 — Create Your First Admin Account
═══════════════════════════════════════════════════════════════

Open your dashboard URL in a browser.
You'll see the login screen.

Because no users exist yet, go to this URL once:
  https://groupb-tracker-api.YOUR_ACCOUNT.workers.dev/api/users/init

No — actually, the app handles this automatically.
Just go to your Pages URL and log in:
  - It will detect no users exist
  - Enter your desired admin username and password
  - Click "Create Admin Account"
  - Then log in normally

═══════════════════════════════════════════════════════════════
STEP 9 — Add More Users (from inside the app)
═══════════════════════════════════════════════════════════════

1. Log in as admin
2. Go to Settings tab
3. Under "User Management" → Add new user
4. Enter username + password → Add
5. Share credentials with your team member

═══════════════════════════════════════════════════════════════
STEP 10 — (Optional) Custom Domain
═══════════════════════════════════════════════════════════════

If you want a custom URL like tracker.yourdomain.com:
1. Go to Cloudflare dashboard → Pages → groupb-tracker
2. Custom domains → Add custom domain
3. Enter your domain → Cloudflare handles DNS automatically

═══════════════════════════════════════════════════════════════
DONE — Your dashboard is live!
═══════════════════════════════════════════════════════════════

Daily workflow:
1. Open your Pages URL
2. Log in
3. Go to Upload tab
4. Drop each brand's Excel file (lpk777-16may.xlsx, etc.)
5. Dashboard updates instantly for all users

Troubleshooting:
- "Unauthorized" errors → check SESSION_SECRET was set correctly
- "Database error" → make sure schema.sql was run (Step 3)
- CORS errors → check API_BASE in App.jsx matches your Worker URL exactly

Support: Keep this DEPLOY.md file. All configuration is here.

## Related

- [[HANDOFF]] — deep reference
- [[LAUNCH_CHECKLIST]] — pre-launch checks
- [[CLAUDE]] — operating rules
