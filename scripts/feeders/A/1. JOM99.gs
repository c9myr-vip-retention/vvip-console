/*** ============================================================
 * groupb-tracker · Google Sheets Feeder (Apps Script)  ·  v2
 * Pushes the Daily (Tier 3) and Daily V (Tier V) tabs to the
 * dashboard ingest endpoint, a few times per day, automatically.
 *
 * INSTALL (per brand sheet):
 *   1) Extensions > Apps Script. Paste this file.
 *   2) Set CONFIG.BRAND to THIS sheet's brand (do not leave it on LPK777).
 *   3) Project Settings > Script Properties: add INGEST_TOKEN.
 *   4) Run setupDailyTrigger() once (authorize when prompted).
 *   5) Test with runFeedNow() and read the Execution log.
 *   6) Deploy > New deployment > Web app (Execute as: Me, Who has access:
 *      Anyone). Send the Web App URL to the console admin — the console
 *      starts every brand's sync together at 12:15 PM through doPost().
 *
 * v2 NOTE — column headers are matched CASE/SPACE-INSENSITIVELY.
 *   A renamed header ("Addressing" -> "addressing") once silently
 *   emptied the addressing field for days. Now spelling/case/space
 *   changes no longer break a column, common renames are aliased,
 *   and any UNMAPPED header is logged so you can see it immediately.
 * ============================================================ */

const CONFIG = {
  BRAND: "JOM99",   // pre-set for this sheet JOM99 (do not change)
  API_URL: "https://groupb-tracker-api.viprtn.workers.dev/api/ingest",
  TIMEZONE: "GMT+8",
  TABS: [
    { name: "Daily",   tier_segment: "3" },
    { name: "Daily V", tier_segment: "V" },
  ],
  TRIGGER_HOURS: [15, 19, 22],   // 3 PM, 7 PM, 10 PM GMT+8 - backup runs only; the main sync is started by the console at 12:15 PM (see doPost)
};

const HEADER_MAP = {
  "Treshold $": "threshold",
  "entry_date": "entry_date",
  "brand": "brand",
  "username": "username",
  "uid": "uid",
  "previous_tier": "previous_tier",
  "tier": "tier",
  "tier_movement": "tier_movement",
  "grace_end_date": "grace_end_date",
  "status": "status",
  "status_days": "status_days",
  "group_name": "group_name",
  "daily_deposit_count": "daily_deposit_count",
  "daily_deposit": "daily_deposit",
  "daily_withdraw_count": "daily_withdraw_count",
  "daily_withdraw": "daily_withdraw",
  "monthly_deposit_count": "monthly_deposit_count",
  "monthly_deposit": "monthly_deposit",
  "is_mau": "is_mau",
  "monthly_withdraw_count": "monthly_withdraw_count",
  "monthly_withdraw": "monthly_withdraw",
  "lifetime_deposit_count": "lifetime_deposit_count",
  "lifetime_deposit": "lifetime_deposit",
  "lifetime_withdraw_count": "lifetime_withdraw_count",
  "lifetime_withdraw": "lifetime_withdraw",
  "bet": "bet",
  "valid_bet": "valid_bet",
  "win_loss": "win_loss",
  "last_deposit_date": "last_deposit_date",
  "register_date": "register_date",
  "member_days": "member_days",
  "addressing": "addressing",
  "PNL": "pnl",
};

// Extra header spellings that should ALSO map to a field. Add new spellings
// here (not in HEADER_MAP) when a sheet column gets renamed. Matched
// case/space-insensitively like everything else.
const HEADER_ALIASES = {
  "addressing": ["address", "nickname", "nick name", "preferred name", "salutation", "call name", "name to address"],
};

const DATE_FIELDS = ["entry_date", "grace_end_date", "last_deposit_date", "register_date"];
const ERR_RE = /^#(REF|N\/A|VALUE|DIV\/0|NAME|NUM|NULL|ERROR)/i;

