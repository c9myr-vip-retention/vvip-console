// Local checks for the schedule routes (board items, types, swaps) and their permissions.
// LOCAL ONLY: talks to `wrangler dev --local` and seeds a THROWAWAY local D1 with `wrangler d1 execute --local`. Never --remote.
//   1) apply schema.sql, schema_v2..v26 with: npx wrangler d1 execute groupb-tracker-db --local --persist-to <dir> --file=...
//   2) npx wrangler dev --local --persist-to <dir> --port 8798 --var SESSION_SECRET:x --var PASSWORD_SALT:y --var INGEST_TOKEN:x
//   3) BASE=http://127.0.0.1:8798 PERSIST=<dir> node scripts/test-schedule-api.mjs
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const PERSIST = process.env.PERSIST;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error("Refusing: BASE must be a local Worker"); process.exit(2); }
if (!PERSIST) { console.error("Set PERSIST=<the --persist-to dir of the local D1>"); process.exit(2); }

let fails = 0, passes = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); if (ok) passes++; else fails++; };
const sql = (q) => execFileSync("npx", ["wrangler", "d1", "execute", "groupb-tracker-db", "--local", "--persist-to", PERSIST, "--json", "--command", q], { stdio: "pipe" }).toString();
const rows = (q) => JSON.parse(sql(q).match(/\[[\s\S]*\]/)[0]).flatMap((x) => x.results || []);

async function call(tok, method, path, body) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    } catch (e) { if (i >= 2) throw e; await new Promise((r) => setTimeout(r, 300)); }
  }
}
const PW = "test-password-1";
async function login(u) { const r = await call(null, "POST", "/api/login", { username: u, password: PW }); if (!r.data.token) throw new Error(`login ${u}: ${JSON.stringify(r)}`); return r.data.token; }

// accounts: aldo (admin), sara + daniel (agents), vic (viewer)
await call(null, "POST", "/api/users/init", { username: "aldo", password: PW });
const A = await login("aldo");
for (const [u, role, edit] of [["sara", "agent", 1], ["daniel", "agent", 1], ["vic", "viewer", 0]]) await call(A, "POST", "/api/users", { username: u, password: PW, role, can_edit: edit, team: "B" });
const S = await login("sara"), D = await login("daniel"), V = await login("vic");
sql("DELETE FROM schedule_swaps; DELETE FROM schedule_items; DELETE FROM schedule_types WHERE builtin = 0");   // throwaway DB only

const W = "/api/work/schedule";
let r;

// ---- read ----
r = await call(S, "GET", W);
check("agent reads the board", r.status === 200 && Array.isArray(r.data.items) && Array.isArray(r.data.types));
check("six builtin types, builtin:true", r.data.types.length === 6 && r.data.types.every((t) => t.builtin === 1 || t.builtin === true) && r.data.types.some((t) => t.key === "shift"), JSON.stringify(r.data.types));
check("viewer reads the board", (await call(V, "GET", W)).status === 200);
check("unauthenticated read is 401", (await call(null, "GET", W)).status === 401);
check("bad from date rejected (400)", (await call(S, "GET", `${W}?from=nope`)).status === 400);

// ---- permissions: agent / viewer on admin routes ----
const shiftBody = { items: [{ type_key: "shift", date: "2026-11-02", title: "Morning", who: ["sara"] }] };
for (const [who, tok] of [["agent", S], ["viewer", V]]) {
  check(`${who} cannot add items (403)`, (await call(tok, "POST", `${W}/items`, shiftBody)).status === 403);
  check(`${who} cannot create a type (403)`, (await call(tok, "POST", `${W}/types`, { name: "Leave", color: "#E11D48" })).status === 403);
  check(`${who} cannot list swaps (403)`, (await call(tok, "GET", `${W}/swaps`)).status === 403);
  check(`${who} cannot decide a swap (403)`, (await call(tok, "POST", `${W}/swaps/1`, { status: "approved" })).status === 403);
}

