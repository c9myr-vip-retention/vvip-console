// Settings (admin): Accounts / Activity log / Recycle bin. Reuses the live Settings (accounts, password, Telegram import)
// and ActivityLog; the Recycle bin tab is pages/RecycleBin.jsx. Owned by agent "shell-ui".
import React, { useState } from "react";
import { Settings as LiveSettings, ActivityLog } from "../../App.jsx";
import RecycleBin from "./RecycleBin.jsx";

const TABS = [["acc", "Accounts"], ["log", "Activity log"], ["bin", "Recycle bin"]];

export default function SettingsPage({ ctx }) {
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem("rv_set_tab") || "acc"; } catch (e) { return "acc"; } });
  const pick = (k) => { setTab(k); try { sessionStorage.setItem("rv_set_tab", k); } catch (e) { /* private mode */ } };
  return (
    <>
      <div className="top"><h1>Settings</h1><span className="badge admin">Admin only</span></div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => pick(k)}>{l}</button>)}
      </div>
      {tab === "acc" && <div className="rv-live"><LiveSettings me={ctx.me} viewTeam={ctx.viewTeam} hideLog /></div>}
      {tab === "log" && <div className="rv-live"><ActivityLog viewTeam={ctx.viewTeam} /></div>}
      {tab === "bin" && <RecycleBin ctx={ctx} />}
    </>
  );
}
