// Dev fixtures for the task views. Enabled ONLY when localStorage.revamp_mock === "1" (never the default).
// Dates are relative to today (Malaysia time) so the harness always looks current.
const DAY = 864e5, pad = (n) => String(n).padStart(2, "0");
const todayNum = () => Math.floor((Date.now() + 8 * 3600e3) / DAY);
const ymd = (n) => { const d = new Date(n * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export const mockEnabled = () => { try { return localStorage.getItem("revamp_mock") === "1"; } catch { return false; } };

export const MOCK_PEOPLE = [
  { username: "aldo", role: "admin", team: "B" }, { username: "mexha", role: "agent", team: "B" },
  { username: "sara", role: "agent", team: "B" }, { username: "daniel", role: "agent", team: "B" },
  { username: "mei", role: "agent", team: "B" }, { username: "kai", role: "agent", team: "B" },
];
export const MOCK_PROJECTS = [
  { id: 1, name: "Team B Retention" }, { id: 2, name: "October Win-Back Drive" }, { id: 3, name: "Data Quality" },
];

// [title, assignee, owner, dueOffset|null, status, high, tags, project, est_min, checklist_total, checklist_done, comments]
const ROWS = [
  ["Call back swecin about missed bonus", "sara", "aldo", -2, "progress", 1, ["LPK777", "Tier V"], 1, 240, 3, 1, 3],
  ["Daily contact list: Team B", "sara", "aldo", 0, "pending", 0, ["Daily"], 1, 180, 3, 0, 0],
  ["Welcome-back message for cooling whales", "daniel", "mexha", 0, "pending", 1, ["Win-back"], 2, 90, 2, 0, 0],
  ["Verify Telegram links for ACE33", "mei", "mexha", 1, "progress", 0, ["ACE33", "Data"], 3, 360, 2, 1, 1],
  ["Weekly save-rate review", "aldo", "aldo", 3, "pending", 0, ["Report"], 1, 120, 0, 0, 0],
  ["Fix duplicate rows for JK32", "mexha", "aldo", 5, "pending", 0, ["JK32", "Data"], 3, 120, 0, 0, 0],
  ["Update message hooks for Zyra brands", "sara", "aldo", 9, "pending", 0, ["Copy"], 2, 240, 0, 0, 2],
  ["Handover notes for night shift", "daniel", "aldo", null, "pending", 0, [], 1, 60, 0, 0, 0],
  ["Reply to player complaint", "sara", "mexha", -1, "pending", 0, ["Support"], 1, 45, 2, 0, 0],
  ["Audit last week's mistakes log", "mexha", "aldo", -4, "done", 0, ["KPI"], 1, 90, 0, 0, 0],
  ["Contact list for Tier 3 BM69", "sara", "aldo", -1, "done", 0, ["BM69"], 1, 120, 0, 0, 0],
  ["Check livechat log gaps", "mei", "mexha", 2, "deferred", 0, ["Livechat"], 3, 150, 0, 0, 1],
  ["Re-engage dormant Tier V (DSLD 30+)", "daniel", "aldo", 2, "pending", 1, ["Tier V", "DSLD"], 2, 200, 4, 1, 0],
  ["Prepare grace claim rule note for new agents", "mei", "aldo", 4, "pending", 0, ["Training"], 1, 90, 0, 0, 0],
  ["Review HOT321 deposit-block list", "kai", "aldo", -3, "pending", 1, ["HOT321"], 1, 100, 1, 0, 0],
  ["Compile October win-back results", "aldo", "aldo", 12, "pending", 0, ["Report"], 2, 240, 0, 0, 0],
  ["Spot-check RM68 uids vs usernames", "mexha", "aldo", 6, "pending", 0, ["RM68", "Data"], 3, 120, 0, 0, 0],
  ["Telegram import audit", "mei", "mexha", 8, "pending", 0, ["Data"], 3, 180, 3, 0, 0],
  ["Check-in mismatch report", "kai", "aldo", 1, "progress", 0, ["Check-in"], 1, 120, 2, 1, 0],
  ["Draft SK69 festive message", "daniel", "aldo", 10, "pending", 0, ["SK69", "Copy"], 2, 120, 0, 0, 0],
  ["Clean #REF! rows from ZAS36 feeder", "mexha", "aldo", -5, "pending", 1, ["ZAS36", "Data"], 3, 90, 0, 0, 4],
  ["Quarterly VIP retention summary", "aldo", "aldo", 21, "pending", 0, ["Report"], 1, 480, 0, 0, 0],
  ["Onboard new agent: shadow sessions", "aldo", "aldo", 15, "pending", 0, ["Training"], 1, 300, 0, 0, 0],
  ["Follow up: ACE33 whale complaint", "kai", "aldo", 0, "pending", 1, ["ACE33", "Tier V"], 1, 60, 0, 0, 2],
  ["Verify bonus credit for 12 players", "sara", "mexha", 3, "pending", 0, ["Bonus"], 1, 90, 0, 0, 0],
  ["Update Behavior Book notes", "aldo", "aldo", null, "pending", 0, [], 1, 60, 0, 0, 0],
  ["Backlog: tag legacy contacts", "mei", "aldo", null, "pending", 0, ["Data"], 3, 240, 0, 0, 0],
  ["Review swap requests for week 44", "aldo", "aldo", 2, "pending", 0, ["Schedule"], 1, 30, 0, 0, 0],
  ["Cooling-whale call list (Tier V)", "daniel", "aldo", 1, "pending", 1, ["Tier V", "Win-back"], 2, 150, 0, 0, 0],
  ["LPK777 mid-month promo copy", "kai", "mexha", 6, "pending", 0, ["LPK777", "Copy"], 2, 120, 0, 0, 1],
  ["Audit contact_log outcomes", "mexha", "aldo", 14, "pending", 0, ["KPI"], 3, 180, 0, 0, 0],
  ["Reply to JK32 livechat escalation", "sara", "aldo", 0, "pending", 0, ["JK32", "Support"], 1, 45, 0, 0, 0],
  ["Fix feeder retry on timeout", "mexha", "aldo", 3, "progress", 0, ["Data"], 3, 300, 3, 1, 2],
  ["Send approved copy to Tier 3 list", "daniel", "aldo", -2, "done", 0, ["Win-back"], 2, 60, 0, 0, 0],
  ["Weekly save-rate report (wk 42)", "aldo", "aldo", -6, "done", 0, ["Report"], 1, 120, 0, 0, 0],
  ["Spot-check HOT321 snapshot", "mei", "mexha", -3, "done", 0, ["HOT321", "Data"], 3, 60, 0, 0, 0],
  ["Telegram link request: 7 players", "kai", "aldo", -1, "done", 0, ["Telegram"], 1, 45, 0, 0, 0],
  ["Review RM68 hooks", "daniel", "aldo", -1, "pending", 0, ["RM68", "Copy"], 2, 90, 0, 0, 0],
  ["Grace week reminders", "sara", "aldo", 2, "pending", 0, ["Grace"], 1, 60, 0, 0, 0],
];

let store = null;
function build() {
  const t0 = todayNum(), now = Date.now();
  return ROWS.map((r, i) => {
    const [title, assignee, owner, due, status, hi, tags, project_id, est, ct, cd, cm] = r;
    const created = (due === null ? t0 : t0 + due) - (2 + (i % 6)) - (due === null ? 3 : 0);
    const started = status === "progress" ? new Date(now - (1 + (i % 4)) * 3600e3 - 14 * 60e3).toISOString().slice(0, 19).replace("T", " ") : null;
    return {
      id: i + 1, title, description: "", status, high_priority: hi, owner, assignee, project_id, flow_id: null, parent_id: null,
      due_date: due === null ? null : ymd(t0 + due), due_time: due === null ? null : "19:00", est_minutes: est,
      started_at: started, spent_seconds: status === "progress" ? 1800 : 0,
      completed_at: status === "done" ? `${ymd(t0 + due)} 09:30:00` : null,
      tags, linked_player: null, created_at: `${ymd(created)} 02:00:00`, updated_at: `${ymd(created)} 02:00:00`,
      observers: [], checklist_total: ct, checklist_done: cd, comment_count: cm,
    };
  });
}
export const mockTasks = () => { if (!store) store = build(); return store.map((t) => ({ ...t, tags: [...t.tags], observers: [...t.observers] })); };
export function mockUpdate(id, patch) {
  if (!store) store = build();
  const t = store.find((x) => x.id === id);
  if (!t) return Promise.reject(new Error("Task not found"));
  Object.assign(t, patch);
  return Promise.resolve({ task: { ...t } });
}
export const resetMock = () => { store = null; };