// ---- add: many dates x many entries ----
const dates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
const entries = [
  { type_key: "shift", title: "Morning", start_time: "09:00", end_time: "17:00", who: ["sara"], brands: ["LPK777", "ACE33"], note: "Team B", repeat: "weekly" },
  { type_key: "reload", title: "Friday Reload 12%", start_time: "12:00", end_time: "23:59", brands: ["BM69", "HOT321"] },
];
r = await call(A, "POST", `${W}/items`, { items: dates.flatMap((date) => entries.map((e) => ({ ...e, date }))) });
check("admin adds 5 dates x 2 entries = 10", r.status === 201 && r.data.created === 10, JSON.stringify(r));
check("`dates` array on one entry also expands", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "meeting", title: "Kickoff", dates: ["2026-11-02", "2026-11-09"], who: ["aldo", "sara"] }] })).data.created === 2);
check("shift without a person rejected (400)", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "shift", date: "2026-11-02", title: "Night", who: [] }] })).status === 400);
check("shift with only unknown people rejected (400)", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "shift", date: "2026-11-02", title: "Night", who: ["ghost"] }] })).status === 400);
check("unknown type rejected (400)", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "nope", date: "2026-11-02", title: "x" }] })).status === 400);
check("bad date rejected (400)", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "reload", date: "2026-02-31", title: "x" }] })).status === 400);
check("bad time rejected (400)", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "reload", date: "2026-11-02", title: "x", start_time: "25:00" }] })).status === 400);
check("missing title rejected (400)", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "reload", date: "2026-11-02", title: " " }] })).status === 400);
check("empty items rejected (400)", (await call(A, "POST", `${W}/items`, { items: [] })).status === 400);
const many = Array.from({ length: 501 }, (_, i) => ({ type_key: "reload", date: "2026-12-01", title: `r${i}` }));
check("501 items rejected", (await call(A, "POST", `${W}/items`, { items: many })).status === 413);
check("a rejected call writes nothing", rows("SELECT COUNT(*) AS c FROM schedule_items WHERE date='2026-12-01'")[0].c === 0);
const five = Array.from({ length: 500 }, (_, i) => ({ type_key: "reload", date: "2026-12-01", title: `r${i}` }));
check("exactly 500 items accepted", (await call(A, "POST", `${W}/items`, { items: five })).data.created === 500);
sql("DELETE FROM schedule_items WHERE date='2026-12-01'");
check("a bad entry in the batch writes nothing", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "reload", date: "2026-12-02", title: "ok" }, { type_key: "reload", date: "bad", title: "x" }] })).status === 400 && rows("SELECT COUNT(*) AS c FROM schedule_items WHERE date='2026-12-02'")[0].c === 0);
check("SQL-looking title is stored as text", (await call(A, "POST", `${W}/items`, { items: [{ type_key: "reload", date: "2026-12-03", title: "x'); DROP TABLE schedule_items;--" }] })).status === 201 && rows("SELECT COUNT(*) AS c FROM schedule_items")[0].c > 0);

// ---- read window + repeats ----
r = await call(S, "GET", `${W}?from=2026-11-02&to=2026-11-08`);
const items = r.data.items;
check("window returns items with parsed arrays", items.length >= 11 && Array.isArray(items[0].brands) && Array.isArray(items[0].who), `${items.length}`);
check("item shape", ["id", "type_key", "date", "title", "start_time", "end_time", "brands", "who", "note", "repeat", "off"].every((k) => k in items[0]));
r = await call(S, "GET", `${W}?from=2026-11-16&to=2026-11-22`);
check("weekly repeat still returned in a later window, one-offs are not", r.data.items.some((i) => i.repeat === "weekly") && !r.data.items.some((i) => i.repeat === "none" && i.date < "2026-11-16"));
r = await call(S, "GET", `${W}?from=2026-10-01&to=2026-10-31`);
check("repeating item is not returned before it starts", r.data.items.length === 0);

