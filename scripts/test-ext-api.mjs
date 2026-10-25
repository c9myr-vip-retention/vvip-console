// Local checks for the key-protected widget routes (/api/ext/*), here POST /api/ext/action/remove.
// LOCAL ONLY: talks to `wrangler dev --local` and seeds a THROWAWAY local D1 with `wrangler d1 execute --local`. Never --remote.
//   1) apply schema.sql, schema_v2..v34 with: npx wrangler d1 execute groupb-tracker-db --local --persist-to <dir> --file=...
//   2) npx wrangler dev --local --persist-to <dir> --port 8799 --var SESSION_SECRET:x --var PASSWORD_SALT:y --var INGEST_TOKEN:x --var WIDGET_API_KEY:test-widget-key
//   3) BASE=http://127.0.0.1:8799 PERSIST=<dir> node scripts/test-ext-api.mjs
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const PERSIST = process.env.PERSIST;
const KEY = process.env.WIDGET_KEY || "test-widget-key";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error("Refusing: BASE must be a local Worker"); process.exit(2); }
if (!PERSIST) { console.error("Set PERSIST=<the --persist-to dir of the local D1>"); process.exit(2); }

let fails = 0, passes = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); if (ok) passes++; else fails++; };
const sql = (q) => execFileSync("npx", ["wrangler", "d1", "execute", "groupb-tracker-db", "--local", "--persist-to", PERSIST, "--json", "--command", q], { stdio: "pipe" }).toString();
const rows = (q) => JSON.parse(sql(q).match(/\[[\s\S]*\]/)[0]).flatMap((x) => x.results || []);
const isNull = (v) => v === null || v === "null";                      // the local D1 helper prints SQL NULL as the text "null"

async function call(method, path, body, headers = { "x-widget-token": KEY }) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    } catch (e) { if (i >= 2) throw e; await new Promise((r) => setTimeout(r, 300)); }
  }
}
const REMOVE = "/api/ext/action/remove";
const SNAP = "2026-10-26", PREV = "2026-10-25";
const HW = "Halloween Day 1: deposited RM350 (RM300 or more), eligible for Day 2 and Day 3.";
const wl = (who, when, text) => `[widget · ${who} · ${when}] ${text}`;

// ---- seed: players on OG (Team C) and PP96 (Team A), two snapshots ----
sql("DELETE FROM contact_log WHERE player_key LIKE 'zz_ext%'; DELETE FROM player_days WHERE player_key LIKE 'zz_ext%'");
const ins = [];
for (const k of ["zz_ext1", "zz_ext2", "zz_ext3", "zz_ext4", "zz_ext5", "zz_ext6", "zz_ext7", "zz_ext8"]) for (const d of [PREV, SNAP]) ins.push(`('${d}', '${k}', 'OG', 'V', '${k}', '${k}')`);
ins.push(`('${SNAP}', 'zz_ext9', 'PP96', 'V', 'zz_ext9', 'zz_ext9')`);
sql(`INSERT INTO player_days (snapshot_date, player_key, brand, tier_segment, uid, username) VALUES ${ins.join(",")}`);
const put = (d, k, o) => sql(`INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, class, assigned_to, status, note, updated_by, updated_at, contacted_at) VALUES ('${d}', '${k}', 'OG', 'V', ${o.cls ? `'${o.cls}'` : "NULL"}, ${o.to ? `'${o.to}'` : "NULL"}, ${o.status ? `'${o.status}'` : "NULL"}, ${o.note === null ? "NULL" : `'${String(o.note).replace(/'/g, "''")}'`}, '${o.by}', '${o.at || "2026-10-26 10:00:00"}', ${o.ca ? `'${o.ca}'` : "NULL"})`);
const one = (d, k) => rows(`SELECT * FROM contact_log WHERE snapshot_date = '${d}' AND player_key = '${k}' AND brand = 'OG'`)[0];

// ---- the key gate ----
let r = await call("POST", REMOVE, { player_key: "zz_ext1", brand: "OG", starts_with: "Halloween Day 1:" }, {});
check("no key is 401", r.status === 401);
r = await call("POST", REMOVE, { player_key: "zz_ext1", brand: "OG", starts_with: "Halloween Day 1:" }, { "x-widget-token": "wrong" });
check("a wrong key is 401", r.status === 401);
r = await call("GET", REMOVE);
check("GET is not a route (404)", r.status === 404);

