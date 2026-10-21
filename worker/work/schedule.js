// Schedule routes: /api/work/schedule*  (agent: schedule). Tables: schedule_types, schedule_items, schedule_swaps (schema_v25_work.sql).
// Everyone reads; only admin (c.canManage) creates/edits/deletes items and types; an agent may request a swap on a shift they are on.
// Repeats are NOT expanded here: items come back with `repeat`, the client expands them.
const MAX_BULK = 500;
const REPEATS = ["none", "daily", "weekly"];

const isDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const strList = (v, max = 60) => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 40);

// Parse one item payload (full create, or the editable subset when `partial`). Returns { v } or { e }.
function parseItem(b, validTypes, partial) {
  if (!b || typeof b !== "object") return { e: "Each item must be an object" };
  const v = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has("type_key")) {
    if (typeof b.type_key !== "string" || !validTypes.has(b.type_key)) return { e: "Unknown schedule type" };
    v.type_key = b.type_key;
  }
  if (!partial || has("date")) {
    if (!isDate(b.date)) return { e: "Invalid date (use YYYY-MM-DD)" };
    v.date = b.date;
  }
  if (!partial || has("title")) {
    const t = typeof b.title === "string" ? b.title.trim() : "";
    if (!t) return { e: "Title is required" };
    if (t.length > 120) return { e: "Title is too long (max 120)" };
    v.title = t;
  }
  for (const k of ["start_time", "end_time"]) {
    if (!partial || has(k)) {
      const t = b[k] == null ? "" : b[k];
      if (t !== "" && (typeof t !== "string" || !isTime(t))) return { e: `Invalid ${k} (use HH:MM)` };
      v[k] = t || null;
    }
  }
  if (!partial || has("brands")) {
    const l = b.brands == null ? [] : b.brands;
    if (!strList(l)) return { e: "brands must be a list of brand codes" };
    v.brands = [...new Set(l)];
  }
  if (!partial || has("who")) {
    const l = b.who == null ? [] : b.who;
    if (!strList(l)) return { e: "who must be a list of usernames" };
    v.who = [...new Set(l)];
  }
  if (!partial || has("note")) {
    const n = b.note == null ? "" : b.note;
    if (typeof n !== "string" || n.length > 500) return { e: "Note must be text, max 500 characters" };
    v.note = n.trim() || null;
  }
  if (!partial || has("repeat")) {
    const r = b.repeat == null ? "none" : b.repeat;
    if (!REPEATS.includes(r)) return { e: "repeat must be none, daily or weekly" };
    v.repeat = r;
  }
  if (has("off")) v.off = b.off ? 1 : 0;
  return { v };
}

const rowToItem = (r) => ({
  id: r.id, type_key: r.type_key, date: r.date, title: r.title,
  start_time: r.start_time || "", end_time: r.end_time || "",
  brands: safeJson(r.brands), who: safeJson(r.who), note: r.note || "",
  repeat: r.repeat || "none", off: r.off ? 1 : 0,
});
function safeJson(s) { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }

async function typeKeys(c) {
  const { results } = await c.env.DB.prepare("SELECT key, name, color, builtin FROM schedule_types ORDER BY builtin DESC, rowid").all();
  return results.map((t) => ({ key: t.key, name: t.name, color: t.color, builtin: !!t.builtin }));
}

