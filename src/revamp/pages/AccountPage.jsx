// Account (agent): change my password, my details. Owned by agent "shell-ui".
import React, { useState } from "react";
import { api } from "../../App.jsx";
import { toast } from "../ui/index.jsx";

const PERMS = [["can_edit", "Edit queue"], ["can_delete", "Delete contact"], ["on_leaderboard", "Scored agent"], ["manage_users", "Manage users"]];

export default function AccountPage({ ctx }) {
  const { me } = ctx;
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [nw2, setNw2] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const mismatch = nw2 !== "" && nw !== nw2;
  async function submit(e) {
    e.preventDefault();
    if (!cur || !nw || nw !== nw2) return;
    setBusy(true); setErr("");
    try {
      await api("/api/change-password", { method: "POST", body: JSON.stringify({ current_password: cur, new_password: nw }) });
      setCur(""); setNw(""); setNw2(""); toast("Password updated");
    } catch (x) { setErr(x.message || "Could not update the password"); }
    setBusy(false);
  }
  return (
    <>
      <div className="top"><h1>Account</h1></div>
      <div className="acct-grid">
        <form className="card" onSubmit={submit}>
          <h3>Change my password</h3>
          <div className="body" style={{ display: "grid", gap: 10 }}>
            <input className="input" type="password" autoComplete="current-password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
            <input className="input" type="password" autoComplete="new-password" placeholder="New password" value={nw} onChange={(e) => setNw(e.target.value)} />
            <input className="input" type="password" autoComplete="new-password" placeholder="Repeat new password" value={nw2} onChange={(e) => setNw2(e.target.value)} />
            {mismatch && <span className="neg">The two new passwords do not match.</span>}
            {err && <span className="neg">{err}</span>}
            <button className="btn pri" type="submit" disabled={busy || !cur || !nw || nw !== nw2}>{busy ? "Updating…" : "Update"}</button>
          </div>
        </form>
        <div className="card">
          <h3>My details</h3>
          <div className="body">
            <p><b>{me.username}</b> · <span className="role-tag">{me.role || "agent"}</span> · Team {me.team || "—"}</p>
            <p className="dim" style={{ marginTop: 8 }}>{PERMS.map(([k, l]) => `${l} ${me[k] ? "✓" : "✗"}`).join(" · ")}</p>
            <p className="dim" style={{ marginTop: 8 }}>Team accounts, Telegram import and Activity logs are admin-only.</p>
          </div>
        </div>
      </div>
    </>
  );
}
