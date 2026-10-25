// Task comments as a group chat: @tags, notifications and emoji reactions (schema_v34). Helpers used by tasks.js, plus the notification routes.
// Without schema_v34 every helper quietly does nothing, so comments keep working exactly as before.
import { filterPeople } from "../perms.js";

// The reactions people may add to a message. Kept to a fixed list so the table never holds junk.
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "👀", "✅", "🔥", "💯", "👎"];

/** Usernames tagged with @name in some text (lower case, no duplicates). */
export function mentionsIn(text) {
  const out = new Set();
  for (const m of String(text || "").matchAll(/(?:^|[^\w@])@([a-z0-9][a-z0-9_.-]{0,40})/gi)) out.add(m[1].toLowerCase().replace(/[._-]+$/, ""));
  return [...out];
}

/** Which of these names are real accounts this person may see (the "who they can see" setting applies to tagging too). */
export async function taggable(c, names) {
  if (!names.length) return [];
  const marks = names.map(() => "?").join(",");
  let rows;
  try { rows = (await c.env.DB.prepare(`SELECT username, role, role_key, team FROM users WHERE username IN (${marks})`).bind(...names).all()).results || []; }
  catch { rows = (await c.env.DB.prepare(`SELECT username, role, team FROM users WHERE username IN (${marks})`).bind(...names).all()).results || []; }
  return filterPeople(rows, c.user, c.roles, c.perms).map((u) => u.username);
}

/** One notification per person (never the person who did it). n: { kind, task_id, comment_id, actor, text } */
export async function notify(db, users, n) {
  const list = [...new Set(users)].filter((u) => u && u !== n.actor).slice(0, 60);
  if (!list.length) return;
  try {
    await db.batch(list.map((u) => db.prepare("INSERT INTO notifications (username, kind, task_id, comment_id, actor, text) VALUES (?,?,?,?,?,?)")
      .bind(u, n.kind, n.task_id || null, n.comment_id || null, n.actor || null, String(n.text || "").slice(0, 200))));
  } catch { /* schema_v34 not run yet */ }
}

/** Reactions of a task's comments: Map(comment_id -> [{ emoji, users: [username] }]) in the order they were first used. */
export async function reactionsOf(db, taskId) {
  const out = new Map();
  try {
    const { results } = await db.prepare("SELECT comment_id, emoji, username FROM task_reactions WHERE task_id = ? ORDER BY rowid").bind(taskId).all();
    for (const r of results || []) {
      const list = out.get(r.comment_id) || []; out.set(r.comment_id, list);
      let g = list.find((x) => x.emoji === r.emoji); if (!g) { g = { emoji: r.emoji, users: [] }; list.push(g); }
      g.users.push(r.username);
    }
  } catch { /* schema_v34 not run yet */ }
  return out;
}

// ── notification routes (a person only ever reads and clears their own) ──
async function body(c) { try { const b = await c.request.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; } }

export async function handleChat(c) {
  const { path, method } = c, db = c.env.DB, me = c.user.username;
  if (path === "/api/work/notifications" && method === "GET") {
    try {
      const { results } = await db.prepare(
        `SELECT n.id, n.kind, n.task_id, n.comment_id, n.actor, n.text, n.created_at, n.read_at, t.title AS task_title
           FROM notifications n LEFT JOIN tasks t ON t.id = n.task_id WHERE n.username = ? ORDER BY n.id DESC LIMIT 40`).bind(me).all();
      const unread = await db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE username = ? AND read_at IS NULL").bind(me).first();
      return c.ok({ items: (results || []).map((r) => ({ ...r, read: !!r.read_at })), unread: unread ? unread.n : 0 });
    } catch { return c.ok({ items: [], unread: 0 }); }                      // schema_v34 not run yet
  }
  if (path === "/api/work/notifications/read" && method === "POST") {
    const b = await body(c);
    try {
      if (Array.isArray(b.ids) && b.ids.length) {
        const ids = b.ids.map(Number).filter(Number.isInteger).slice(0, 100);
        if (ids.length) await db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE username = ? AND read_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`).bind(me, ...ids).run();
      } else if (Number.isInteger(Number(b.task_id)) && b.task_id !== null && b.task_id !== "") {
        await db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE username = ? AND read_at IS NULL AND task_id = ?").bind(me, Number(b.task_id)).run();
      } else if (b.all) {
        await db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE username = ? AND read_at IS NULL").bind(me).run();
      } else return c.err("Say which: ids, task_id or all", 400);
    } catch { /* schema_v34 not run yet */ }
    return c.ok({ ok: true });
  }
  return null;
}