// ---- validation ----
check("invalid JSON is 400", (await call("POST", REMOVE, "{not json")).status === 400);
r = await call("POST", REMOVE, { player_key: "zz_ext1", brand: "NOPE", starts_with: "Halloween Day 1:" });
check("unknown brand is 400 'unknown brand'", r.status === 400 && /unknown brand/.test(r.data.error || ""), JSON.stringify(r));
r = await call("POST", REMOVE, { player_key: "zz_ext1", brand: "OG", starts_with: "Short" });
check("starts_with under 8 characters is 400", r.status === 400, JSON.stringify(r));
check("a missing starts_with is 400", (await call("POST", REMOVE, { player_key: "zz_ext1", brand: "OG" })).status === 400);
r = await call("POST", REMOVE, { player_key: "nobody-here", brand: "OG", starts_with: "Halloween Day 1:" });
check("an unknown player is 404 'player not found in the console'", r.status === 404 && /player not found in the console/.test(r.data.error || ""), JSON.stringify(r));

// ---- end to end: the widget files a line through /api/ext/action, then removes it ----
r = await call("POST", "/api/ext/action", { player_key: "ZZ_EXT1", brand: "og", author: "aina", note: HW });
check("the widget can file an action line first", r.status === 200 && r.data.saved === true, JSON.stringify(r));
const made = one(SNAP, "zz_ext1");
check("the row was made by the widget (no status, no assignee, '(widget)' author)", made && isNull(made.status) && isNull(made.assigned_to) && /\(widget\)$/.test(made.updated_by) && /Halloween Day 1/.test(made.note), JSON.stringify(made));
r = await call("POST", REMOVE, { player_key: "ZZ_Ext1", brand: "og", starts_with: "Halloween Day 1:" });
check("removing it: removed, and the widget-only row is deleted", r.status === 200 && r.data.removed === true && r.data.deletedRow === true && r.data.player_key === "zz_ext1" && r.data.snapshot_date === SNAP, JSON.stringify(r));
check("the row is gone from the database", one(SNAP, "zz_ext1") === undefined);

// ---- an agent's own text stays, and nothing else on the row changes ----
put(SNAP, "zz_ext2", { cls: "WATCH", to: "sara", status: "CONTACTED", by: "sara", at: "2026-10-26 09:15:00", ca: "2026-10-26", note: `called him, prefers WhatsApp\n${wl("aina", "2026-10-26 14:32", HW)}` });
const before = one(SNAP, "zz_ext2");
r = await call("POST", REMOVE, { player_key: "zz_ext2", brand: "OG", starts_with: "Halloween Day 1:" });
const after = one(SNAP, "zz_ext2");
check("the agent's own line stays and the widget line goes", r.data.removed === true && r.data.deletedRow === false && after.note === "called him, prefers WhatsApp", JSON.stringify([r.data, after]));
check("status, assignee, class, updated_by, updated_at and contacted_at are untouched", ["status", "assigned_to", "class", "updated_by", "updated_at", "contacted_at", "id"].every((c) => String(after[c]) === String(before[c])), JSON.stringify([before, after]));

// ---- only the LAST matching widget line ----
const first = wl("aina", "2026-10-26 14:32", HW), second = wl("mei", "2026-10-26 15:40", HW);
put(SNAP, "zz_ext3", { to: "sara", status: "CONTACTED", by: "sara", note: `${first}\nagent wrote this\n${second}` });
r = await call("POST", REMOVE, { player_key: "zz_ext3", brand: "OG", starts_with: "Halloween Day 1:" });
check("with two matching widget lines only the last one is removed", r.data.removed === true && one(SNAP, "zz_ext3").note === `${first}\nagent wrote this`, JSON.stringify(one(SNAP, "zz_ext3")));

// ---- text an agent typed never matches ----
const typed = `Halloween Day 1: i typed this myself\n[widget - aina - x] Halloween Day 1: wrong format\n[widget · aina] Halloween Day 1: missing time part`;
put(SNAP, "zz_ext4", { to: "sara", status: "CONTACTED", by: "sara", note: typed });
r = await call("POST", REMOVE, { player_key: "zz_ext4", brand: "OG", starts_with: "Halloween Day 1:" });
check("lines that are not in the exact widget format are never removed (200, removed:false)", r.status === 200 && r.data.removed === false && one(SNAP, "zz_ext4").note === typed, JSON.stringify([r.data, one(SNAP, "zz_ext4")]));

// ---- no matching line is not an error ----
r = await call("POST", REMOVE, { player_key: "zz_ext2", brand: "OG", starts_with: "Nothing like this at all" });
check("no matching line: 200 removed:false (already done)", r.status === 200 && r.data.removed === false && r.data.player_key === "zz_ext2", JSON.stringify(r));
r = await call("POST", REMOVE, { player_key: "zz_ext8", brand: "OG", starts_with: "Halloween Day 1:" });
check("a player with no notes at all: 200 removed:false", r.status === 200 && r.data.removed === false, JSON.stringify(r));