// ---- edit / delete ----
const shift = items.find((i) => i.type_key === "shift");
check("agent cannot edit (403)", (await call(S, "POST", `${W}/items/${shift.id}/update`, { title: "x" })).status === 403);
check("agent cannot delete (403)", (await call(S, "POST", `${W}/items/${shift.id}/delete`)).status === 403);
r = await call(A, "POST", `${W}/items/${shift.id}/update`, { title: "Day off", note: "" });
check("admin edits (title Day off marks off)", r.status === 200 && r.data.item.title === "Day off" && r.data.item.off === 1 && r.data.item.who.join() === "sara", JSON.stringify(r.data));
r = await call(A, "POST", `${W}/items/${shift.id}/update`, { title: "Afternoon", start_time: "13:00", end_time: "21:00", who: ["daniel", "sara"] });
check("admin edits times + people, off cleared", r.data.item.start_time === "13:00" && r.data.item.who.length === 2 && r.data.item.off === 0, JSON.stringify(r.data));
check("edit that empties a shift's people rejected (400)", (await call(A, "POST", `${W}/items/${shift.id}/update`, { who: [] })).status === 400);
check("edit with bad type rejected (400)", (await call(A, "POST", `${W}/items/${shift.id}/update`, { type_key: "zzz" })).status === 400);
check("edit of a missing item is 404", (await call(A, "POST", `${W}/items/999999/update`, { title: "x" })).status === 404);
const rel = items.find((i) => i.type_key === "reload");
check("admin deletes an item", (await call(A, "POST", `${W}/items/${rel.id}/delete`)).status === 200);
check("deleted item is gone from the board", !(await call(S, "GET", `${W}?from=2026-11-02&to=2026-11-08`)).data.items.some((i) => i.id === rel.id));
check("deleting twice is 404", (await call(A, "POST", `${W}/items/${rel.id}/delete`)).status === 404);

// ---- types ----
r = await call(A, "POST", `${W}/types`, { name: "Leave", color: "#E11D48" });
check("admin creates a type", r.status === 201 && r.data.type.key && r.data.type.name === "Leave" && !r.data.type.builtin, JSON.stringify(r));
check("custom type listed with builtin false", (await call(S, "GET", W)).data.types.some((t) => t.key === r.data.type.key && !t.builtin));
check("duplicate type name rejected (409)", (await call(A, "POST", `${W}/types`, { name: "leave", color: "#E11D48" })).status === 409);
check("bad colour rejected (400)", (await call(A, "POST", `${W}/types`, { name: "Audits", color: "red" })).status === 400);
check("missing name rejected (400)", (await call(A, "POST", `${W}/types`, { name: " ", color: "#E11D48" })).status === 400);
check("items can use the new type", (await call(A, "POST", `${W}/items`, { items: [{ type_key: r.data.type.key, date: "2026-11-10", title: "Public holiday" }] })).data.created === 1);

