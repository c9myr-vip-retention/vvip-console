// Task comments as a group chat: message bubbles with @tags, emoji reactions, an emoji picker and a composer that takes Enter to send.
// Used by TaskPanel. The Worker (worker/work/chat.js) does the tagging, the notifications and the reactions.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../ui/index.jsx";
import { PendingFiles, AttachButton, AttachmentView } from "./Attachments.jsx";

// Quick reactions on a message (the same list the Worker accepts).
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "👀", "✅", "🔥", "💯", "👎"];

const EMOJI = {
  Smileys: "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤔 🤨 😐 😑 😶 🙄 😏 😬 😮 😯 😲 😳 🥺 😢 😭 😤 😠 😡 🤯 😱 😨 😰 😓 🤒 😴 😎 🤓".split(" "),
  Hands: "👍 👎 👌 ✌️ 🤞 🤟 🤘 👏 🙌 🙏 🤝 💪 👋 🤚 ✋ 👉 👈 👆 👇 ☝️ ✊ 👊 🫡".split(" "),
  Symbols: "❤️ 🧡 💛 💚 💙 💜 🖤 💔 ✨ ⭐ 🌟 🔥 💯 ✅ ❌ ⚠️ ❗ ❓ 💡 🎉 🎊 🏆 🥇 🎯 🚀 💰 💵 📌 📎 📅 ⏰ 🔔 👀 💬 📞 📧".split(" "),
};

const when = (ts) => {
  if (!ts) return "";
  const d = new Date(String(ts).replace(" ", "T") + "Z");
  return isNaN(d) ? String(ts) : d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur" });
};
const dayOf = (ts) => { const d = new Date(String(ts || "").replace(" ", "T") + "Z"); return isNaN(d) ? "" : new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10); };
const dayLabel = (iso) => {
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), yest = new Date(Date.now() + 8 * 3600e3 - 864e5).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yest) return "Yesterday";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

