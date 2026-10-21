// Shared widgets for the Contact + Players pages: searchable menus, brand cards, player row, table pieces.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BRAND_COLORS } from "../tokens.js";
import { Select, BrandBadge } from "../ui";
import "./daily.css";
// Used only inside render functions (circular import with App.jsx).
import { BRANDS, CLASSES, CLASS_ORDER, ST_COLOR, ckey, dispName, looksNumeric, tap, keyMetric, fmt, fmtRM, mytClock } from "../../App.jsx";
import { buildInstruction } from "../../messageLibrary";
import { nActive, isActioned } from "./logic.js";

export const bcolor = (b) => BRAND_COLORS[b] || BRANDS[b]?.p || "#8B94A7";

/** Button + floating panel, closes on outside click / Escape. children(q) gets the panel's search text. */
export function Menu({ label, count, wide, placeholder, children, footer }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null), panel = useRef(null);
  const [flip, setFlip] = useState(false);   // open leftwards when the panel would run off the right edge
  useLayoutEffect(() => {
    if (!open || !panel.current) return setFlip(false);
    const r = panel.current.getBoundingClientRect();
    setFlip(r.right > window.innerWidth - 8 && r.width < ref.current.getBoundingClientRect().right);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="dl-dd" ref={ref}>
      <button className={"btn sm" + (count ? " on" : "")} onClick={() => { setOpen((o) => !o); setQ(""); }}>{label}{count ? ` · ${count}` : ""} ▾</button>
      {open && (
        <div ref={panel} className={"dl-ddp" + (wide ? " wide" : "")} style={flip ? { left: "auto", right: 0 } : undefined}>
          <input className="dl-ddq" autoFocus placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
          {children(q.trim().toLowerCase())}
          {footer && <div style={{ padding: "10px 6px 2px" }}>{footer}</div>}
        </div>
      )}
    </div>
  );
}

export function Row({ on, label, extra, dot, onClick }) {
  return (
    <div className={"dl-ddr" + (on ? " on" : "")} {...tap(onClick, null)}>
      <span className="dl-cbx" />{dot && <i className="dl-dot" style={{ background: dot }} />}
      <span className="g">{label}</span>{extra}
    </div>
  );
}

export function BrandMenu({ brandOrder, value, onChange, countOf }) {
  const toggle = (b) => onChange(value.includes(b) ? value.filter((x) => x !== b) : [...value, b]);
  return (
    <Menu label="Brand" count={value.length} placeholder="Search brands…"
      footer={<button className="btn sm" onClick={() => onChange([])}>All brands</button>}>
      {(q) => {
        const rows = brandOrder.filter((b) => !q || b.toLowerCase().includes(q));
        return rows.length ? rows.map((b) => (
          <Row key={b} on={value.includes(b)} label={b} dot={bcolor(b)} onClick={() => toggle(b)} extra={<span className="dim mono">{countOf(b)}</span>} />
        )) : <div className="dl-empty">No brand</div>;
      }}
    </Menu>
  );
}

const TOG_LABELS = {
  gnot: "Grace: not activated", gact: "Grace: activated", gwatch: "Grace watch (by days left)",
  tgonly: "✈ On Telegram", notg: "✈ No Telegram link", zero: "0 deposit this month", open: "Open to contact (no 48h cooldown)",
  my: "Only my assigned players",
};