// ---- swaps ----
const mine = (await call(S, "GET", `${W}?from=2026-11-03&to=2026-11-03`)).data.items.find((i) => i.type_key === "shift" && i.date === "2026-11-03" && i.who.includes("sara"));
const kick = (await call(S, "GET", `${W}?from=2026-11-02&to=2026-11-02`)).data.items.find((i) => i.type_key === "meeting");
check("agent requests a swap on own shift", (r = await call(S, "POST", `${W}/items/${mine.id}/swap`, { note: "Dentist" })).status === 201 && r.data.swap.status === "open", JSON.stringify(r));
const SW = r.data.swap.id;
check("daniel cannot swap sara's shift (403)", (await call(D, "POST", `${W}/items/${mine.id}/swap`, { note: "x" })).status === 403);
check("viewer cannot swap (403)", (await call(V, "POST", `${W}/items/${mine.id}/swap`, { note: "x" })).status === 403);
check("only shifts can be swapped (400)", (await call(S, "POST", `${W}/items/${kick.id}/swap`, { note: "x" })).status === 400);
check("swap on a missing item is 404", (await call(S, "POST", `${W}/items/999999/swap`, { note: "x" })).status === 404);
check("second open request for the same shift is 409", (await call(S, "POST", `${W}/items/${mine.id}/swap`, { note: "again" })).status === 409);
check("agent sees own swap status on the board", (await call(S, "GET", W)).data.my_swaps.some((s) => s.item_id === mine.id && s.status === "open"));
check("another agent does not see it", !(await call(D, "GET", W)).data.my_swaps.some((s) => s.item_id === mine.id));
r = await call(A, "GET", `${W}/swaps`);
check("admin lists swaps with the shift details", r.status === 200 && r.data.swaps.length === 1 && r.data.swaps[0].from_user === "sara" && r.data.swaps[0].item.date === "2026-11-03" && r.data.swaps[0].note === "Dentist", JSON.stringify(r.data));
check("bad swap status rejected (400)", (await call(A, "POST", `${W}/swaps/${SW}`, { status: "maybe" })).status === 400);
check("unknown swap is 404", (await call(A, "POST", `${W}/swaps/999999`, { status: "approved" })).status === 404);
check("admin approves", (await call(A, "POST", `${W}/swaps/${SW}`, { status: "approved" })).data.swap.status === "approved");
check("deciding twice is 409", (await call(A, "POST", `${W}/swaps/${SW}`, { status: "declined" })).status === 409);
check("agent sees approved", (await call(S, "GET", W)).data.my_swaps.some((s) => s.item_id === mine.id && s.status === "approved"));
check("a new request is allowed after a decision", (await call(S, "POST", `${W}/items/${mine.id}/swap`, { note: "again" })).status === 201);
const open2 = (await call(A, "GET", `${W}/swaps`)).data.swaps.find((s) => s.status === "open");
check("open swaps are listed first", (await call(A, "GET", `${W}/swaps`)).data.swaps[0].status === "open");
check("admin declines", (await call(A, "POST", `${W}/swaps/${open2.id}`, { status: "declined" })).data.swap.status === "declined");
check("an unknown schedule path falls through (404)", (await call(A, "GET", `${W}/nothing`)).status === 404);

// ---- shift times (the quick-fill presets) ----
sql("DELETE FROM schedule_shift_presets WHERE key NOT IN ('am','pm','nt'); UPDATE schedule_shift_presets SET deleted_at = NULL, name = CASE key WHEN 'am' THEN 'Morning' WHEN 'pm' THEN 'Afternoon' ELSE 'Night' END, start_time = CASE key WHEN 'am' THEN '09:00' WHEN 'pm' THEN '13:00' ELSE '21:00' END, end_time = CASE key WHEN 'am' THEN '17:00' WHEN 'pm' THEN '21:00' ELSE '05:00' END");
r = await call(S, "GET", W);
check("board carries the three default shifts", r.status === 200 && ["Morning", "Afternoon", "Night"].every((n) => (r.data.shifts || []).some((x) => x.name === n)), JSON.stringify(r.data.shifts));
for (const [who, tok] of [["agent", S], ["viewer", V]]) {
  check(`${who} cannot add a shift (403)`, (await call(tok, "POST", `${W}/shifts`, { name: "Mid", start_time: "11:00", end_time: "19:00" })).status === 403);
  check(`${who} cannot change a shift (403)`, (await call(tok, "POST", `${W}/shifts/am/update`, { start_time: "08:00" })).status === 403);
  check(`${who} cannot remove a shift (403)`, (await call(tok, "POST", `${W}/shifts/am/delete`)).status === 403);
}
r = await call(A, "POST", `${W}/shifts`, { name: "Mid", start_time: "11:00", end_time: "19:00" });
const MID = r.data.shift && r.data.shift.key;
check("admin adds a shift (201)", r.status === 201 && MID === "mid", JSON.stringify(r));
check("a duplicate name is 409", (await call(A, "POST", `${W}/shifts`, { name: "mid", start_time: "10:00", end_time: "18:00" })).status === 409);
check("bad time is 400", (await call(A, "POST", `${W}/shifts`, { name: "X", start_time: "25:00", end_time: "18:00" })).status === 400);
check("same start and end is 400", (await call(A, "POST", `${W}/shifts`, { name: "X", start_time: "10:00", end_time: "10:00" })).status === 400);
check("blank name is 400", (await call(A, "POST", `${W}/shifts`, { name: "  ", start_time: "10:00", end_time: "18:00" })).status === 400);
check("Day off is built in (400)", (await call(A, "POST", `${W}/shifts`, { name: "Day off", start_time: "10:00", end_time: "18:00" })).status === 400);
r = await call(A, "POST", `${W}/shifts/am/update`, { start_time: "08:30", end_time: "16:30" });
check("admin changes Morning times", r.status === 200 && r.data.shift.name === "Morning" && r.data.shift.start_time === "08:30", JSON.stringify(r.data));
check("renaming onto another shift is 409", (await call(A, "POST", `${W}/shifts/am/update`, { name: "Night" })).status === 409);
check("unknown shift is 404", (await call(A, "POST", `${W}/shifts/nope/update`, { name: "Z" })).status === 404);
r = await call(S, "GET", W);
check("everyone sees the new list in order", r.data.shifts.map((x) => x.name).join() === "Morning,Afternoon,Night,Mid" && r.data.shifts[0].start_time === "08:30", JSON.stringify(r.data.shifts));
check("admin removes Mid (soft)", (await call(A, "POST", `${W}/shifts/${MID}/delete`)).status === 200 && !(await call(S, "GET", W)).data.shifts.some((x) => x.key === MID));
check("removing it twice is 404", (await call(A, "POST", `${W}/shifts/${MID}/delete`)).status === 404);

