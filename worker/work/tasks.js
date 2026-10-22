// tasks-backend routes: people, tasks (list/get/create/update/status/checklist/comments/delete), workload.
// Mounted by worker/work/index.js after requireAuth. Returns a Response, or null for paths that are not ours.
// Contract: docs/design/BUILD-CONTRACT.md sections 2-3. Tables: schema/schema_v25_work.sql. Parameterised SQL only.
//
// Rules enforced here (not only in the UI):
//  - admin (users.manage_users) sees/edits everything; others see tasks where they are assignee, owner or observer.
//  - viewers (can_edit false) are read-only. Observers can read + comment only.
//  - start/pause/complete: the assignee only. defer/reopen: assignee, owner or admin.
//  - one ongoing task per person (DB index uq_one_ongoing_per_person; the API answers 409).
//  - started_at is set only while status='progress'; spent_seconds accumulates elapsed time.
//  - delete is soft (deleted_at/deleted_by); an ongoing task becomes 'pending' first so a later restore cannot clash.

const STATUSES = ["pending", "progress", "done", "deferred"];
const DEADLINE_DAYS = { "Same day": 0, "1 day": 1, "2 days": 2, "3 days": 3, "7 days": 7, "No deadline": null };

const mytToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const mytShift = (date, days) => { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const isTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uniq = (a) => [...new Set(a)];
const holes = (arr) => arr.map(() => "?").join(",");
const parseList = (s) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch { return []; } };
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const blank = (v) => v === undefined || v === null || v === "";
const isUnique = (e) => /UNIQUE/i.test(String(e && e.message));

// seconds elapsed since started_at (SQL fragment, safe when started_at is NULL)
const ELAPSED = "MAX(0, COALESCE(CAST(strftime('%s','now') AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER), 0))";

async function body(c) { try { const b = await c.request.json(); return b && typeof b === "object" && !Array.isArray(b) ? b : {}; } catch { return {}; } }

// ── people / permissions ──────────────────────────────────────────────────────────────────────
const canEditAny = (c) => c.can("tasks.use");
const noEdit = (c) => c.err("View-only — your account has no edit permission", 403);

async function existingUsers(db, names) {
  const list = uniq((Array.isArray(names) ? names : []).filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim())).slice(0, 80);
  if (!list.length) return [];
  const { results } = await db.prepare(`SELECT username FROM users WHERE username IN (${holes(list)})`).bind(...list).all();
  return (results || []).map((r) => r.username);
}

// ── task shaping ──────────────────────────────────────────────────────────────────────────────
const TASK_SELECT =
  `SELECT t.id, t.title, t.description, t.status, t.high_priority, t.owner, t.assignee, t.project_id, t.flow_id, t.parent_id,
          t.due_date, t.due_time, t.est_minutes, t.started_at, t.spent_seconds, t.completed_at, t.tags, t.linked_player,
          t.created_at, t.updated_at,
          (SELECT COUNT(*) FROM task_checklist k WHERE k.task_id = t.id) AS checklist_total,
          (SELECT COUNT(*) FROM task_checklist k WHERE k.task_id = t.id AND k.done = 1) AS checklist_done,
          (SELECT COUNT(*) FROM task_comments m WHERE m.task_id = t.id) AS comment_count
     FROM tasks t`;

async function shape(db, rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { results } = await db.prepare(`SELECT task_id, username FROM task_observers WHERE task_id IN (${holes(ids)}) ORDER BY username`).bind(...ids).all();
  const obs = new Map(ids.map((i) => [i, []]));
  for (const o of results || []) obs.get(o.task_id)?.push(o.username);
  return rows.map((r) => ({ ...r, tags: parseList(r.tags), observers: obs.get(r.id) || [] }));
}

async function loadTask(db, id) {
  const row = await db.prepare(`${TASK_SELECT} WHERE t.id = ? AND t.deleted_at IS NULL`).bind(id).first();
  return row ? (await shape(db, [row]))[0] : null;
}

const isObserver = (t, me) => t.observers.includes(me);
const canSee = (c, t) => c.can("tasks.view_all") || t.assignee === c.user.username || t.owner === c.user.username || isObserver(t, c.user.username);
const canEditTask = (c, t) => c.can("tasks.edit_any") || t.assignee === c.user.username || t.owner === c.user.username;

