// Mock data for developing the Schedule page without the Worker. Enabled ONLY when localStorage.revamp_mock === "1".
// Same method names and shapes as the schedule part of src/revamp/api/work.js. State is in memory and mutable.
// Dates are anchored to the current Monday (Malaysia time) so the board always has content around "today".
import { addDays, mondayOf, todayMyt } from "./logic.js";

let me = { username: "aldo", manage_users: 1 };
export const setMe = (m) => { if (m && m.username) me = m; };
const admin = () => !!me.manage_users;
const wait = (v) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v))), 40));
const fail = (msg, status) => Promise.reject(Object.assign(new Error(msg), { status }));

export const PEOPLE = [
  { username: "aldo", role: "admin", team: null }, { username: "mexha", role: "admin", team: null },
  { username: "sara", role: "agent", team: "B" }, { username: "daniel", role: "agent", team: "B" }, { username: "mei", role: "agent", team: "B" },
];

let types = [
  { key: "shift", name: "Agent shifts", color: "#5F9AD6", builtin: 1 },
  { key: "reload", name: "Reload events", color: "#E8C547", builtin: 1 },
  { key: "meeting", name: "Meetings", color: "#A78BFA", builtin: 1 },
  { key: "maint", name: "Maintenance", color: "#EF4444", builtin: 1 },
  { key: "report", name: "Reports & deadlines", color: "#4CC38A", builtin: 1 },
  { key: "training", name: "Training", color: "#56B6C2", builtin: 1 },
];

let nid = 1;
let items = [];
let swaps = [];
(() => {
  const mon = addDays(mondayOf(todayMyt()), -28);                       // series start four weeks back so past weeks are filled too
  const add = (x) => items.push({ id: nid++, brands: [], who: [], note: "", repeat: "none", off: 0, start_time: null, end_time: null, ...x });
  const SH = { AM: ["Morning", "09:00", "17:00"], PM: ["Afternoon", "13:00", "21:00"], NT: ["Night", "21:00", "05:00"], OFF: ["Day off", null, null] };
  const COV = { sara: "LPK777 · ACE33", daniel: "BM69 · HOT321 · RM68", mei: "SK69 · JK32 · ZAS36" };
  const pat = { sara: ["AM", "AM", "AM", "AM", "AM", "OFF", "OFF"], daniel: ["PM", "PM", "PM", "PM", "PM", "PM", "OFF"], mei: ["OFF", "NT", "NT", "NT", "NT", "NT", "OFF"] };
  for (const u of Object.keys(pat)) pat[u].forEach((k, d) => {
    const p = SH[k];
    add({ type_key: "shift", date: addDays(mon, d), title: p[0], start_time: p[1], end_time: p[2], who: [u], note: COV[u], off: k === "OFF" ? 1 : 0, repeat: "weekly",
      brands: k === "OFF" ? [] : COV[u].split(" · ") });
  });
  const wk = (d) => addDays(mon, 28 + d);                               // this week
  add({ type_key: "reload", date: addDays(mon, 1), title: "Midweek Reload 8%", start_time: "12:00", end_time: "23:59", brands: ["BM69", "HOT321", "RM68"], note: "Min deposit RM100 · bonus cap RM500", repeat: "weekly" });
  add({ type_key: "reload", date: addDays(mon, 4), title: "Weekend Reload 10%", start_time: "00:00", end_time: "23:59", brands: ["LPK777", "ACE33", "SK69"], note: "Min deposit RM200 · bonus cap RM800", repeat: "weekly" });
  add({ type_key: "reload", date: wk(6), title: "Sunday Reload 5%", start_time: "18:00", end_time: "23:59", brands: ["JK32", "ZAS36"], note: "Min deposit RM100" });
  add({ type_key: "meeting", date: addDays(mon, 0), title: "Weekly kickoff", start_time: "10:00", end_time: "10:30", who: ["aldo", "mexha", "sara", "daniel", "mei"], repeat: "weekly" });
  add({ type_key: "meeting", date: addDays(mon, 3), title: "Save-rate review", start_time: "16:00", end_time: "17:00", who: ["aldo", "mexha"], repeat: "weekly" });
  add({ type_key: "maint", date: wk(1), title: "Feeder maintenance (Zyra)", start_time: "03:00", end_time: "04:00", brands: ["BM69", "HOT321", "RM68", "SK69", "JK32", "ZAS36"], note: "Data may lag until 04:30" });
  add({ type_key: "report", date: addDays(mon, 0), title: "Daily report to leadership", start_time: "15:00", end_time: "15:15", who: ["aldo"], repeat: "daily" });
  add({ type_key: "report", date: addDays(mon, 3), title: "Weekly report due", start_time: "18:00", end_time: "18:00", who: ["aldo"], repeat: "weekly" });
  add({ type_key: "training", date: wk(2), title: "New hook scripts training", start_time: "15:00", end_time: "16:00", who: ["sara", "daniel", "mei"], note: "Zyra brand messaging" });
})();
let sid = 1;
swaps.push({ id: sid++, item_id: 3, from_user: "sara", note: "For Wed 21 Oct. Dentist appointment in the morning.", status: "open", created_at: "2026-10-21 08:10:00" });

const inWindow = (it, from, to) => (it.repeat === "none" ? (!from || it.date >= from) && (!to || it.date <= to) : !to || it.date <= to);

