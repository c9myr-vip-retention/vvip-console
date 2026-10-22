// Shared bits for the daily-b pages (Check-in, Grace claims, Assignments, Changes, Performance).
// Imports from App.jsx are used only inside render functions / hooks (circular import).
import React from "react";
import { BrandBadge } from "../ui";
import { bcolor } from "../daily/widgets.jsx";
import "./daily2.css";

/** Page header: title + one-line purpose on the left, actions on the right. */
export function Head({ title, sub, children }) {
  return (
    <div className="top">
      <div><h1>{title}</h1>{sub && <div className="dim">{sub}</div>}</div>
      <span className="grow" />
      {children}
    </div>
  );
}

/** Live App.jsx components must sit inside .rv-live or they render unstyled. */
export const Live = ({ children }) => <div className="rv-live d2-live">{children}</div>;

export function Empty({ children }) {
  return <div className="card"><div className="body dim" style={{ textAlign: "center", padding: 30 }}>{children}</div></div>;
}

/** Player cell: id on top, brand badge + tier under it. */
export function PCell({ id, name, brand, tier, extra }) {
  return (
    <div>
      <b>{id}</b>{extra}
      <div className="d2-sub"><BrandBadge brand={brand} color={bcolor(brand)} />{tier && <span className="dim">Tier {tier}</span>}{name && <span className="dim">· {name}</span>}</div>
    </div>
  );
}

export function downloadCsv(name, cols, lines) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + cols.join(",") + "\n" + lines.map((l) => l.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
