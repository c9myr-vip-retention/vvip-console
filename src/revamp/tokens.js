// Shared constants for the revamp UI. Colours are the LIVE console's, unchanged (see :root in src/App.jsx <Style>).
// Brand colours are identity: keep them everywhere a brand appears.
export const BRAND_COLORS = {
  LPK777: "#2563EB", ACE33: "#E11D48", BM69: "#16A34A", HOT321: "#F97316",
  RM68: "#A855F7", SK69: "#0EA5E9", JK32: "#EAB308", ZAS36: "#14B8A6",
};
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
