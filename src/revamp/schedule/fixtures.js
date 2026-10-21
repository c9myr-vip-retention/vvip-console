// Mock data for the Schedule page. Only used when localStorage.revamp_mock === "1" (never the default).
// Mirrors the real API shapes (docs/design/BUILD-CONTRACT.md section 3) and is anchored on the current week so the board is never empty.
import { addDays, weekStart, todayMYT } from "./dates.js";

const TYPES = [
  { key: "shift", name: "Agent shifts", color: "#5F9AD6", builtin: true },
  { key: "reload", name: "Reload events", color: "#E8C547", builtin: true },
  { key: "meeting", name: "Meetings", color: "#A78BFA", builtin: true },
  { key: "maint", name: "Maintenance", color: "#EF4444", builtin: true },
  { key: "report", name: "Reports & deadlines", color: "#4CC38A", builtin: true },
  { key: "training", name: "Training", color: "#56B6C2", builtin: true },
];
const PEOPLE = [
  { username: "aldo", role: "admin", team: null }, { username: "mexha", role: "admin", team: null },
  { username: "sara", role: "agent", team: "B" }, { username: "daniel", role: "agent", team: "B" }, { username: "mei", role: "agent", team: "C" },
];

let items = [], swaps = [], nextId = 1, nextSwap = 1, seeded = false;
function seed() {
  if (seeded) return; seeded = true;
  const mon = addDays(weekStart(todayMYT()), -7);          // series start a week ago so repeat expansion is exercised
  const add = (x) => items.push({ id: nextId++, start_time: "", end_time: "", brands: [], who: [], note: "", repeat: "none", off: 0, ...x });
  const SH = { AM: ["Morning", "09:00", "17:00"], PM: ["Afternoon", "13:00", "21:00"], NT: ["Night", "21:00", "05:00"], OFF: ["Day off", "", ""] };
  const pat = { sara: ["AM", "AM", "AM", "AM", "AM", "OFF", "OFF"], daniel: ["PM", "PM", "PM", "PM", "PM", "PM", "OFF"], mei: ["OFF", "NT", "NT", "NT", "NT", "NT", "OFF"] };
  const cov = { sara: "LPK777 · ACE33", daniel: "BM69 · HOT321 · RM68", mei: "SK69 · JK32 · ZAS36" };
  Object.entries(pat).forEach(([u, p]) => p.forEach((k, d) => {
    const [title, s, e] = SH[k];
    add({ type_key: "shift", date: addDays(mon, d), title, start_time: s, end_time: e, who: [u], note: cov[u], repeat: "weekly", off: k === "OFF" ? 1 : 0 });
  }));
  add({ type_key: "reload", date: addDays(mon, 1), title: "Midweek Reload 8%", start_time: "12:00", end_time: "23:59", brands: ["BM69", "HOT321", "RM68"], note: "Min deposit RM100 · bonus cap RM500", repeat: "weekly" });
  add({ type_key: "reload", date: addDays(mon, 4), title: "Weekend Reload 10%", start_time: "00:00", end_time: "23:59", brands: ["LPK777", "ACE33", "SK69"], note: "Min deposit RM200 · bonus cap RM800", repeat: "weekly" });
  add({ type_key: "reload", date: addDays(mon, 13), title: "Sunday Reload 5%", start_time: "18:00", end_time: "23:59", brands: ["JK32", "ZAS36"], note: "Min deposit RM100" });
  add({ type_key: "meeting", date: mon, title: "Weekly kickoff", start_time: "10:00", end_time: "10:30", who: ["aldo", "mexha", "sara", "daniel", "mei"], repeat: "weekly" });
  add({ type_key: "meeting", date: addDays(mon, 3), title: "Save-rate review", start_time: "16:00", end_time: "17:00", who: ["aldo", "mexha"], repeat: "weekly" });
  add({ type_key: "maint", date: addDays(mon, 8), title: "Feeder maintenance (Zyra)", start_time: "03:00", end_time: "04:00", brands: ["BM69", "HOT321", "RM68", "SK69", "JK32", "ZAS36"], note: "Data may lag until 04:30" });
  add({ type_key: "report", date: mon, title: "Daily report to leadership", start_time: "15:00", end_time: "15:15", who: ["aldo"], repeat: "daily" });
  add({ type_key: "report", date: addDays(mon, 3), title: "Weekly report due", start_time: "18:00", end_time: "18:00", who: ["aldo"], repeat: "weekly" });
  add({ type_key: "training", date: addDays(mon, 9), title: "New hook scripts training", start_time: "15:00", end_time: "16:00", who: ["sara", "daniel", "mei"], note: "Zyra brand messaging" });
}

const clone = (o) => JSON.parse(JSON.stringify(o));
export const mockApi = {
  async people() { return { people: clone(PEOPLE) }; },
  async schedule() { seed(); return { types: clone(TYPES), items: clone(items) }; },
  async addItems(list) {
    seed();
    list.forEach((x) => items.push({ id: nextId++, start_time: "", end_time: "", brands: [], who: [], note: "", repeat: "none", off: 0, ...clone(x) }));
    return { created: list.length };
  },
  async updateItem(id, b) { const it = items.find((x) => x.id === id); Object.assign(it, clone(b)); return { item: clone(it) }; },
  async deleteItem(id) { items = items.filter((x) => x.id !== id); return { ok: true }; },
  async addType({ name, color }) { const t = { key: "t_" + name.toLowerCase().replace(/\W+/g, "_"), name, color, builtin: false }; TYPES.push(t); return { type: clone(t) }; },
  async requestSwap(id, note) { swaps.push({ id: nextSwap++, item_id: id, from_user: "sara", note, status: "open" }); return { swap: { id: nextSwap - 1 } }; },
  async swaps() { seed(); return { swaps: swaps.map((s) => { const i = items.find((x) => x.id === s.item_id) || {}; return { ...s, date: i.date, title: i.title, start_time: i.start_time, end_time: i.end_time }; }) }; },
  async decideSwap(id, status) { const s = swaps.find((x) => x.id === id); s.status = status; return { swap: clone(s) }; },
};
