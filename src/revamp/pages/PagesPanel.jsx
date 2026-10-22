// Settings > Page access. A table of every page against every role: a tick means that role can open the page. The ticks are worked out from the
// roles' permissions (the same rule the sidebar uses), so this is always what people really see. A page that depends on one permission can be
// switched here for a role; pages open to everyone, or that need any one of several permissions, are shown but not switched here.
// Needs the users.manage permission.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../ui/index.jsx";
import { work } from "../api/work.js";
import { useLive } from "../live.js";
import { NAV } from "../tokens.js";
import { PAGE_PERM, pageKeys } from "../perms.js";

// Every page once, in the order the admin sidebar shows them, then the pages only the agent-style sidebar has.
function pageList() {
  const seen = new Set(), out = [];
  for (const kind of ["admin", "agent"]) {
    for (const [section, items] of NAV[kind]) {
      for (const [key, label] of items) if (!seen.has(key)) { seen.add(key); out.push({ key, label, section: kind === "agent" && !out.some((p) => p.section === section) ? `${section} (agent view)` : section }); }
    }
  }
  return out;
}

export default function PagesPanel() {
  const [data, setData] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => { work.roles().then((r) => { setData(r); setErr(""); }, (e) => { setErr(e.message || "Could not load roles"); setData((d) => d || { roles: [], perms: [] }); }); }, []);
  useEffect(() => { load(); }, [load]);
  useLive(["people"], load);

  const pages = useMemo(pageList, []);
  const label = (k) => ((data && data.perms.find((p) => p.key === k)) || {}).label || k;
  const open = useMemo(() => Object.fromEntries((data ? data.roles : []).map((r) => [r.key, pageKeys({ perms: r.perms })])), [data]);

  const flip = async (role, page) => {
    const perm = PAGE_PERM[page.key];
    const want = !open[role.key].has(page.key), isStart = (role.start || []).includes(perm);
    setBusy(true);
    try { await work.updateRole(role.key, { overrides: { [perm]: want === isStart ? null : want } }); toast(`${role.name}: ${page.label} ${want ? "opened" : "closed"}`); load(); }
    catch (e) { toast(e.message || "Could not save"); }
    setBusy(false);
  };

  if (!data) return <div className="dim" style={{ padding: 14 }}>Loading…</div>;
  if (data.setup_needed) return <div className="card"><div className="body">Roles are not set up yet (the roles migration has not been run).</div></div>;
  let lastSection = null;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {err && <div className="banner crit">{err}</div>}
      <div className="dim">Which roles can open each page. A tick means they can. Click a tick to switch a page on or off for a role. This only decides whether the page shows in the sidebar; what people can do or see inside a page still follows the other permissions and their team. Accounts with personal permissions can differ from their role (see Accounts).</div>
      <div className="card"><div className="tw" style={{ overflowX: "auto" }}>
        <table className="pg-tbl">
          <thead><tr><th>Page</th>{data.roles.map((r) => <th key={r.key}>{r.name}</th>)}<th className="pg-need" style={{ textAlign: "left" }}>Needs</th></tr></thead>
          <tbody>
            {pages.map((p) => {
              const need = PAGE_PERM[p.key], single = typeof need === "string";
              const sec = p.section !== lastSection ? (lastSection = p.section) : null;
              return (
                <React.Fragment key={p.key}>
                  {sec && <tr className="pg-sec"><td colSpan={data.roles.length + 2}>{sec}</td></tr>}
                  <tr>
                    <td><b>{p.label}</b></td>
                    {data.roles.map((r) => {
                      const on = open[r.key].has(p.key);
                      return (
                        <td key={r.key}>
                          {single
                            ? <button type="button" className={"pg-cell" + (on ? " on" : "")} disabled={busy} aria-pressed={on} aria-label={`${r.name}: ${p.label}`} onClick={() => flip(r, p)}>{on ? "✓" : ""}</button>
                            : <span className={"pg-cell" + (on ? " on" : "")}>{on ? "✓" : ""}</span>}
                        </td>
                      );
                    })}
                    <td className="pg-need">{need ? (Array.isArray(need) ? `any of: ${need.map(label).join(", ")}` : label(need)) : "Everyone"}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
