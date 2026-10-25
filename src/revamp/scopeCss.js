// Scope the live console's stylesheet to `.rv-live` so its generic class names (.top .tabs .seg .kpi .search .chip ...)
// cannot leak onto revamp elements. Only used when the revamp shell is on; flag off never calls this.
// Handles what the live <Style> contains: plain rules, @import, @media, @keyframes, @font-face, comments, quoted strings.
const KEEP = /^(:root|html|body|\*|:focus-visible|\[role=button\])/;   // global resets stay global

function splitTop(s, ch) {   // split on `ch` outside (), [], and quotes
  const out = []; let d = 0, q = "", cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q && s[i - 1] !== "\\") q = ""; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "(" || c === "[") d++; else if (c === ")" || c === "]") d--;
    if (c === ch && d === 0) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}

function walk(css, scope) {
  let out = "", i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;
    if (css.startsWith("@import", i)) {   // the font URL holds `;` inside quotes: find the real end
      let j = i, q = "";
      for (; j < css.length; j++) { const c = css[j]; if (q) { if (c === q) q = ""; } else if (c === '"' || c === "'") q = c; else if (c === ";") break; }
      out += css.slice(i, j + 1) + "\n"; i = j + 1; continue;
    }
    // read the prelude up to `{`, skipping quoted strings
    let j = i, q = "";
    for (; j < css.length; j++) {
      const c = css[j];
      if (q) { if (c === q && css[j - 1] !== "\\") q = ""; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === "{") break;
    }
    const prelude = css.slice(i, j).trim();
    let d = 1, k = j + 1; q = "";
    for (; k < css.length && d; k++) {
      const c = css[k];
      if (q) { if (c === q && css[k - 1] !== "\\") q = ""; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === "{") d++; else if (c === "}") d--;
    }
    const body = css.slice(j + 1, k - 1);
    if (/^@(media|supports)/.test(prelude)) out += `${prelude}{${walk(body, scope)}}\n`;
    else if (prelude.startsWith("@")) out += `${prelude}{${body}}\n`;   // @keyframes / @font-face: untouched
    else out += splitTop(prelude, ",").map((s) => (KEEP.test(s.trim()) ? s.trim() : `${scope} ${s.trim()}`)).join(",") + `{${body}}\n`;
    i = k;
  }
  return out;
}

export function scopeLiveCss(css, scope = ".rv-live") {
  return walk(css.replace(/\/\*[\s\S]*?\*\//g, ""), scope);
}
