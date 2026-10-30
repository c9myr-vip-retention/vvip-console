// Task comments as a group chat: @tags, notifications and emoji reactions (schema_v34). Helpers used by tasks.js, plus the notification routes.
// Without schema_v34 every helper quietly does nothing, so comments keep working exactly as before.
import { filterPeople, loadRoles, resolvePerms } from "../perms.js";

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

/** One message for a burst of the same thing from the same person (players dealt one by one, a schedule built item by item): an unread
 *  message of this kind from this actor in the last 15 minutes is counted up instead of a new one. For these kinds comment_id holds the
 *  count and text the thing counted ("player", "item"); the bell writes "30 players". Both statements run as one batch, so requests
 *  arriving together still end up in one message. n: { kind, actor, text } */
export async function notifyCount(db, user, n, add = 1) {
  if (!user || user === n.actor || !(add > 0)) return;
  const same = "username = ? AND kind = ? AND COALESCE(actor, '') = ? AND read_at IS NULL AND created_at >= datetime('now', '-15 minutes')";
  const key = [user, n.kind, n.actor || ""];
  try {
    await db.batch([
      db.prepare(`UPDATE notifications SET comment_id = COALESCE(comment_id, 0) + ? WHERE id = (SELECT MAX(id) FROM notifications WHERE ${same})`).bind(add, ...key),
      db.prepare(`INSERT INTO notifications (username, kind, actor, comment_id, text) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE ${same})`)
        .bind(user, n.kind, n.actor || null, add, String(n.text || "").slice(0, 200), ...key),
    ]);
  } catch { /* schema_v34 not run yet */ }
}

/** Every account with the columns resolvePerms needs (older databases lack the newer ones). */
export async function accountsWithPerms(db) {
  for (const cols of ["username, role, role_key, team, on_leaderboard, can_edit, manage_users, perm_overrides", "username, role, role_key, team, on_leaderboard, can_edit, manage_users", "username, role, team, on_leaderboard, can_edit, manage_users"]) {
    try { return (await db.prepare(`SELECT ${cols} FROM users ORDER BY username COLLATE NOCASE`).all()).results || []; } catch { /* older schema: fewer columns */ }
  }
  return [];
}

/** Usernames that hold a permission, limited to people who look after this team (or every team). */
export async function usersWith(db, perm, team) {
  const [rows, roles] = await Promise.all([accountsWithPerms(db), loadRoles(db)]);
  return rows.filter((u) => {
    const p = resolvePerms(u, roles);
    return p.has(perm) && (!team || !u.team || u.team === team || p.has("teams.all"));
  }).map((u) => u.username);
}

/** Hourly (from the Worker's cron): remind about tasks that are due soon or have just gone overdue. Each reminder is sent once per due
 *  date and time (text carries it, so moving the deadline earns a fresh one). Tasks overdue for more than a day are left alone, so the
 *  first run never floods anyone with old backlog. Times are Malaysia time (GMT+8). Tasks with a date but no time are due at the end of that
 *  day: "due today" at 09:00, "overdue" from 09:00 the day after. */
export async function taskReminders(db) {
  const now = Date.now(), myt = new Date(now + 8 * 3600e3), today = myt.toISOString().slice(0, 10), hour = myt.getUTCHours();
  const day = (n) => new Date(now + 8 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
  let rows;
  try {
    rows = (await db.prepare(`SELECT id, title, assignee, owner, due_date, due_time FROM tasks
      WHERE deleted_at IS NULL AND status IN ('pending', 'progress') AND due_date IS NOT NULL AND due_date BETWEEN ? AND ?`).bind(day(-2), day(1)).all()).results || [];
  } catch { return { reminded: 0 }; }
  const want = [];
  for (const t of rows) {
    const text = `due ${t.due_date}${t.due_time ? " " + t.due_time : ""}`;
    let kind = null;
    if (t.due_time) {
      const at = Date.parse(`${t.due_date}T${t.due_time}:00+08:00`);
      if (now >= at && now - at < 86400e3) kind = "overdue";
      else if (at > now && at - now <= 90 * 60e3) kind = "due_soon";
    } else if (hour >= 9) {
      if (t.due_date === today) kind = "due_soon";
      else if (t.due_date === day(-1)) kind = "overdue";
    }
    if (!kind) continue;
    const to = kind === "overdue" ? [t.assignee, t.owner] : [t.assignee];
    for (const u of new Set(to.filter(Boolean))) want.push({ u, kind, task_id: t.id, text });
  }
  if (!want.length) return { reminded: 0 };
  const ids = [...new Set(want.map((w) => w.task_id))];
  const done = new Set();
  try {
    const { results } = await db.prepare(`SELECT username, kind, task_id, text FROM notifications WHERE kind IN ('due_soon', 'overdue') AND task_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
    for (const r of results || []) done.add(`${r.username}|${r.kind}|${r.task_id}|${r.text}`);
    const fresh = want.filter((w) => !done.has(`${w.u}|${w.kind}|${w.task_id}|${w.text}`));
    for (let i = 0; i < fresh.length; i += 50) {
      await db.batch(fresh.slice(i, i + 50).map((w) => db.prepare("INSERT INTO notifications (username, kind, task_id, text) VALUES (?, ?, ?, ?)").bind(w.u, w.kind, w.task_id, w.text)));
    }
    return { reminded: fresh.length };
  } catch { return { reminded: 0 }; }                                     // schema_v34 not run yet
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