// Loads a task and applies visibility. Returns { t } or { res } (a ready error response).
async function getVisible(c, id) {
  const t = await loadTask(c.env.DB, id);
  if (!t) return { res: c.err("Task not found", 404) };
  if (!canSee(c, t)) return { res: c.err("You do not have access to this task", 403) };
  return { t };
}

const act = (db, taskId, actor, text) => db.prepare("INSERT INTO task_activity (task_id, actor, text) VALUES (?, ?, ?)").bind(taskId, actor, text);

// Agent project rule: admin any live project; others need membership or a team-privacy project.
async function projectCheck(c, projectId) {
  const p = await c.env.DB.prepare("SELECT id, privacy FROM projects WHERE id = ? AND deleted_at IS NULL").bind(projectId).first();
  if (!p) return c.err("Project not found", 404);
  if (c.can("projects.manage") || p.privacy === "team") return null;
  const m = await c.env.DB.prepare("SELECT 1 AS x FROM project_members WHERE project_id = ? AND username = ?").bind(projectId, c.user.username).first();
  return m ? null : c.err("You are not a member of that project", 403);
}

const intOrNull = (v) => { const n = Number(v); return Number.isInteger(n) ? n : null; };

// Validates the optional links/fields shared by create and update. `b` is the body; `only` = keys to check.
async function checkFields(c, b, keys) {
  const db = c.env.DB;
  if (keys.includes("due_date") && !blank(b.due_date) && !isDate(b.due_date)) return c.err("due_date must be YYYY-MM-DD");
  if (keys.includes("due_time") && !blank(b.due_time) && !isTime(b.due_time)) return c.err("due_time must be HH:MM");
  if (keys.includes("est_minutes") && !blank(b.est_minutes) && !(Number.isInteger(Number(b.est_minutes)) && Number(b.est_minutes) >= 0 && Number(b.est_minutes) <= 100000)) return c.err("est_minutes must be a whole number of minutes");
  if (keys.includes("project_id") && !blank(b.project_id)) {
    const id = intOrNull(b.project_id);
    if (id === null) return c.err("Bad project_id");
    const r = await projectCheck(c, id);
    if (r) return r;
  }
  if (keys.includes("flow_id") && !blank(b.flow_id)) {
    const id = intOrNull(b.flow_id);
    if (id === null || !(await db.prepare("SELECT id FROM flows WHERE id = ? AND deleted_at IS NULL").bind(id).first())) return c.err("Flow not found", 404);
  }
  if (keys.includes("parent_id") && !blank(b.parent_id)) {
    const id = intOrNull(b.parent_id);
    if (id === null) return c.err("Bad parent_id");
    const p = await loadTask(db, id);
    if (!p) return c.err("Parent task not found", 404);
    if (!canSee(c, p)) return c.err("You do not have access to the parent task", 403);
    if (b.__self !== undefined && id === b.__self) return c.err("A task cannot be its own parent");
  }
  return null;
}

const cleanTags = (v) => uniq((Array.isArray(v) ? v : []).map((x) => str(x, 40)).filter(Boolean)).slice(0, 20);

// ── GET /people ───────────────────────────────────────────────────────────────────────────────
async function people(c) {
  const { results } = await c.env.DB.prepare("SELECT username, role, team FROM users ORDER BY username COLLATE NOCASE").all();
  return c.ok({ people: (results || []).map((u) => ({ username: u.username, role: u.role, team: u.team || null })) });
}

