// work-setup routes: projects, flows, templates, analytics, efficiency, recycle bin.
// Mounted by worker/work/index.js after requireAuth. Returns a Response, or null for paths that are not ours.
// Contract: docs/design/BUILD-CONTRACT.md section 3. Tables: schema/schema_v25_work.sql. Parameterised SQL only.
//
// Time: tasks.created_at / completed_at are UTC 'YYYY-MM-DD HH:MM:SS'. Deadlines (due_date) are Malaysia dates,
// so every "on time" test converts the UTC stamp with date(x,'+8 hours') before comparing to due_date.

const DEADLINES = ["Same day", "1 day", "2 days", "3 days", "7 days", "No deadline"];
const BIN_TYPES = { task: "tasks", project: "projects", flow: "flows", template: "task_templates" };
const BIN_NAME = { task: "title", project: "name", flow: "name", template: "name" };
const BIN_DAYS = 30;

const mytToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const mytShift = (date, days) => { const d = new Date(date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const mytMonday = (date) => { const d = new Date(date + "T00:00:00Z"); return mytShift(date, -((d.getUTCDay() + 6) % 7)); };
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uniq = (a) => [...new Set(a)];
const pct = (num, den) => (den > 0 ? Math.round((100 * num) / den) : null);
const parseList = (s) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch { return []; } };
const ratingFor = (eff) => (eff === null ? "No data" : eff >= 85 ? "Excellent" : eff >= 70 ? "Good" : "Needs attention");
const holes = (arr) => arr.map(() => "?").join(",");

// A completed task counts "on time" when it was finished (Malaysia date) on or before its due date.
const ON_TIME = "t.status='done' AND t.due_date IS NOT NULL AND date(t.completed_at,'+8 hours') <= t.due_date";
const DONE_WITH_DUE = "t.status='done' AND t.due_date IS NOT NULL";

async function body(c) { try { const b = await c.request.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; } }

// Returns the subset of `names` that are real accounts.
async function existingUsers(db, names) {
  const list = uniq(names.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim())).slice(0, 80);
  if (!list.length) return [];
  const { results } = await db.prepare(`SELECT username FROM users WHERE username IN (${holes(list)})`).bind(...list).all();
  return (results || []).map((r) => r.username);
}

async function membersOf(db, ids) {
  const map = new Map(ids.map((i) => [i, []]));
  if (!ids.length) return map;
  const { results } = await db.prepare(`SELECT project_id, username, role FROM project_members WHERE project_id IN (${holes(ids)}) ORDER BY role='owner' DESC, username`).bind(...ids).all();
  for (const r of results || []) map.get(r.project_id)?.push({ username: r.username, role: r.role });
  return map;
}

// ───────────────────────────── projects ─────────────────────────────
async function projectRows(c, { id = null, archived = null } = {}) {
  const db = c.env.DB, me = c.user.username;
  const where = ["p.deleted_at IS NULL"], binds = [];
  if (id !== null) { where.push("p.id = ?"); binds.push(id); }
  if (archived !== null) { where.push("p.archived = ?"); binds.push(archived); }
  if (!c.can("projects.manage")) { where.push("EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.username = ?)"); binds.push(me); }
  const { results } = await db.prepare(
    `SELECT p.id, p.name, p.description, p.privacy, p.archived, p.created_by, p.created_at,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_total,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL AND t.status = 'done') AS task_done,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL AND t.status != 'done'
               AND t.due_date IS NOT NULL AND t.due_date < ?) AS overdue,
            COALESCE((SELECT MAX(t.updated_at) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL), p.created_at) AS last_active
       FROM projects p WHERE ${where.join(" AND ")} ORDER BY p.archived, p.name COLLATE NOCASE`
  ).bind(mytToday(), ...binds).all();
  const rows = results || [];
  const mem = await membersOf(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, members: mem.get(r.id) || [] }));
}

/** May this person change this project? "Manage any project", or "own projects" and they own it (its creator is its owner member). */
async function mayChange(c, id) {
  if (c.can("projects.manage")) return true;
  if (!c.can("projects.use")) return false;
  return !!(await c.env.DB.prepare("SELECT 1 AS x FROM project_members WHERE project_id = ? AND username = ? AND role = 'owner'").bind(id, c.user.username).first());
}
const MINE = "You can only change projects you own";