/** The single Filters menu: Player type | Tier + Grace | Telegram + Activity. */
export function FilterMenu({ f, setF, setTog, clearAll, classCount, showMine }) {
  const toggleClass = (k) => setF((s) => ({ ...s, classes: s.classes.includes(k) ? s.classes.filter((x) => x !== k) : [...s.classes, k] }));
  // Telegram: on / none are opposites; Grace: not / activated are opposites (same as the live toggles).
  const flip = (k, other) => setF((s) => ({ ...s, tg: { ...s.tg, [k]: !s.tg[k], ...(other && !s.tg[k] ? { [other]: false } : {}) } }));
  return (
    <Menu label="Filters" count={nActive(f)} wide placeholder="Search filters…"
      footer={<button className="btn sm" onClick={clearAll}>Clear all filters</button>}>
      {(q) => {
        const hit = (l) => !q || l.toLowerCase().includes(q);
        const tog = (k, other) => hit(TOG_LABELS[k]) && <Row key={k} on={f.tg[k]} label={TOG_LABELS[k]} onClick={() => (other !== undefined ? flip(k, other) : setTog(k))} />;
        const cls = CLASS_ORDER.filter((k) => hit(CLASSES[k].label)).map((k) => (
          <Row key={k} on={f.classes.includes(k)} label={CLASSES[k].label} dot={CLASSES[k].color} onClick={() => toggleClass(k)}
            extra={<span className="dim mono">{classCount(k)}</span>} />));
        const tiers = ["3", "V"].filter((v) => hit("Tier " + v)).map((v) => (
          <Row key={v} on={f.tier === v} label={"Tier " + v} onClick={() => setF((s) => ({ ...s, tier: s.tier === v ? "all" : v }))} />));
        const grace = [tog("gnot", "gact"), tog("gact", "gnot"), tog("gwatch")].filter(Boolean);
        const tgs = [tog("tgonly", "notg"), tog("notg", "tgonly")].filter(Boolean);
        const act = [tog("zero"), tog("open"), showMine && tog("my")].filter(Boolean);
        const sect = (h, rows) => (rows.length ? <><div className="dl-ddh">{h}</div>{rows}</> : null);
        return (
          <>
            <div className="dl-cols">
              <div>{sect("Player type", cls)}</div>
              <div>{sect("Tier", tiers)}{sect("Grace", grace)}</div>
              <div>{sect("Telegram", tgs)}{sect("Activity", act)}</div>
            </div>
            {!cls.length && !tiers.length && !grace.length && !tgs.length && !act.length && <div className="dl-empty">No matching filter</div>}
          </>
        );
      }}
    </Menu>
  );
}

export function AgentSelect({ value, onChange, team, show }) {
  if (!show) return null;
  const opts = [{ value: "all", label: "All agents" }, ...team.map((t) => ({ value: t.username, label: t.username })), { value: "none", label: "Unassigned" }];
  return <Select value={value} options={opts} onChange={onChange} style={{ width: 150 }} />;
}

export const SearchBox = ({ value, onChange }) => (
  <input className="search" placeholder="Search player, UID or name" value={value} onChange={(e) => onChange(e.target.value)} />
);

export function ClassPill({ k }) {
  const c = CLASSES[k];
  return c ? <span className="dl-pill" style={{ "--c": c.color }}>{c.label}</span> : null;
}
export function StatusTag({ con }) {
  if (con?.status && con.status !== "ASSIGNED")
    return <span className="dl-pill" style={{ "--c": ST_COLOR[con.status] }}>{con.status.replace("_", " ")}{con.assigned_to ? ` · ${con.assigned_to}` : ""}</span>;
  if (con?.assigned_to) return <span className="dl-pill" style={{ "--c": ST_COLOR.ASSIGNED }}>Assigned · {con.assigned_to}</span>;
  return <span className="dim">—</span>;
}
export function GraceTag({ g }) {
  return g ? <span className={"dl-tag" + (g.on ? " on" : "")} title={g.title}>{g.on ? "activated" : "not activated"}</span> : null;
}

/** Player name + flags (whale, Telegram, churn-risk, fragile): the live Queue's name cell. */
export function PlayerName({ r }) {
  return (
    <b>{dispName(r)}
      {r._whale && <span className="dl-flag crown" title="Top-value Tier V: personal handling only"> ♛</span>}
      {r._tg && <span className="dl-flag tg" title="On Telegram"> ✈</span>}
      {(r._cool2 || r._cooling) && <span className="dl-flag cool" title="Churn-risk from a deposit-rhythm break: act now"> ❄ {r._cool2 ? `RISK ${r._cool2.risk}` : "COOLING"}</span>}
      {r._fragile && <span className="dl-flag frag" title="Reactivated in the last 14 days: soften everything"> FRAGILE</span>}
    </b>
  );
}

