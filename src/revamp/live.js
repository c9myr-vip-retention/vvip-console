// "Live" updates without websockets. One poller asks the Worker's GET /api/work/pulse every few seconds (only while the tab is visible) and
// calls the pages that care about an area (tasks, schedule, projects, people) when that area's number moved. A page then reloads its own data
// quietly, so nobody has to refresh. The Worker bumps an area's number after every successful change (worker/work/pulse.js, schema_v31).
import { useEffect, useRef } from "react";
import { http } from "./api/work.js";

const EVERY = 10000;
const subs = new Map();                                   // area -> Set of callbacks
let seen = null, timer = null, busy = false, bound = false;

const mock = () => { try { return localStorage.getItem("revamp_mock") === "1"; } catch { return false; } };
const total = () => { let n = 0; subs.forEach((s) => { n += s.size; }); return n; };

async function poll() {
  if (busy || (typeof document !== "undefined" && document.hidden) || !total() || mock()) return;
  busy = true;
  try {
    const next = (await http("/api/work/pulse")).areas || {};
    const prev = seen;
    seen = { ...(prev || {}), ...next };
    if (prev) for (const a of Object.keys(next)) if (prev[a] !== next[a]) (subs.get(a) || []).forEach((f) => { try { f(); } catch { /* a page must not stop the poller */ } });
  } catch { /* offline or signed out: try again next time */ }
  busy = false;
}
const wake = () => { if (!document.hidden) poll(); };

function start() {
  if (timer) return;
  timer = setInterval(poll, EVERY);
  if (!bound) { document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake); bound = true; }
  poll();
}
function stop() { if (timer && !total()) { clearInterval(timer); timer = null; } }

/** Call fn (a quiet reload) whenever one of these areas changes. fn may change between renders. */
export function useLive(areas, fn) {
  const ref = useRef(fn); ref.current = fn;
  const key = [].concat(areas).join(",");
  useEffect(() => {
    const run = () => ref.current && ref.current();
    const list = key.split(",").filter(Boolean);
    list.forEach((a) => { if (!subs.has(a)) subs.set(a, new Set()); subs.get(a).add(run); });
    start();
    return () => { list.forEach((a) => subs.get(a)?.delete(run)); stop(); };
  }, [key]);
}
