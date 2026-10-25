// Settings > Task data. Wipes every task and everything attached to it (checklists, observers, comments, history) to reset the data after
// testing. Projects, flows, templates and people are kept. It cannot be undone, so it shows exactly what will go and asks for the words
// CLEAR TASKS. Needs the "Clear all task data" permission (worker/work/tasks.js enforces it).
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "../ui/index.jsx";
import { work } from "../api/work.js";

const WORD = "CLEAR TASKS";

export default function TaskDataPanel() {
  const [counts, setCounts] = useState(null), [err, setErr] = useState(""), [typed, setTyped] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => { work.clearTasks({ preview: true }).then((r) => { setCounts(r.counts); setErr(""); }, (e) => setErr(e.message || "Could not read the task data")); }, []);
  useEffect(() => { load(); }, [load]);

  const go = async () => {
    setBusy(true); setErr("");
    try { const r = await work.clearTasks({ confirm: WORD }); toast(`Cleared ${r.cleared.tasks} task${r.cleared.tasks === 1 ? "" : "s"} and everything attached to them`); setTyped(""); load(); }
    catch (e) { setErr(e.message || "Could not clear"); }
    setBusy(false);
  };

  const rows = counts ? [["Tasks", counts.tasks], ["Checklist items", counts.checklist], ["Observers", counts.observers], ["Comments", counts.comments], ["Pictures and files", counts.attachments || 0], ["History entries", counts.history]] : [];
  const empty = counts && counts.tasks === 0 && counts.history === 0;
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
      <div className="card"><div className="body" style={{ display: "grid", gap: 12 }}>
        <div className="rl-gh">Reset task data</div>
        <div>Delete every task and everything attached to it, so you can start again. <b>Projects, flows, templates and people are kept.</b> This cannot be undone.</div>
        {err && <div className="neg">{err}</div>}
        {counts ? (
          <table className="acc-tbl"><tbody>{rows.map(([l, n]) => <tr key={l}><td>{l}</td><td className="r mono">{n}</td></tr>)}</tbody></table>
        ) : !err && <div className="dim">Counting…</div>}
        {counts && (
          <label>Type <b className="mono">{WORD}</b> to confirm
            <input className="input" value={typed} placeholder={WORD} autoComplete="off" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && typed === WORD && !empty) go(); }} />
          </label>
        )}
        <div>
          <button className="btn danger" disabled={busy || !counts || empty || typed !== WORD} onClick={go}>{busy ? "Clearing…" : empty ? "Nothing to clear" : "Delete all task data"}</button>
        </div>
      </div></div>
    </div>
  );
}
