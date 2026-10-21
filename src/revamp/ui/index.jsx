// Minimal UI kit. These are WORKING but plain versions so every page can import them today.
// The `shell-ui` agent upgrades them IN PLACE (searchable dropdowns, floating date picker, ...)
// WITHOUT changing the props below. Everyone else: import from here, never re-implement.
import React, { useEffect } from "react";

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

/** Dropdown (single). options: [{ value, label, dot? }]. searchable by default once upgraded. */
export function Select({ value, options, onChange, placeholder, style }) {
  return (
    <select className="input" value={value ?? ""} style={style} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Multi-select with checkboxes. value: string[]; options: [{ value, label, dot? }] */
export function MultiSelect({ value, options, onChange, label }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <details className="msel">
      <summary className="btn sm">{label}{value.length ? ` · ${value.length}` : ""} ▾</summary>
      <div className="mselbox">
        {options.map((o) => (
          <label key={o.value} className="ck"><input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}</label>
        ))}
      </div>
    </details>
  );
}

/** Date picker. value / onChange use 'YYYY-MM-DD' (Malaysia date) or "" for none. */
export function DatePick({ value, onChange, placeholder }) {
  return <input className="input" type="date" value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** Modal. Closes on scrim click and Escape. width: css width string. */
export function Modal({ title, onClose, children, footer, width = "min(720px,94vw)" }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="rv-scrim" onClick={onClose}>
      <div className="rv-modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        {title && <div className="mh">{title}</div>}
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

/** Right-hand drawer (the big task panel uses width ~ min(1240px,97vw)). */
export function DrawerPanel({ onClose, children, width = "min(1240px,97vw)" }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="rv-scrim" onClick={onClose}>
      <aside className="rv-drawer" style={{ width }} onClick={(e) => e.stopPropagation()}>{children}</aside>
    </div>
  );
}

/** One-line toast: toast("Saved"). Rendered by the shell. */
export function toast(msg) { window.dispatchEvent(new CustomEvent("rv-toast", { detail: msg })); }

/** Avatar bubble with initials. */
export function Avatar({ name }) {
  const s = (name || "?").slice(0, 2).toUpperCase();
  return <span className="av">{s}</span>;
}

/** Small coloured brand tag. color comes from BRAND_COLORS in ../tokens.js. */
export function BrandBadge({ brand, color }) {
  return <span className="brandbadge" style={{ "--b": color }}>{brand}</span>;
}