// Normalize a header for tolerant matching: lowercase, strip everything that
// isn't a letter or digit (spaces, underscores, $, punctuation). So
// "Addressing", "addressing", " ADDRESSING " all collapse to "addressing".
function normHeader_(h) {
  return String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Build the normalized lookup once: normalized header text -> field name.
const NORM_HEADER_MAP = (function () {
  const m = {};
  for (const key in HEADER_MAP) m[normHeader_(key)] = HEADER_MAP[key];
  for (const field in HEADER_ALIASES) {
    HEADER_ALIASES[field].forEach(function (alt) { m[normHeader_(alt)] = field; });
  }
  return m;
})();

function clean_(v) {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string" && ERR_RE.test(v.trim())) return null;
  return v;
}

function fmt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TIMEZONE, "yyyy-MM-dd");
  return v;
}

function tabToRows_(tabName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) { Logger.log("Tab not found: " + tabName); return []; }
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function (h) { return String(h).trim(); });

  // Resolve each column to a field via normalized matching; note any that don't map.
  const unmapped = [];
  const fieldByCol = headers.map(function (h) {
    if (h === "") return undefined;
    const field = NORM_HEADER_MAP[normHeader_(h)];
    if (!field) unmapped.push(h);
    return field;
  });
  if (unmapped.length) {
    Logger.log(tabName + " — UNMAPPED headers (ignored): " + JSON.stringify(unmapped));
  }

  const rows = [];
  let withAddressing = 0;
  for (let i = 1; i < data.length; i++) {
    const raw = data[i];
    const obj = {};

    for (let c = 0; c < fieldByCol.length; c++) {
      const field = fieldByCol[c];
      if (!field) continue;
      let val = clean_(raw[c]);
      if (val !== null && DATE_FIELDS.indexOf(field) !== -1) val = fmt_(val);
      obj[field] = val;
    }

    const hasKey = (obj.uid !== null && obj.uid !== undefined) ||
                   (obj.username !== null && obj.username !== undefined);
    if (hasKey) {
      rows.push(obj);
      if (obj.addressing !== null && obj.addressing !== undefined && String(obj.addressing).trim() !== "") withAddressing++;
    }
  }
  Logger.log(tabName + " — rows: " + rows.length + ", with addressing: " + withAddressing);
  return rows;
}

function postRows_(brand, tier_segment, rows) {
  const token = PropertiesService.getScriptProperties().getProperty("INGEST_TOKEN");
  if (!token) throw new Error("INGEST_TOKEN script property not set");

  const res = UrlFetchApp.fetch(CONFIG.API_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ brand: brand, tier_segment: tier_segment, rows: rows }),
    muteHttpExceptions: true,
  });
  Logger.log(brand + " " + tier_segment + " [" + rows.length + "] -> " +
             res.getResponseCode() + " " + res.getContentText());
  return res.getResponseCode();
}

function runFeedNow() {
  return CONFIG.TABS.map((t) => {
    const rows = tabToRows_(t.name);
    const code = rows.length ? postRows_(CONFIG.BRAND, t.tier_segment, rows) : null;
    return { tier: t.tier_segment, rows: rows.length, code: code };
  });
}

// ── Web App start door ─────────────────────────────────────────────
// The console Worker POSTs here at 12:15 PM MYT, calling all brands at once
// so every feed syncs together. The body must carry this sheet's
// INGEST_TOKEN, so only the Worker can start a run. Deploy once as a Web App
// (Execute as: Me · Who has access: Anyone) and give the URL to the console.
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { /* bad body → unauthorized */ }
  const token = PropertiesService.getScriptProperties().getProperty("INGEST_TOKEN");
  if (!token || body.key !== token) return json_({ ok: false, error: "unauthorized" });
  const lock = LockService.getScriptLock();   // a second start call while one is running → skip, don't double-post
  if (!lock.tryLock(5000)) return json_({ ok: false, brand: CONFIG.BRAND, error: "already running" });
  try {
    return json_({ ok: true, brand: CONFIG.BRAND, tabs: runFeedNow() });
  } catch (err) {
    return json_({ ok: false, brand: CONFIG.BRAND, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}


function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach((tr) => {
    if (tr.getHandlerFunction() === "runFeedNow") ScriptApp.deleteTrigger(tr);
  });
  CONFIG.TRIGGER_HOURS.forEach((h) => {
    ScriptApp.newTrigger("runFeedNow")
      .timeBased()
      .atHour(h)
      .everyDays(1)
      .inTimezone(CONFIG.TIMEZONE)
      .create();
  });
  Logger.log("Daily triggers set for " + CONFIG.TRIGGER_HOURS.join(", ") + " " + CONFIG.TIMEZONE);
}
