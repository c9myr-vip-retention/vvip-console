// Shared by the Roster grid and the Shift groups dialog: turn "this brush on these (person|date) cells" into API calls.
// Only a one-off, single-person shift is changed in place; a repeating or shared shift is skipped (edit it from the Week view).
import { api } from "./api.js";
import { expand } from "./logic.js";

const CHUNK = 400;   // the Worker takes at most 500 new items per call

/** Map of 'person|date' -> [occurrence] for every shift between from..to. */
export function shiftCells(items, from, to) {
  const m = new Map();
  for (const o of expand(items.filter((i) => i.type_key === "shift"), from, to)) {
    for (const p of o.item.who) { const k = `${p}|${o.date}`; if (!m.has(k)) m.set(k, []); m.get(k).push(o); }
  }
  return m;
}

/** brush: { title, start_time, end_time, off } or { erase: true }. keepOff: leave days off and leave alone.
 *  Returns { added, updated, cleared, same, blocked, skipped }. Throws the API error. */
export async function paintCells(cells, keys, brush, { keepOff = false } = {}) {
  const adds = [], ops = [], r = { added: 0, updated: 0, cleared: 0, same: 0, blocked: 0, skipped: 0 };
  for (const k of keys) {
    const [person, date] = k.split("|"), list = cells.get(k) || [];
    const one = list.length === 1 && list[0].item.repeat === "none" && list[0].item.who.length === 1 ? list[0].item : null;
    if (brush.erase) { if (!list.length) continue; if (one) ops.push(["cleared", () => api.deleteItem(one.id)]); else r.blocked++; continue; }
    if (!list.length) { adds.push({ type_key: "shift", date, who: [person], title: brush.title, start_time: brush.start_time, end_time: brush.end_time, off: brush.off ? 1 : 0, repeat: "none", brands: [], note: "" }); continue; }
    if (keepOff && list.some((o) => o.item.off)) { r.skipped++; continue; }
    if (!one) r.blocked++;
    else if (one.title === brush.title && (one.start_time || null) === (brush.start_time || null) && (one.end_time || null) === (brush.end_time || null) && !!one.off === !!brush.off) r.same++;
    else ops.push(["updated", () => api.updateItem(one.id, { title: brush.title, start_time: brush.start_time || null, end_time: brush.end_time || null, off: brush.off ? 1 : 0 })]);
  }
  for (let i = 0; i < adds.length; i += CHUNK) { await api.addItems(adds.slice(i, i + CHUNK)); r.added += Math.min(CHUNK, adds.length - i); }
  for (let i = 0; i < ops.length; i += 10) {                                   // ten at a time, so a big month does not flood the Worker
    await Promise.all(ops.slice(i, i + 10).map(([kind, f]) => f().then(() => { r[kind]++; })));
  }
  return r;
}

export const paintSummary = (r, erase) => {
  const n = r.added + r.updated + r.cleared;
  const parts = [`${erase ? "Cleared" : "Set"} ${n} cell${n === 1 ? "" : "s"}`];
  if (r.blocked) parts.push(`${r.blocked} skipped (repeating or shared shift)`);
  if (r.skipped) parts.push(`${r.skipped} kept (day off or leave)`);
  return parts.join(" · ");
};