async function projects(c, m) {
  const { path, method } = c, db = c.env.DB;
  if (path === "/api/work/projects" && method === "GET") {
    const a = c.url.searchParams.get("archived");
    return c.ok({ projects: await projectRows(c, { archived: a === "1" ? 1 : 0 }) });
  }
  if (path === "/api/work/projects" && method === "POST") {
    if (!c.can("projects.manage") && !c.can("projects.use")) return c.err("You do not have permission to create projects", 403);
    const b = await body(c);
    const name = str(b.name, 120);
    if (!name) return c.err("Project name is required");
    const privacy = b.privacy === "team" ? "team" : "members";
    const description = str(b.description, 2000);
    const wanted = await existingUsers(db, Array.isArray(b.members) ? b.members : []);
    const id = b.id !== undefined && b.id !== null && b.id !== "" ? Number(b.id) : null;
    if (id !== null) {
      if (!Number.isInteger(id)) return c.err("Bad project id");
      const cur = await db.prepare("SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL").bind(id).first();
      if (!cur) return c.err("Project not found", 404);
      if (!(await mayChange(c, id))) return c.err(MINE, 403);
      const keep = uniq([...wanted]);
      const stmts = [
        db.prepare("UPDATE projects SET name = ?, description = ?, privacy = ? WHERE id = ?").bind(name, description, privacy, id),
        // the owner is never removed by an edit
        db.prepare(`DELETE FROM project_members WHERE project_id = ? AND role != 'owner'${keep.length ? ` AND username NOT IN (${holes(keep)})` : ""}`).bind(id, ...keep),
        ...keep.map((u) => db.prepare("INSERT OR IGNORE INTO project_members (project_id, username, role) VALUES (?, ?, 'member')").bind(id, u)),
      ];
      await db.batch(stmts);
      c.log(c.user, "work", `Edited project #${id} "${name}"`);
      return c.ok({ project: (await projectRows(c, { id }))[0] });
    }
    const ins = await db.prepare("INSERT INTO projects (name, description, privacy, created_by) VALUES (?, ?, ?, ?)").bind(name, description, privacy, c.user.username).run();
    const nid = ins.meta.last_row_id;
    const people = uniq([c.user.username, ...wanted]);
    await db.batch(people.map((u) => db.prepare("INSERT OR IGNORE INTO project_members (project_id, username, role) VALUES (?, ?, ?)").bind(nid, u, u === c.user.username ? "owner" : "member")));
    c.log(c.user, "work", `Created project #${nid} "${name}"`);
    return c.ok({ project: (await projectRows(c, { id: nid }))[0] }, 201);
  }
  if ((m = path.match(/^\/api\/work\/projects\/(\d+)$/)) && method === "GET") {
    const p = (await projectRows(c, { id: Number(m[1]) }))[0];
    if (!p) return c.err("Project not found", 404);
    // member activity feed, limited to tasks this person may see (admin: all; agent: assignee/owner/observer)
    const scope = c.can("tasks.view_all") ? "" : " AND (t.assignee = ? OR t.owner = ? OR EXISTS (SELECT 1 FROM task_observers o WHERE o.task_id = t.id AND o.username = ?))";
    const sb = c.can("tasks.view_all") ? [] : [c.user.username, c.user.username, c.user.username];
    const { results } = await db.prepare(
      `SELECT a.id, a.actor, a.text, a.created_at, t.id AS task_id, t.title FROM task_activity a JOIN tasks t ON t.id = a.task_id
        WHERE t.project_id = ? AND t.deleted_at IS NULL${scope} ORDER BY a.id DESC LIMIT 30`
    ).bind(p.id, ...sb).all();
    const act = await db.prepare(
      `SELECT assignee AS username, COUNT(*) AS n FROM tasks WHERE project_id = ? AND deleted_at IS NULL AND status != 'done' GROUP BY assignee`
    ).bind(p.id).all();
    const active = Object.fromEntries((act.results || []).map((r) => [r.username, r.n]));
    p.members = p.members.map((x) => ({ ...x, active: active[x.username] || 0 }));
    return c.ok({ project: p, activity: results || [] });
  }
  if ((m = path.match(/^\/api\/work\/projects\/(\d+)\/archive$/)) && method === "POST") {
    const b = await body(c), id = Number(m[1]);
    if (!(await mayChange(c, id))) return c.err(c.can("projects.use") ? MINE : "You do not have permission to change projects", 403);
    const r = await db.prepare("UPDATE projects SET archived = ? WHERE id = ? AND deleted_at IS NULL").bind(b.archived ? 1 : 0, id).run();
    if (!r.meta.changes) return c.err("Project not found", 404);
    c.log(c.user, "work", `${b.archived ? "Archived" : "Unarchived"} project #${id}`);
    return c.ok({ project: (await projectRows(c, { id }))[0] });
  }
  if ((m = path.match(/^\/api\/work\/projects\/(\d+)\/delete$/)) && method === "POST") {  // soft delete -> Recycle bin
    const id = Number(m[1]);
    if (!(await mayChange(c, id))) return c.err(c.can("projects.use") ? MINE : "You do not have permission to delete projects", 403);
    const r = await db.prepare("UPDATE projects SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ? AND deleted_at IS NULL").bind(c.user.username, id).run();
    if (!r.meta.changes) return c.err("Project not found", 404);
    c.log(c.user, "work", `Deleted project #${id}`);
    return c.ok({ ok: true });
  }
  return null;
}

