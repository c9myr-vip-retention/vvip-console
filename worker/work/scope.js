// Which people's tasks this request may not see, by the role hierarchy (worker/perms.js). Loaded once per request and cached on `c`.
import { hiddenPeople } from "../perms.js";

/** Set of usernames whose tasks are hidden from this person. Empty for people outside the hierarchy (no role). */
export async function hiddenFor(c) {
  if (c._hid) return c._hid;
  let rows = [];
  if (c.user && c.user.role_key && c.roles && c.roles.has(c.user.role_key)) {
    try { rows = (await c.env.DB.prepare("SELECT username, role, role_key, team FROM users").all()).results || []; } catch { rows = []; }
  }
  c._hid = hiddenPeople(rows, c.user, c.roles, c.perms, { tasks: true });
  return c._hid;
}
