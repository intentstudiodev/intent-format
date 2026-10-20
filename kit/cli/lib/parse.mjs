// Low-level parsing: front matter, card skeleton (title, status line, sections), relation lines.
import { splitTop, unquote, quote } from './util.mjs';

/* ---------------- front matter ---------------- */

export function parseFrontMatter(lines, R) {
  if (lines[0] !== '---') return null;
  const entries = [], errors = [];
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { end = i; break; }
    const m = R.fmLine.exec(lines[i]);
    if (!m) { errors.push({ idx: i, msg: `not a "key: value" line: ${lines[i]}` }); continue; }
    const raw = m.groups.value ?? '';
    const e = { key: m.groups.key, raw, idx: i, kind: 'plain', value: raw, items: null };
    if (raw.trim() === '') { e.kind = 'empty'; e.value = ''; }
    else if (raw === '—') e.kind = 'blind';
    else if (raw.startsWith('"')) {
      const q = R.quoted.exec(raw);
      if (!q) errors.push({ idx: i, msg: `unbalanced quotes in ${e.key}:` });
      else { e.kind = 'quoted'; e.value = unquote(q.groups.inner); }
    } else if (raw.startsWith('[')) {
      const l = R.list.exec(raw);
      if (!l) errors.push({ idx: i, msg: `unbalanced list in ${e.key}:` });
      else {
        e.kind = 'list';
        e.items = l.groups.items.trim() === '' ? [] : l.groups.items.split(',').map((x) => {
          const t = x.trim();
          return t.startsWith('"') && t.endsWith('"') && t.length > 1 ? unquote(t.slice(1, -1)) : t;
        });
        e.value = e.items.join(', ');
      }
    }
    entries.push(e);
  }
  if (end < 0) errors.push({ idx: 0, msg: 'front matter is not closed by ---' });
  const map = new Map();
  for (const e of entries) if (!map.has(e.key)) map.set(e.key, e);
  return { entries, end, errors, map };
}

/** Render one front-matter value following D3.4/D3.7. enumKey: value comes from a closed list. */
export function fmValue(S, key, value, enumKey = false) {
  if (Array.isArray(value)) return '[' + value.join(', ') + ']';
  const v = String(value);
  if (v === '—') return v;
  if (S.alwaysQuoted.has(key)) return quote(v);
  if (S.R.needsQuotes.test(v) || (!enumKey && S.R.readsAsNonString.test(v))) return quote(v);
  return v;
}

/* ---------------- skeleton ---------------- */