/** Message text with @tags picked out. A tag of a real person is highlighted; a tag of you is highlighted more. */
function Text({ body, names, me }) {
  const parts = String(body || "").split(/(@[a-z0-9][a-z0-9_.-]*)/gi);
  return (
    <>
      {parts.map((p, i) => {
        const who = p.startsWith("@") ? p.slice(1).toLowerCase().replace(/[._-]+$/, "") : "";
        return who && names.has(who) ? <span key={i} className={"chat-tag" + (who === me ? " me" : "")}>{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

/** The emoji panel: tabs, a grid, one click inserts. */
export function EmojiPanel({ onPick, onClose }) {
  const [tab, setTab] = useState("Smileys");
  return (
    <div className="chat-pop emoji" role="dialog" aria-label="Emoji">
      <div className="chat-pop-tabs">
        {Object.keys(EMOJI).map((k) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k}</button>)}
        <span className="grow" /><button type="button" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="chat-emoji-grid">{EMOJI[tab].map((e) => <button key={e} type="button" onClick={() => onPick(e)}>{e}</button>)}</div>
    </div>
  );
}

/** One message. mine = aligned right. Reactions sit under the bubble; the little + opens the quick reactions. */
function Message({ c, mine, names, me, canReact, onReact, showName }) {
  const [pick, setPick] = useState(false);
  const rx = c.reactions || [];
  return (
    <div className={"chat-msg" + (mine ? " mine" : "")}>
      {!mine && (showName ? <Avatar name={c.author} /> : <span className="chat-av-gap" />)}
      <div className="chat-col">
        {showName && !mine && <div className="chat-name">{c.author}</div>}
        <div className="chat-bub">
          {c.body && <div className="chat-text"><Text body={c.body} names={names} me={me} /></div>}
          {(c.attachments || []).length > 0 && <div className="att-list">{c.attachments.map((a) => <AttachmentView key={a.id} a={a} />)}</div>}
          <span className="chat-time">{when(c.created_at)}</span>
        </div>
        <div className="chat-rx">
          {rx.map((g) => (
            <button key={g.emoji} type="button" className={"chat-chip" + (g.users.includes(me) ? " mine" : "")} disabled={!canReact} onClick={() => onReact(c.id, g.emoji)}
              title={g.users.join(", ")}>{g.emoji} <span>{g.users.length}</span></button>
          ))}
          {canReact && (
            <span className="chat-add">
              <button type="button" className="chat-chip add" aria-label="Add a reaction" onClick={() => setPick((o) => !o)}>☺+</button>
              {pick && (
                <span className="chat-pop quick" role="dialog">
                  {REACTIONS.map((e) => <button key={e} type="button" onClick={() => { setPick(false); onReact(c.id, e); }}>{e}</button>)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** The whole conversation: messages grouped by day, newest at the bottom (the parent scrolls). */
export function Messages({ comments, me, people, canReact, onReact }) {
  const names = useMemo(() => new Set([...(people || []).map((p) => p.username), ...comments.map((c) => c.author)].map((u) => String(u).toLowerCase())), [people, comments]);
  const out = [];
  let lastDay = "", lastAuthor = "";
  comments.forEach((c) => {
    const day = dayOf(c.created_at);
    if (day && day !== lastDay) { out.push(<div key={"d" + day + c.id} className="chat-day"><span>{dayLabel(day)}</span></div>); lastDay = day; lastAuthor = ""; }
    out.push(<Message key={c.id} c={c} mine={c.author === me} names={names} me={me} canReact={canReact} onReact={onReact} showName={c.author !== lastAuthor} />);
    lastAuthor = c.author;
  });
  return <>{out}</>;
}

/** The box at the bottom: grows with the text, Enter sends (Shift+Enter is a new line), @ opens the people list, 😀 the emoji panel, 📎 attaches. */
export function Composer({ draft, setDraft, onSend, people, me, pending, disabled }) {
  const ta = useRef(null);
  const [emoji, setEmoji] = useState(false);
  const [mention, setMention] = useState(null);      // { start, q } while a @name is being typed
  const [hi, setHi] = useState(0);

  const candidates = useMemo(() => {
    if (!mention) return [];
    const q = mention.q.toLowerCase();
    return (people || []).map((p) => p.username).filter((u) => u !== me && u.toLowerCase().includes(q)).sort((a, b) => (a.toLowerCase().startsWith(q) ? 0 : 1) - (b.toLowerCase().startsWith(q) ? 0 : 1) || a.localeCompare(b)).slice(0, 6);
  }, [mention, people, me]);
  useEffect(() => { setHi(0); }, [mention && mention.q]);

  // grow with the text (up to about five lines)
  useEffect(() => { const el = ta.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }, [draft]);

  const detect = (value, caret) => {
    const m = /(?:^|\s)@([a-z0-9_.-]*)$/i.exec(value.slice(0, caret));
    setMention(m ? { start: caret - m[1].length - 1, q: m[1] } : null);
  };
  const insert = (text, replaceFrom) => {
    const el = ta.current, caret = el ? el.selectionStart : draft.length, from = replaceFrom != null ? replaceFrom : caret;
    const next = draft.slice(0, from) + text + draft.slice(caret);
    setDraft(next); setMention(null);
    requestAnimationFrame(() => { if (el) { el.focus(); const pos = from + text.length; el.setSelectionRange(pos, pos); } });
  };
  const pickName = (u) => insert("@" + u + " ", mention.start);
  const onKey = (e) => {
    if (mention && candidates.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % candidates.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + candidates.length) % candidates.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickName(candidates[hi]); return; }
    }
    if (e.key === "Escape") { if (mention) setMention(null); else setEmoji(false); return; }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); }
  };
  const can = (draft.trim() || pending.files.length) && !disabled;

  return (
    <div className="chat-comp" onDragOver={(e) => e.dataTransfer && e.dataTransfer.types && [...e.dataTransfer.types].includes("Files") && e.preventDefault()}
      onDrop={(e) => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); pending.add(e.dataTransfer.files); } }}>
      <PendingFiles files={pending.files} onRemove={pending.remove} />
      {mention && candidates.length > 0 && (
        <div className="chat-pop mention" role="listbox" aria-label="Tag someone">
          {candidates.map((u, i) => (
            <button key={u} type="button" role="option" aria-selected={i === hi} className={i === hi ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); pickName(u); }}>
              <Avatar name={u} /> <span>{u}</span>
            </button>
          ))}
        </div>
      )}
      {emoji && <EmojiPanel onPick={(e) => insert(e)} onClose={() => setEmoji(false)} />}
      <div className="chat-row">
        <AttachButton onPick={pending.add} />
        <button type="button" className="btn" title="Emoji" aria-label="Emoji" onClick={() => setEmoji((o) => !o)}>😀</button>
        <button type="button" className="btn" title="Tag someone" aria-label="Tag someone" onClick={() => { const el = ta.current; const c = el ? el.selectionStart : draft.length; const pre = c > 0 && !/\s$/.test(draft.slice(0, c)) ? " @" : "@"; insert(pre); setMention({ start: c + pre.length - 1, q: "" }); }}>@</button>
        <textarea ref={ta} className="input chat-input" rows={1} placeholder="Message… (@ to tag, Enter to send, Shift+Enter for a new line)" value={draft}
          onChange={(e) => { setDraft(e.target.value); detect(e.target.value, e.target.selectionStart); }}
          onClick={(e) => detect(draft, e.target.selectionStart)} onKeyDown={onKey}
          onPaste={(e) => { const fl = e.clipboardData && e.clipboardData.files; if (fl && fl.length) { e.preventDefault(); pending.add(fl); } }} />
        <button type="button" className="btn pri" onClick={onSend} disabled={!can}>Send</button>
      </div>
    </div>
  );
}
