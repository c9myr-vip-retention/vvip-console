// Date helpers for the Schedule page. All dates are 'YYYY-MM-DD' strings (Malaysia calendar, GMT+8); weeks start on Monday.
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parse = (s) => new Date(s + "T00:00:00Z");
const iso = (d) => d.toISOString().slice(0, 10);

export const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
export const dow = (s) => (parse(s).getUTCDay() + 6) % 7;                       // 0 = Monday
export const weekStart = (s) => addDays(s, -dow(s));
export const todayMYT = () => iso(new Date(Date.now() + 8 * 3600e3));
export const minutesNowMYT = () => { const d = new Date(Date.now() + 8 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const fmtDay = (s) => `${+s.slice(8)} ${MONTHS[+s.slice(5, 7) - 1]}`;
export const monthOf = (s) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) - 1 });
export const shiftMonth = ({ y, m }, n) => { const t = y * 12 + m + n; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; };
export const daysIn = ({ y, m }) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const ymd = ({ y, m }, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Repeats are expanded here, not in the API: an item shows on its own date, then every day / every week after it.
export function occurs(item, day) {
  if (item.date === day) return true;
  if (day < item.date) return false;
  if (item.repeat === "daily") return true;
  if (item.repeat === "weekly") return diffDays(day, item.date) % 7 === 0;
  return false;
}

export const toMins = (t) => { if (!t) return null; const [h, m] = t.split(":"); return +h * 60 + +m; };
export const timeStr = (s) => (!s.start_time ? "All day" : s.start_time + (s.end_time && s.end_time !== s.start_time ? "–" + s.end_time : ""));
export const byTime = (a, b) => (a.off ? 1 : 0) - (b.off ? 1 : 0) || (a.start_time || "99").localeCompare(b.start_time || "99") || a.id - b.id;

export function timeOptions() {
  const o = [{ value: "", label: "All day" }];
  for (let h = 0; h < 24; h++) for (const m of [0, 30]) { const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; o.push({ value: t, label: t }); }
  o.push({ value: "23:59", label: "23:59" });
  return o;
}