let shifts = [
  { key: "am", name: "Morning", start_time: "09:00", end_time: "17:00" },
  { key: "pm", name: "Afternoon", start_time: "13:00", end_time: "21:00" },
  { key: "nt", name: "Night", start_time: "21:00", end_time: "05:00" },
];
const shiftBad = (b) => (!String(b.name || "").trim() ? "Give the shift a name" : !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start_time || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end_time || "") ? "Start and end must be times (HH:MM)" : b.start_time === b.end_time ? "Start and end cannot be the same time" : "");
export const addShiftPreset = (b) => {
  if (!admin()) return fail("Admin only", 403);
  const bad = shiftBad(b); if (bad) return fail(bad, 400);
  if (shifts.some((s) => s.name.toLowerCase() === b.name.trim().toLowerCase())) return fail("A shift with that name already exists", 409);
  const s = { key: "s" + nid++, name: b.name.trim(), start_time: b.start_time, end_time: b.end_time };
  shifts = [...shifts, s]; return wait({ shift: s });
};
export const updateShiftPreset = (key, b) => {
  if (!admin()) return fail("Admin only", 403);
  const s = shifts.find((x) => x.key === key); if (!s) return fail("Shift not found", 404);
  const m = { ...s, ...b }, bad = shiftBad(m); if (bad) return fail(bad, 400);
  if (shifts.some((x) => x.key !== key && x.name.toLowerCase() === m.name.trim().toLowerCase())) return fail("A shift with that name already exists", 409);
  Object.assign(s, { name: m.name.trim(), start_time: m.start_time, end_time: m.end_time }); return wait({ shift: s });
};
export const deleteShiftPreset = (key) => { if (!admin()) return fail("Admin only", 403); shifts = shifts.filter((s) => s.key !== key); return wait({ ok: true }); };
export const schedule = (from, to) => wait({ types, shifts, items: items.filter((i) => inWindow(i, from, to)), my_swaps: swaps.filter((s) => s.from_user === me.username).map((s) => ({ item_id: s.item_id, status: s.status })) });
export const addScheduleItems = (list) => {
  if (!admin()) return fail("Admin only", 403);
  let n = 0;
  for (const e of list) {
    if (e.type_key === "shift" && !(e.who || []).length) return fail("A shift needs at least one person", 400);
    items.push({ id: nid++, brands: [], who: [], note: "", repeat: "none", off: String(e.title).trim().toLowerCase() === "day off" ? 1 : 0, start_time: null, end_time: null, ...e }); n++;
  }
  return wait({ created: n });
};
export const updateScheduleItem = (id, b) => {
  if (!admin()) return fail("Admin only", 403);
  const it = items.find((i) => i.id === id); if (!it) return fail("Schedule item not found", 404);
  Object.assign(it, b); return wait({ item: it });
};
export const deleteScheduleItem = (id) => { if (!admin()) return fail("Admin only", 403); items = items.filter((i) => i.id !== id); return wait({ ok: true }); };
export const deleteScheduleItems = (b) => {
  if (!admin()) return fail("Admin only", 403);
  const hit = items.filter((i) => (!b.type_key || i.type_key === b.type_key) && (!b.from || i.date >= b.from) && (!b.to || i.date <= b.to));
  if (b.preview) return wait({ count: hit.length, repeating: hit.filter((i) => i.repeat !== "none").length });
  items = items.filter((i) => !hit.includes(i)); return wait({ deleted: hit.length });
};
export const addScheduleType = ({ name, color }) => {
  if (!admin()) return fail("Admin only", 403);
  const t = { key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nid++, name, color, builtin: 0 };
  types = [...types, t]; return wait({ type: t });
};
export const updateScheduleType = (key, b) => {
  if (!admin()) return fail("Admin only", 403);
  const t = types.find((x) => x.key === key); if (!t) return fail("Schedule type not found", 404);
  if (b.name !== undefined && types.some((x) => x.key !== key && x.name.toLowerCase() === String(b.name).trim().toLowerCase())) return fail("A schedule type with that name already exists", 409);
  Object.assign(t, { name: b.name === undefined ? t.name : String(b.name).trim(), color: b.color || t.color }); return wait({ type: t });
};
export const deleteScheduleType = (key, b) => {
  if (!admin()) return fail("Admin only", 403);
  const n = items.filter((i) => i.type_key === key).length;
  if (b && b.preview) return wait({ items: n });
  types = types.filter((t) => t.key !== key); items = items.filter((i) => i.type_key !== key); return wait({ ok: true, items: n });
};
export const requestSwap = (id, note) => {
  const it = items.find((i) => i.id === id);
  if (!it) return fail("Schedule item not found", 404);
  if (!it.who.includes(me.username)) return fail("You can only request a swap on a shift you are on", 403);
  if (swaps.some((s) => s.item_id === id && s.from_user === me.username && s.status === "open")) return fail("You already have an open swap request for this shift", 409);
  const s = { id: sid++, item_id: id, from_user: me.username, note: note || "", status: "open", created_at: new Date().toISOString().slice(0, 19).replace("T", " ") };
  swaps.push(s); return wait({ swap: s });
};
export const swapsList = () => {
  if (!admin()) return fail("Admin only", 403);
  return wait({ swaps: [...swaps].sort((a, b) => (b.status === "open") - (a.status === "open") || b.id - a.id).map((s) => {
    const it = items.find((i) => i.id === s.item_id) || {};
    return { ...s, item: { id: it.id, title: it.title, date: it.date, start_time: it.start_time, end_time: it.end_time, who: it.who || [], repeat: it.repeat } };
  }) });
};
export const decideSwap = (id, status) => {
  if (!admin()) return fail("Admin only", 403);
  const s = swaps.find((x) => x.id === id); if (!s) return fail("Swap request not found", 404);
  if (s.status !== "open") return fail(`This request was already ${s.status}`, 409);
  s.status = status; return wait({ swap: s });
};
export const people = () => wait({ people: PEOPLE });
