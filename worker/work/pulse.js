// "Live" updates without websockets. Every successful change bumps a counter for its area (live_pulse, schema_v31); open pages poll
// GET /api/work/pulse and reload only the area whose number moved. The counters carry no data, only "something changed".
// Without the table (schema_v31 not run) everything keeps working, pages just do not refresh by themselves.

/** Which area a write to this path belongs to, or null when the page does not live-refresh from it. */
export function areaOf(path) {
  if (path.startsWith("/api/work/schedule")) return "schedule";
  if (path.startsWith("/api/work/tasks") || path.startsWith("/api/work/attachments") || path.startsWith("/api/work/comments")) return "tasks";
  if (/^\/api\/work\/(projects|flows|templates|bin)/.test(path)) return "projects";
  if (path.startsWith("/api/users") || path.startsWith("/api/roles")) return "people";
  if (path === "/api/rtn/contact" || path === "/api/rtn/unassign") return "contact";            // who owns which player, and its status (rows stamped with updated_at)
  if (path.startsWith("/api/rtn/auto-assign")) return "contactreset";                             // may write rows without a fresh stamp: pull the full list
  if (path.startsWith("/api/rtn/login-check")) return "checkin";
  if (/^\/api\/rtn\/(notes|crm|telegram|livechat)/.test(path)) return "player";                                               // the player drawer
  if (/^\/api\/rtn\/(kpi|mistakes)/.test(path)) return "kpi";
  if (path.startsWith("/api/rtn/campaign")) return "campaign";
  if (path === "/api/ingest" || /^\/api\/rtn\/(feeders|engagement-sync|lark-sync|feed-check)/.test(path) || path === "/api/upload") return "feed";   // new data arrived
  return null;
}

/** After the response is built: a successful write bumps its area. Fire-and-forget, never delays or breaks a response. */
export function liveBump(request, response, env, ctx) {
  try {
    if (request.method === "GET" || request.method === "OPTIONS" || !response || !response.ok) return;
    const area = areaOf(new URL(request.url).pathname);
    if (!area || !ctx) return;
    ctx.waitUntil(env.DB.prepare("INSERT INTO live_pulse (area, n) VALUES (?, 1) ON CONFLICT(area) DO UPDATE SET n = n + 1").bind(area).run().catch(() => {}));
  } catch { /* never in the way */ }
}

/** Fire-and-forget bump for work that does not come through a request (the scheduled jobs). */
export function bumpArea(env, ctx, area) {
  try { ctx.waitUntil(env.DB.prepare("INSERT INTO live_pulse (area, n) VALUES (?, 1) ON CONFLICT(area) DO UPDATE SET n = n + 1").bind(area).run().catch(() => {})); } catch { /* never in the way */ }
}

// A short fingerprint of what this account may do (role, team, every permission). It moves when an admin changes any of them, so the page can
// reload the account's own permissions without a sign-in. Different for every account, so the pulse is read per person.
const fingerprint = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; };

// GET /api/work/pulse -> { areas: { tasks: 12, schedule: 3, ..., me: 123456 } }
export async function pulse(c) {
  let areas = {};
  try { for (const r of (await c.env.DB.prepare("SELECT area, n FROM live_pulse").all()).results || []) areas[r.area] = r.n; }
  catch { areas = {}; }                                    // schema_v31 not run yet
  try {                                                    // unread notifications for this person: a new one (or a read one) moves it
    const r = await c.env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM notifications WHERE username = ? AND read_at IS NULL").bind(c.user.username).first();
    areas.notif = fingerprint(`${r ? r.n : 0}:${r ? r.m : 0}`);
  } catch { areas.notif = 0; }                              // schema_v34 not run yet
  areas.me = fingerprint(`${c.user.role_key || ""}|${c.user.team || ""}|${c.user.role || ""}|${[...(c.perms || [])].sort().join(",")}`);
  return c.ok({ areas });
}