// ───────────────────────────── flows (admin) ─────────────────────────────
async function flowRows(db, id = null) {
  const { results } = await db.prepare(
    `SELECT f.id, f.name, f.project_id, p.name AS project_name, f.admin_user, f.default_assignee,
            MAX(t.created_at) AS last_task_at,
            COALESCE(SUM(t.status = 'pending'), 0) AS pending,
            COALESCE(SUM(t.status = 'progress'), 0) AS in_progress,
            COALESCE(SUM(t.status = 'done'), 0) AS completed,
            COALESCE(SUM(${ON_TIME}), 0) AS on_time,
            COALESCE(SUM(${DONE_WITH_DUE}), 0) AS timed
       FROM flows f
       LEFT JOIN projects p ON p.id = f.project_id AND p.deleted_at IS NULL
       LEFT JOIN tasks t ON t.flow_id = f.id AND t.deleted_at IS NULL
      WHERE f.deleted_at IS NULL${id !== null ? " AND f.id = ?" : ""}
      GROUP BY f.id ORDER BY MAX(t.created_at) IS NULL, MAX(t.created_at) DESC, f.name COLLATE NOCASE`
  ).bind(...(id !== null ? [id] : [])).all();
  return (results || []).map(({ on_time, timed, ...f }) => {
    const efficiency = pct(on_time, timed);
    return { ...f, efficiency, rating: ratingFor(efficiency) };
  });
}

