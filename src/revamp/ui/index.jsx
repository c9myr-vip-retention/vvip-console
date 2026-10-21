// Revamp UI kit. Props of every export are fixed (pages depend on them); optional props may be added.
// Select / MultiSelect / DatePick are custom floating menus (searchable, keyboard friendly, kept inside the viewport).
// Menus, modals and drawers render into #rv-portal (a `.rv` host on <body>) so no ancestor can clip or transform them.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ---------------------------------------------------------------- portal host */
export function portalRoot() {
  let el = document.getElementById("rv-portal");
  if (!el) { el = document.createElement("div"); el.id = "rv-portal"; el.className = "rv"; document.body.appendChild(el); }
  return el;
}
const Portal = ({ children }) => createPortal(children, portalRoot());

/* ---------------------------------------------------------------- Seg */
/** Segmented switch. options: [{ value, label, count? }] */
export function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <span className="dim"> {o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- floating menu helpers */
/** Position a fixed menu under (or above) its anchor and keep it inside the viewport. */
function useFloat(open, anchorRef, menuRef, deps = []) {
  const [pos, setPos] = useState(null);
  const place = () => {
    const a = anchorRef.current, m = menuRef.current;
    if (!a || !m) return;
    const r = a.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, gap = 6, pad = 8;
    const mw = Math.max(m.offsetWidth, Math.min(r.width, vw - pad * 2)), mh = m.offsetHeight;
    const below = vh - r.bottom - gap - pad, above = r.top - gap - pad;
    const up = below < Math.min(mh, 240) && above > below;                 // flip when there is more room above
    const room = Math.max(120, up ? above : below);
    let left = r.left; if (left + mw > vw - pad) left = vw - pad - mw; if (left < pad) left = pad;
    const h = Math.min(mh, room);
    setPos({ left, top: up ? r.top - gap - h : r.bottom + gap, maxHeight: Math.min(room, 340), minWidth: Math.min(r.width, vw - pad * 2) });
  };
  useLayoutEffect(() => { if (open) place(); /* eslint-disable-next-line */ }, [open, ...deps]);
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const h = (e) => { if (e && e.type === "scroll" && menuRef.current && menuRef.current.contains(e.target)) return; place(); };
    window.addEventListener("resize", h); window.addEventListener("scroll", h, true);
    return () => { window.removeEventListener("resize", h); window.removeEventListener("scroll", h, true); };
    // eslint-disable-next-line
  }, [open]);
  return pos;
}

/** Close on outside mousedown / Escape. */
function useDismiss(open, refs, onClose) {
  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (!refs.some((r) => r.current && r.current.contains(e.target))) onClose(false); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(true); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
    // eslint-disable-next-line
  }, [open]);
}

const Dot = ({ c }) => (c ? <i className="bd" style={{ background: c }} /> : null);
const norm = (s) => String(s ?? "").toLowerCase();

/** Shared list body: search box + keyboard-navigable rows. */
function MenuList({ options, query, setQuery, hl, setHl, onPick, isOn, multi, footer, searchRef }) {
  const listRef = useRef(null);
  useEffect(() => { // keep the highlighted row in view
    const el = listRef.current?.querySelector(".hl"); if (el) el.scrollIntoView({ block: "nearest" });
  }, [hl, options]);
  return (
    <>
      <input ref={searchRef} className="csq" placeholder="Search…" value={query} onChange={(e) => { setQuery(e.target.value); setHl(0); }} />
      <div className="cslist" ref={listRef} role="listbox" aria-multiselectable={multi || undefined}>
        {options.length === 0 && <div className="csempty">No match</div>}
        {options.map((o, i) => (
          <div key={String(o.value)} role="option" aria-selected={isOn(o)} className={"csi" + (i === hl ? " hl" : "") + (isOn(o) ? (multi ? " on" : " sel") : "")}
            onMouseEnter={() => setHl(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(o)}>
            {multi && <span className="cbx" />}
            <Dot c={o.dot} />
            <span className="csl">{o.label}</span>
            {!multi && isOn(o) && <span className="csk">✓</span>}
          </div>
        ))}
      </div>
      {footer}
    </>
  );
}

/** Keyboard handler shared by the search box: arrows move, Enter picks, Tab closes. */
function navKeys(e, { options, hl, setHl, pick, close }) {
  if (e.key === "ArrowDown") { e.preventDefault(); setHl(Math.min(options.length - 1, hl + 1)); }
  else if (e.key === "ArrowUp") { e.preventDefault(); setHl(Math.max(0, hl - 1)); }
  else if (e.key === "Home") { e.preventDefault(); setHl(0); }
  else if (e.key === "End") { e.preventDefault(); setHl(options.length - 1); }
  else if (e.key === "Enter") { e.preventDefault(); if (options[hl]) pick(options[hl]); }
  else if (e.key === "Tab") close();
}

function useMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hl, setHl] = useState(0);
  const btn = useRef(null), menu = useRef(null), search = useRef(null);
  const close = (refocus = true) => { setOpen(false); setQuery(""); if (refocus) btn.current?.focus(); };
  useDismiss(open, [btn, menu], (esc) => close(esc));
  useEffect(() => { if (open) setTimeout(() => search.current?.focus(), 0); }, [open]);
  return { open, setOpen, query, setQuery, hl, setHl, btn, menu, search, close };
}

