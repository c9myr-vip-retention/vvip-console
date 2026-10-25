// Recycle bin (admin). Soft-deleted tasks, projects, flows and templates are kept 30 days. Restore, or delete forever (confirmed).
import React, { useMemo, useState } from "react";
import { Select, toast } from "../ui";
import { api, allowed, useLoad, person, Notice, AdminOnly, Confirm, fmtWhen } from "../setup/common.jsx";

const TYPE = { task: "Task", project: "Project", flow: "Flow", template: "Template" };
const RANGES = [{ value: "30", label: "Last 30 days" }, { value: "7", label: "Last 7 days" }, { value: "1", label: "Today" }];
const ago = (ts) => (Date.now() - new Date(String(ts).replace(" ", "T") + "Z").getTime()) / 864e5;

export default function RecycleBin({ ctx }) {
  const admin = allowed(ctx, "bin.manage");
  const { data, loading, error, reload } = useLoad(() => (admin ? api.bin() : Promise.resolve(null)), [admin], ["tasks", "projects"]);
  const [range, setRange] = useState("30"), [type, setType] = useState(""), [q, setQ] = useState(""), [del, setDel] = useState(null), [busy, setBusy] = useState(false);
  const rows = useMemo(() => (data?.items || []).filter((i) => ago(i.deleted_at) <= Number(range) && (!type || i.type === type) && (!q || `${i.name} ${i.id}`.toLowerCase().includes(q.toLowerCase()))), [data, range, type, q]);
  if (!admin) return <AdminOnly what="The Recycle bin" />;
  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast(ok); setDel(null); reload(); } catch (e) { toast(e.message); } setBusy(false); };
  return (
    <>
      <div className="top"><h1>Recycle bin</h1><span className="badge admin">Admin</span><span className="grow" /><span className="dim">The bin keeps deleted items for {data?.keep_days || 30} days.</span></div>
      <div className="bar">
        <Select value={range} onChange={setRange} options={RANGES} style={{ width: 160 }} />
        <Select value={type} onChange={setType} placeholder="All types" style={{ width: 150 }} options={Object.entries(TYPE).map(([value, label]) => ({ value, label }))} />
        <input className="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Notice error={error} loading={loading && !data} />
      {data && (
        <div className="card tw"><table>
          <thead><tr><th>ID</th><th>Name</th><th>Deleted on</th><th>Deleted by</th><th>Type</th><th></th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={`${i.type}-${i.id}`} style={{ cursor: "default" }}>
                <td className="mono">{i.id}</td><td>{i.name}</td><td>{fmtWhen(i.deleted_at)}</td><td>{i.deleted_by ? person(i.deleted_by) : <span className="dim">—</span>}</td>
                <td><span className="tag">{TYPE[i.type]}</span></td>
                <td className="r" style={{ whiteSpace: "nowrap" }}>
                  <button className="btn sm" disabled={busy} onClick={() => run(() => api.restore(i.type, i.id), `${TYPE[i.type]} restored`)}>Restore</button>{" "}
                  <button className="btn sm danger" disabled={busy} onClick={() => setDel(i)}>Delete forever</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr style={{ cursor: "default" }}><td colSpan={6} className="dim">The bin is empty.</td></tr>}
          </tbody>
        </table><div className="pg"><span>Total: {rows.length}</span></div></div>
      )}
      {del && <Confirm title="Delete forever" action="Delete forever" busy={busy} onCancel={() => setDel(null)}
        text={<>Permanently delete the {TYPE[del.type].toLowerCase()} <b>{del.name}</b>? This cannot be undone.</>}
        onConfirm={() => run(() => api.purge(del.type, del.id), "Deleted forever")} />}
    </>
  );
}
