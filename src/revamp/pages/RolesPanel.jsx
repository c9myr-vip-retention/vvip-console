// Settings > Roles. Roles are ranked, most senior first (move them with the arrows). Make a role, name it, pick a starting point and switch any
// function on or off. Any role can be a template: a role that starts from another role either follows it (changes to the template also change
// this role) or is a one-off copy. Every role can be deleted, built-in ones too (accounts on it are moved first).
// One switch = one permission = one function. A switch that differs from the starting point is marked "changed". The Worker enforces all of it
// (worker/perms.js, worker/roles.js); this page only edits it. Needs the users.manage permission.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Select, toast } from "../ui/index.jsx";
import { work } from "../api/work.js";
import { hiddenPerm } from "../schedule/logic.js";

const FIXED = { admin: "Admin", agent: "Agent", viewer: "Viewer" };           // the fixed starting sets built into the code
/** What a role can start from: nothing, another role (a template), or a fixed default set when no role of that name is left. selfKey is left out. */
function baseOptions(roles, selfKey) {
  const out = [{ value: "none", label: "Nothing (start empty)" }];
  for (const r of roles) if (r.key !== selfKey) out.push({ value: r.key, label: `Same as ${r.name}` });
  for (const [k, n] of Object.entries(FIXED)) if (k === selfKey || !roles.some((r) => r.key === k)) out.push({ value: k, label: `Fixed ${n} defaults` });
  return out;
}
const baseName = (roles, role) => (role.base === "none" ? "nothing" : (roles.find((r) => r.key === role.base && r.key !== role.key) || {}).name || (FIXED[role.base] ? `fixed ${FIXED[role.base]} defaults` : role.base));

function Switch({ on, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={"rl-sw" + (on ? " on" : "")} onClick={() => onChange(!on)}><span /></button>;
}

function NewRole({ roles, onClose, onCreated }) {
  const [name, setName] = useState(""), [base, setBase] = useState(() => (roles.find((r) => r.key === "agent") || roles[0] || {}).key || "none");
  const [copy, setCopy] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const save = async () => {
    if (!name.trim()) return setErr("Give the role a name");
    setBusy(true); setErr("");
    try { const r = await work.createRole({ name: name.trim(), base, copy: copy && base !== "none" }); toast(`Created "${r.role.name}"`); onCreated(r.role); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title="New role" onClose={onClose} width="min(480px,94vw)" footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={busy} onClick={save}>Create role</button></>}>
      <div style={{ display: "grid", gap: 14 }}>
        <label>Name<input className="input" autoFocus value={name} maxLength={30} placeholder="e.g. Supervisor, Team lead, Trainer" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} /></label>
        <label>Start from (any role works as a template)
          <Select value={base} onChange={setBase} options={baseOptions(roles, "")} />
        </label>
        {base !== "none" && (
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: "row" }}>
              <input type="radio" name="rl-copy" className="chk" checked={!copy} onChange={() => setCopy(false)} />
              <span><b>Keep in step with it.</b> <span className="dim">When that role changes, this role changes too, except for the switches you set on this role yourself.</span></span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: "row" }}>
              <input type="radio" name="rl-copy" className="chk" checked={copy} onChange={() => setCopy(true)} />
              <span><b>Copy it once.</b> <span className="dim">Take its permissions as they are now. Later changes to that role do not reach this one.</span></span>
            </label>
          </div>
        )}
        <span className="dim" style={{ fontSize: 12 }}>You switch individual functions on or off after the role is created.</span>
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