// ---- a row is deleted only when the widget alone made it ----
put(SNAP, "zz_ext5", { to: "sara", status: null, by: "aina (widget)", note: wl("aina", "2026-10-26 14:32", HW) });
r = await call("POST", REMOVE, { player_key: "zz_ext5", brand: "OG", starts_with: "Halloween Day 1:" });
check("emptied but it has an assignee: the row stays, note becomes NULL", r.data.removed === true && r.data.deletedRow === false && one(SNAP, "zz_ext5") && isNull(one(SNAP, "zz_ext5").note) && one(SNAP, "zz_ext5").assigned_to === "sara", JSON.stringify(one(SNAP, "zz_ext5")));
put(SNAP, "zz_ext6", { status: "NO_RESPONSE", by: "aina (widget)", note: wl("aina", "2026-10-26 14:32", HW) });
r = await call("POST", REMOVE, { player_key: "zz_ext6", brand: "OG", starts_with: "Halloween Day 1:" });
check("emptied but it has a status: the row stays, note becomes NULL", r.data.deletedRow === false && one(SNAP, "zz_ext6") && isNull(one(SNAP, "zz_ext6").note) && one(SNAP, "zz_ext6").status === "NO_RESPONSE");
put(SNAP, "zz_ext7", { by: "sara", note: wl("aina", "2026-10-26 14:32", HW) });
r = await call("POST", REMOVE, { player_key: "zz_ext7", brand: "OG", starts_with: "Halloween Day 1:" });
check("emptied but updated_by is a person, not '(widget)': the row stays, note becomes NULL", r.data.deletedRow === false && one(SNAP, "zz_ext7") && isNull(one(SNAP, "zz_ext7").note) && one(SNAP, "zz_ext7").updated_by === "sara");

// ---- newest row first, one line per call ----
const lineA = wl("aina", "2026-10-25 11:00", HW), lineB = wl("aina", "2026-10-26 14:32", HW);
put(PREV, "zz_ext8", { to: "sara", status: "CONTACTED", by: "sara", at: "2026-10-25 12:00:00", note: lineA });
put(SNAP, "zz_ext8", { to: "sara", status: "CONTACTED", by: "sara", at: "2026-10-26 12:00:00", note: lineB });
r = await call("POST", REMOVE, { player_key: "zz_ext8", brand: "OG", starts_with: "Halloween Day 1:" });
check("two days have a matching line: the newest row is handled first, the older one is left alone", r.data.snapshot_date === SNAP && isNull(one(SNAP, "zz_ext8").note) && one(PREV, "zz_ext8").note === lineA, JSON.stringify([r.data, one(SNAP, "zz_ext8"), one(PREV, "zz_ext8")]));
r = await call("POST", REMOVE, { player_key: "zz_ext8", brand: "OG", starts_with: "Halloween Day 1:" });
check("the next call takes the older row's line", r.data.removed === true && r.data.snapshot_date === PREV && isNull(one(PREV, "zz_ext8").note));

// ---- brand spellings and the player lookup ----
sql(`INSERT INTO contact_log (snapshot_date, player_key, brand, tier_segment, status, note, updated_by) VALUES ('${SNAP}', 'zz_ext9', 'PP96', 'V', NULL, '${wl("aina", "2026-10-26 14:32", HW)}', 'aina (widget)')`);
r = await call("POST", REMOVE, { player_key: "ZZ_EXT9", brand: "pp", starts_with: "Halloween Day 1:" });
check("the short brand code in any case works (pp -> PP96)", r.status === 200 && r.data.removed === true && r.data.deletedRow === true, JSON.stringify(r));

// ---- the activity log ----
const lg = rows("SELECT username, role, action, detail FROM activity_log WHERE detail LIKE 'Removed a widget action line%' ORDER BY id DESC LIMIT 1")[0];
check("it is logged as a widget contact action", lg && lg.role === "widget" && lg.action === "contact" && /^widget:/.test(lg.username) && /Removed a widget action line · zz_ext9 \(PP96\)/.test(lg.detail), JSON.stringify(lg));

// ---- leave the throwaway database clean ----
sql("DELETE FROM contact_log WHERE player_key LIKE 'zz_ext%'; DELETE FROM player_days WHERE player_key LIKE 'zz_ext%'; DELETE FROM activity_log WHERE detail LIKE '%zz_ext%'");

console.log(fails ? `\n${fails} check(s) FAILED (${passes} passed)` : `\nAll ${passes} checks passed`);
process.exit(fails ? 1 : 0);
