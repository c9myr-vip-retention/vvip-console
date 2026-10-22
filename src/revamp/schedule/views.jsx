// Schedule board views: week board, lanes (one row per type) and month grid. Pure presentation: all state lives in Schedule.jsx.
import React, { useState } from "react";
import { Avatar } from "../ui";
import { Brands, Who, typeOf } from "./forms.jsx";
import { DAYS, byTime, dayNum, fmtD, monthGrid, timeStr } from "./logic.js";

const ONE = { shift: "Shift", reload: "Reload", meeting: "Meeting", maint: "Maintenance", report: "Report", training: "Training" };
export const oneName = (T) => ONE[T.key] || T.name;

/** One schedule card (week + lanes). Admin can drag a one-off card to another day. */
export function Card({ occ, types, me, admin, onOpen }) {
  const { item, date } = occ, T = typeOf(types, item.type_key), mine = item.who.includes(me);
  const drag = admin && item.repeat === "none";
  const dnd = drag ? { draggable: true, onDragStart: (e) => { e.dataTransfer.setData("text/plain", String(item.id)); e.dataTransfer.effectAllowed = "move"; } } : {};
  const open = () => onOpen(occ);
  const keys = { role: "button", tabIndex: 0, onClick: open, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } };
  if (item.off) {
    return (
      <div className={"sc off" + (mine ? " mine" : "")} {...dnd} {...keys}>
        <div className="who">{item.who[0] && <Avatar name={item.who[0]} />}<span className="dim">{item.who[0] || "Unassigned"} · Day off</span></div>
      </div>
    );
  }
  return (
    <div className={"sc" + (mine ? " mine" : "")} {...dnd} {...keys}>
      <div className="sch-sc-top"><span className="pill np" style={{ "--c": T.color }}>{oneName(T)}</span><span className="grow" />{item.repeat !== "none" && item.type_key !== "shift" && <span className="dim" title="Repeats">↻</span>}</div>
      <b>{item.title}</b>
      <div className="mono dim">{timeStr(item)}</div>
      {item.brands.length > 0 && <Brands list={item.brands} />}
      {item.who.length > 0 && (
        <div className="who"><Who names={item.who} />{item.type_key === "shift" && <span>{item.who[0]}</span>}</div>
      )}
      {item.note && <div className="dim sch-note">{item.note}</div>}
    </div>
  );
}

function useDrop(admin, onMove) {
  const [over, setOver] = useState(null);
  return {
    over,
    props: (date) => (admin ? {
      onDragOver: (e) => { e.preventDefault(); if (over !== date) setOver(date); },
      onDragLeave: () => setOver((o) => (o === date ? null : o)),
      onDrop: (e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) onMove(id, date); },
    } : {}),
  };
}

export function WeekBoard({ days, today, occs, types, me, admin, hideShifts, onOpen, onAdd, onMove }) {
  const dnd = useDrop(admin, onMove);
  return (
    <div className="board sched">
      {days.map((d, i) => {
        const list = occs.filter((o) => o.date === d).sort(byTime), shifts = list.filter((o) => o.item.type_key === "shift" && !o.item.off);
        const warn = hideShifts ? "" : !shifts.length ? "No cover" : !shifts.some((o) => o.item.title === "Night") ? "No night cover" : "";
        return (
          <div key={d} className={"col" + (d === today ? " today" : "") + (dnd.over === d ? " drop" : "")} style={{ "--c": d === today ? "var(--accent)" : "#6B7385" }} {...dnd.props(d)}>
            <div className="ch">{DAYS[i]} <span>{fmtD(d)}</span></div>
            <div className="sch-sub">{warn ? <span className="warn">{warn}</span> : <span className="dim">{list.filter((o) => !o.item.off).length} scheduled</span>}</div>
            <div className="cb">
              {list.map((o) => <Card key={o.key} occ={o} types={types} me={me} admin={admin} onOpen={onOpen} />)}
              {admin && <button type="button" className="addq" onClick={() => onAdd(d)}>+ Add</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Lanes({ days, today, occs, types, me, admin, onOpen, onAdd, onMove }) {
  const dnd = useDrop(admin, onMove);
  return (
    <div className="lanes">
      <div className="lh" />
      {days.map((d, i) => <div key={d} className="lh">{DAYS[i]} {fmtD(d)}{d === today ? " · today" : ""}</div>)}
      {types.map((t) => (
        <React.Fragment key={t.key}>
          <div className="lt"><i className="bd" style={{ background: t.color }} />{t.name}</div>
          {days.map((d) => (
            <div key={d} className={"lc" + (dnd.over === d ? " drop" : "")} {...dnd.props(d)}>
              {occs.filter((o) => o.date === d && o.item.type_key === t.key).sort(byTime).map((o) => <Card key={o.key} occ={o} types={types} me={me} admin={admin} onOpen={onOpen} />)}
              {admin && <button type="button" className="addq" onClick={() => onAdd(d, t.key)}>+</button>}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

export function Month({ month, today, occs, types, me, onOpen, onDay }) {
  const grid = monthGrid(month);
  return (
    <div className="sch-month">
      {DAYS.map((d) => <div key={d} className="sch-mh">{d}</div>)}
      {grid.map((d) => {
        const list = occs.filter((o) => o.date === d).sort(byTime), shown = list.slice(0, 3);
        return (
          <div key={d} className={"sch-mc" + (d === today ? " today" : "") + (d.slice(0, 7) !== month.slice(0, 7) ? " out" : "")}>
            <button type="button" className="sch-mn" onClick={() => onDay(d)} title="Open this week">{dayNum(d)}</button>
            {shown.map((o) => {
              const T = typeOf(types, o.item.type_key), mine = o.item.who.includes(me);
              return (
                <button key={o.key} type="button" className={"sch-ml" + (mine ? " mine" : "") + (o.item.off ? " off" : "")} onClick={() => onOpen(o)}>
                  <i className="bd" style={{ background: T.color }} />
                  <span className="sch-ml-t">{o.item.off ? `${o.item.who[0] || ""} off` : o.item.title}</span>
                  {o.item.type_key === "shift" && !o.item.off && o.item.who[0] && <span className="dim sch-ml-w">{o.item.who[0]}</span>}
                </button>
              );
            })}
            {list.length > shown.length && <button type="button" className="sch-more" onClick={() => onDay(d)}>+{list.length - shown.length} more</button>}
          </div>
        );
      })}
    </div>
  );
}
