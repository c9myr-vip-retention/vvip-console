// Settings > Accounts. One role per account; the role decides what the account may do (see the Roles tab). An account that has not been given a
// role yet is shown as "old settings" and keeps the access it has today until you pick a role for it. Needs the users.manage permission.
import React, { useCallback, useEffect, useState } from "react";
import { Avatar, Modal, Select, toast } from "../ui/index.jsx";
import { work } from "../api/work.js";
import { hiddenPerm } from "../schedule/logic.js";

const TEAMS = [{ value: "", label: "No team" }, { value: "A", label: "Team A" }, { value: "B", label: "Team B" }, { value: "C", label: "Team C" }];
/** What an account without a role can do today (mirrors legacyPerms in worker/perms.js). */
function legacySet(u, perms) {
  const out = new Set(), mgr = !!u.manage_users;
  if (mgr) perms.forEach((p) => { if (p.defaults.admin) out.add(p.key); });
  if (u.can_edit || mgr) ["contact.edit", "tasks.use", "schedule.swap_request"].forEach((k) => out.add(k));
  if (u.can_delete || mgr) out.add("contact.delete");
  if (u.on_leaderboard) out.add("kpi.scored");
  return out;
}

/** Moves every "old settings" account onto the built-in role named in its old role, so edits to that role apply to it. */
function AdoptModal({ users, roles, perms, onClose, onDone }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [keep, setKeep] = useState(true);
  const olds = [...new Set(users.filter((u) => !u.role_key).map((u) => u.role || "viewer"))];            // the old roles still in use: admin, agent, viewer
  // which role each old group moves to: the role of the same name when it still exists, else the first role there is
  const [target, setTarget] = useState(() => Object.fromEntries(olds.map((o) => [o, (roles.find((r) => r.key === o) || roles[0] || {}).key])));
  const rows = users.filter((u) => !u.role_key).map((u) => {
    const role = roles.find((r) => r.key === target[u.role || "viewer"]) || roles[0];
    const now = legacySet(u, perms), next = new Set(role ? role.perms : []);
    const label = (k) => (perms.find((p) => p.key === k) || {}).label || k;
    const loseKeys = [...now].filter((k) => !next.has(k) && !hiddenPerm(k));
    return { u, role, loseKeys, gain: [...next].filter((k) => !now.has(k) && !hiddenPerm(k)).map(label), lose: [...now].filter((k) => !next.has(k) && !hiddenPerm(k)).map(label) };
  });
  const differ = rows.filter((r) => r.gain.length || r.lose.length);
  const go = async () => {
    setBusy(true); setErr("");
    try {
      for (const r of rows) {
        await work.setAccountRole({ id: r.u.id, role_key: r.role.key });
        if (keep && r.loseKeys.length) await work.setAccountPerms({ id: r.u.id, overrides: Object.fromEntries(r.loseKeys.map((k) => [k, true])) });   // keep what they have today
      } toast(`Moved ${rows.length} account${rows.length === 1 ? "" : "s"} onto roles`); onDone(); }
    catch (e) { setErr(e.message || "Could not move them"); setBusy(false); onDone(true); }
  };
  return (
    <Modal title="Move old-settings accounts onto roles" onClose={onClose} width="min(640px,94vw)"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={busy || !rows.length || !roles.length} onClick={go}>Move {rows.length} account{rows.length === 1 ? "" : "s"}</button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div>Each account joins a role, so any change you make to that role applies to it from then on. Choose the role for each old group:</div>
        {olds.map((o) => (
          <label key={o} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, alignItems: "center", flexDirection: "row" }}>
            <span>Old <b>{o}</b> accounts</span>
            <Select value={target[o] || ""} onChange={(v) => setTarget((t) => ({ ...t, [o]: v }))} options={roles.map((r) => ({ value: r.key, label: r.name }))} />
          </label>
        ))}
        {differ.length ? (
          <div>
            <b>{differ.length} account{differ.length === 1 ? "" : "s"} would change:</b>
            {differ.map((r) => (
              <div key={r.u.id} className="ent" style={{ marginTop: 8 }}>
                <b>{r.u.username}</b> <span className="dim">→ {r.role.name}</span>
                {r.gain.length > 0 && <div className="pos" style={{ fontSize: 12 }}>Gains: {r.gain.join(", ")}</div>}
                {r.lose.length > 0 && <div className="neg" style={{ fontSize: 12 }}>Loses: {r.lose.join(", ")}</div>}
              </div>
            ))}
          </div>
        ) : <div className="pos">Nobody's access changes: every account already matches its role.</div>}
        {differ.some((r) => r.lose.length) && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: "row" }}>
            <input type="checkbox" className="chk" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span><b>Keep what each account has today.</b> <span className="dim">Whatever an account would lose above stays as a personal exception, so nobody drops out of anything (for example the KPI leaderboard).</span></span>
          </label>
        )}
        {err && <div className="neg">{err}</div>}
      </div>
    </Modal>
  );
}