// ── GET /tasks ────────────────────────────────────────────────────────────────────────────────
async function list(c) {
  const q = c.url.searchParams, me = c.user.username;
  const where = ["t.deleted_at IS NULL"], binds = [];
  const assignee = q.get("assignee");
  if (assignee) {
    if (!c.can("tasks.view_all") && assignee !== me) return c.err("You can only filter by your own username", 403);
    where.push("t.assignee = ?"); binds.push(assignee);
  }
  const status = q.get("status");
  if (status) {
    if (!STATUSES.includes(status)) return c.err(`status must be one of: ${STATUSES.join(", ")}`);
    where.push("t.status = ?"); binds.push(status);
  } else if (q.get("include") !== "done") where.push("t.status != 'done'");
  for (const [key, col] of [["project_id", "t.project_id"], ["flow_id", "t.flow_id"]]) {
    const v = q.get(key);
    if (v) { const n = intOrNull(v); if (n === null) return c.err(`Bad ${key}`); where.push(`${col} = ?`); binds.push(n); }
  }
  const text = str(q.get("q") || "", 100);
  if (text) {
    const like = "%" + text.replace(/[\\%_]/g, (m) => "\\" + m) + "%";
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\' OR t.tags LIKE ? ESCAPE '\\' OR t.linked_player LIKE ? ESCAPE '\\')");
    binds.push(like, like, like, like);
  }
  if (!c.can("tasks.view_all")) {
    where.push("(t.assignee = ? OR t.owner = ? OR EXISTS (SELECT 1 FROM task_observers o WHERE o.task_id = t.id AND o.username = ?))");
    binds.push(me, me, me);
  }
  const { results } = await c.env.DB.prepare(
    `${TASK_SELECT} WHERE ${where.join(" AND ")}
      ORDER BY t.status = 'progress' DESC, t.high_priority DESC, t.due_date IS NULL, t.due_date, t.due_time IS NULL, t.due_time, t.id DESC LIMIT 2000`
  ).bind(...binds).all();
  return c.ok({ tasks: await shape(c.env.DB, results || []) });
}

// ── GET /tasks/:id ────────────────────────────────────────────────────────────────────────────
async function getOne(c, id) {
  const db = c.env.DB;
  const v = await getVisible(c, id);
  if (v.res) return v.res;
  const [cl, cm, ac] = await Promise.all([
    db.prepare("SELECT id, text, done, pos FROM task_checklist WHERE task_id = ? ORDER BY pos, id").bind(id).all(),
    db.prepare("SELECT id, author, body, created_at FROM task_comments WHERE task_id = ? ORDER BY id").bind(id).all(),
    db.prepare("SELECT id, actor, text, created_at FROM task_activity WHERE task_id = ? ORDER BY id DESC LIMIT 100").bind(id).all(),
  ]);
  return c.ok({ task: v.t, checklist: cl.results || [], observers: v.t.observers, comments: cm.results || [], activity: ac.results || [] });
}