/* ---------------------------------------------------------------- Select */
/** Dropdown (single). options: [{ value, label, dot? }]. Searchable. `placeholder` adds a leading "" (clear) row. */
export function Select({ value, options, onChange, placeholder, style, disabled, className }) {
  const m = useMenu();
  const all = useMemo(() => (placeholder !== undefined ? [{ value: "", label: placeholder }, ...options] : options), [options, placeholder]);
  const shown = useMemo(() => { const q = norm(m.query); return q ? all.filter((o) => norm(o.label).includes(q)) : all; }, [all, m.query]);
  const cur = all.find((o) => String(o.value) === String(value ?? ""));
  const pos = useFloat(m.open, m.btn, m.menu, [shown.length]);
  const openMenu = () => { if (disabled) return; const i = shown.findIndex((o) => String(o.value) === String(value ?? "")); m.setHl(Math.max(0, i)); m.setOpen(true); };
  const pick = (o) => { onChange(o.value); m.close(); };
  return (
    <>
      <button type="button" ref={m.btn} disabled={disabled} className={"csb" + (m.open ? " open" : "") + (className ? " " + className : "")} style={style}
        aria-haspopup="listbox" aria-expanded={m.open} onClick={() => (m.open ? m.close(false) : openMenu())}
        onKeyDown={(e) => { if (!m.open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openMenu(); } }}>
        <span className={"csl" + (cur && cur.value !== "" ? "" : " ph")}><Dot c={cur?.dot} />{cur && (cur.value !== "" || placeholder === undefined) ? cur.label : (placeholder ?? "Select…")}</span>
        <span className="csa">▾</span>
      </button>
      {m.open && (
        <Portal>
          <div ref={m.menu} className="cmenu" style={pos ? { ...pos, visibility: "visible" } : { left: 0, top: 0, visibility: "hidden" }}
            onKeyDown={(e) => navKeys(e, { options: shown, hl: m.hl, setHl: m.setHl, pick, close: () => m.close(false) })}>
            <MenuList options={shown} query={m.query} setQuery={m.setQuery} hl={m.hl} setHl={m.setHl} onPick={pick}
              isOn={(o) => String(o.value) === String(value ?? "")} searchRef={m.search} />
          </div>
        </Portal>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- MultiSelect */
/** Multi-select with checkboxes. value: string[]; options: [{ value, label, dot? }] */
export function MultiSelect({ value, options, onChange, label, style, disabled }) {
  const m = useMenu();
  const shown = useMemo(() => { const q = norm(m.query); return q ? options.filter((o) => norm(o.label).includes(q)) : options; }, [options, m.query]);
  const pos = useFloat(m.open, m.btn, m.menu, [shown.length, value.length]);
  const toggle = (o) => onChange(value.includes(o.value) ? value.filter((x) => x !== o.value) : [...value, o.value]);
  const footer = (
    <div className="csf">
      <button type="button" className="btn sm" disabled={!value.length} onClick={() => onChange([])}>Clear</button>
      <button type="button" className="btn sm" onClick={() => onChange(options.map((o) => o.value))} disabled={value.length === options.length}>All</button>
      <span className="dim" style={{ marginLeft: "auto" }}>{value.length} selected</span>
      <button type="button" className="btn sm pri" onClick={() => m.close()}>Done</button>
    </div>
  );
  return (
    <>
      <button type="button" ref={m.btn} disabled={disabled} className={"btn sm" + (value.length ? " on" : "") + (m.open ? " open" : "")} style={style}
        aria-haspopup="listbox" aria-expanded={m.open} onClick={() => (m.open ? m.close(false) : (m.setHl(0), m.setOpen(true)))}
        onKeyDown={(e) => { if (!m.open && e.key === "ArrowDown") { e.preventDefault(); m.setHl(0); m.setOpen(true); } }}>
        {label}{value.length ? ` · ${value.length}` : ""} <span className="csa">▾</span>
      </button>
      {m.open && (
        <Portal>
          <div ref={m.menu} className="cmenu" style={pos ? { ...pos, visibility: "visible", minWidth: Math.max(pos.minWidth, 260) } : { left: 0, top: 0, visibility: "hidden" }}
            onKeyDown={(e) => navKeys(e, { options: shown, hl: m.hl, setHl: m.setHl, pick: toggle, close: () => m.close(false) })}>
            <MenuList options={shown} query={m.query} setQuery={m.setQuery} hl={m.hl} setHl={m.setHl} onPick={toggle} multi
              isOn={(o) => value.includes(o.value)} footer={footer} searchRef={m.search} />
          </div>
        </Portal>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- DatePick */
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON3 = MON.map((x) => x.slice(0, 3));
const pad2 = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;               // m is 0-based
const todayMY = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);   // Malaysia date (GMT+8)
const parseIso = (s) => { const [y, m, d] = String(s).split("-").map(Number); return { y, m: m - 1, d }; };
const addDays = (s, n) => { const { y, m, d } = parseIso(s); const t = new Date(Date.UTC(y, m, d + n)); return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };
export const fmtPick = (s) => { if (!s) return ""; const { y, m, d } = parseIso(s); return `${d} ${MON3[m]} ${y}`; };

/** Date picker. value / onChange use 'YYYY-MM-DD' (Malaysia date) or "" for none.
 *  Optional: `min` / `max` (ISO) bound the choice; `avail` (Set or array of ISO) marks days that have data and, with `onlyAvail`, disables the rest. */
export function DatePick({ value, onChange, placeholder = "Pick a date", min, max, avail, onlyAvail, clearable = true, style, disabled }) {
  const m = useMenu();
  const today = todayMY();
  const start = value || today;
  const [view, setView] = useState(() => { const p = parseIso(start); return { y: p.y, m: p.m }; });
  const [foc, setFoc] = useState(start);
  const pos = useFloat(m.open, m.btn, m.menu, [view.y, view.m]);
  const av = useMemo(() => (avail ? new Set(avail) : null), [avail]);
  const ok = (s) => !((min && s < min) || (max && s > max) || (onlyAvail && av && !av.has(s)));
  const openMenu = () => { if (disabled) return; const p = parseIso(value || today); setView({ y: p.y, m: p.m }); setFoc(value || today); m.setOpen(true); };
  const pick = (s) => { if (!ok(s)) return; onChange(s); m.close(); };
  const go = (dm) => setView((v) => { const t = new Date(Date.UTC(v.y, v.m + dm, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; });
  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();         // 0 = Sunday
  const lead = (first + 6) % 7;                                              // Monday-first grid
  const dim = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < 42; i++) { cells.push(addDays(iso(view.y, view.m, 1), i - lead)); }
  const keys = (e) => {
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (mv) {
      e.preventDefault(); const n = addDays(foc, mv); setFoc(n);
      const p = parseIso(n); if (p.y !== view.y || p.m !== view.m) setView({ y: p.y, m: p.m });
    } else if (e.key === "PageUp") { e.preventDefault(); go(-1); }
    else if (e.key === "PageDown") { e.preventDefault(); go(1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(foc); }
    else if (e.key === "Tab") m.close(false);
  };
  useEffect(() => { if (m.open) setTimeout(() => m.menu.current?.focus(), 0); }, [m.open]);
  return (
    <>
      <button type="button" ref={m.btn} disabled={disabled} className={"csb" + (m.open ? " open" : "")} style={style} aria-haspopup="dialog" aria-expanded={m.open}
        onClick={() => (m.open ? m.close(false) : openMenu())}>
        <span className={"csl" + (value ? "" : " ph")}>{value ? fmtPick(value) : placeholder}</span><span className="csa">▦</span>
      </button>
      {m.open && (
        <Portal>
          <div ref={m.menu} tabIndex={-1} className="cmenu calpop" style={pos ? { ...pos, visibility: "visible", maxHeight: "none", minWidth: 300 } : { left: 0, top: 0, visibility: "hidden" }} onKeyDown={keys}>
            <div className="cal-h">
              <button type="button" onClick={() => go(-1)} aria-label="Previous month">‹</button>
              <b>{MON[view.m]} {view.y}</b>
              <button type="button" onClick={() => go(1)} aria-label="Next month">›</button>
            </div>
            <div className="cal-w">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}</div>
            <div className="cal-g">
              {cells.map((s) => {
                const p = parseIso(s), inMonth = p.m === view.m;
                return (
                  <button type="button" key={s} disabled={!ok(s)} onClick={() => pick(s)} onMouseEnter={() => setFoc(s)}
                    className={"cdy" + (s === today ? " td" : "") + (s === value ? " on" : "") + (inMonth ? "" : " mute") + (!ok(s) ? " dis" : "") + (s === foc ? " foc" : "") + (av && av.has(s) ? " hasdot" : "")}>
                    {p.d}
                  </button>
                );
              })}
            </div>
            <div className="cal-f">
              <button type="button" className="btn sm" disabled={!ok(today)} onClick={() => pick(today)}>Today</button>
              {clearable && value && <button type="button" className="btn sm" onClick={() => { onChange(""); m.close(); }}>Clear</button>}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- Modal / DrawerPanel */
const escStack = [];   // only the top-most dialog reacts to Escape
function useEscape(onClose) {
  const ref = useRef(onClose); ref.current = onClose;
  useEffect(() => {
    const id = {}; escStack.push(id);
    const h = (e) => { if (e.key === "Escape" && escStack[escStack.length - 1] === id) { e.stopPropagation(); ref.current(); } };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); const i = escStack.indexOf(id); if (i >= 0) escStack.splice(i, 1); };
  }, []);
}
function useFocusOnMount() {
  const ref = useRef(null);
  useEffect(() => { const prev = document.activeElement; ref.current?.focus(); return () => { try { prev && prev.focus && prev.focus(); } catch (e) { /* element gone */ } }; }, []);
  return ref;
}

/** Modal. Closes on scrim click and Escape. width: css width string. */
export function Modal({ title, onClose, children, footer, width = "min(720px,94vw)" }) {
  useEscape(onClose);
  const ref = useFocusOnMount();
  return (
    <Portal>
      <div className="rv-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="rv-modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} style={{ width }}>
          {title && <div className="mh">{title}</div>}
          <div className="mb">{children}</div>
          {footer && <div className="mf">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

/** Right-hand drawer (the big task panel uses width ~ min(1240px,97vw)). */
export function DrawerPanel({ onClose, children, width = "min(1240px,97vw)" }) {
  useEscape(onClose);
  const ref = useFocusOnMount();
  return (
    <Portal>
      <div className="rv-scrim right" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <aside className="rv-drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" style={{ width }}>{children}</aside>
      </div>
    </Portal>
  );
}

/* ---------------------------------------------------------------- toasts */
/** One-line toast: toast("Saved"). Rendered by <ToastHost/> in the shell. */
export function toast(msg) { window.dispatchEvent(new CustomEvent("rv-toast", { detail: msg })); }

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let n = 0;
    const h = (e) => {
      const id = ++n;
      setItems((l) => [...l.slice(-2), { id, msg: String(e.detail ?? "") }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 2600);
    };
    window.addEventListener("rv-toast", h);
    return () => window.removeEventListener("rv-toast", h);
  }, []);
  if (!items.length) return null;
  return <Portal><div className="rv-toasts" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className="rv-toast">{t.msg}</div>)}</div></Portal>;
}

/* ---------------------------------------------------------------- Avatar / BrandBadge */
/** Avatar bubble with initials. */
export function Avatar({ name }) {
  const s = (name || "?").slice(0, 2).toUpperCase();
  return <span className="avatar" title={name || ""}>{s}</span>;
}

/** Small coloured brand tag. color comes from BRAND_COLORS in ../tokens.js. */
export function BrandBadge({ brand, color }) {
  return <span className="bb" style={{ "--b": color }}>{brand}</span>;
}