const FENCE = /^(```|~~~)/;

/** Marks lines inside fenced code blocks (never parsed as structure). */
export function fenceMask(lines, from = 0) {
  const mask = new Array(lines.length).fill(false);
  let open = null;
  for (let i = from; i < lines.length; i++) {
    const m = FENCE.exec(lines[i]);
    if (open) { mask[i] = true; if (m && lines[i].startsWith(open)) open = null; }
    else if (m) { open = m[1]; mask[i] = true; }
  }
  return mask;
}

/**
 * Card skeleton after the front matter: title, status line, preamble, ## sections.
 * Indices are 0-based line indices; ranges are [start, end).
 */
export function parseSkeleton(lines, bodyStart, R, mask) {
  const sk = { titleIdx: -1, statusIdx: -1, preStart: bodyStart, preEnd: lines.length, sections: [] };
  let i = bodyStart;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^# /.test(lines[i])) {
    sk.titleIdx = i;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length && /^> ⚙/.test(lines[j])) sk.statusIdx = j;
    sk.preStart = (sk.statusIdx >= 0 ? sk.statusIdx : i) + 1;
  }
  for (let k = sk.preStart; k < lines.length; k++) {
    if (mask[k]) continue;
    const m = R.section.exec(lines[k]);
    if (!m || !/^## /.test(lines[k])) continue;
    const gear = !!m.groups.gear;
    sk.sections.push({ heading: m.groups.heading, gear, idx: k, start: k + 1, end: lines.length });
  }
  for (let s = 0; s < sk.sections.length; s++) {
    if (s + 1 < sk.sections.length) sk.sections[s].end = sk.sections[s + 1].idx;
  }
  if (sk.sections.length) sk.preEnd = sk.sections[0].idx;
  return sk;
}

/** Split a range at ### headings: { intro: [start,end), subs: [{idx, text, start, end}] }. */
export function splitSub(lines, start, end, mask) {
  const subs = [];
  let introEnd = end;
  for (let i = start; i < end; i++) {
    if (mask[i] || !/^### \S/.test(lines[i])) continue;
    if (!subs.length) introEnd = i;
    if (subs.length) subs[subs.length - 1].end = i;
    subs.push({ idx: i, text: lines[i].slice(4).trim(), start: i + 1, end });
  }
  return { intro: [start, introEnd], subs };
}

/** Non-blank, non-fenced line indices of a range. */
export function contentIdx(lines, start, end, mask) {
  const out = [];
  for (let i = start; i < end; i++) if (!mask[i] && lines[i].trim() !== '') out.push(i);
  return out;
}

/** Body state of a range: 'blind' | 'none' | 'forgive' | 'empty' | null (content). */
export function bodyState(lines, idxs, R) {
  if (!idxs.length) return 'empty';
  if (idxs.length > 1) return null;
  const t = lines[idxs[0]].trim();
  if (R.blind.test(t)) return 'blind';
  if (R.none.test(t)) return 'none';
  if (R.forgiveness.test(t)) return 'forgive';
  return null;
}

/* ---------------- atoms and relation lines ---------------- */

export function parseAtom(text, R, linkMode = false) {
  const t = text;
  if (linkMode) {
    const l = R.link.exec(t);
    return l ? { kind: 'link', title: l.groups.title, target: l.groups.target } : null;
  }
  let m;
  if ((m = R.bound.exec(t))) return { kind: 'bound', core: m.groups.core, name: m.groups.name ?? null, path: m.groups.path, anchor: m.groups.anchor ?? null };
  if ((m = R.hand.exec(t))) return { kind: 'hand', core: m.groups.core };
  if ((m = R.placeholder.exec(t))) return { kind: 'placeholder', name: m.groups.name };
  if (t === '—') return { kind: 'unknown' };
  return null;
}

function parseQualifiers(segs, base, R) {
  const quals = [];
  for (const seg of segs) {
    const raw = seg.text;
    const m = R.qualifier.exec(raw);
    if (!m) { quals.push({ key: null, raw, start: base + seg.start, bad: true }); continue; }
    let value = m.groups.value ?? null, quoted = false;
    if (value && value.startsWith('"') && value.endsWith('"') && value.length > 1) { value = unquote(value.slice(1, -1)); quoted = true; }
    quals.push({ key: m.groups.key, value, quoted, raw, start: base + seg.start });
  }
  return quals;
}

function atomAt(text, base, R, linkMode, glyphOk) {
  let t = text, off = base;
  const lead = t.length - t.trimStart().length;
  t = t.trim(); off += lead;
  let glyph = null;
  if (glyphOk) {
    const g = R.stepGlyph.exec(t);
    if (g) { glyph = g.groups.glyph; off += g[0].length; t = t.slice(g[0].length); }
  }
  const atom = parseAtom(t, R, linkMode);
  if (atom) Object.assign(atom, { text: t, start: off, end: off + t.length, glyph });
  return atom;
}

/**
 * Parse one line in a relation context.
 * cx: { relations, defaultRel, glyphOk }
 * Returns { kind: 'nonlist' | 'generated' | 'unknown-word' | 'prose' | 'ext' | 'rel', ... }.
 */
export function parseRelLine(line, cx, R) {
  const m = R.listLine.exec(line);
  if (!m) return { kind: 'nonlist' };
  const indent = m.groups.indent.length;
  const ordered = m.groups.num != null;
  let rest = m.groups.rest;
  let off = line.length - rest.length;
  if (R.generatedLine.exec(line.slice(indent))) return { kind: 'generated', indent, ordered };
  let rel = null, explicit = false;
  const pm = R.relationPrefix.exec(rest);
  if (pm) {
    const w = pm.groups.rel;
    if (w.startsWith('x-')) return { kind: 'ext', indent, ordered };
    if (cx.relations[w]) {
      rel = w; explicit = true;
      off += w.length + 2; rest = pm.groups.body;
    } else if (!cx.defaultRel || !parseAtom(rest.trim(), R, cx.defaultRel === 'Link')) {
      return { kind: 'unknown-word', word: w, indent, ordered };
    }
  }
  if (!rel) {
    if (!cx.defaultRel) return { kind: 'prose', indent, ordered };
    rel = cx.defaultRel;
  }
  const def = cx.relations[rel];
  const r = { kind: 'rel', rel, explicit, indent, ordered, num: ordered ? +m.groups.num : null, atoms: [], quals: [], note: null, ok: true };
  if (def.textSlot) {
    r.text = rest; r.textStart = off;
    return r;
  }
  const noteSplit = splitTop(rest, ' — ', 1);
  if (noteSplit.length > 1) r.note = noteSplit[1].text;
  let main = noteSplit[0].text, mainOff = off;
  if (def.twoSlot || def.labelSlot) {
    const lr = splitTop(main, ' → ', 1);
    if (lr.length < 2) { r.ok = false; r.why = 'missing " → "'; return r; }
    if (def.twoSlot) {
      const a = atomAt(lr[0].text, mainOff + lr[0].start, R, false, false);
      if (!a) { r.ok = false; r.why = `"${lr[0].text.trim()}" is not a reference`; return r; }
      r.atoms.push(a);
    } else {
      let label = lr[0].text.trim();
      if (label.startsWith('"') && label.endsWith('"') && label.length > 1) label = unquote(label.slice(1, -1));
      r.label = label;
    }
    main = lr[1].text; mainOff += lr[1].start;
  }
  const segs = splitTop(main, ' · ');
  const a = atomAt(segs[0].text, mainOff + segs[0].start, R, rel === 'Link', !!cx.glyphOk);
  if (!a) { r.ok = false; r.why = `"${segs[0].text.trim()}" is not a ${rel === 'Link' ? '[title](target) link' : 'reference'}`; }
  else r.atoms.push(a);
  r.quals = parseQualifiers(segs.slice(1), mainOff, R);
  return r;
}

/** Passport line → [{key, value, raw}] or null when the line is not a passport line. */
export function parsePassport(line, R) {
  if (!R.passportLine.test(line)) return null;
  const pairs = [];
  for (const seg of splitTop(line, ' · ')) {
    const m = R.passportPair.exec(seg.text);
    if (!m) return null;
    let v = m.groups.value;
    if (v.startsWith('"') && v.endsWith('"') && v.length > 1) v = unquote(v.slice(1, -1));
    pairs.push({ key: m.groups.key, value: v });
  }
  return pairs;
}

/** Markdown table rows of a range → { header: [..], rows: [{idx, cells}] , bad: [idx] }. */
export function parseTable(lines, idxs, R) {
  const out = { header: null, rows: [], bad: [] };
  let sawSep = false;
  for (const i of idxs) {
    const t = lines[i].trim();
    const m = R.tableRow.exec(t);
    if (!m) { out.bad.push(i); continue; }
    if (R.tableSep.test(t)) { sawSep = true; continue; }
    const cells = m.groups.cells.split('|').map((c) => c.trim());
    if (!out.header) out.header = cells;
    else out.rows.push({ idx: i, cells });
  }
  if (out.header && !sawSep) out.bad.push(idxs[0]);
  return out;
}