// ---- delete many ----
sql("DELETE FROM schedule_items");
await call(A, "POST", `${W}/items`, { items: [
  { type_key: "reload", date: "2026-12-01", title: "[b] r1" }, { type_key: "reload", date: "2026-12-10", title: "[b] r2" }, { type_key: "meeting", date: "2026-12-10", title: "[b] m1" },
  { type_key: "shift", date: "2026-12-12", title: "[b] Morning", who: ["sara"], repeat: "weekly" }, { type_key: "reload", date: "2027-01-05", title: "[b] r3" },
] });
const bd = (b) => call(A, "POST", `${W}/items/bulk-delete`, b);
check("agent cannot bulk delete (403)", (await call(S, "POST", `${W}/items/bulk-delete`, { from: "2026-12-01" })).status === 403);
check("viewer cannot bulk delete (403)", (await call(V, "POST", `${W}/items/bulk-delete`, { from: "2026-12-01" })).status === 403);
r = await bd({ from: "2026-12-01", to: "2026-12-31", preview: true });
check("preview counts December and flags the repeating one", r.status === 200 && r.data.count === 4 && r.data.repeating === 1, JSON.stringify(r.data));
check("preview deletes nothing", rows("SELECT COUNT(*) n FROM schedule_items WHERE deleted_at IS NULL")[0].n === 5);
r = await bd({ type_key: "reload", from: "2026-12-01", to: "2026-12-31", preview: true });
check("type + dates narrows to the two December reloads", r.data.count === 2, JSON.stringify(r.data));
check("bad date is 400", (await bd({ from: "2026-13-01" })).status === 400);
check("start after end is 400", (await bd({ from: "2026-12-31", to: "2026-12-01" })).status === 400);
check("unknown type is 400", (await bd({ type_key: "nope" })).status === 400);
r = await bd({ type_key: "reload", from: "2026-12-01", to: "2026-12-31" });
check("deletes the two December reloads", r.status === 200 && r.data.deleted === 2, JSON.stringify(r.data));
check("the others are untouched", rows("SELECT COUNT(*) n FROM schedule_items WHERE deleted_at IS NULL")[0].n === 3);
r = await bd({});
check("no filters deletes every remaining item", r.data.deleted === 3 && rows("SELECT COUNT(*) n FROM schedule_items WHERE deleted_at IS NULL")[0].n === 0, JSON.stringify(r.data));
check("nothing left -> deleted 0", (await bd({})).data.deleted === 0);

