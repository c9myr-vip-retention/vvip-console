// One-off: convert telegram_list_template.csv -> telegram_import.sql (upserts).
// The CSV held player data and was removed from the repo before the AI Department handover.
// Maps short brand codes to the full brand names the app uses. Run with: node scripts/build_telegram_import.cjs
const fs = require("fs");
const path = require("path");

const BRAND = { LPK: "LPK777", BM: "BM69", HOT: "HOT321", RM: "RM68", SK: "SK69", ACE: "ACE33", JK: "JK32" };
const csv = fs.readFileSync(path.join(__dirname, "..", "telegram_list_template.csv"), "utf8");
const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const rows = [];
const bad = [];
const perBrand = {};
const seen = new Set();
let dupes = 0;

for (const line of lines) {
  const i1 = line.indexOf(",");
  const i2 = line.indexOf(",", i1 + 1);
  if (i1 < 0 || i2 < 0) { bad.push(line); continue; }
  const short = line.slice(0, i1).trim();
  const key = line.slice(i1 + 1, i2).trim();
  const url = line.slice(i2 + 1).trim();
  const brand = BRAND[short];
  if (!brand || !key || !url) { bad.push(line); continue; }
  const k = key + "|" + brand;
  if (seen.has(k)) dupes++;            // later row wins on upsert
  seen.add(k);
  rows.push({ key, brand, url });
  perBrand[brand] = (perBrand[brand] || 0) + 1;
}

const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const chunks = [];
for (let i = 0; i < rows.length; i += 100) chunks.push(rows.slice(i, i + 100));
const sql = chunks.map((chunk) =>
  "INSERT INTO player_telegram (player_key, brand, url, updated_by, updated_at) VALUES\n" +
  chunk.map((r) => `  (${esc(r.key)}, ${esc(r.brand)}, ${esc(r.url)}, 'csv-import', datetime('now'))`).join(",\n") +
  "\nON CONFLICT (player_key, brand) DO UPDATE SET url = excluded.url, updated_by = excluded.updated_by, updated_at = datetime('now');"
).join("\n\n");

fs.writeFileSync(path.join(__dirname, "..", "telegram_import.sql"), sql + "\n");

console.log("Total valid rows:", rows.length);
console.log("Per brand:", JSON.stringify(perBrand));
console.log("Unique (player_key, brand):", seen.size, "| duplicate lines collapsed:", dupes);
console.log("Skipped/bad lines:", bad.length, bad.length ? JSON.stringify(bad.slice(0, 5)) : "");
console.log("SQL statements (batches of 100):", chunks.length);
