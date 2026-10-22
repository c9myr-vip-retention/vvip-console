// Feature flags. A new feature ships behind its own flag, off for everyone until Aldo says "live". When he does, the flag moves to DEFAULT_ON below.
//   Turn one on for this browser:   https://groupb-tracker.pages.dev/?<name>=1     (remembered from then on, even on the plain address)
//   Turn one off for this browser:  ?<name>=0                                      (also remembered)
//   Forget every choice made here:  ?flags=reset                                   (each flag goes back to its default)
// The remembered choice lives in localStorage on that one browser, so nobody else is affected.
// Add a flag by choosing a short name and asking for it where the feature starts:  const on = readFlag("tasks2");
// "revamp" (the new console) is LIVE: it is on by default, and ?revamp=0 is how a browser goes back to the old console.
// It keeps its original storage key, so browsers that already chose stay as they were.
const DEFAULT_ON = new Set(["revamp"]);
const KEY = (name) => (name === "revamp" ? "revamp_ui" : "ff_" + name);
const NAME = /^[a-z0-9_]{1,24}$/;

const state = (name) => {
  const v = localStorage.getItem(KEY(name));
  return v === "1" ? true : v === "0" ? false : DEFAULT_ON.has(name);          // a remembered choice wins; otherwise the default
};

/** Read the flag from the address (?name=1 or ?name=0 is remembered) and return whether it is on. Call it once when the app starts. */
export function readFlag(name) {
  try {
    if (!NAME.test(name)) return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("flags") === "reset") resetFlags();
    const q = params.get(name);
    if (q === "1") localStorage.setItem(KEY(name), "1");
    else if (q === "0") localStorage.setItem(KEY(name), "0");
    return state(name);
  } catch (e) { return DEFAULT_ON.has(name); }          // storage blocked: the default
}

/** Whether the flag is on right now (no address parsing). For code that runs after the app has started. */
export function flagOn(name) {
  try { return NAME.test(name) && state(name); } catch (e) { return DEFAULT_ON.has(name); }
}

/** Every flag this browser has on (default-on flags count unless they were turned off). */
export function flagsOn() {
  try {
    const names = new Set(DEFAULT_ON);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === "revamp_ui") names.add("revamp");
      else if (k && k.startsWith("ff_")) names.add(k.slice(3));
    }
    return [...names].filter((n) => NAME.test(n) && state(n)).sort();
  } catch (e) { return [...DEFAULT_ON]; }
}

/** Forget every remembered choice in this browser: each flag goes back to its default. */
export function resetFlags() {
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === "revamp_ui" || (k && k.startsWith("ff_"))) drop.push(k); }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* storage blocked: nothing was remembered anyway */ }
}
