// Schedule routes: the team board (shifts, reload events, meetings, maintenance, reports, training, custom types) and shift swaps.
// Mounted by worker/work/index.js after requireAuth. Returns a Response, or null for paths that are not ours.
// Contract: docs/design/BUILD-CONTRACT.md sections 2-3. Tables: schema/schema_v25_work.sql. Parameterised SQL only.
//
// Everyone reads. Holders of schedule.manage create / edit / delete items, types and shift times; schedule.swaps decides swaps.
// An agent may ask for a swap only on a shift they are on. Repeats are stored once (repeat = 'daily' | 'weekly');
// the client expands them, so GET returns every repeating item whose first date is on or before `to`.

const MAX_PER_CALL = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const REPEATS = ["none", "daily", "weekly"];

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uniq = (a) => [...new Set(a)];
const holes = (arr) => arr.map(() => "?").join(",");
const parseList = (s) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch { return []; } };
const realDate = (s) => { if (typeof s !== "string" || !DATE_RE.test(s)) return false; const d = new Date(s + "T00:00:00Z"); return !isNaN(d) && d.toISOString().slice(0, 10) === s; };
const strList = (v, max, n) => (Array.isArray(v) ? uniq(v.filter((x) => typeof x === "string").map((x) => x.trim().slice(0, max)).filter(Boolean)).slice(0, n) : []);

async function body(c) { try { const b = await c.request.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; } }

const itemOut = (r) => ({
  id: r.id, type_key: r.type_key, date: r.date, title: r.title, start_time: r.start_time || null, end_time: r.end_time || null,
  brands: parseList(r.brands), who: parseList(r.who), note: r.note || "", repeat: r.repeat, off: r.off ? 1 : 0, created_by: r.created_by || null,
});
const typeOut = (r) => ({ key: r.key, name: r.name, color: r.color, builtin: r.builtin ? 1 : 0 });

async function typeKeys(db) {
  const { results } = await db.prepare("SELECT key FROM schedule_types").all();
  return new Set((results || []).map((r) => r.key));
}
// Subset of `names` that are real accounts.
async function existingUsers(db, names) {
  const list = names.slice(0, 80);
  if (!list.length) return new Set();
  const { results } = await db.prepare(`SELECT username FROM users WHERE username IN (${holes(list)})`).bind(...list).all();
  return new Set((results || []).map((r) => r.username));
}

