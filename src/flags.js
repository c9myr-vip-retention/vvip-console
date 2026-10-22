// Feature flags. Every new feature ships behind its own flag, off for everyone until Aldo says "live".
//   Turn one on for this browser:   https://groupb-tracker.pages.dev/?<name>=1     (remembered from then on, even on the plain address)
//   Turn one off again:             ?<name>=0
//   Turn every flag off at once:    ?flags=reset
// The remembered state lives in localStorage on that one browser, so nobody else is affected.
// Add a flag by choosing a short name and asking for it where the feature starts:  const on = readFlag("tasks2");
// "revamp" (the new console) keeps its original storage key, so browsers that already turned it on stay on.
const KEY = (name) => (name === "revamp" ? "revamp_ui" : "ff_" + name);
const NAME = /^[a-z0-9_]{1,24}$/;

/** Read the flag from the address (?name=1 or ?name=0 is remembered) and return whether it is on. Call it once when the app starts. */
export function readFlag(name) {
  try {
    if (!NAME.test(name)) return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("flags") === "reset") resetFlags();
    const q = params.get(name);
    if (q === "1") localStorage.setItem(KEY(name), "1");
    else if (q === "0") localStorage.removeItem(KEY(name));
    return localStorage.getItem(KEY(name)) === "1";
  } catch (e) { return false; }
}

/** Whether the flag is on right now (no address parsing). For code that runs after the app has started. */
export function flagOn(name) {
  try { return NAME.test(name) && localStorage.getItem(KEY(name)) === "1"; } catch (e) { return false; }
}

/** Every flag this browser has turned on. */
export function flagsOn() {
  try {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === "revamp_ui" && localStorage.getItem(k) === "1") out.push("revamp");
      else if (k && k.startsWith("ff_") && localStorage.getItem(k) === "1") out.push(k.slice(3));
    }
    return out.sort();
  } catch (e) { return []; }
}

/** Turn every flag off in this browser. */
export function resetFlags() {
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === "revamp_ui" || (k && k.startsWith("ff_"))) drop.push(k); }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* storage blocked: nothing was remembered anyway */ }
}
