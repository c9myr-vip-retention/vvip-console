// Pure helpers for the Schedule page: Malaysia-time dates, repeat expansion, ordering, on-duty test.
// Dates are 'YYYY-MM-DD' strings in Malaysia time (GMT+8). No Date objects leave this file except through these helpers.
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M3 = MONTHS.map((m) => m.slice(0, 3));

export const myNow = () => new Date(Date.now() + 8 * 3600e3);
export const todayMyt = () => myNow().toISOString().slice(0, 10);
export const nowMinutes = () => { const d = myNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const nowLabel = () => { const d = myNow(); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (s, n) => fromUtc(utc(s) + n * 864e5);
export const diffDays = (a, b) => Math.round((utc(a) - utc(b)) / 864e5);
export const dow = (s) => (new Date(utc(s)).getUTCDay() + 6) % 7;            // 0 = Monday
export const mondayOf = (s) => addDays(s, -dow(s));
export const monthStart = (s) => s.slice(0, 7) + "-01";
export const addMonths = (s, n) => { const [y, m] = s.split("-").map(Number); return fromUtc(Date.UTC(y, m - 1 + n, 1)); };
export const daysInMonth = (s) => { const [y, m] = s.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const dayNum = (s) => Number(s.slice(8, 10));
export const fmtD = (s) => `${dayNum(s)} ${M3[Number(s.slice(5, 7)) - 1]}`;
export const fmtDow = (s) => `${DAYS[dow(s)]} ${fmtD(s)}`;
export const monthLabel = (s) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
export const weekLabel = (mon) => { const end = addDays(mon, 6); return `${fmtD(mon)} – ${fmtD(end)} ${end.slice(0, 4)}`; };
/** The 7-column month grid: from the Monday on/before the 1st, 6 rows (42 days) so the grid height never jumps. */
export const monthGrid = (s) => { const first = mondayOf(monthStart(s)); return Array.from({ length: 42 }, (_, i) => addDays(first, i)); };

/** Does this (stored) item fall on `date`? Repeats start on the item's own date. */
export function occursOn(it, date) {
  if (date < it.date) return false;
  if (it.repeat === "daily") return true;
  if (it.repeat === "weekly") return diffDays(date, it.date) % 7 === 0;
  return it.date === date;
}
/** Expand stored items into per-day occurrences between from..to (inclusive): [{ item, date, key }]. */
export function expand(items, from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) for (const it of items) if (occursOn(it, d)) out.push({ item: it, date: d, key: `${it.id}:${d}` });
  return out;
}

const mins = (t) => { if (!t) return null; const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };
export const byTime = (a, b) => (a.item.off ? 1 : 0) - (b.item.off ? 1 : 0) || (a.item.start_time || "99").localeCompare(b.item.start_time || "99") || a.item.id - b.item.id;
export const timeStr = (it) => (!it.start_time ? "All day" : it.start_time + (it.end_time && it.end_time !== it.start_time ? "–" + it.end_time : ""));

/** Shifts that are on right now (handles night shifts that run past midnight). */
export function onDuty(items, today, minute) {
  const out = [];
  for (const it of items) {
    if (it.type_key !== "shift" || it.off) continue;
    const a = mins(it.start_time), b = mins(it.end_time);
    if (a === null || b === null) continue;
    const overnight = b <= a;
    if (occursOn(it, today) && (overnight ? minute >= a : minute >= a && minute < b)) out.push(it);
    else if (overnight && occursOn(it, addDays(today, -1)) && minute < b) out.push(it);
  }
  return out;
}

export const TIME_OPTIONS = (() => {
  const o = [{ value: "", label: "All day" }];
  for (let h = 0; h < 24; h++) for (const m of [0, 30]) { const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; o.push({ value: t, label: t }); }
  o.push({ value: "23:59", label: "23:59" });
  return o;
})();
export const timeOptionsFor = (...vals) => { const o = [...TIME_OPTIONS]; for (const v of vals) if (v && !o.some((x) => x.value === v)) o.splice(1, 0, { value: v, label: v }); return o; };

/** Shifts live in the HR portal now, so every shift screen is hidden. Set to false to bring them back (Roster, shift times, swaps, "on duty now"). */
export const HIDE_SHIFTS = true;

/** While shifts are hidden, the shift-swap permissions are hidden from the role screens too. */
export const hiddenPerm = (key) => HIDE_SHIFTS && String(key).startsWith("schedule.swap");

/** Shift times used until the Worker sends the admin-managed list (and by older Workers that do not send one). */
export const DEFAULT_SHIFTS = [
  { key: "am", name: "Morning", start_time: "09:00", end_time: "17:00" },
  { key: "pm", name: "Afternoon", start_time: "13:00", end_time: "21:00" },
  { key: "nt", name: "Night", start_time: "21:00", end_time: "05:00" },
];
/** A shift that runs past midnight (counts as night cover on the board, whatever it is called). */
export const isOvernight = (it) => { const a = mins(it.start_time), b = mins(it.end_time); return a !== null && b !== null && b <= a; };
export const REPEAT_OPTIONS = [{ value: "none", label: "Does not repeat" }, { value: "daily", label: "Every day" }, { value: "weekly", label: "Every week" }];

/** Quick date picks for the add form. */
export function quickDates(kind, today, monthCursor) {
  const mon = mondayOf(today), wk = (n) => [0, 1, 2, 3, 4].map((i) => addDays(mon, 7 * n + i));
  if (kind === "wk0") return wk(0);
  if (kind === "wk1") return wk(1);
  const out = [], n = daysInMonth(monthCursor), base = monthStart(monthCursor);
  for (let d = 0; d < n; d++) { const s = addDays(base, d); if ((kind === "wd") === (dow(s) < 5)) out.push(s); }
  return out;
}