export async function handleSchedule(c) {
  const { path, method, env, user } = c;
  if (!path.startsWith("/api/work/schedule")) return null;
  const DB = env.DB;
  const admin = !!c.canManage;
  const deny = () => c.err("Admin only", 403);
  const readJson = async () => { try { return await c.request.json(); } catch { return null; } };

  // GET /api/work/schedule?from=&to=
  if (path === "/api/work/schedule" && method === "GET") {
    const from = c.url.searchParams.get("from"), to = c.url.searchParams.get("to");
    if ((from && !isDate(from)) || (to && !isDate(to))) return c.err("from/to must be YYYY-MM-DD", 400);
    let sql = "SELECT * FROM schedule_items WHERE deleted_at IS NULL";
    const bind = [];
    // a repeating item still matters for a window that starts after its first date
    if (from && to) { sql += " AND ((date >= ? AND date <= ?) OR (repeat != 'none' AND date <= ?))"; bind.push(from, to, to); }
    else if (from) { sql += " AND (date >= ? OR repeat != 'none')"; bind.push(from); }
    else if (to) { sql += " AND date <= ?"; bind.push(to); }
    sql += " ORDER BY date, start_time, id";
    const { results } = await DB.prepare(sql).bind(...bind).all();
    return c.ok({ types: await typeKeys(c), items: results.map(rowToItem) });
  }

  // POST /api/work/schedule/items  (admin, bulk)
  if (path === "/api/work/schedule/items" && method === "POST") {
    if (!admin) return deny();
    const b = await readJson();
    if (!b || !Array.isArray(b.items) || !b.items.length) return c.err("items must be a non-empty list", 400);
    if (b.items.length > MAX_BULK) return c.err(`Too many items (max ${MAX_BULK} per call)`, 400);
    const valid = new Set((await typeKeys(c)).map((t) => t.key));
    const rows = [];
    for (let i = 0; i < b.items.length; i++) {
      const r = parseItem(b.items[i], valid, false);
      if (r.e) return c.err(`Item ${i + 1}: ${r.e}`, 400);
      if (r.v.type_key === "shift" && !r.v.who.length) return c.err(`Item ${i + 1}: a shift needs at least one person`, 400);
      rows.push(r.v);
    }
    const ins = DB.prepare("INSERT INTO schedule_items (type_key, date, title, start_time, end_time, brands, who, note, repeat, off, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    for (let i = 0; i < rows.length; i += 50) {
      await DB.batch(rows.slice(i, i + 50).map((v) =>
        ins.bind(v.type_key, v.date, v.title, v.start_time, v.end_time, JSON.stringify(v.brands), JSON.stringify(v.who), v.note, v.repeat, v.off || 0, user.username)));
    }
    c.log(user.username, "schedule", `Added ${rows.length} schedule item(s)`);
    return c.ok({ created: rows.length }, 201);
  }

  // POST /api/work/schedule/items/:id/(update|delete|swap)
  let m = path.match(/^\/api\/work\/schedule\/items\/(\d+)\/(update|delete|swap)$/);
  if (m && method === "POST") {
    const id = +m[1], act = m[2];
    const row = await DB.prepare("SELECT * FROM schedule_items WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (act !== "swap" && !admin) return deny();
    if (!row) return c.err("Schedule item not found", 404);

    if (act === "delete") {
      await DB.prepare("UPDATE schedule_items SET deleted_at = datetime('now') WHERE id = ?").bind(id).run();
      c.log(user.username, "schedule", `Deleted schedule item ${id} (${row.title})`);
      return c.ok({ ok: true });
    }

    if (act === "update") {
      const b = await readJson();
      if (!b) return c.err("Invalid JSON", 400);
      const valid = new Set((await typeKeys(c)).map((t) => t.key));
      const r = parseItem(b, valid, true);
      if (r.e) return c.err(r.e, 400);
      const cur = rowToItem(row), v = r.v;
      if ((v.type_key ?? cur.type_key) === "shift" && !(v.who ?? cur.who).length) return c.err("A shift needs at least one person", 400);
      const sets = [], bind = [];
      for (const [k, val] of Object.entries(v)) {
        sets.push(`${k} = ?`);
        bind.push(k === "brands" || k === "who" ? JSON.stringify(val) : val);
      }
      if (sets.length) await DB.prepare(`UPDATE schedule_items SET ${sets.join(", ")} WHERE id = ?`).bind(...bind, id).run();
      const fresh = await DB.prepare("SELECT * FROM schedule_items WHERE id = ?").bind(id).first();
      return c.ok({ item: rowToItem(fresh) });
    }

    // swap: an agent on that shift
    if (!user.can_edit && !admin) return c.err("View-only — your account cannot request swaps", 403);
    if (row.type_key !== "shift" || row.off) return c.err("Swaps can only be requested for a shift", 400);
    if (!safeJson(row.who).includes(user.username)) return c.err("You can only request a swap on your own shift", 403);
    const b = (await readJson()) || {};
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
    const dupe = await DB.prepare("SELECT id FROM schedule_swaps WHERE item_id = ? AND from_user = ? AND status = 'open'").bind(id, user.username).first();
    if (dupe) return c.err("You already have an open swap request for this shift", 409);
    const res = await DB.prepare("INSERT INTO schedule_swaps (item_id, from_user, note) VALUES (?,?,?)").bind(id, user.username, note || null).run();
    c.log(user.username, "schedule", `Requested a swap on shift ${id} (${row.date})`);
    return c.ok({ swap: { id: res.meta.last_row_id, item_id: id, from_user: user.username, note, status: "open" } }, 201);
  }

  // POST /api/work/schedule/types  (admin) { name, color }
  if (path === "/api/work/schedule/types" && method === "POST") {
    if (!admin) return deny();
    const b = await readJson();
    const name = b && typeof b.name === "string" ? b.name.trim() : "";
    if (!name || name.length > 40) return c.err("Name is required (max 40 characters)", 400);
    if (!b || typeof b.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(b.color)) return c.err("color must be a hex colour like #E11D48", 400);
    const existing = await typeKeys(c);
    if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) return c.err("A schedule type with that name already exists", 409);
    const base = "t_" + (name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "type");
    let key = base;
    for (let n = 2; existing.some((t) => t.key === key); n++) key = `${base}_${n}`;
    await DB.prepare("INSERT INTO schedule_types (key, name, color, builtin) VALUES (?,?,?,0)").bind(key, name, b.color).run();
    c.log(user.username, "schedule", `Created schedule type ${name}`);
    return c.ok({ type: { key, name, color: b.color, builtin: false } }, 201);
  }

  // GET /api/work/schedule/swaps  (admin)
  if (path === "/api/work/schedule/swaps" && method === "GET") {
    if (!admin) return deny();
    const { results } = await DB.prepare(
      `SELECT s.id, s.item_id, s.from_user, s.note, s.status, s.created_at, i.date, i.title, i.start_time, i.end_time
         FROM schedule_swaps s LEFT JOIN schedule_items i ON i.id = s.item_id
        ORDER BY (s.status = 'open') DESC, s.id DESC LIMIT 200`).all();
    return c.ok({ swaps: results });
  }

  // POST /api/work/schedule/swaps/:id  (admin) { status }
  m = path.match(/^\/api\/work\/schedule\/swaps\/(\d+)$/);
  if (m && method === "POST") {
    if (!admin) return deny();
    const b = await readJson();
    if (!b || !["approved", "declined"].includes(b.status)) return c.err("status must be approved or declined", 400);
    const sw = await DB.prepare("SELECT * FROM schedule_swaps WHERE id = ?").bind(+m[1]).first();
    if (!sw) return c.err("Swap request not found", 404);
    if (sw.status !== "open") return c.err(`Swap already ${sw.status}`, 409);
    await DB.prepare("UPDATE schedule_swaps SET status = ? WHERE id = ?").bind(b.status, sw.id).run();
    c.log(user.username, "schedule", `Swap ${sw.id} ${b.status}`);
    return c.ok({ swap: { ...sw, status: b.status } });
  }

  return c.err("Not found", 404);
}