/** Contact worklist row: brand-coloured left stripe, Message + Contacted. Clicking the row opens the player panel. */
export function PlayerRow({ r, con, cool, graceTag, readOnly, busy, onOpen, onMark }) {
  const done = isActioned(con);
  return (
    <div className={"dl-prow" + (done ? " done" : "")} style={{ "--b": bcolor(r.brand) }} {...tap(onOpen)}>
      <div>
        <PlayerName r={r} />
        <div className="sub"><BrandBadge brand={r.brand} color={bcolor(r.brand)} /><span>Tier {r.tier_segment}{!looksNumeric(r.addressing) ? ` · ${r.addressing}` : ""}</span></div>
      </div>
      <div className="why"><ClassPill k={r._cls} /><span>{buildInstruction(r)}</span><GraceTag g={graceTag} /></div>
      <div className="st">{cool && !done && <span className="dl-cd">48h cooldown</span>}<StatusTag con={con} /></div>
      <div className={"met" + (r._cls === "TOP_LOSS" ? " neg" : r._cls === "TOP_DEP" ? " pos" : "")}>{keyMetric(r)}</div>
      <div className="act" onClick={(e) => e.stopPropagation()}>
        <button className="btn sm" title="Open the player panel with the message" onClick={onOpen}>Message</button>
        {!done && <button className="btn sm pri" disabled={readOnly || busy} onClick={onMark}>✓ Contacted</button>}
      </div>
    </div>
  );
}

/** Row of brand cards: brand name in brand colour, brand-colour top edge, counts. Click toggles the brand filter. */
export function BrandCards({ brandOrder, rows, selected, onToggle, staleBrands, lagBrands }) {
  return (
    <div className="dl-bstrip">
      {brandOrder.map((b) => {
        const m = rows.filter((r) => r.brand === b), on = selected.includes(b);
        const n = (pred) => m.filter(pred).length;
        const dep = m.reduce((s, r) => s + (r.daily_deposit || 0), 0);
        const stale = staleBrands.some((s) => s.brand === b), lag = lagBrands.some((s) => s.brand === b);
        const dot = (k) => CLASSES[k]?.color;
        return (
          <button key={b} className={"dl-bcp" + (on ? " on" : "")} style={{ "--b": bcolor(b) }} aria-pressed={on}
            title={on ? "Click to remove this brand filter" : "Show only " + b} onClick={() => onToggle(b)}>
            <div className="n">{b}{stale && <span className="dl-warnchip">stale</span>}{!stale && lag && <span className="dl-warnchip">lag</span>}</div>
            <div className="big">{fmt(m.length)}<small>players</small></div>
            <div className="dep">{fmtRM(dep)}</div>
            <div className="mix">
              <span><i style={{ background: dot("TOP_LOSS") }} /><b>{n((r) => r._cls === "TOP_LOSS")}</b> loss</span>
              <span><i style={{ background: dot("BLOCKED") }} /><b>{n((r) => r._cls === "BLOCKED")}</b> blocked</span>
              <span><i style={{ background: dot("DSLD14") }} /><b>{n((r) => r._cls === "DSLD30" || r._cls === "DSLD14" || r._cls === "DSLD7")}</b> cold</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function Banners({ base }) {
  const { readOnly, snap, staleBrands, lagBrands } = base;
  return (
    <>
      {readOnly && <div className="banner warn">Viewing {snap}: read-only. Switch to Today to take action.</div>}
      {!readOnly && staleBrands.length > 0 && (
        <div className="dl-note">Stale data, not fed today: {staleBrands.map((s) => `${s.brand} (last ${s.last_fed})`).join(" · ")}. Run that sheet's feeder before working its queue.</div>)}
      {!readOnly && lagBrands.length > 0 && (
        <div className="dl-note">Data lagging, deposits behind other brands: {lagBrands.map((s) => `${s.brand} (through ${s.newest_dep})`).join(" · ")}. Others are current through {lagBrands[0].lead}.</div>)}
    </>
  );
}

export function PageHead({ title, sub }) {
  return <div className="top"><div><h1>{title}</h1><div className="dim">{sub}</div></div></div>;
}

export { ckey, fmt, fmtRM, mytClock };