async function flows(c, m) {
  const { path, method } = c, db = c.env.DB;
  if (!path.startsWith("/api/work/flows")) return null;
  const anyFlow = c.can("flows.manage");                       // "Manage any flow"; "flows.own" reaches only the flows they administer
  if (!anyFlow && !c.can("flows.own")) return c.err("Admin only", 403);
  const meF = c.user.username, ownsFlow = async (id) => !!(await db.prepare("SELECT 1 AS x FROM flows WHERE id = ? AND admin_user = ? AND deleted_at IS NULL").bind(id, meF).first());
  if (path === "/api/work/flows" && method === "GET") { const all = await flowRows(db); return c.ok({ flows: anyFlow ? all : all.filter((f) => f.admin_user === meF) }); }
  if (path === "/api/work/flows" && method === "POST") {
    const b = await body(c), name = str(b.name, 120);
    if (!name) return c.err("Flow name is required");
    if (!anyFlow) b.admin_user = meF;                          // they become (and stay) the flow's administrator
    const [adminUser, defAssignee] = await Promise.all(["admin_user", "default_assignee"].map(async (k) => (b[k] ? (await existingUsers(db, [b[k]]))[0] || null : null)));
    if (b.admin_user && !adminUser) return c.err("Flow administrator is not a known user");
    if (b.default_assignee && !defAssignee) return c.err("Default assignee is not a known user");
    let projectId = null;
    if (b.project_id !== undefined && b.project_id !== null && b.project_id !== "") {
      projectId = Number(b.project_id);
      if (!Number.isInteger(projectId) || !(await db.prepare("SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL").bind(projectId).first())) return c.err("Project not found", 404);
    }
    let id = b.id !== undefined && b.id !== null && b.id !== "" ? Number(b.id) : null;
    if (id !== null && !anyFlow && !(await ownsFlow(id))) return c.err("You can only change flows you administer", 403);
    if (id !== null) {
      const r = await db.prepare("UPDATE flows SET name = ?, project_id = ?, admin_user = ?, default_assignee = ? WHERE id = ? AND deleted_at IS NULL").bind(name, projectId, adminUser, defAssignee, id).run();
      if (!r.meta.changes) return c.err("Flow not found", 404);
      c.log(c.user, "work", `Edited flow #${id} "${name}"`);
    } else {
      const r = await db.prepare("INSERT INTO flows (name, project_id, admin_user, default_assignee) VALUES (?, ?, ?, ?)").bind(name, projectId, adminUser, defAssignee).run();
      id = r.meta.last_row_id;
      c.log(c.user, "work", `Created flow #${id} "${name}"`);
    }
    return c.ok({ flow: (await flowRows(db, id))[0] }, b.id ? 200 : 201);
  }
  if ((m = path.match(/^\/api\/work\/flows\/(\d+)\/delete$/)) && method === "POST") {
    const id = Number(m[1]);
    if (!anyFlow && !(await ownsFlow(id))) return c.err("You can only delete flows you administer", 403);
    const r = await db.prepare("UPDATE flows SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ? AND deleted_at IS NULL").bind(c.user.username, id).run();
    if (!r.meta.changes) return c.err("Flow not found", 404);
    c.log(c.user, "work", `Deleted flow #${id}`);
    return c.ok({ ok: true });
  }
  return null;
}

// ───────────────────────────── templates (read: everyone, write: admin) ─────────────────────────────
const tplOut = (r) => ({ id: r.id, name: r.name, deadline: r.deadline, assignee: r.assignee, checklist: parseList(r.checklist), created_by: r.created_by });

async function templates(c, m) {
  const { path, method } = c, db = c.env.DB;
  if (!path.startsWith("/api/work/templates")) return null;
  if (path === "/api/work/templates" && method === "GET") {
    const { results } = await db.prepare("SELECT id, name, deadline, assignee, checklist, created_by FROM task_templates WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE").all();
    return c.ok({ templates: (results || []).map(tplOut) });
  }
  const anyTpl = c.can("templates.manage");                    // "Manage any task template"; "templates.own" reaches only the ones they created
  if (!anyTpl && !c.can("templates.own")) return c.err("Admin only", 403);   // every write below needs one of the two (agents and viewers get 403)
  const ownsTpl = async (id) => !!(await db.prepare("SELECT 1 AS x FROM task_templates WHERE id = ? AND created_by = ? AND deleted_at IS NULL").bind(id, c.user.username).first());
  if (path === "/api/work/templates" && method === "POST") {
    const b = await body(c), name = str(b.name, 120);
    if (!name) return c.err("Template name is required");
    const deadline = b.deadline === undefined || b.deadline === "" ? "1 day" : b.deadline;
    if (!DEADLINES.includes(deadline)) return c.err(`Deadline must be one of: ${DEADLINES.join(", ")}`);
    let assignee = null;
    if (b.assignee) { assignee = (await existingUsers(db, [b.assignee]))[0] || null; if (!assignee) return c.err("Assignee is not a known user"); }
    const checklist = JSON.stringify((Array.isArray(b.checklist) ? b.checklist : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 50));
    let id = b.id !== undefined && b.id !== null && b.id !== "" ? Number(b.id) : null;
    if (id !== null && !anyTpl && !(await ownsTpl(id))) return c.err("You can only change templates you created", 403);
    if (id !== null) {
      const r = await db.prepare("UPDATE task_templates SET name = ?, deadline = ?, assignee = ?, checklist = ? WHERE id = ? AND deleted_at IS NULL").bind(name, deadline, assignee, checklist, id).run();
      if (!r.meta.changes) return c.err("Template not found", 404);
      c.log(c.user, "work", `Edited template #${id} "${name}"`);
    } else {
      const r = await db.prepare("INSERT INTO task_templates (name, deadline, assignee, checklist, created_by) VALUES (?, ?, ?, ?, ?)").bind(name, deadline, assignee, checklist, c.user.username).run();
      id = r.meta.last_row_id;
      c.log(c.user, "work", `Created template #${id} "${name}"`);
    }
    const row = await db.prepare("SELECT id, name, deadline, assignee, checklist, created_by FROM task_templates WHERE id = ?").bind(id).first();
    return c.ok({ template: tplOut(row) }, b.id ? 200 : 201);
  }
  if ((m = path.match(/^\/api\/work\/templates\/(\d+)\/delete$/)) && method === "POST") {
    const id = Number(m[1]);
    if (!anyTpl && !(await ownsTpl(id))) return c.err("You can only delete templates you created", 403);
    const r = await db.prepare("UPDATE task_templates SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ? AND deleted_at IS NULL").bind(c.user.username, id).run();
    if (!r.meta.changes) return c.err("Template not found", 404);
    c.log(c.user, "work", `Deleted template #${id}`);
    return c.ok({ ok: true });
  }
  return null;
}

