// Pictures and files on task comments: pick / paste / drop them, check them, shrink big pictures, and show them in a comment.
// The Worker keeps each file in the database (see schema_v30), so a file is limited to about 1.2 MB. A pasted screenshot is shrunk to fit.
import React, { useEffect, useRef, useState } from "react";
import { toast } from "../ui/index.jsx";
import { tapi } from "./common.jsx";

export const MAX_FILE = 1_200_000;
export const MAX_FILES = 5;
const IMAGES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const ALLOWED = [...IMAGES, "application/pdf", "text/plain", "text/csv", "application/zip",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
export const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const EXT_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", txt: "text/plain", csv: "text/csv", zip: "application/zip",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };

export const fmtSize = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const mimeOf = (f) => (f.type && ALLOWED.includes(f.type) ? f.type : EXT_MIME[String(f.name || "").split(".").pop().toLowerCase()] || f.type || "");
const readB64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => no(new Error("Could not read the file")); r.readAsDataURL(blob); });

/** Draw a big picture smaller until it fits (webp, then jpeg). Returns a Blob, or the original if it already fits. */
async function shrink(file, mime) {
  if (file.size <= 600_000) return file;                                   // small enough as it is
  if (mime === "image/gif") return file;                                   // would lose the animation: keep or refuse
  const bmp = await createImageBitmap(file);
  for (const [maxSide, q] of [[1600, 0.85], [1280, 0.8], [1024, 0.75], [800, 0.7]]) {
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    for (const type of ["image/webp", "image/jpeg"]) {
      const out = await new Promise((r) => cv.toBlob(r, type, q));
      if (out && out.type === type && out.size <= MAX_FILE) return out;
    }
  }
  return file;
}

/** A File from a picker, a paste or a drop -> { name, mime, size, data (base64), preview? }. Throws an Error with a plain message. */
export async function prepareFile(file) {
  let mime = mimeOf(file);
  if (!ALLOWED.includes(mime)) throw new Error(`${file.name || "That file"}: this kind of file is not allowed. Use a picture, PDF, text, CSV, Word, Excel, PowerPoint or zip.`);
  let blob = file, name = file.name || (IMAGES.includes(mime) ? `picture.${mime.split("/")[1]}` : "file");
  if (IMAGES.includes(mime)) {
    blob = await shrink(file, mime);
    if (blob !== file) { mime = blob.type; name = name.replace(/\.[^.]+$/, "") + (mime === "image/webp" ? ".webp" : ".jpg"); }
  }
  if (blob.size > MAX_FILE) throw new Error(`${name} is too big (${fmtSize(blob.size)}). The limit is ${fmtSize(MAX_FILE)} per file.`);
  const data = await readB64(blob);
  return { name, mime, size: blob.size, data, preview: IMAGES.includes(mime) ? `data:${mime};base64,${data}` : "" };
}

/** Keep the pending files of a comment. add() takes Files and tells the person what it refused. */
export function usePending() {
  const [files, setFiles] = useState([]);
  const ref = useRef([]); ref.current = files;
  const add = async (list) => {
    const incoming = [...list];
    for (const f of incoming) {
      if (ref.current.length >= MAX_FILES) { toast(`At most ${MAX_FILES} files per comment`); break; }
      try { const p = await prepareFile(f); ref.current = [...ref.current, p]; setFiles(ref.current); }
      catch (e) { toast(e.message || "Could not add that file"); }
    }
  };
  return { files, add, remove: (i) => setFiles((l) => l.filter((_, j) => j !== i)), clear: () => { ref.current = []; setFiles([]); } };
}

/** The little attach button (paperclip) next to the comment box. */
export function AttachButton({ onPick, disabled }) {
  const input = useRef(null);
  return (
    <>
      <input ref={input} type="file" multiple accept={ACCEPT} style={{ display: "none" }} onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
      <button type="button" className="btn" title="Attach a picture or file (you can also paste a picture)" aria-label="Attach a file" disabled={disabled} onClick={() => input.current && input.current.click()}>📎</button>
    </>
  );
}

/** Files waiting to be sent: thumbnails for pictures, a chip for the rest, each with a remove button. */
export function PendingFiles({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div className="att-pend">
      {files.map((f, i) => (
        <span key={i} className="att-chip" title={`${f.name} · ${fmtSize(f.size)}`}>
          {f.preview ? <img src={f.preview} alt="" /> : <span className="att-ic">📄</span>}
          <span className="att-nm">{f.name}</span><span className="dim">{fmtSize(f.size)}</span>
          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)}>✕</button>
        </span>
      ))}
    </div>
  );
}

/** One attachment inside a comment. Pictures show as a thumbnail that opens full size; other files download. The file is fetched with the
 *  person's sign-in, so it never needs a public link. */
export function AttachmentView({ a }) {
  const [url, setUrl] = useState(""), [err, setErr] = useState("");
  useEffect(() => {
    if (!a.inline) return undefined;
    let dead = false, made = "";
    tapi.attachment(a.id).then((b) => { if (dead) return; made = URL.createObjectURL(b); setUrl(made); }, (e) => !dead && setErr(e.message || "Could not load the picture"));
    return () => { dead = true; if (made) URL.revokeObjectURL(made); };
  }, [a.id, a.inline]);
  const download = async () => {
    try {
      const b = await tapi.attachment(a.id), u = URL.createObjectURL(b), link = document.createElement("a");
      link.href = u; link.download = a.name; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    } catch (e) { toast(e.message || "Could not download the file"); }
  };
  if (a.inline) {
    return err ? <span className="neg" style={{ fontSize: 12 }}>{a.name}: {err}</span>
      : url ? <button type="button" className="att-img" title={`${a.name} · ${fmtSize(a.size)}. Click to open`} onClick={() => window.open(url, "_blank", "noopener")}><img src={url} alt={a.name} /></button>
      : <span className="dim att-load">Loading {a.name}…</span>;
  }
  return <button type="button" className="att-file" onClick={download} title="Download"><span className="att-ic">📄</span><span className="att-nm">{a.name}</span><span className="dim">{fmtSize(a.size)}</span></button>;
}
