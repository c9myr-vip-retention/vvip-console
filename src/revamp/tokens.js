// Shared constants for the revamp UI. Colours are the LIVE console's, unchanged (see :root in src/App.jsx <Style>).
// Brand colours are identity: brandColor() reads BRANDS from src/App.jsx (the single source). Call it inside render only (circular import).
import { BRANDS } from "../App.jsx";
export const brandColor = (b) => BRANDS[b]?.p || "#8B94A7";
export const BRAND_ORDER = ["LPK777", "ACE33", "BM69", "HOT321", "RM68", "SK69", "JK32", "ZAS36"];

// Daily class chips (key -> [label, colour]); classifyAll() in src/App.jsx stays the source of truth for the rules.
export const CLASS_COLORS = {
  GRACE: ["GRACE", "#E8C547"], TOP_LOSS: ["TOP LOSS", "#EF4444"], TOP_DEP: ["TOP DEPOSIT", "#4CC38A"],
  BLOCKED: ["DEP-BLOCKED", "#A78BFA"], DSLD30: ["DSLD 30+", "#3B5BDB"], DSLD14: ["DSLD 14+", "#4C8DF6"],
  DSLD7: ["DSLD 7+", "#93C5FD"], WATCH: ["WATCH", "#8B94A7"], HEALTHY: ["HEALTHY", "#94A3B8"],
};

// Sidebar structure per role. `key` matches pages in ./registry.js. Shell reads this; do not fork it elsewhere.
export const NAV = {
  admin: [
    ["Overview", [["dash", "Dashboard"], ["delta", "Changes"], ["perf", "Performance"]]],
    ["Daily work", [["queue", "Contact"], ["checkin", "Check-in"], ["grace", "Grace claims"], ["players", "Players"], ["assign", "Assignments"]]],
    ["Work", [["tasks", "Tasks"], ["sched", "Schedule"], ["proj", "Projects"], ["flows", "Flows"], ["tpl", "Templates"], ["team", "Team workload"]]],
    ["Task insight", [["ana", "Analytics"], ["bin", "Recycle bin"]]],
    ["Admin", [["set", "Settings"]]],
  ],
  agent: [
    ["My work", [["home", "My day"], ["tasks", "My tasks"], ["sched", "Schedule"], ["proj", "Projects"]]],
    ["Daily work", [["queue", "Contact"], ["checkin", "Check-in"], ["grace", "Grace claims"], ["players", "Players"], ["delta", "Changes"]]],
    ["Me", [["mine", "My performance"], ["acct", "Account"]]],
  ],
};

// Sidebar glyphs (from the mockup). Kept apart from NAV so NAV's shape stays [section, [[key, label], ...]].
export const NAV_ICONS = {
  dash: "◧", delta: "⇅", perf: "▤", queue: "✉", checkin: "☑", grace: "✦", players: "☷", assign: "⇄",
  tasks: "✔", sched: "▥", proj: "▣", flows: "⇉", tpl: "❐", team: "◎", ana: "▦", bin: "🗑", set: "⚙",
  home: "⌂", mine: "▤", acct: "⚙",
};
