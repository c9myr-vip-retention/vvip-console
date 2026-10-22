// Settings (admin): Accounts / Roles / Activity log / Recycle bin. Accounts and Roles are pages/AccountsPanel.jsx and pages/RolesPanel.jsx;
// the live Settings still supplies "Change my password" and the Telegram import, and ActivityLog is the live one. Owned by agent "shell-ui".
import React, { useState } from "react";
import { Settings as LiveSettings, ActivityLog } from "../../App.jsx";
import RecycleBin from "./RecycleBin.jsx";
import AccountsPanel from "./AccountsPanel.jsx";
import RolesPanel from "./RolesPanel.jsx";
import TaskDataPanel from "./TaskDataPanel.jsx";
import PagesPanel from "./PagesPanel.jsx";
import { can } from "../perms.js";

const TABS = [["acc", "Accounts", "users.manage"], ["roles", "Roles & permissions", "users.manage"], ["pages", "Page access", "users.manage"], ["log", "Activity log", "activity.view"], ["bin", "Recycle bin", "bin.manage"], ["tdata", "Task data", "tasks.clear"]];

export default function SettingsPage({ ctx }) {
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem("rv_set_tab") || "acc"; } catch (e) { return "acc"; } });
  const tabs = TABS.filter(([, , perm]) => can(ctx.me, perm));
  const cur = tabs.some(([k]) => k === tab) ? tab : (tabs[0] || [])[0];
  const pick = (k) => { setTab(k); try { sessionStorage.setItem("rv_set_tab", k); } catch (e) { /* private mode */ } };
  return (
    <>
      <div className="top"><h1>Settings</h1></div>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} className={cur === k ? "on" : ""} onClick={() => pick(k)}>{l}</button>)}
      </div>
      {!cur && <div className="card"><div className="body dim">Nothing here is available to your role.</div></div>}
      {cur === "acc" && <><AccountsPanel me={ctx.me} /><div className="rv-live" style={{ marginTop: 14 }}><LiveSettings me={ctx.me} viewTeam={ctx.viewTeam} hideLog hideAccounts /></div></>}
      {cur === "roles" && <RolesPanel />}
      {cur === "pages" && <PagesPanel />}
      {cur === "log" && <div className="rv-live"><ActivityLog viewTeam={ctx.viewTeam} /></div>}
      {cur === "bin" && <RecycleBin ctx={ctx} />}
      {cur === "tdata" && <TaskDataPanel />}
    </>
  );
}