function DeleteRole({ role, others, onClose, onDeleted }) {
  const [to, setTo] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const held = role.assigned || 0;                       // accounts given this role (accounts on old settings are not moved)
  const go = async () => {
    if (held && !to) return setErr("Choose a role to move them to");
    setBusy(true); setErr("");
    try { await work.deleteRole(role.key, held ? { move_to: to } : {}); toast(`Deleted "${role.name}"`); onDeleted(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Delete "${role.name}"?`} onClose={onClose} width="min(480px,94vw)" footer={<><button className="btn" onClick={onClose}>Keep it</button><button className="btn danger" disabled={busy} onClick={go}>Delete role</button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        {role.builtin && <div className="dim">This is a built-in role. You can delete it; you can always make a role with the same name again.</div>}
        {held > 0
          ? <><div>{held} account{held === 1 ? " is" : "s are"} on this role. They move to another role and take its permissions.</div>
              <label>Move them to<Select value={to} onChange={setTo} placeholder="Choose a role" options={others.map((r) => ({ value: r.key, label: r.name }))} /></label></>
          : <div>Nobody has been given this role.</div>}
        {role.used_by > 0 && <div className="dim">{role.used_by} role{role.used_by === 1 ? " starts" : "s start"} from this one. {role.used_by === 1 ? "It keeps" : "They keep"} the permissions {role.used_by === 1 ? "it has" : "they have"} now.</div>}
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

export default function RolesPanel() {
  const [data, setData] = useState(null), [err, setErr] = useState(""), [sel, setSel] = useState(null), [accounts, setAccounts] = useState([]);
  const [modal, setModal] = useState(null), [name, setName] = useState("");
  const load = useCallback(async (keep) => {
    try {
      const r = await work.roles();
      setData(r); setErr("");
      setSel((cur) => keep || (r.roles.some((x) => x.key === cur) ? cur : (r.roles[0] || {}).key || null));
    } catch (e) { setErr(e.message || "Could not load roles"); setData((d) => d || { roles: [], perms: [], groups: [] }); }
    work.accounts().then(setAccounts, () => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const role = data && data.roles.find((r) => r.key === sel);
  useEffect(() => { setName(role ? role.name : ""); }, [role && role.key, role && role.name]);   // eslint-disable-line react-hooks/exhaustive-deps
  const defaults = useMemo(() => {                                    // what the starting point has on, per permission (the Worker computes it)
    const m = {}, on = new Set(role ? role.start || [] : []);
    for (const p of (data ? data.perms : [])) m[p.key] = on.has(p.key);
    return m;
  }, [data, role]);

  const patch = (next) => setData((d) => ({ ...d, roles: d.roles.map((r) => (r.key === next.key ? { ...r, ...next } : r)) }));
  const change = async (body, ok) => {
    try {
      const r = await work.updateRole(role.key, body); patch(r.role); if (ok) toast(ok);
      if (role.builtin || role.used_by || body.base !== undefined) load(role.key);       // roles that follow this one change with it: fetch them all again
    } catch (e) { toast(e.message || "Could not save"); load(role.key); }
  };
  const move = async (r, dir) => {
    try { await work.moveRole(r.key, { dir }); load(r.key); } catch (e) { toast(e.message || "Could not move it"); }
  };
  const flip = (key, on) => {
    const def = defaults[key], overrides = { ...role.overrides };
    if (on === def) delete overrides[key]; else overrides[key] = on;
    const perms = on ? [...new Set([...role.perms, key])] : role.perms.filter((x) => x !== key);
    patch({ key: role.key, overrides, perms });                                      // optimistic; the Worker's answer replaces it
    change({ overrides: { [key]: on === def ? null : on } });
  };
  const rename = () => { const n = name.trim(); if (!n) return setName(role.name); if (n !== role.name) change({ name: n }, "Renamed"); };

  if (!data) return <div className="dim" style={{ padding: 14 }}>Loading…</div>;
  if (data.setup_needed) return <div className="card"><div className="body">Roles are not set up yet. The database needs the roles migration first (<span className="mono">schema_v27_roles.sql</span>), run by Aldo.</div></div>;

  const people = role ? accounts.filter((u) => (u.role_key ? u.role_key === role.key : u.role === role.key)) : [];
  const changed = role ? Object.keys(role.overrides).filter((k) => !hiddenPerm(k) && role.overrides[k] !== defaults[k]).length : 0;
  const shownPerms = data.perms.filter((p) => !hiddenPerm(p.key));
  const total = shownPerms.length, onCount = role ? role.perms.filter((k) => !hiddenPerm(k)).length : 0;

  return (
    <div className="rl">
      {err && <div className="banner crit">{err}</div>}
      <div className="rl-list">
        <div className="rl-lh"><b>Roles <span className="dim" style={{ fontWeight: 400 }}>({data.roles.length})</span></b><span className="grow" /><button className="btn sm pri" onClick={() => setModal({ kind: "new" })}>+ New role</button></div>
        <div className="dim rl-note" style={{ marginTop: 0 }}>Ranked most senior first. Use the arrows to move a role. New roles go to the bottom (most junior).</div>
        {data.roles.map((r, i) => (
          <div key={r.key} className={"rl-item rl-rank" + (r.key === sel ? " on" : "")}>
            <button type="button" className="rl-pick" onClick={() => setSel(r.key)}>
              <span className="dim rl-n">{i + 1}.</span>
              <span className="rl-name"><b>{r.name}</b>
                <span className="dim">{r.users} {r.users === 1 ? "person" : "people"} · {r.builtin && r.base === r.key ? "built in" : `from ${baseName(data.roles, r)}`}{r.used_by ? ` · ${r.used_by} based on it` : ""}</span></span>
            </button>
            <button type="button" className="rl-arrow" disabled={i === 0} aria-label={`Move ${r.name} up`} onClick={() => move(r, "up")}>↑</button>
            <button type="button" className="rl-arrow" disabled={i === data.roles.length - 1} aria-label={`Move ${r.name} down`} onClick={() => move(r, "down")}>↓</button>
          </div>
        ))}
        <div className="dim rl-note">A role is a name plus a set of permissions. Give each account one role in the Accounts tab. Accounts that have not been given a role yet keep the access they have today.</div>
      </div>

      {role && (
        <div className="rl-edit">
          <div className="card"><div className="body rl-head">
            <label>Role name<input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
            <label>Starts from
              <Select value={role.base} options={baseOptions(data.roles, role.key)} onChange={(v) => change({ base: v }, "Starting point changed")} />
            </label>
            <div className="rl-sum">
              <b className="mono">{onCount}</b> of {total} on{changed ? <> · <b className="mono">{changed}</b> changed from the starting point</> : " · same as the starting point"}
              <div className="rl-act">
                <button className="btn sm" disabled={!changed} onClick={() => change({ reset: true }, "Back to the starting point")}>Reset to starting point</button>
                <button className="btn sm danger" onClick={() => setModal({ kind: "delete" })}>Delete role</button>
              </div>
            </div>
          </div></div>

          {data.groups.map(([gk, gl]) => (
            <div key={gk} className="card"><div className="body">
              <div className="rl-gh">{gl}</div>
              {shownPerms.filter((p) => p.group === gk).map((p) => {
                const on = role.perms.includes(p.key), diff = p.key in role.overrides && role.overrides[p.key] !== defaults[p.key];
                return (
                  <div key={p.key} className="rl-row">
                    <Switch on={on} label={p.label} onChange={(v) => flip(p.key, v)} />
                    <div className="grow">
                      <div><b>{p.label}</b>{diff && <span className="rl-chg" title={`The starting point has this ${defaults[p.key] ? "on" : "off"}`}>changed</span>}</div>
                      <div className="dim rl-desc">{p.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div></div>
          ))}
          <div className="dim" style={{ fontSize: 12 }}>
            {people.length ? <>On this role: {people.slice(0, 12).map((u) => u.username).join(", ")}{people.length > 12 ? ` and ${people.length - 12} more` : ""}.</> : "Nobody is on this role yet."}
            {" "}Changes save as you switch them and apply to everyone on the role the next time their page loads.
          </div>
        </div>
      )}

      {modal && modal.kind === "new" && <NewRole roles={data.roles} onClose={() => setModal(null)} onCreated={(r) => { setModal(null); load(r.key); }} />}
      {modal && modal.kind === "delete" && role && <DeleteRole role={role} others={data.roles.filter((r) => r.key !== role.key)} onClose={() => setModal(null)} onDeleted={() => { setModal(null); setSel(null); load(); }} />}
    </div>
  );
}
