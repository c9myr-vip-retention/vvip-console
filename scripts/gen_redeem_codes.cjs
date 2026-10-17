#!/usr/bin/env node
/* Redeem-code generator for the VVIP Code campaign.
   NOT wired into the console on purpose — run it on demand, paste the codes
   into BO, then into the Campaigns page.

   Usage:
     node scripts/gen_redeem_codes.cjs BM69 HOT321 RM68 SK69 JK32
     node scripts/gen_redeem_codes.cjs BM69 --tail 7
     node scripts/gen_redeem_codes.cjs --team B          (Zyra brands of a team)

   Format: BRAND + 6 random chars, e.g. BM69ZSP3DK
     - alphabet drops every hard-confusable character: O 0 I 1 L
     - 729 million combinations per brand, no clashes in 20k draws
     - both codes of an event share the same shape, so A and B are
       indistinguishable — players comparing in a group chat cannot tell who
       got the bigger amount, which is what keeps the "luck" believable
*/

const SAFE = "23456789ABCDEFGHJKMNPRSTUVWXYZ".split("");   // no 0 1 I L O Q

// Zyra brands only — TC brands ship no uid and can never run this campaign.
const TEAM_ZYRA = {
  A: ["EZ96", "BIG321", "FUN36", "JUS22", "YES82"],
  B: ["BM69", "HOT321", "RM68", "SK69", "JK32"],
  C: ["VS96", "ONG66", "RUSH33", "MAX39", "AC69"],   // AC69 joined the feed 2026-08-05
};

function randTail(n) {
  const out = [];
  const buf = new Uint32Array(n);
  require("crypto").webcrypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) out.push(SAFE[buf[i] % SAFE.length]);
  return out.join("");
}

const args = process.argv.slice(2);
let tailLen = 6;
const ti = args.indexOf("--tail");
if (ti !== -1) { tailLen = Number(args[ti + 1]) || 6; args.splice(ti, 2); }

let brands = [];
const tm = args.indexOf("--team");
if (tm !== -1) {
  const t = String(args[tm + 1] || "").toUpperCase();
  brands = TEAM_ZYRA[t] || [];
  if (!brands.length) { console.error(`unknown team "${t}" — use A, B or C`); process.exit(1); }
} else {
  brands = args.filter((a) => !a.startsWith("--"));
}

if (!brands.length) {
  console.error("usage: node scripts/gen_redeem_codes.cjs BM69 HOT321   |   --team B   [--tail 6]");
  process.exit(1);
}

const used = new Set();
const draw = (brand) => {
  for (let i = 0; i < 50; i++) {
    const c = brand + randTail(tailLen);
    if (!used.has(c)) { used.add(c); return c; }
  }
  throw new Error("could not find a free code — widen --tail");
};

console.log(`\nbrand      code A            code B`);
console.log("-".repeat(46));
for (const b of brands) {
  console.log(b.padEnd(10) + draw(b).padEnd(18) + draw(b));
}
console.log(`\n${brands.length} brand(s) · tail ${tailLen} · alphabet ${SAFE.length} chars (no O 0 I 1 L)`);
console.log("Check against previously issued codes before use — this script has no memory.\n");