// ───────────────────────────── analytics (admin) ─────────────────────────────
// compliance = on-time completions / (completions with a deadline + tasks still open and overdue): overdue work counts against the score.
async function analytics(c) {
  if (!c.can("analytics.view")) return c.err("Admin only", 403);
  const db = c.env.DB, today = mytToday();
  const days = Math.min(365, Math.max(1, parseInt(c.url.searchParams.get("days"), 10) || 30));
  const since = mytShift(today, -(days - 1));
  const wk = (col) => `date(${col},'+8 hours','weekday 0','-6 days')`;
  const [cr, co, wl, fl, cp, ov] = await Promise.all([
    db.prepare(`SELECT ${wk("created_at")} AS week, COUNT(*) AS n FROM tasks WHERE deleted_at IS NULL AND date(created_at,'+8 hours') >= ? GROUP BY week`).bind(since).all(),
    db.prepare(`SELECT ${wk("completed_at")} AS week, COUNT(*) AS n FROM tasks WHERE deleted_at IS NULL AND status = 'done' AND completed_at IS NOT NULL AND date(completed_at,'+8 hours') >= ? GROUP BY week`).bind(since).all(),
    db.prepare(`SELECT t.assignee AS username, COUNT(*) AS open FROM tasks t WHERE t.deleted_at IS NULL AND t.status != 'done' GROUP BY t.assignee ORDER BY open DESC, username LIMIT 20`).all(),
    db.prepare(
      `SELECT f.name, COUNT(*) AS completed FROM tasks t JOIN flows f ON f.id = t.flow_id AND f.deleted_at IS NULL
        WHERE t.deleted_at IS NULL AND t.status = 'done' AND t.completed_at IS NOT NULL AND date(t.completed_at,'+8 hours') >= ?
        GROUP BY f.id ORDER BY completed DESC, f.name LIMIT 10`).bind(since).all(),
    db.prepare(
      `SELECT t.assignee AS username, COUNT(*) AS timed, SUM(${ON_TIME}) AS on_time FROM tasks t
        WHERE t.deleted_at IS NULL AND ${DONE_WITH_DUE} AND date(t.completed_at,'+8 hours') >= ? GROUP BY t.assignee`).bind(since).all(),
    db.prepare(`SELECT assignee AS username, COUNT(*) AS n FROM tasks WHERE deleted_at IS NULL AND status != 'done' AND due_date IS NOT NULL AND due_date < ? GROUP BY assignee`).bind(today).all(),
  ]);
  const created = Object.fromEntries((cr.results || []).map((r) => [r.week, r.n]));
  const completed = Object.fromEntries((co.results || []).map((r) => [r.week, r.n]));
  const created_vs_completed = [];
  for (let w = mytMonday(since); w <= today; w = mytShift(w, 7)) created_vs_completed.push({ week: w, created: created[w] || 0, completed: completed[w] || 0 });

  const overdue = Object.fromEntries((ov.results || []).map((r) => [r.username, r.n]));
  const comp = new Map();
  for (const r of cp.results || []) comp.set(r.username, { username: r.username, on_time: r.on_time || 0, den: r.timed + (overdue[r.username] || 0), completed: r.timed });
  for (const [u, n] of Object.entries(overdue)) if (!comp.has(u)) comp.set(u, { username: u, on_time: 0, den: n, completed: 0 });
  const rate = Object.fromEntries([...comp.values()].map((x) => [x.username, pct(x.on_time, x.den)]));
  const compliance = [...comp.values()].map((x) => ({ username: x.username, rate: rate[x.username], completed: x.completed }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.username.localeCompare(b.username));
  const workload = (wl.results || []).map((r) => ({ username: r.username, open: r.open, rate: rate[r.username] ?? null }));
  return c.ok({ days, since, created_vs_completed, workload, flows: fl.results || [], compliance });
}

// ───────────────────────────── efficiency (admin: all or one; agent: self) ─────────────────────────────
async function efficiency(c) {
  const db = c.env.DB, today = mytToday(), me = c.user.username;
  const q = c.url.searchParams;
  let user = q.get("user") || "";
  if (!c.can("analytics.view")) { if (user && user !== me) return c.err("You can only see your own task efficiency", 403); user = me; }
  const d = parseInt(q.get("days"), 10);
  const days = d > 0 ? Math.min(365, d) : null;                    // optional window for completions; default all time
  const since = days ? mytShift(today, -(days - 1)) : "0000-00-00";
  const who = user ? " AND t.assignee = ?" : "", wb = user ? [user] : [];
  const [done, open, daily] = await Promise.all([
    db.prepare(
      `SELECT t.assignee AS username, COUNT(*) AS completed, SUM(${DONE_WITH_DUE}) AS timed, SUM(${ON_TIME}) AS on_time,
              AVG(CASE WHEN t.spent_seconds > 0 THEN t.spent_seconds END) AS avg_sec
         FROM tasks t WHERE t.deleted_at IS NULL AND t.status = 'done' AND date(t.completed_at,'+8 hours') >= ?${who} GROUP BY t.assignee`).bind(since, ...wb).all(),
    db.prepare(
      `SELECT t.assignee AS username, COUNT(*) AS assigned, SUM(t.status = 'progress') AS in_progress,
              SUM(t.due_date IS NOT NULL AND t.due_date < ?) AS overdue
         FROM tasks t WHERE t.deleted_at IS NULL AND t.status != 'done'${who} GROUP BY t.assignee`).bind(today, ...wb).all(),
    db.prepare(
      `SELECT date(t.completed_at,'+8 hours') AS day, COUNT(*) AS timed, SUM(${ON_TIME}) AS on_time FROM tasks t
        WHERE t.deleted_at IS NULL AND ${DONE_WITH_DUE} AND date(t.completed_at,'+8 hours') >= ?${who} GROUP BY day ORDER BY day`).bind(mytShift(today, -((days || 30) - 1)), ...wb).all(),
  ]);
  const by = new Map();
  const get = (u) => { if (!by.has(u)) by.set(u, { username: u, assigned: 0, in_progress: 0, completed: 0, timed: 0, on_time: 0, avg_sec: null, overdue: 0 }); return by.get(u); };
  for (const r of done.results || []) Object.assign(get(r.username), { completed: r.completed, timed: r.timed || 0, on_time: r.on_time || 0, avg_sec: r.avg_sec });
  for (const r of open.results || []) Object.assign(get(r.username), { assigned: r.assigned, in_progress: r.in_progress || 0, overdue: r.overdue || 0 });
  if (user) get(user);                                             // a person with no tasks still gets a row
  const users = [...by.values()].map((x) => ({
    username: x.username, assigned: x.assigned, in_progress: x.in_progress, completed: x.completed,
    on_time_rate: pct(x.on_time, x.timed + x.overdue),             // overdue open tasks count against the score
    avg_minutes: x.avg_sec ? Math.round(x.avg_sec / 60) : null, overdue: x.overdue,
  })).sort((a, b) => (b.on_time_rate ?? -1) - (a.on_time_rate ?? -1) || a.username.localeCompare(b.username));
  const series = (daily.results || []).map((r) => ({ date: r.day, rate: pct(r.on_time || 0, r.timed) }));
  return c.ok({ users, daily: series, days });
}

// ───────────────────────────── recycle bin (admin) ─────────────────────────────
async function bin(c, m) {
  const { path, method } = c, db = c.env.DB;
  if (!path.startsWith("/api/work/bin")) return null;
  if (!c.can("bin.manage")) return c.err("Admin only", 403);
  if (path === "/api/work/bin" && method === "GET") {
    const cut = `datetime('now','-${BIN_DAYS} days')`;
    const parts = Object.entries(BIN_TYPES).map(([k, t]) => `SELECT '${k}' AS type, id, ${BIN_NAME[k]} AS name, deleted_at, deleted_by FROM ${t} WHERE deleted_at IS NOT NULL AND deleted_at >= ${cut}`);
    const { results } = await db.prepare(`${parts.join(" UNION ALL ")} ORDER BY deleted_at DESC LIMIT 500`).all();
    return c.ok({ items: results || [], keep_days: BIN_DAYS });
  }
  if ((path === "/api/work/bin/restore" || path === "/api/work/bin/purge") && method === "POST") {
    const b = await body(c), table = BIN_TYPES[b.type], id = Number(b.id);
    if (!table || !Number.isInteger(id)) return c.err("type (task|project|flow|template) and id are required");
    const row = await db.prepare(`SELECT id, ${BIN_NAME[b.type]} AS name${b.type === "task" ? ", status, assignee" : ""} FROM ${table} WHERE id = ? AND deleted_at IS NOT NULL`).bind(id).first();
    if (!row) return c.err("Not in the recycle bin", 404);      // purge only ever touches an item that is already binned
    if (path.endsWith("/restore")) {
      try { await db.prepare(`UPDATE ${table} SET deleted_at = NULL, deleted_by = NULL WHERE id = ?`).bind(id).run(); }
      catch (e) {
        if (b.type === "task" && /UNIQUE/i.test(String(e.message))) {   // uq_one_ongoing_per_person
          const ongoing = await db.prepare("SELECT id, title FROM tasks WHERE assignee = ? AND status = 'progress' AND deleted_at IS NULL").bind(row.assignee).first();
          return new Response(JSON.stringify({ error: `${row.assignee} already has an ongoing task`, ongoing }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        throw e;
      }
      c.log(c.user, "work", `Restored ${b.type} #${id} "${row.name}"`);
      return c.ok({ ok: true });
    }
    const stmts = [];
    if (b.type === "task") for (const t of ["task_checklist", "task_observers", "task_comments", "task_activity"]) stmts.push(db.prepare(`DELETE FROM ${t} WHERE task_id = ?`).bind(id));
    if (b.type === "project") { stmts.push(db.prepare("DELETE FROM project_members WHERE project_id = ?").bind(id)); stmts.push(db.prepare("UPDATE tasks SET project_id = NULL WHERE project_id = ?").bind(id)); stmts.push(db.prepare("UPDATE flows SET project_id = NULL WHERE project_id = ?").bind(id)); }
    if (b.type === "flow") stmts.push(db.prepare("UPDATE tasks SET flow_id = NULL WHERE flow_id = ?").bind(id));
    stmts.push(db.prepare(`DELETE FROM ${table} WHERE id = ? AND deleted_at IS NOT NULL`).bind(id));
    await db.batch(stmts);
    c.log(c.user, "work", `Permanently deleted ${b.type} #${id} "${row.name}"`);
    return c.ok({ ok: true });
  }
  return null;
}

export async function handleProjects(c) {
  const { path, method } = c;
  if (path.startsWith("/api/work/projects")) return projects(c);
  if (path.startsWith("/api/work/flows")) return flows(c);
  if (path.startsWith("/api/work/templates")) return templates(c);
  if (path === "/api/work/analytics" && method === "GET") return analytics(c);
  if (path === "/api/work/efficiency" && method === "GET") return efficiency(c);
  if (path.startsWith("/api/work/bin")) return bin(c);
  return null;
}