// ---- types: rename, recolour, delete ----
sql("DELETE FROM schedule_items; DELETE FROM schedule_types WHERE builtin = 0");
r = await call(A, "POST", `${W}/types`, { name: "Promo", color: "#112233" });
const PK = r.data.type && r.data.type.key;
check("create a custom type", r.status === 201 && PK === "promo", JSON.stringify(r));
for (const [who, tok] of [["agent", S], ["viewer", V]]) {
  check(`${who} cannot rename a type (403)`, (await call(tok, "POST", `${W}/types/${PK}/update`, { name: "X" })).status === 403);
  check(`${who} cannot delete a type (403)`, (await call(tok, "POST", `${W}/types/${PK}/delete`, {})).status === 403);
}
r = await call(A, "POST", `${W}/types/${PK}/update`, { name: "Promotions", color: "#AABBCC" });
check("rename and recolour", r.status === 200 && r.data.type.name === "Promotions" && r.data.type.color === "#AABBCC", JSON.stringify(r));
check("rename onto another type is 409", (await call(A, "POST", `${W}/types/${PK}/update`, { name: "meetings" })).status === 409);
check("bad colour is 400", (await call(A, "POST", `${W}/types/${PK}/update`, { color: "red" })).status === 400);
check("blank name is 400", (await call(A, "POST", `${W}/types/${PK}/update`, { name: " " })).status === 400);
check("unknown type is 404", (await call(A, "POST", `${W}/types/nope/update`, { name: "Z" })).status === 404);
check("a built-in type can be renamed too", (await call(A, "POST", `${W}/types/training/update`, { name: "Learning" })).data.type.name === "Learning");
await call(A, "POST", `${W}/items`, { items: [{ type_key: PK, date: "2026-12-01", title: "[t] a" }, { type_key: PK, date: "2026-12-02", title: "[t] b" }, { type_key: "reload", date: "2026-12-01", title: "[t] keep" }] });
r = await call(A, "POST", `${W}/types/${PK}/delete`, { preview: true });
check("delete preview counts the items and deletes nothing", r.status === 200 && r.data.items === 2 && rows("SELECT COUNT(*) n FROM schedule_types WHERE key = 'promo'")[0].n === 1, JSON.stringify(r.data));
r = await call(A, "POST", `${W}/types/${PK}/delete`, {});
check("delete the type and its items", r.status === 200 && r.data.items === 2, JSON.stringify(r.data));
check("the type is gone from the board and the other type's item stays", !(await call(S, "GET", `${W}?from=2026-12-01&to=2026-12-31`)).data.types.some((t) => t.key === PK) && (await call(S, "GET", `${W}?from=2026-12-01&to=2026-12-31`)).data.items.map((i) => i.title).join() === "[t] keep");
check("deleting it twice is 404", (await call(A, "POST", `${W}/types/${PK}/delete`, {})).status === 404);
check("a deleted type cannot be used for new items (400)", (await call(A, "POST", `${W}/items`, { items: [{ type_key: PK, date: "2026-12-03", title: "[t] no" }] })).status === 400);
check("a built-in type can be deleted (Learning/training)", (await call(A, "POST", `${W}/types/training/delete`, {})).status === 200 && !(await call(S, "GET", W)).data.types.some((t) => t.key === "training"));
sql("INSERT OR IGNORE INTO schedule_types (key, name, color, builtin) VALUES ('shift','Agent shifts','#5F9AD6',1),('reload','Reload events','#E8C547',1),('meeting','Meetings','#A78BFA',1),('maint','Maintenance','#EF4444',1),('report','Reports & deadlines','#4CC38A',1),('training','Training','#56B6C2',1)");   // put the built-ins back for the next run

console.log(`\n${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} check(s) FAILED` : "All checks passed");
process.exit(fails ? 1 : 0);
