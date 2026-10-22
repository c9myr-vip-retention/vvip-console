// Shared helpers for the four task views (dates are Malaysia time, GMT+8; "day numbers" are whole days since 1970-01-01).
import { can } from "../perms.js";
import { work } from "../api/work.js";
import { toast } from "../ui/index.jsx";
import { mockEnabled, mockUpdate } from "./fixtures.js";

export const DAY = 864e5;
const pad = (n) => String(n).padStart(2, "0");
export const todayNum = () => Math.floor((Date.now() + 8 * 3600e3) / DAY);
export const toNum = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
export const toStr = (n) => { const d = new Date(n * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const dow = (n) => (((n + 3) % 7) + 7) % 7;                     // Monday = 0
export const fmtDay = (n, opt = { day: "numeric", month: "short" }) => new Date(n * DAY).toLocaleDateString("en-GB", { ...opt, timeZone: "UTC" });
export const fmtTime = (hhmm) => { if (!hhmm) return ""; const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "am" : "pm"}`; };
const parseUtc = (s) => Date.parse(String(s).replace(" ", "T") + "Z");

// ---- permissions (contract section 2) ----
export const isAdmin = (me) => can(me, "tasks.view_all");
export const canEdit = (me) => (me && me.perms ? can(me, "tasks.use") : me?.can_edit !== false);
/** May this person change the task's date? Admin: any. Agent: their own (assignee or owner). Viewer: never. */
export const canMoveDate = (t, me) => canEdit(me) && t.status !== "done" && (can(me, "tasks.edit_any") || t.assignee === me?.username || t.owner === me?.username);
/** Reassigning is admin only. */
export const canReassign = (t, me) => canEdit(me) && can(me, "tasks.assign_others") && t.status !== "done";

// ---- deadline buckets (calendar weeks, Monday to Sunday) ----
export const BUCKETS = [
  ["over", "Overdue", "#F2727F"], ["today", "Today", "#E39A4B"], ["week", "This week", "#5F9AD6"], ["next", "Next week", "#56B6C2"],
  ["later", "Later", "#8B94A7"], ["none", "No deadline", "#6B7385"], ["done", "Completed", "#4CC38A"],
];
export function bucketOf(t, today = todayNum()) {
  if (t.status === "done") return "done";
  if (!t.due_date) return "none";
  const d = toNum(t.due_date), weekEnd = today + (6 - dow(today));
  if (d < today) return "over";
  if (d === today) return "today";
  if (d <= weekEnd) return "week";
  if (d <= weekEnd + 7) return "next";
  return "later";
}
/** Date a card gets when dropped on a bucket: string, null (clear), or undefined (not a valid drop target). */
export function bucketDate(key, today = todayNum()) {
  const weekEnd = today + (6 - dow(today)), friThis = weekEnd - 2;
  if (key === "today") return toStr(today);
  if (key === "none") return null;
  if (key === "week") return friThis > today ? toStr(friThis) : weekEnd > today ? toStr(weekEnd) : undefined;
  if (key === "next") return toStr(weekEnd + 5);
  if (key === "later") return toStr(weekEnd + 12);
  return undefined;                                                      // over / done: set through status, not by dragging
}

export function dueInfo(t, today = todayNum()) {
  if (!t.due_date) return { text: "No deadline", cls: "" };
  const d = toNum(t.due_date), time = t.due_time ? ` · ${fmtTime(t.due_time)}` : "";
  if (t.status === "done") return { text: fmtDay(d), cls: "done" };
  if (d < today) return { text: `${fmtDay(d)} · ${today - d}d late`, cls: "over" };
  if (d === today) return { text: `Today${time}`, cls: "today" };
  if (d === today + 1) return { text: `Tomorrow${time}`, cls: "" };
  return { text: fmtDay(d) + time, cls: "" };
}

export const elapsedSec = (t) => (t.spent_seconds || 0) + (t.status === "progress" && t.started_at ? Math.max(0, (Date.now() - parseUtc(t.started_at)) / 1000) : 0);
export const fmtElapsed = (s) => { s = Math.floor(s); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

export const STATUS = {
  pending: { name: "Pending", color: "#8B94A7" }, progress: { name: "In progress", color: "#5F9AD6" },
  done: { name: "Completed", color: "#4CC38A" }, deferred: { name: "Deferred", color: "#E39A4B" },
};
export const byDue = (a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || b.high_priority - a.high_priority || a.id - b.id;

// ---- saving ----
export function saveTask(id, patch) { return mockEnabled() ? mockUpdate(id, patch) : work.updateTask(id, patch); }
/** Returns move(id, patch, okMsg): saves, toasts, then onChange(). Errors from the Worker (403 / 409 ...) are shown, not thrown. */
export function useSaver(onChange) {
  return async (id, patch, okMsg) => {
    try { await saveTask(id, patch); toast(okMsg || "Saved"); onChange && onChange(); }
    catch (e) { toast(e.message || "Could not save"); onChange && onChange(); }
  };
}

// ---- drag payload (one in flight at a time) ----
let dragId = null;
export const dragStart = (e, id) => { dragId = id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(id)); } catch { /* ignore */ } };
export const dragEnd = () => { dragId = null; };
export const dragging = () => dragId;
