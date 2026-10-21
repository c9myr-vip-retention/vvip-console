// Work-management routes (tasks, schedule, projects/flows/templates/analytics/bin).
// Mounted ONCE in worker/index.js, after requireAuth. Each handler returns a Response, or null
// when the path is not its own. One file per area so parallel work never collides:
//   tasks.js    -> /api/work/tasks*, /api/work/workload        (agent: tasks-backend)
//   schedule.js -> /api/work/schedule*                         (agent: schedule)
//   projects.js -> /api/work/projects*, flows*, templates*, analytics*, bin*   (agent: work-setup)
import { handleTasks } from "./tasks.js";
import { handleSchedule } from "./schedule.js";
import { handleProjects } from "./projects.js";

// c = { path, method, url, request, env, user, canManage, ok, err, log, ctx }
//   user.username identifies the person; canManage === admin (users.manage_users).
//   ok(data, status) / err(msg, status) are the Worker's JSON helpers; log(actor, action, detail) writes activity_log.
export async function handleWork(c) {
  if (!c.path.startsWith("/api/work/")) return null;
  for (const h of [handleTasks, handleSchedule, handleProjects]) {
    const r = await h(c);
    if (r) return r;
  }
  return null;
}