// ── POST /tasks (create) ──────────────────────────────────────────────────────────────────────
async function create(c) {
  if (!canEditAny(c)) return noEdit(c);
  const db = c.env.DB, me = c.user.username, b = await body(c);

  let tpl = null;
  if (!blank(b.template_id)) {
    const tid = intOrNull(b.template_id);
    tpl = tid === null ? null : await db.prepare("SELECT id, name, deadline, assignee, checklist FROM task_templates WHERE id = ? AND deleted_at IS NULL").bind(tid).first();
    if (!tpl) return c.err("Template not found", 404);
  }
  const title = str(b.title, 200) || (tpl ? str(tpl.name, 200) : "");
  if (!title) return c.err("Title is required");

  const bad = await checkFields(c, b, ["due_date", "due_time", "est_minutes", "project_id", "flow_id", "parent_id"]);
  if (bad) return bad;

  // agents can only create for themselves; admin may pick anyone (or the template's assignee)
  let assignee = me;
  if (c.can("tasks.assign_others")) {
    const want = !blank(b.assignee) ? b.assignee : tpl && tpl.assignee ? tpl.assignee : me;
    if (!(await existingUsers(db, [want])).length) return c.err("Assignee is not a known user");
    assignee = String(want).trim();
  }

  let due = blank(b.due_date) ? null : b.due_date;
  if (due === null && blank(b.due_date) && tpl) {
    const n = DEADLINE_DAYS[tpl.deadline];
    if (n !== undefined && n !== null) due = mytShift(mytToday(), n);
  }

  let items = Array.isArray(b.checklist) ? b.checklist.map((x) => str(x, 200)).filter(Boolean) : [];
  if (!items.length && tpl) items = parseList(tpl.checklist).map((x) => str(x, 200)).filter(Boolean);
  items = items.slice(0, 100);
  const observers = (await existingUsers(db, b.observers)).filter((u) => u !== assignee).slice(0, 30);

  const ins = await db.prepare(
    `INSERT INTO tasks (title, description, status, high_priority, owner, assignee, project_id, flow_id, parent_id,
                        due_date, due_time, est_minutes, tags, linked_player)
     VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title, str(b.description, 5000) || null, b.high_priority ? 1 : 0, me, assignee,
    blank(b.project_id) ? null : Number(b.project_id), blank(b.flow_id) ? null : Number(b.flow_id), blank(b.parent_id) ? null : Number(b.parent_id),
    due, blank(b.due_time) ? null : b.due_time, blank(b.est_minutes) ? null : Number(b.est_minutes),
    JSON.stringify(cleanTags(b.tags)), str(b.linked_player, 120) || null
  ).run();
  const id = ins.meta.last_row_id;
  await db.batch([
    ...items.map((text, i) => db.prepare("INSERT INTO task_checklist (task_id, text, done, pos) VALUES (?, ?, 0, ?)").bind(id, text, i + 1)),
    ...observers.map((u) => db.prepare("INSERT OR IGNORE INTO task_observers (task_id, username) VALUES (?, ?)").bind(id, u)),
    act(db, id, me, "Created the task"),
  ]);
  c.log(c.user, "task", `Created task #${id} "${title}"${assignee !== me ? ` for ${assignee}` : ""}`);
  return c.ok({ task: await loadTask(db, id) }, 201);
}

// ── POST /tasks/:id/update ────────────────────────────────────────────────────────────────────
const FIELD_LABEL = { title: "title", description: "description", high_priority: "priority", project_id: "project", flow_id: "flow", parent_id: "parent task",
  due_date: "due date", due_time: "due time", est_minutes: "estimate", tags: "tags", linked_player: "linked player", observers: "observers" };

async function update(c, id) {
  if (!canEditAny(c)) return noEdit(c);
  const db = c.env.DB, me = c.user.username, b = await body(c);
  const v = await getVisible(c, id);
  if (v.res) return v.res;
  const t = v.t;
  if (!canEditTask(c, t)) return c.err("Only the assignee, owner or an admin can edit this task", 403);

  const sets = [], binds = [], changed = [], extra = [];

  if (has(b, "assignee") && !blank(b.assignee) && String(b.assignee).trim() !== t.assignee) {
    if (!c.can("tasks.assign_others")) return c.err("Only an admin can reassign a task", 403);
    if (t.status === "progress") return c.err("Pause the task before reassigning it", 400);
    const who = String(b.assignee).trim();
    if (!(await existingUsers(db, [who])).length) return c.err("Assignee is not a known user");
    sets.push("assignee = ?"); binds.push(who);
    extra.push(act(db, id, me, `Reassigned the task from ${t.assignee} to ${who}`));
  }

  const keys = ["due_date", "due_time", "est_minutes", "project_id", "flow_id", "parent_id"].filter((k) => has(b, k));
  const bad = await checkFields(c, { ...b, __self: id }, keys);
  if (bad) return bad;

  if (has(b, "title")) { const s = str(b.title, 200); if (!s) return c.err("Title cannot be empty"); sets.push("title = ?"); binds.push(s); changed.push("title"); }
  if (has(b, "description")) { sets.push("description = ?"); binds.push(str(b.description, 5000) || null); changed.push("description"); }
  if (has(b, "high_priority")) { sets.push("high_priority = ?"); binds.push(b.high_priority ? 1 : 0); changed.push("high_priority"); }
  if (has(b, "linked_player")) { sets.push("linked_player = ?"); binds.push(str(b.linked_player, 120) || null); changed.push("linked_player"); }
  if (has(b, "tags")) { sets.push("tags = ?"); binds.push(JSON.stringify(cleanTags(b.tags))); changed.push("tags"); }
  for (const k of keys) {
    sets.push(`${k} = ?`);
    binds.push(blank(b[k]) ? null : k === "due_date" || k === "due_time" ? b[k] : Number(b[k]));
    changed.push(k);
  }
  if (has(b, "observers")) {
    const obs = (await existingUsers(db, b.observers)).filter((u) => u !== (sets.includes("assignee = ?") ? binds[sets.indexOf("assignee = ?")] : t.assignee)).slice(0, 30);
    extra.push(db.prepare("DELETE FROM task_observers WHERE task_id = ?").bind(id));
    for (const u of obs) extra.push(db.prepare("INSERT OR IGNORE INTO task_observers (task_id, username) VALUES (?, ?)").bind(id, u));
    changed.push("observers");
  }

  if (!sets.length && !extra.length) return c.err("Nothing to update");
  const stmts = [];
  if (sets.length || changed.length) stmts.push(db.prepare(`UPDATE tasks SET ${[...sets, "updated_at = datetime('now')"].join(", ")} WHERE id = ? AND deleted_at IS NULL`).bind(...binds, id));
  stmts.push(...extra);
  if (changed.length) stmts.push(act(db, id, me, `Edited ${uniq(changed.map((k) => FIELD_LABEL[k] || k)).join(", ")}`));
  try { await db.batch(stmts); }
  catch (e) { if (isUnique(e)) return ongoingClash(c, sets.includes("assignee = ?") ? binds[sets.indexOf("assignee = ?")] : t.assignee); throw e; }
  return c.ok({ task: await loadTask(db, id) });
}

// ── POST /tasks/:id/status ────────────────────────────────────────────────────────────────────
async function ongoingClash(c, who, exceptId = null) {
  const o = await c.env.DB.prepare(`SELECT id, title FROM tasks WHERE assignee = ? AND status = 'progress' AND deleted_at IS NULL${exceptId ? " AND id != ?" : ""}`)
    .bind(...(exceptId ? [who, exceptId] : [who])).first();
  return c.ok({ error: `${who} already has an ongoing task`, ongoing: o || null }, 409);
}

async function status(c, id) {
  if (!canEditAny(c)) return noEdit(c);
  const db = c.env.DB, me = c.user.username, b = await body(c), action = b.action;
  if (!["start", "pause", "complete", "defer", "reopen"].includes(action)) return c.err("action must be start, pause, complete, defer or reopen");
  const v = await getVisible(c, id);
  if (v.res) return v.res;
  const t = v.t;

  if (["start", "pause", "complete"].includes(action)) {
    if (t.assignee !== me) return c.err("Only the assignee can start, pause or complete this task", 403);
  } else if (!canEditTask(c, t)) return c.err("Only the assignee, owner or an admin can do that", 403);

  const W = "WHERE id = ? AND deleted_at IS NULL AND status = ?";   // status guard keeps double-clicks from double-counting
  const touch = "updated_at = datetime('now')";
  let sql, text;
  switch (action) {
    case "start":
      if (t.status === "progress") return c.err("Task is already in progress");
      if (t.status === "done") return c.err("Task is done — reopen it first");
      {
        const o = await db.prepare("SELECT id, title FROM tasks WHERE assignee = ? AND status = 'progress' AND deleted_at IS NULL AND id != ?").bind(t.assignee, id).first();
        if (o) return c.ok({ error: `${t.assignee} already has an ongoing task`, ongoing: o }, 409);
      }
      sql = `UPDATE tasks SET status = 'progress', started_at = datetime('now'), ${touch} ${W}`; text = "Started the task"; break;
    case "pause":
      if (t.status !== "progress") return c.err("Only a task in progress can be paused");
      sql = `UPDATE tasks SET status = 'pending', spent_seconds = spent_seconds + ${ELAPSED}, started_at = NULL, ${touch} ${W}`; text = "Paused the task"; break;
    case "complete":
      if (t.status !== "progress") return c.err("Start the task before completing it");
      sql = `UPDATE tasks SET status = 'done', spent_seconds = spent_seconds + ${ELAPSED}, started_at = NULL, completed_at = datetime('now'), ${touch} ${W}`; text = "Completed the task"; break;
    case "defer":
      if (t.status === "done" || t.status === "deferred") return c.err(`A ${t.status} task cannot be deferred`);
      sql = `UPDATE tasks SET status = 'deferred', spent_seconds = spent_seconds + ${t.status === "progress" ? ELAPSED : "0"}, started_at = NULL, ${touch} ${W}`; text = "Deferred the task"; break;
    case "reopen":
      if (t.status !== "done" && t.status !== "deferred") return c.err("Only a done or deferred task can be reopened");
      sql = `UPDATE tasks SET status = 'pending', started_at = NULL, completed_at = NULL, ${touch} ${W}`; text = "Reopened the task"; break;
  }
  let r;
  try { r = await db.prepare(sql).bind(id, t.status).run(); }
  catch (e) { if (isUnique(e)) return ongoingClash(c, t.assignee, id); throw e; }
  if (!r.meta.changes) return c.err("The task changed while you were doing that — refresh and try again", 409);
  await act(db, id, me, text).run();
  if (action === "complete" || action === "defer" || action === "reopen") c.log(c.user, "task", `${text.replace(" the task", "")} task #${id} "${t.title}"`);
  return c.ok({ task: await loadTask(db, id) });
}

// ── POST /tasks/:id/checklist ─────────────────────────────────────────────────────────────────
async function checklist(c, id) {
  if (!canEditAny(c)) return noEdit(c);
  const db = c.env.DB, me = c.user.username, b = await body(c);
  const v = await getVisible(c, id);
  if (v.res) return v.res;
  if (!canEditTask(c, v.t)) return c.err("Only the assignee, owner or an admin can change the checklist", 403);

  if (b.action === "add") {
    const text = str(b.text, 200);
    if (!text) return c.err("text is required");
    const cnt = await db.prepare("SELECT COUNT(*) AS n, COALESCE(MAX(pos), 0) AS p FROM task_checklist WHERE task_id = ?").bind(id).first();
    if (cnt.n >= 100) return c.err("A task can have at most 100 checklist items");
    await db.batch([
      db.prepare("INSERT INTO task_checklist (task_id, text, done, pos) VALUES (?, ?, 0, ?)").bind(id, text, cnt.p + 1),
      act(db, id, me, `Added checklist item "${text}"`),
      db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").bind(id),
    ]);
  } else if (b.action === "toggle" || b.action === "remove") {
    const itemId = intOrNull(b.item_id);
    const item = itemId === null ? null : await db.prepare("SELECT id, text, done FROM task_checklist WHERE id = ? AND task_id = ?").bind(itemId, id).first();
    if (!item) return c.err("Checklist item not found", 404);
    if (b.action === "toggle") {
      await db.batch([
        db.prepare("UPDATE task_checklist SET done = ? WHERE id = ?").bind(item.done ? 0 : 1, item.id),
        act(db, id, me, `${item.done ? "Unchecked" : "Checked off"} "${item.text}"`),
        db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").bind(id),
      ]);
    } else {
      await db.batch([
        db.prepare("DELETE FROM task_checklist WHERE id = ?").bind(item.id),
        act(db, id, me, `Removed checklist item "${item.text}"`),
        db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").bind(id),
      ]);
    }
  } else return c.err("action must be add, toggle or remove");

  const { results } = await db.prepare("SELECT id, text, done, pos FROM task_checklist WHERE task_id = ? ORDER BY pos, id").bind(id).all();
  return c.ok({ checklist: results || [] });
}

// ── POST /tasks/:id/comments ──────────────────────────────────────────────────────────────────
async function comments(c, id) {
  if (!canEditAny(c)) return noEdit(c);
  const db = c.env.DB, b = await body(c);
  const v = await getVisible(c, id);   // assignee, owner, observer or admin may comment
  if (v.res) return v.res;
  const text = str(b.body, 2000);
  if (!text) return c.err("body is required");
  await db.batch([
    db.prepare("INSERT INTO task_comments (task_id, author, body) VALUES (?, ?, ?)").bind(id, c.user.username, text),
    db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").bind(id),
  ]);
  const { results } = await db.prepare("SELECT id, author, body, created_at FROM task_comments WHERE task_id = ? ORDER BY id").bind(id).all();
  return c.ok({ comments: results || [] });
}

// ── POST /tasks/:id/delete ────────────────────────────────────────────────────────────────────
async function remove(c, id) {
  if (!canEditAny(c)) return noEdit(c);
  const db = c.env.DB, me = c.user.username;
  const v = await getVisible(c, id);
  if (v.res) return v.res;
  const t = v.t;
  if (!c.can("tasks.delete_any") && t.owner !== me) return c.err("Only the owner or an admin can delete this task", 403);
  // an ongoing task goes back to 'pending' (elapsed kept) so a later restore can never clash with uq_one_ongoing_per_person
  await db.batch([
    db.prepare(
      `UPDATE tasks SET deleted_at = datetime('now'), deleted_by = ?, updated_at = datetime('now'),
              spent_seconds = spent_seconds + CASE WHEN status = 'progress' THEN ${ELAPSED} ELSE 0 END,
              status = CASE WHEN status = 'progress' THEN 'pending' ELSE status END,
              started_at = NULL
        WHERE id = ? AND deleted_at IS NULL`).bind(me, id),
    act(db, id, me, "Deleted the task"),
  ]);
  c.log(c.user, "task", `Deleted task #${id} "${t.title}"`);
  return c.ok({ ok: true });
}

// ── GET /workload (admin) ─────────────────────────────────────────────────────────────────────
// Admin: everyone (each row carries `team`; the page filters). Anyone else: only their own team (just themselves when they have no team).
async function workload(c) {
  const db = c.env.DB, today = mytToday();
  const [users, agg, ong] = await Promise.all([
    db.prepare("SELECT username, team, (can_edit = 1 OR manage_users = 1) AS listed FROM users").all(),     // everyone's team is known; only those who can act get a card
    db.prepare(
      `SELECT assignee AS username,
              SUM(status != 'done') AS assigned,
              SUM(status != 'done' AND due_date IS NOT NULL AND due_date < ?) AS overdue,
              SUM(status = 'done') AS done,
              SUM(status = 'pending') AS waiting
         FROM tasks WHERE deleted_at IS NULL GROUP BY assignee`).bind(today).all(),
    db.prepare(
      `SELECT t.assignee AS username, t.id, t.title, t.started_at, t.spent_seconds, t.est_minutes,
              (SELECT COUNT(*) FROM task_checklist k WHERE k.task_id = t.id AND k.done = 1) AS checklist_done,
              (SELECT COUNT(*) FROM task_checklist k WHERE k.task_id = t.id) AS checklist_total
         FROM tasks t WHERE t.status = 'progress' AND t.deleted_at IS NULL`).all(),
  ]);
  const by = new Map();
  const teamOf = new Map((users.results || []).map((u) => [u.username, u.team || null]));
  const get = (u) => { if (!by.has(u)) by.set(u, { username: u, team: teamOf.get(u) || null, assigned: 0, overdue: 0, done: 0, waiting: 0, ongoing: null }); return by.get(u); };
  for (const u of users.results || []) if (u.listed) get(u.username);
  for (const r of agg.results || []) Object.assign(get(r.username), { assigned: r.assigned || 0, overdue: r.overdue || 0, done: r.done || 0, waiting: r.waiting || 0 });
  for (const r of ong.results || []) {
    const { username, ...o } = r;
    get(username).ongoing = o;
  }
  const mine = c.user.team || null;
  const rows = [...by.values()].filter((p) => c.can("workload.all") || p.username === c.user.username || (mine && p.team === mine));
  return c.ok({ people: rows.sort((a, b) => a.username.localeCompare(b.username)), my_team: mine });
}

// ── router ────────────────────────────────────────────────────────────────────────────────────
export async function handleTasks(c) {
  const { path, method } = c;
  if (path === "/api/work/people" && method === "GET") return people(c);
  if (path === "/api/work/workload" && method === "GET") return workload(c);
  if (path === "/api/work/tasks") {
    if (method === "GET") return list(c);
    if (method === "POST") return create(c);
    return null;
  }
  const m = path.match(/^\/api\/work\/tasks\/(\d+)(?:\/(update|status|checklist|comments|delete))?$/);
  if (!m) return null;
  const id = Number(m[1]);
  if (!m[2]) return method === "GET" ? getOne(c, id) : null;
  if (method !== "POST") return null;
  switch (m[2]) {
    case "update": return update(c, id);
    case "status": return status(c, id);
    case "checklist": return checklist(c, id);
    case "comments": return comments(c, id);
    case "delete": return remove(c, id);
  }
  return null;
}
