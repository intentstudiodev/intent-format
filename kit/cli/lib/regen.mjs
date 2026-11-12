// intent-format regen: rewrite machine-owned tokens and generated zones. Idempotent; no dates.
import fs from 'node:fs';
import path from 'node:path';
import { writeIfChanged, exists, toPosix } from './util.mjs';
import { targetType } from './project.mjs';
import { ref, makeContext, generatedFor, changeOf, statusLine, renderFolderIndex, renderRootIndex, renderIds, renderChanges } from './generate.mjs';

/** New text of one card: title, status line, refreshed authored zone, generated sections last. */
export function rewriteCard(S, ws, card, gen, status) {
  const { lines, sk, mask } = card;
  const res = (core) => ws.byCore.get(core);
  const skip = new Set([sk.titleIdx, sk.statusIdx].filter((i) => i >= 0));
  const untouched = new Set();
  for (const sec of sk.sections) {
    const range = [];
    for (let i = sec.idx; i < sec.end; i++) range.push(i);
    if (sec.gear && S.generated[sec.full]) range.forEach((i) => skip.add(i));
    else if (sec.ext) range.forEach((i) => untouched.add(i));
  }
  const ups = new Map();
  for (const r of card.rels) {
    const def = S.relations[r.rel];
    for (const a of r.atoms) {
      if (a.kind !== 'hand') continue;
      const t = res(a.core);
      if (!t || (def.targetTypes.length && !def.targetTypes.includes(targetType(t)))) continue;
      if (!ups.has(r.idx)) ups.set(r.idx, []);
      ups.get(r.idx).push({ start: a.start, end: a.end, text: ref(card.file, t) });
    }
  }
  const renumber = new Map();
  for (const g of card.groups) g.forEach((idx, k) => renumber.set(idx, k + 1));
  const forgive = new Set(card.forgive);
  const confirmed = new Set(card.confirmedIdx || []);
  const anchorAfter = new Map(), anchorFix = new Map();
  for (const sd of card.subs) {
    const want = `<a id="${sd.core.toLowerCase()}"></a>`;
    if (sd.anchorIdx < 0) anchorAfter.set(sd.idx, want);
    else if (lines[sd.anchorIdx] !== want) anchorFix.set(sd.anchorIdx, want);
  }
  const refresh = (l) => l.replace(S.R.boundG, (...a) => {
    const t = res(a[a.length - 1].core);
    return t ? ref(card.file, t) : a[0];
  });
  const body = [];
  for (let i = card.fm.end + 1; i < lines.length; i++) {
    if (skip.has(i)) continue;
    let l = lines[i];
    if (!untouched.has(i) && !mask[i] && !card.extLines.has(i)) {
      if (anchorFix.has(i)) l = anchorFix.get(i);
      else if (forgive.has(i)) l = l.replace(l.trim(), '—');
      else if (confirmed.has(i)) l = l.replace(/ \[confirmed\]\s*$/, '');
      else {
        const u = ups.get(i);
        if (u) for (const x of [...u].sort((p, q) => q.start - p.start)) l = l.slice(0, x.start) + x.text + l.slice(x.end);
        if (renumber.has(i)) l = l.replace(/^(\s*)\d+\./, `$1${renumber.get(i)}.`);
        l = refresh(l);
      }
    }
    body.push(l);
    if (anchorAfter.has(i)) {
      body.push(anchorAfter.get(i));
      const nx = i + 1 < lines.length ? lines[i + 1] : '';
      if (nx.trim() !== '' && !/^#{2,3} /.test(nx) && !S.R.passportLine.test(nx)) body.push('');
    }
  }
  while (body.length && body[0].trim() === '') body.shift();
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  const out = lines.slice(0, card.fm.end + 1);
  out.push(`# ${card.name} · #${card.id}`, status);
  if (body.length) out.push('', ...body);
  for (const g of gen) out.push('', `## ${g.heading}`, ...g.lines);
  return out.join('\n') + '\n';
}

/** Compute every file regen would write. Returns [{file, text|null}] (null = delete). */
export function plan(S, P) {
  const writes = [];
  for (const ws of P.workspaces) {
    if (S.raw.lifecycles.readOnly.includes(ws.lifecycle)) continue;
    const ctx = makeContext(S, ws);
    const changes = new Map();
    for (const c of ws.cards) if (c.id) changes.set(c, changeOf(S, ws, c));
    for (const c of ws.cards) {
      if (!c.id || !c.name) continue;
      writes.push({ file: c.file, text: rewriteCard(S, ws, c, generatedFor(ctx, c), statusLine(S, ws, c, changes.get(c))) });
    }
    for (const folder of S.modules) {
      if (ws.modules.includes(folder) || exists(path.join(ws.dir, folder))) {
        writes.push({ file: path.join(ws.dir, folder, '_index.md'), text: renderFolderIndex(S, ws, folder) });
      }
    }
    const ch = renderChanges(S, ws, changes);
    const cf = path.join(ws.dir, 'CHANGES.md');
    if (ch) writes.push({ file: cf, text: ch });
    else if (exists(cf)) writes.push({ file: cf, text: null });
  }
  writes.push({ file: path.join(P.root, '_index.md'), text: renderRootIndex(S, P) });
  writes.push({ file: path.join(P.root, '_ids.md'), text: renderIds(S, P) });
  return writes;
}

/** Apply a plan; returns the project-relative paths that changed. */
export function apply(P, writes) {
  const changed = [];
  for (const w of writes) {
    const rel = toPosix(path.relative(P.root, w.file));
    if (w.text === null) { fs.rmSync(w.file, { force: true }); changed.push(rel + ' (removed)'); continue; }
    if (writeIfChanged(w.file, w.text)) changed.push(rel);
  }
  return changed;
}
