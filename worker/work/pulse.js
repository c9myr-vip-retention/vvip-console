// "Live" updates without websockets. Every successful change bumps a counter for its area (live_pulse, schema_v31); open pages poll
// GET /api/work/pulse and reload only the area whose number moved. The counters carry no data, only "something changed".
// Without the table (schema_v31 not run) everything keeps working, pages just do not refresh by themselves.

/** Which area a write to this path belongs to, or null when the page does not live-refresh from it. */
export function areaOf(path) {
  if (path.startsWith("/api/work/schedule")) return "schedule";
  if (path.startsWith("/api/work/tasks") || path.startsWith("/api/work/attachments")) return "tasks";
  if (/^\/api\/work\/(projects|flows|templates|bin)/.test(path)) return "projects";
  if (path.startsWith("/api/users") || path.startsWith("/api/roles")) return "people";
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

// GET /api/work/pulse -> { areas: { tasks: 12, schedule: 3, ... } }
export async function pulse(c) {
  let areas = {};
  try { for (const r of (await c.env.DB.prepare("SELECT area, n FROM live_pulse").all()).results || []) areas[r.area] = r.n; }
  catch { areas = {}; }                                    // schema_v31 not run yet
  return c.ok({ areas });
}