const parseOv = (u) => { try { const o = JSON.parse(u.perm_overrides || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } };
const withOv = (set, ov) => { const out = new Set(set); for (const [k, v] of Object.entries(ov || {})) { if (v) out.add(k); else out.delete(k); } return out; };

/** One account's own exceptions on top of its role: for each function, "Role" (do what the role says), "Allow" or "Block". Saves as you click. */
function PermsModal({ u, role, groups, perms, onClose }) {
  const [ov, setOv] = useState(() => parseOv(u)), [rolePerms, setRolePerms] = useState(() => new Set(role.perms)), [busy, setBusy] = useState(false);
  const eff = withOv(rolePerms, ov), n = Object.keys(ov).length;
  const set = async (key, v) => {
    setBusy(true);
    try { const r = await work.setAccountPerms({ id: u.id, overrides: { [key]: v } }); setOv(r.overrides); setRolePerms(new Set(r.role_perms)); }
    catch (e) { toast(e.message || "Could not save"); }
    setBusy(false);
  };
  const reset = async () => {
    setBusy(true);
    try { const r = await work.setAccountPerms({ id: u.id, reset: true }); setOv(r.overrides); toast(`${u.username} is back to exactly ${role.name}`); }
    catch (e) { toast(e.message || "Could not reset"); }
    setBusy(false);
  };
  const shown = perms.filter((p) => !hiddenPerm(p.key));
  const choice = (k) => (k in ov ? (ov[k] ? "allow" : "block") : "role");
  return (
    <Modal title={`Permissions: ${u.username}`} onClose={onClose} width="min(780px,95vw)"
      footer={<><span className="dim" style={{ marginRight: "auto" }}>{n ? `${n} personal exception${n === 1 ? "" : "s"} on top of ${role.name}` : `Exactly what ${role.name} gives`}</span>
        <button className="btn" disabled={busy || !n} onClick={reset}>Reset to {role.name}</button><button className="btn pri" onClick={onClose}>Done</button></>}>
      <div style={{ display: "grid", gap: 10, maxHeight: "62vh", overflow: "auto", paddingRight: 4 }}>
        <div className="dim">{u.username} is <b>{role.name}</b>. Leave a function on <b>Role</b> to do what the role says. Choose <b>Allow</b> or <b>Block</b> to make an exception for this person only. It saves as you click.</div>
        {groups.map(([gk, gl]) => (
          <div key={gk}>
            <div className="rl-gh">{gl}</div>
            {shown.filter((p) => p.group === gk).map((p) => {
              const c = choice(p.key), on = eff.has(p.key), roleOn = rolePerms.has(p.key);
              return (
                <div key={p.key} className="rl-row" style={{ alignItems: "center" }}>
                  <span className={"pu-dot" + (on ? " on" : "")} title={on ? "Can do this" : "Cannot do this"} />
                  <div className="grow"><b>{p.label}</b>{c !== "role" && <span className="rl-chg">{c === "allow" ? "allowed for them" : "blocked for them"}</span>}
                    <div className="dim rl-desc">{p.desc}</div></div>
                  <div className="seg" role="group" aria-label={p.label}>
                    {[["role", `Role (${roleOn ? "on" : "off"})`], ["allow", "Allow"], ["block", "Block"]].map(([v, l]) => (
                      <button key={v} type="button" className={c === v ? "on" : ""} disabled={busy} onClick={() => c !== v && set(p.key, v === "role" ? null : v === "allow")}>{l}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Asked before an account moves to a role that has fewer permissions: says exactly what they would lose. */
function LoseModal({ ask, onClose, onYes, busy }) {
  const { u, from, to, lost, gained, legacy } = ask;
  const [keep, setKeep] = useState(true);                // an old-settings account can keep what it has today as personal exceptions
  return (
    <Modal title={`Move ${u.username} to ${to}?`} onClose={onClose} width="min(560px,94vw)"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy} onClick={() => onYes(legacy && keep)}>Yes, move {u.username}</button></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><b>{u.username}</b> is <b>{from}</b> now. As <b>{to}</b> they will have <b>{lost.length} fewer permission{lost.length === 1 ? "" : "s"}</b>.</div>
        <div>
          <div className="neg" style={{ fontWeight: 600, marginBottom: 4 }}>They will lose:</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>{lost.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
        {gained.length > 0 && <div className="dim" style={{ fontSize: 12 }}>They will also gain: {gained.join(", ")}.</div>}
        {legacy && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: "row" }}>
            <input type="checkbox" className="chk" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span><b>Keep what they have today.</b> <span className="dim">They keep the permissions above as personal exceptions, so nothing changes for them except the role name. You can remove an exception later under Permissions.</span></span>
          </label>
        )}
        <div className="dim" style={{ fontSize: 12 }}>It applies the next time their page loads. You can move them back at any time. {Object.keys(parseOv(u)).length > 0 && "Their personal exceptions are cleared when the role changes."}</div>
      </div>
    </Modal>
  );
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const when = (t) => (t ? String(t).slice(0, 16).replace("T", " ") : "never");

export default function AccountsPanel({ me }) {
  const [users, setUsers] = useState(null), [roles, setRoles] = useState([]), [perms, setPerms] = useState([]), [groups, setGroups] = useState([]), [err, setErr] = useState(""), [adopt, setAdopt] = useState(false), [pm, setPm] = useState(null);
  const [nu, setNu] = useState(""), [np, setNp] = useState(""), [nr, setNr] = useState(""), [nt, setNt] = useState(""), [busy, setBusy] = useState(false), [del, setDel] = useState(null);
  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([work.accounts(), work.roles()]);
      setUsers(u); setRoles(r.roles || []); setPerms(r.perms || []); setGroups(r.groups || []); setErr(r.setup_needed ? "Roles are not set up yet (the roles migration has not been run). Accounts keep their old settings." : "");
      setNr((cur) => cur || ((r.roles || []).find((x) => x.key === "viewer") || (r.roles || [])[0] || {}).key || "");
    } catch (e) { setErr(e.message || "Could not load accounts"); setUsers((x) => x || []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const roleOpts = roles.map((r) => ({ value: r.key, label: r.name }));
  const [ask, setAsk] = useState(null), [moving, setMoving] = useState(false);
  const doRole = async (u, key, keepKeys = []) => {
    setMoving(true);
    try {
      await work.setAccountRole({ id: u.id, role_key: key });
      if (keepKeys.length) await work.setAccountPerms({ id: u.id, overrides: Object.fromEntries(keepKeys.map((k) => [k, true])) });   // what they had that the role lacks
      toast(`${u.username} is now ${(roles.find((r) => r.key === key) || {}).name || key}${keepKeys.length ? ` (kept ${keepKeys.length} permission${keepKeys.length === 1 ? "" : "s"} they had)` : ""}`); load();
    } catch (e) { toast(e.message || "Could not save"); }
    setMoving(false); setAsk(null);
  };
  // Ask first when the new role has fewer permissions than the account has today
  const setRole = (u, key) => {
    const target = roles.find((r) => r.key === key); if (!target) return;
    const cur = u.role_key ? roles.find((r) => r.key === u.role_key) : null;
    const now = cur ? withOv(cur.perms, parseOv(u)) : legacySet(u, perms), next = new Set(target.perms);
    const label = (k) => (perms.find((p) => p.key === k) || {}).label || k;
    const lostKeys = [...now].filter((k) => !next.has(k) && !hiddenPerm(k)), lost = lostKeys.map(label), gained = [...next].filter((k) => !now.has(k) && !hiddenPerm(k)).map(label);
    if (!lost.length) return doRole(u, key);
    setAsk({ u, key, from: cur ? cur.name : `${cap(u.role)} (old settings)`, to: target.name, lost, lostKeys, gained, legacy: !cur });
  };
  const setTeam = async (u, team) => {
    try {
      if (u.role_key) await work.setAccountRole({ id: u.id, role_key: u.role_key, team: team || null });
      else await work.setAccountFlags({ id: u.id, role: u.role, can_edit: u.can_edit, can_delete: u.can_delete, on_leaderboard: u.on_leaderboard, manage_users: u.manage_users, team: team || null });
      toast(`${u.username}: ${team ? "Team " + team : "no team"}`); load();
    } catch (e) { toast(e.message || "Could not save"); }
  };
  const add = async () => {
    if (!nu.trim() || !np) return;
    if (np.length < 8) return toast("The password needs at least 8 characters");
    setBusy(true);
    try { await work.createAccount({ username: nu.trim(), password: np, role_key: nr || undefined, role: nr ? undefined : "viewer", team: nt || undefined }); toast(`Added ${nu.trim().toLowerCase()}`); setNu(""); setNp(""); load(); }
    catch (e) { toast(e.message || "Could not add the account"); }
    setBusy(false);
  };
  const remove = async () => {
    try { await work.deleteAccount(del.id); toast(`Deleted ${del.username}`); setDel(null); load(); } catch (e) { toast(e.message || "Could not delete"); setDel(null); }
  };

  if (users === null) return <div className="dim" style={{ padding: 14 }}>Loading…</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {err && <div className="banner warn">{err}</div>}
      <div className="card"><div className="tw">
        <table className="acc-tbl">
          <thead><tr><th>Account</th><th style={{ width: 230 }}>Role</th><th style={{ width: 150 }}>Team</th><th style={{ width: 130 }}>Personal</th><th>Last sign-in</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><span className="who"><Avatar name={u.username} /><b>{u.username}</b>{u.username === me.username && <span className="dim"> · you</span>}</span></td>
                <td>
                  <Select value={u.role_key || ""} options={roleOpts} onChange={(v) => v && v !== u.role_key && setRole(u, v)}
                    placeholder={`${cap(u.role)} (old settings)`} disabled={!roles.length} />
                </td>
                <td><Select value={u.team || ""} options={TEAMS} onChange={(v) => setTeam(u, v)} /></td>
                <td><button className="btn sm" disabled={!u.role_key} onClick={() => setPm(u)} title={u.role_key ? "Give this person extra permissions, or take some away" : "Give this account a role first"}>Permissions{Object.keys(parseOv(u)).length ? ` · ${Object.keys(parseOv(u)).length}` : ""}</button></td>
                <td className="dim">{when(u.last_login)}</td>
                <td className="r">{u.username !== me.username && <button className="btn sm danger" onClick={() => setDel(u)} aria-label={`Delete ${u.username}`}>Delete</button>}</td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan="6" className="dim" style={{ padding: 20, textAlign: "center" }}>No accounts.</td></tr>}
          </tbody>
        </table>
      </div></div>
      {users.some((u) => !u.role_key) && roles.length > 0 && (
        <div className="banner warn" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 240 }}>{users.filter((u) => !u.role_key).length} account{users.filter((u) => !u.role_key).length === 1 ? " is" : "s are"} on <b>old settings</b>. They keep the access they have today, and edits to the Admin, Agent or Viewer role do not reach them until they are moved onto a role.</span>
          <button className="btn sm pri" onClick={() => setAdopt(true)}>Move them onto roles…</button>
        </div>
      )}

      <div className="card"><div className="body">
        <div className="rl-gh">Add an account</div>
        <div className="acc-new">
          <input className="input" placeholder="Username" value={nu} onChange={(e) => setNu(e.target.value)} autoComplete="off" />
          <input className="input" placeholder="Password (8+ characters)" type="password" value={np} onChange={(e) => setNp(e.target.value)} autoComplete="new-password" />
          <Select value={nr} options={roleOpts} onChange={setNr} placeholder="Role" />
          <Select value={nt} options={TEAMS} onChange={setNt} />
          <button className="btn pri" disabled={busy || !nu.trim() || !np} onClick={add}>Add account</button>
        </div>
      </div></div>

      {ask && <LoseModal ask={ask} busy={moving} onClose={() => setAsk(null)} onYes={(keep) => doRole(ask.u, ask.key, keep ? ask.lostKeys : [])} />}
      {pm && roles.find((r) => r.key === pm.role_key) && <PermsModal u={pm} role={roles.find((r) => r.key === pm.role_key)} groups={groups} perms={perms} onClose={() => { setPm(null); load(); }} />}
      {adopt && <AdoptModal users={users} roles={roles} perms={perms} onClose={() => setAdopt(false)} onDone={(failed) => { setAdopt(false); load(); if (failed) return; }} />}
      {del && (
        <Modal title={`Delete ${del.username}?`} onClose={() => setDel(null)} width="min(460px,94vw)"
          footer={<><button className="btn" onClick={() => setDel(null)}>Keep it</button><button className="btn danger" onClick={remove}>Delete account</button></>}>
          <div>This removes the account. Tasks and history they made stay, under their name.</div>
        </Modal>
      )}
    </div>
  );
}
