// Local-only checks for /api/work/schedule*. Run against `npx wrangler dev --local` (never a deployed Worker):
//   BASE=http://127.0.0.1:8799 node scripts/test-schedule-api.mjs
// Creates admin1 (via /api/users/init, if no users yet), agent1, agent2, viewer1 (password "password123") in the LOCAL db.
const BASE = process.env.BASE || "http://127.0.0.1:8799";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error("Refusing to run against a non-local BASE"); process.exit(2); }
const PW = "password123";
let fails = 0;

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
function check(name, cond, extra = "") { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`); }
async function login(u) { const r = await call(null, "POST", "/api/login", { username: u, password: PW }); return r.data.token; }

await call(null, "POST", "/api/users/init", { username: "admin1", password: PW });
const admin = await login("admin1");
const mk = (username, role, can_edit) => call(admin, "POST", "/api/users", { username, password: PW, role, can_edit, team: "A" });
await mk("agent1", "agent", true); await mk("agent2", "agent", true); await mk("viewer1", "viewer", false);
const a1 = await login("agent1"), a2 = await login("agent2"), v1 = await login("viewer1");
check("logins", admin && a1 && a2 && v1);

const day = (n) => { const d = new Date(Date.UTC(2026, 9, 19 + n)); return d.toISOString().slice(0, 10); };

// reads: everyone, types seeded
for (const [n, t] of [["admin", admin], ["agent", a1], ["viewer", v1]]) {
  const r = await call(t, "GET", `/api/work/schedule?from=${day(0)}&to=${day(6)}`);
  check(`GET schedule as ${n}`, r.status === 200 && r.data.types?.length >= 6 && Array.isArray(r.data.items), JSON.stringify(r));
}
check("GET schedule without token -> 401", (await call(null, "GET", "/api/work/schedule")).status === 401);
check("GET schedule bad date -> 400", (await call(admin, "GET", "/api/work/schedule?from=2026-13-40")).status === 400);

// writes are admin-only
const one = { items: [{ type_key: "meeting", date: day(1), title: "Kickoff", start_time: "10:00", end_time: "10:30", who: ["agent1"] }] };
check("agent POST items -> 403", (await call(a1, "POST", "/api/work/schedule/items", one)).status === 403);
check("viewer POST items -> 403", (await call(v1, "POST", "/api/work/schedule/items", one)).status === 403);
check("agent POST types -> 403", (await call(a1, "POST", "/api/work/schedule/types", { name: "X", color: "#112233" })).status === 403);
check("agent GET swaps -> 403", (await call(a1, "GET", "/api/work/schedule/swaps")).status === 403);
check("agent decide swap -> 403", (await call(a1, "POST", "/api/work/schedule/swaps/1", { status: "approved" })).status === 403);

// validation
const bad = async (name, it, code = 400) => { const r = await call(admin, "POST", "/api/work/schedule/items", { items: [it] }); check(`validation: ${name} -> ${code}`, r.status === code, JSON.stringify(r)); };
await bad("missing title", { type_key: "meeting", date: day(0) });
await bad("blank title", { type_key: "meeting", date: day(0), title: "   " });
await bad("bad date", { type_key: "meeting", date: "2026-02-31", title: "x" });
await bad("bad type", { type_key: "nope", date: day(0), title: "x" });
await bad("bad time", { type_key: "meeting", date: day(0), title: "x", start_time: "25:00" });
await bad("bad repeat", { type_key: "meeting", date: day(0), title: "x", repeat: "monthly" });
await bad("shift without people", { type_key: "shift", date: day(0), title: "Morning", start_time: "09:00", end_time: "17:00", who: [] });
check("empty items -> 400", (await call(admin, "POST", "/api/work/schedule/items", { items: [] })).status === 400);
const many = Array.from({ length: 501 }, () => ({ type_key: "meeting", date: day(0), title: "x" }));
check("501 items -> 400", (await call(admin, "POST", "/api/work/schedule/items", { items: many })).status === 400);
const atomic = await call(admin, "POST", "/api/work/schedule/items", { items: [{ type_key: "meeting", date: day(0), title: "ok-but-rolled-back" }, { type_key: "meeting", date: day(0) }] });
check("one bad item rejects the whole call (nothing created)", atomic.status === 400 && (await call(admin, "GET", `/api/work/schedule?from=${day(0)}&to=${day(0)}`)).data.items.every((i) => i.title !== "ok-but-rolled-back"));

// bulk: 3 dates x 2 entries = 6
const entries = [
  { type_key: "reload", title: "Weekend Reload 10%", start_time: "00:00", end_time: "23:59", brands: ["LPK777", "ACE33"], note: "Min RM200", repeat: "weekly" },
  { type_key: "shift", title: "Morning", start_time: "09:00", end_time: "17:00", who: ["agent1"] },
];
const dates = [day(2), day(3), day(4)];
const bulk = await call(admin, "POST", "/api/work/schedule/items", { items: dates.flatMap((date) => entries.map((e) => ({ ...e, date }))) });
check("bulk 3 dates x 2 entries -> 201 created 6", bulk.status === 201 && bulk.data.created === 6, JSON.stringify(bulk));
const week = await call(a1, "GET", `/api/work/schedule?from=${day(0)}&to=${day(6)}`);
const shifts = week.data.items.filter((i) => i.type_key === "shift");
check("items readable by agent, shape ok", shifts.length === 3 && shifts[0].who[0] === "agent1" && shifts[0].start_time === "09:00" && Array.isArray(shifts[0].brands) && shifts[0].repeat === "none", JSON.stringify(shifts[0]));
const reload = week.data.items.find((i) => i.type_key === "reload");
check("brands + repeat stored", reload && reload.brands.join() === "LPK777,ACE33" && reload.repeat === "weekly");
const later = await call(a1, "GET", `/api/work/schedule?from=${day(30)}&to=${day(36)}`);
check("weekly item from earlier date still returned for a later window", later.data.items.some((i) => i.id === reload.id) && !later.data.items.some((i) => i.type_key === "shift"));

// update / delete
const sid = shifts[0].id;
check("agent update -> 403", (await call(a1, "POST", `/api/work/schedule/items/${sid}/update`, { title: "hax" })).status === 403);
const up = await call(admin, "POST", `/api/work/schedule/items/${sid}/update`, { title: "Afternoon", start_time: "13:00", end_time: "21:00", who: ["agent1", "agent2"] });
check("admin update", up.status === 200 && up.data.item.title === "Afternoon" && up.data.item.who.length === 2 && up.data.item.date === shifts[0].date, JSON.stringify(up));
check("update shift to no people -> 400", (await call(admin, "POST", `/api/work/schedule/items/${sid}/update`, { who: [] })).status === 400);
check("update missing item -> 404", (await call(admin, "POST", "/api/work/schedule/items/99999/update", { title: "x" })).status === 404);

// types
const t1 = await call(admin, "POST", "/api/work/schedule/types", { name: "Leave", color: "#E11D48" });
check("admin create type", t1.status === 201 && t1.data.type.key.startsWith("t_") && t1.data.type.builtin === false, JSON.stringify(t1));
check("duplicate type name -> 409", (await call(admin, "POST", "/api/work/schedule/types", { name: "leave", color: "#E11D48" })).status === 409);
check("bad colour -> 400", (await call(admin, "POST", "/api/work/schedule/types", { name: "Audits", color: "red" })).status === 400);
const withType = await call(admin, "POST", "/api/work/schedule/items", { items: [{ type_key: t1.data.type.key, date: day(1), title: "Aldo on leave", who: ["admin1"] }] });
check("custom type usable in items", withType.status === 201);
check("types listed incl. custom", (await call(v1, "GET", "/api/work/schedule")).data.types.some((t) => t.key === t1.data.type.key));

// swaps
const mine = shifts[1].id, notMine = (await call(admin, "POST", "/api/work/schedule/items", { items: [{ type_key: "shift", date: day(5), title: "Night", start_time: "21:00", end_time: "05:00", who: ["agent2"] }] })) && (await call(admin, "GET", `/api/work/schedule?from=${day(5)}&to=${day(5)}`)).data.items.find((i) => i.title === "Night").id;
check("agent swap on own shift -> 201", (await call(a1, "POST", `/api/work/schedule/items/${mine}/swap`, { note: "Dentist" })).status === 201);
check("duplicate open swap -> 409", (await call(a1, "POST", `/api/work/schedule/items/${mine}/swap`, { note: "again" })).status === 409);
check("agent swap on someone else's shift -> 403", (await call(a1, "POST", `/api/work/schedule/items/${notMine}/swap`, { note: "nope" })).status === 403);
check("agent swap on non-shift -> 400", (await call(a1, "POST", `/api/work/schedule/items/${reload.id}/swap`, {})).status === 400);
check("viewer swap -> 403", (await call(v1, "POST", `/api/work/schedule/items/${mine}/swap`, {})).status === 403);
const sw = await call(admin, "GET", "/api/work/schedule/swaps");
check("admin lists swaps", sw.status === 200 && sw.data.swaps.length === 1 && sw.data.swaps[0].from_user === "agent1" && sw.data.swaps[0].status === "open", JSON.stringify(sw));
check("bad swap status -> 400", (await call(admin, "POST", `/api/work/schedule/swaps/${sw.data.swaps[0].id}`, { status: "maybe" })).status === 400);
check("approve swap", (await call(admin, "POST", `/api/work/schedule/swaps/${sw.data.swaps[0].id}`, { status: "approved" })).status === 200);
check("decide twice -> 409", (await call(admin, "POST", `/api/work/schedule/swaps/${sw.data.swaps[0].id}`, { status: "declined" })).status === 409);

// delete
check("agent delete -> 403", (await call(a1, "POST", `/api/work/schedule/items/${sid}/delete`)).status === 403);
check("admin delete", (await call(admin, "POST", `/api/work/schedule/items/${sid}/delete`)).status === 200);
check("deleted item gone", !(await call(a1, "GET", `/api/work/schedule?from=${day(0)}&to=${day(6)}`)).data.items.some((i) => i.id === sid));
check("delete again -> 404", (await call(admin, "POST", `/api/work/schedule/items/${sid}/delete`)).status === 404);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