/** Validate one entry (already merged with defaults). Returns { error } or { row }. */
function checkEntry(e, types, users) {
  if (!types.has(e.type_key)) return { error: `Unknown schedule type "${e.type_key}"` };
  if (!realDate(e.date)) return { error: `Bad date "${e.date}" (use YYYY-MM-DD)` };
  const title = str(e.title, 200);
  if (!title) return { error: "Every item needs a title" };
  const start = e.start_time ? String(e.start_time) : null, end = e.end_time ? String(e.end_time) : null;
  if ((start && !TIME_RE.test(start)) || (end && !TIME_RE.test(end))) return { error: "Times must be HH:MM" };
  const repeat = e.repeat === undefined || e.repeat === null || e.repeat === "" ? "none" : e.repeat;
  if (!REPEATS.includes(repeat)) return { error: "repeat must be none, daily or weekly" };
  const who = strList(e.who, 60, 60).filter((u) => users.has(u));
  if (e.type_key === "shift" && !who.length) return { error: "A shift needs at least one person" };
  const off = e.off === undefined || e.off === null ? (e.type_key === "shift" && title.toLowerCase() === "day off") : !!e.off;
  return { row: { type_key: e.type_key, date: e.date, title, start, end, brands: strList(e.brands, 20, 20), who, note: str(e.note, 1000), repeat, off: off ? 1 : 0 } };
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "type";

// Shift presets (the "Quick fill a shift" list). Stored in schedule_shift_presets (schema_v26). If that table is not there yet
// (Worker deployed before the migration) the board still loads and shows these defaults.
const DEFAULT_SHIFTS = [
  { key: "am", name: "Morning", start_time: "09:00", end_time: "17:00" },
  { key: "pm", name: "Afternoon", start_time: "13:00", end_time: "21:00" },
  { key: "nt", name: "Night", start_time: "21:00", end_time: "05:00" },
];
const shiftOut = (r) => ({ key: r.key, name: r.name, start_time: r.start_time, end_time: r.end_time });
async function listShifts(db) {
  try {
    const { results } = await db.prepare("SELECT key, name, start_time, end_time FROM schedule_shift_presets WHERE deleted_at IS NULL ORDER BY sort, rowid").all();
    return (results || []).map(shiftOut);
  } catch { return DEFAULT_SHIFTS; }
}
/** Validate a preset body. Returns { error } or { name, start, end }. */
function checkShift(b) {
  const name = str(b.name, 30), start = typeof b.start_time === "string" ? b.start_time : "", end = typeof b.end_time === "string" ? b.end_time : "";
  if (!name) return { error: "Give the shift a name" };
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { error: "Start and end must be times (HH:MM)" };
  if (start === end) return { error: "Start and end cannot be the same time" };
  if (name.toLowerCase() === "day off") return { error: "\"Day off\" is built in" };
  return { name, start, end };
}

export async function handleSchedule(c) {
  const { path, method } = c;
  if (!path.startsWith("/api/work/schedule")) return null;
  const db = c.env.DB, me = c.user.username;
  const canEdit = c.can("schedule.swap_request");

  // ───────────── read the board ─────────────
  if (path === "/api/work/schedule" && method === "GET") {
    const from = c.url.searchParams.get("from") || "", to = c.url.searchParams.get("to") || "";
    if ((from && !realDate(from)) || (to && !realDate(to))) return c.err("from / to must be YYYY-MM-DD");
    const where = ["deleted_at IS NULL"], binds = [];
    // one-off items inside the window, plus every repeating item that has started by the end of it
    const oneOff = ["repeat = 'none'"], rep = ["repeat != 'none'"];
    if (from) { oneOff.push("date >= ?"); binds.push(from); }
    if (to) { oneOff.push("date <= ?"); binds.push(to); rep.push("date <= ?"); }
    const b2 = [...binds];
    if (to) b2.push(to);
    where.push(`((${oneOff.join(" AND ")}) OR (${rep.join(" AND ")}))`);
    const { results } = await db.prepare(
      `SELECT id, type_key, date, title, start_time, end_time, brands, who, note, repeat, off, created_by FROM schedule_items
        WHERE ${where.join(" AND ")} ORDER BY date, COALESCE(start_time,''), id LIMIT 5000`
    ).bind(...b2).all();
    const types = await db.prepare("SELECT key, name, color, builtin FROM schedule_types ORDER BY builtin DESC, rowid").all();
    const mine = await db.prepare("SELECT item_id, status FROM schedule_swaps WHERE from_user = ? ORDER BY id").bind(me).all();
    return c.ok({ types: (types.results || []).map(typeOut), items: (results || []).map(itemOut), my_swaps: mine.results || [], shifts: await listShifts(db) });
  }

  // ───────────── add items (many dates x many entries) ─────────────
  if (path === "/api/work/schedule/items" && method === "POST") {
    if (!c.can("schedule.manage") && !c.can("schedule.edit_own")) return c.err("Admin only", 403);
    const b = await body(c);
    if (!Array.isArray(b.items) || !b.items.length) return c.err("items must be a non-empty array");
    // an entry may carry `dates: [...]` instead of one `date`; both are expanded here
    const flat = [];
    for (const e of b.items) {
      if (!e || typeof e !== "object") return c.err("Bad item");
      const dates = Array.isArray(e.dates) ? e.dates : [e.date];
      for (const d of dates) { flat.push({ ...e, date: d }); if (flat.length > MAX_PER_CALL) return c.err(`Too many items (max ${MAX_PER_CALL} per call)`, 413); }
    }
    const types = await typeKeys(db);
    const users = await existingUsers(db, uniq(flat.flatMap((e) => strList(e.who, 60, 60))));
    const rows = [];
    for (const e of flat) {
      const r = checkEntry(e, types, users);
      if (r.error) return c.err(r.error);
      rows.push(r.row);
    }
    const ins = db.prepare(
      "INSERT INTO schedule_items (type_key, date, title, start_time, end_time, brands, who, note, repeat, off, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    );
    for (let i = 0; i < rows.length; i += 50) {
      await db.batch(rows.slice(i, i + 50).map((r) => ins.bind(r.type_key, r.date, r.title, r.start, r.end, JSON.stringify(r.brands), JSON.stringify(r.who), r.note, r.repeat, r.off, me)));
    }
    c.log(c.user, "schedule", `Added ${rows.length} schedule item${rows.length === 1 ? "" : "s"}`);
    return c.ok({ created: rows.length }, 201);
  }

  // ───────────── delete many items at once (admin) ─────────────
  // Matches items by their stored date (for a repeating item that is its first date) and, optionally, by type.
  // { type_key?, from?, to?, preview? }. With preview:true nothing is deleted; it only reports what would be.
  if (path === "/api/work/schedule/items/bulk-delete" && method === "POST") {
    if (!c.can("schedule.manage")) return c.err("Admin only", 403);
    const b = await body(c);
    const from = b.from || "", to = b.to || "", type = b.type_key || "";
    if ((from && !realDate(from)) || (to && !realDate(to))) return c.err("from / to must be YYYY-MM-DD");
    if (from && to && from > to) return c.err("The start date is after the end date");
    if (type && !(await typeKeys(db)).has(type)) return c.err(`Unknown schedule type "${type}"`);
    const where = ["deleted_at IS NULL"], binds = [];
    if (type) { where.push("type_key = ?"); binds.push(type); }
    if (from) { where.push("date >= ?"); binds.push(from); }
    if (to) { where.push("date <= ?"); binds.push(to); }
    const sum = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(repeat != 'none'), 0) AS rep FROM schedule_items WHERE ${where.join(" AND ")}`).bind(...binds).first();
    if (b.preview) return c.ok({ count: sum.n, repeating: sum.rep });
    if (!sum.n) return c.ok({ deleted: 0 });
    await db.prepare(`UPDATE schedule_items SET deleted_at = datetime('now') WHERE ${where.join(" AND ")}`).bind(...binds).run();
    c.log(c.user, "schedule", `Deleted ${sum.n} schedule item${sum.n === 1 ? "" : "s"}${type ? ` (type ${type})` : ""}${from || to ? ` from ${from || "start"} to ${to || "end"}` : " (all dates)"}`);
    return c.ok({ deleted: sum.n });
  }

  // ───────────── edit / delete one item ─────────────
  let m = path.match(/^\/api\/work\/schedule\/items\/(\d+)\/(update|delete|swap)$/);
  if (m && method === "POST") {
    const id = Number(m[1]), act = m[2];
    const mayAny = c.can("schedule.manage");
    if (act !== "swap" && !mayAny && !c.can("schedule.edit_own")) return c.err("Admin only", 403);
    const cur = await db.prepare("SELECT id, type_key, date, title, start_time, end_time, brands, who, note, repeat, off, created_by FROM schedule_items WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!cur) return c.err("Schedule item not found", 404);
    if (act !== "swap" && !mayAny && cur.created_by !== me && !parseList(cur.who).includes(me)) return c.err("You can only change schedule items you created or are on", 403);

    if (act === "delete") {
      await db.prepare("UPDATE schedule_items SET deleted_at = datetime('now') WHERE id = ?").bind(id).run();
      c.log(c.user, "schedule", `Deleted schedule item #${id} "${cur.title}"`);
      return c.ok({ ok: true });
    }

    if (act === "update") {
      const b = await body(c);
      const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
      const merged = {
        type_key: has("type_key") ? b.type_key : cur.type_key, date: has("date") ? b.date : cur.date, title: has("title") ? b.title : cur.title,
        start_time: has("start_time") ? b.start_time : cur.start_time, end_time: has("end_time") ? b.end_time : cur.end_time,
        brands: has("brands") ? b.brands : parseList(cur.brands), who: has("who") ? b.who : parseList(cur.who),
        note: has("note") ? b.note : cur.note, repeat: has("repeat") ? b.repeat : cur.repeat, off: has("off") ? !!b.off : (has("title") ? undefined : !!cur.off),
      };
      const types = await typeKeys(db);
      const r = checkEntry(merged, types, await existingUsers(db, strList(merged.who, 60, 60)));
      if (r.error) return c.err(r.error);
      const x = r.row;
      await db.prepare("UPDATE schedule_items SET type_key=?, date=?, title=?, start_time=?, end_time=?, brands=?, who=?, note=?, repeat=?, off=? WHERE id=?")
        .bind(x.type_key, x.date, x.title, x.start, x.end, JSON.stringify(x.brands), JSON.stringify(x.who), x.note, x.repeat, x.off, id).run();
      c.log(c.user, "schedule", `Edited schedule item #${id} "${x.title}"`);
      const row = await db.prepare("SELECT id, type_key, date, title, start_time, end_time, brands, who, note, repeat, off, created_by FROM schedule_items WHERE id = ?").bind(id).first();
      return c.ok({ item: itemOut(row) });
    }

    // swap: an agent asks to swap a shift they are on
    if (!canEdit) return c.err("View-only — your account cannot request swaps", 403);
    if (cur.type_key !== "shift") return c.err("Only shifts can be swapped", 400);
    if (!parseList(cur.who).includes(me)) return c.err("You can only request a swap on a shift you are on", 403);
    const open = await db.prepare("SELECT id FROM schedule_swaps WHERE item_id = ? AND from_user = ? AND status = 'open'").bind(id, me).first();
    if (open) return c.err("You already have an open swap request for this shift", 409);
    const b = await body(c);
    const res = await db.prepare("INSERT INTO schedule_swaps (item_id, from_user, note) VALUES (?,?,?)").bind(id, me, str(b.note, 500)).run();
    c.log(c.user, "schedule", `Requested a swap on shift #${id} "${cur.title}"`);
    const swap = await db.prepare("SELECT id, item_id, from_user, note, status, created_at FROM schedule_swaps WHERE id = ?").bind(res.meta.last_row_id).first();
    return c.ok({ swap }, 201);
  }

  // ───────────── types ─────────────
  if (path === "/api/work/schedule/types" && method === "POST") {
    if (!c.can("schedule.manage")) return c.err("Admin only", 403);
    const b = await body(c);
    const name = str(b.name, 40), color = typeof b.color === "string" ? b.color.trim() : "";
    if (!name) return c.err("Give the type a name");
    if (!COLOR_RE.test(color)) return c.err("color must look like #RRGGBB");
    const dup = await db.prepare("SELECT key FROM schedule_types WHERE name = ? COLLATE NOCASE").bind(name).first();
    if (dup) return c.err("A schedule type with that name already exists", 409);
    const keys = await typeKeys(db);
    let key = slug(name), n = 2;
    while (keys.has(key)) key = `${slug(name)}-${n++}`;
    await db.prepare("INSERT INTO schedule_types (key, name, color, builtin) VALUES (?,?,?,0)").bind(key, name, color).run();
    c.log(c.user, "schedule", `Created schedule type "${name}"`);
    return c.ok({ type: { key, name, color, builtin: 0 } }, 201);
  }

  // ───────────── rename, recolour or delete a type (any type, built-in ones too) ─────────────
  // Deleting a type removes the type itself and soft-deletes every item of that type (deleted_at), so they leave the board.
  // { preview: true } on delete only reports how many items it would take with it.
  m = path.match(/^\/api\/work\/schedule\/types\/([a-z0-9-]+)\/(update|delete)$/);
  if (m && method === "POST") {
    if (!c.can("schedule.manage")) return c.err("Admin only", 403);
    const cur = await db.prepare("SELECT key, name, color, builtin FROM schedule_types WHERE key = ?").bind(m[1]).first();
    if (!cur) return c.err("Schedule type not found", 404);
    const b = await body(c);
    if (m[2] === "update") {
      const name = b.name === undefined ? cur.name : str(b.name, 40), color = b.color === undefined ? cur.color : (typeof b.color === "string" ? b.color.trim() : "");
      if (!name) return c.err("Give the type a name");
      if (!COLOR_RE.test(color)) return c.err("color must look like #RRGGBB");
      const dup = await db.prepare("SELECT key FROM schedule_types WHERE name = ? COLLATE NOCASE AND key != ?").bind(name, cur.key).first();
      if (dup) return c.err("A schedule type with that name already exists", 409);
      await db.prepare("UPDATE schedule_types SET name = ?, color = ? WHERE key = ?").bind(name, color, cur.key).run();
      c.log(c.user, "schedule", `Changed schedule type "${cur.name}"${name !== cur.name ? ` to "${name}"` : ""}`);
      return c.ok({ type: { key: cur.key, name, color, builtin: cur.builtin ? 1 : 0 } });
    }
    const n = (await db.prepare("SELECT COUNT(*) AS n FROM schedule_items WHERE type_key = ? AND deleted_at IS NULL").bind(cur.key).first()).n;
    if (b.preview) return c.ok({ items: n });
    await db.prepare("UPDATE schedule_items SET deleted_at = datetime('now') WHERE type_key = ? AND deleted_at IS NULL").bind(cur.key).run();
    await db.prepare("DELETE FROM schedule_types WHERE key = ?").bind(cur.key).run();
    c.log(c.user, "schedule", `Deleted schedule type "${cur.name}" and its ${n} item${n === 1 ? "" : "s"}`);
    return c.ok({ ok: true, items: n });
  }

  // ───────────── shift times (admin): the presets behind "Quick fill a shift" ─────────────
  // Changing or removing a preset only affects shifts added from now on; shifts already on the board keep their own times.
  if (path === "/api/work/schedule/shifts" && method === "POST") {
    if (!c.can("schedule.manage")) return c.err("Admin only", 403);
    const r = checkShift(await body(c));
    if (r.error) return c.err(r.error);
    try {
      const dup = await db.prepare("SELECT key FROM schedule_shift_presets WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL").bind(r.name).first();
      if (dup) return c.err("A shift with that name already exists", 409);
      const { results } = await db.prepare("SELECT key FROM schedule_shift_presets").all();
      const keys = new Set((results || []).map((x) => x.key));
      let key = slug(r.name), n = 2;
      while (keys.has(key)) key = `${slug(r.name)}-${n++}`;
      const top = await db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM schedule_shift_presets").first();
      await db.prepare("INSERT INTO schedule_shift_presets (key, name, start_time, end_time, sort) VALUES (?,?,?,?,?)").bind(key, r.name, r.start, r.end, (top?.m || 0) + 1).run();
      c.log(c.user, "schedule", `Added shift "${r.name}" ${r.start}-${r.end}`);
      return c.ok({ shift: { key, name: r.name, start_time: r.start, end_time: r.end } }, 201);
    } catch (e) {
      if (/no such table/i.test(String(e && e.message))) return c.err("Shift times are not set up yet (schema_v26 has not been run)", 503);
      throw e;
    }
  }
  m = path.match(/^\/api\/work\/schedule\/shifts\/([a-z0-9-]+)\/(update|delete)$/);
  if (m && method === "POST") {
    if (!c.can("schedule.manage")) return c.err("Admin only", 403);
    try {
      const cur = await db.prepare("SELECT key, name, start_time, end_time FROM schedule_shift_presets WHERE key = ? AND deleted_at IS NULL").bind(m[1]).first();
      if (!cur) return c.err("Shift not found", 404);
      if (m[2] === "delete") {
        await db.prepare("UPDATE schedule_shift_presets SET deleted_at = datetime('now') WHERE key = ?").bind(cur.key).run();
        c.log(c.user, "schedule", `Removed shift "${cur.name}" from the quick-fill list`);
        return c.ok({ ok: true });
      }
      const b = await body(c);
      const r = checkShift({ name: b.name ?? cur.name, start_time: b.start_time ?? cur.start_time, end_time: b.end_time ?? cur.end_time });
      if (r.error) return c.err(r.error);
      const dup = await db.prepare("SELECT key FROM schedule_shift_presets WHERE name = ? COLLATE NOCASE AND key != ? AND deleted_at IS NULL").bind(r.name, cur.key).first();
      if (dup) return c.err("A shift with that name already exists", 409);
      await db.prepare("UPDATE schedule_shift_presets SET name = ?, start_time = ?, end_time = ? WHERE key = ?").bind(r.name, r.start, r.end, cur.key).run();
      c.log(c.user, "schedule", `Changed shift "${cur.name}" to "${r.name}" ${r.start}-${r.end}`);
      return c.ok({ shift: { key: cur.key, name: r.name, start_time: r.start, end_time: r.end } });
    } catch (e) {
      if (/no such table/i.test(String(e && e.message))) return c.err("Shift times are not set up yet (schema_v26 has not been run)", 503);
      throw e;
    }
  }

  // ───────────── swaps (admin) ─────────────
  if (path === "/api/work/schedule/swaps" && method === "GET") {
    if (!c.can("schedule.swaps")) return c.err("Admin only", 403);
    const { results } = await db.prepare(
      `SELECT s.id, s.item_id, s.from_user, s.note, s.status, s.created_at,
              i.title, i.date, i.start_time, i.end_time, i.who, i.repeat
         FROM schedule_swaps s JOIN schedule_items i ON i.id = s.item_id AND i.deleted_at IS NULL
        ORDER BY s.status = 'open' DESC, s.id DESC LIMIT 200`
    ).all();
    return c.ok({ swaps: (results || []).map((r) => ({
      id: r.id, item_id: r.item_id, from_user: r.from_user, note: r.note || "", status: r.status, created_at: r.created_at,
      item: { id: r.item_id, title: r.title, date: r.date, start_time: r.start_time || null, end_time: r.end_time || null, who: parseList(r.who), repeat: r.repeat },
    })) });
  }
  m = path.match(/^\/api\/work\/schedule\/swaps\/(\d+)$/);
  if (m && method === "POST") {
    if (!c.can("schedule.swaps")) return c.err("Admin only", 403);
    const b = await body(c);
    if (b.status !== "approved" && b.status !== "declined") return c.err("status must be approved or declined");
    const id = Number(m[1]);
    const cur = await db.prepare("SELECT id, status, from_user, item_id FROM schedule_swaps WHERE id = ?").bind(id).first();
    if (!cur) return c.err("Swap request not found", 404);
    if (cur.status !== "open") return c.err(`This request was already ${cur.status}`, 409);
    await db.prepare("UPDATE schedule_swaps SET status = ? WHERE id = ?").bind(b.status, id).run();
    c.log(c.user, "schedule", `${b.status === "approved" ? "Approved" : "Declined"} swap #${id} (${cur.from_user}, shift #${cur.item_id})`);
    return c.ok({ swap: { ...cur, status: b.status } });
  }

  return null;
}
