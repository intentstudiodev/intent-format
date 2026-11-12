// Loads a project root: workspaces (V<x.y>/), their manifests and cards, the core index and _ids.md.
import path from 'node:path';
import { listDir, walkMd, exists, readText, toPosix, compareVersions } from './util.mjs';
import { buildFile } from './model.mjs';

export function emptyVocab() {
  return { declared: new Set(), values: {}, stateCodes: new Map(), roleStates: [] };
}

export function loadProject(S, root) {
  root = path.resolve(root);
  const P = { root, workspaces: [], byVersion: new Map(), ids: null, rootFiles: [] };
  for (const e of listDir(root)) {
    if (e.isDirectory() && S.R.workspaceFolder.test(e.name)) P.workspaces.push(loadWorkspace(S, P, e.name));
  }
  P.workspaces.sort((a, b) => compareVersions(a.version, b.version));
  for (const ws of P.workspaces) P.byVersion.set(ws.version, ws);
  for (const ws of P.workspaces) ws.base = ws.basedOn ? P.byVersion.get(ws.basedOn) || null : null;
  for (const n of ['_index.md', '_ids.md']) {
    const f = path.join(root, n);
    if (exists(f)) P.rootFiles.push(buildFile(S, f, n));
  }
  const idsFile = path.join(root, '_ids.md');
  P.ids = exists(idsFile) ? parseIds(readText(idsFile)) : { resolved: [], retired: [], marks: new Map() };
  return P;
}

function loadWorkspace(S, P, folder) {
  const dir = path.join(P.root, folder);
  const rel = (f) => toPosix(path.relative(P.root, f));
  const ws = {
    folder, dir, version: folder.slice(1), files: [], cards: [], byCore: new Map(), dupCores: [],
    manifest: null, project: null, vocab: emptyVocab(), modules: [...S.modules], lifecycle: null,
    basedOn: null, kb: null, name: null, subfolders: [],
  };
  const mf = path.join(dir, 'intent-format.md');
  if (exists(mf)) {
    ws.manifest = buildFile(S, mf, rel(mf));
    const m = ws.manifest.fm?.map;
    if (m) {
      ws.kb = m.get('kb')?.value ?? null;
      ws.name = m.get('name')?.value ?? null;
      ws.lifecycle = m.get('lifecycle')?.value ?? null;
      ws.basedOn = m.get('based-on')?.value || null;
      const mods = m.get('modules');
      if (mods && mods.kind === 'list') ws.modules = mods.items;
    }
  }
  for (const f of walkMd(dir)) {
    if (f === mf) continue;
    const c = buildFile(S, f, rel(f), { modules: ws.modules });
    c.ws = ws;
    ws.files.push(c);
  }
  for (const e of listDir(dir)) {
    if (!e.isDirectory() || !S.modules.includes(e.name)) continue;
    for (const s of listDir(path.join(dir, e.name))) if (s.isDirectory()) ws.subfolders.push(`${folder}/${e.name}/${s.name}`);
  }
  ws.cards = ws.files.filter((c) => c.kind === 'card');
  ws.project = ws.cards.find((c) => c.type === 'project' && path.basename(c.file) === 'project.md' && path.dirname(c.file) === dir)
    || ws.cards.find((c) => c.type === 'project') || null;
  if (ws.project && ws.project.vocab) ws.vocab = ws.project.vocab;
  // core index
  const put = (core, entry) => {
    if (ws.byCore.has(core)) ws.dupCores.push({ core, a: ws.byCore.get(core), b: entry });
    else ws.byCore.set(core, entry);
  };
  for (const c of ws.files) {
    if ((c.kind === 'card' || c.kind === 'x') && c.id) put(c.id, { card: c, sub: null });
    for (const sd of c.subs) put(sd.core, { card: c, sub: sd });
  }
  return ws;
}

/** Type of a resolved target: card type or sub-document kind. */
export const targetType = (t) => (t.sub ? t.sub.kind : t.card.type);

/** Name of a resolved target. */
export const targetName = (t) => (t.sub ? t.sub.name : t.card.name);

/** Absolute file + anchor of a resolved target. */
export const targetAnchor = (t) => (t.sub ? t.sub.core.toLowerCase() : null);

/* ---------------- _ids.md ---------------- */

function tableAfter(lines, heading) {
  const i = lines.findIndex((l) => l.replace('⚙️', '⚙').trim() === `## ${heading}`);
  if (i < 0) return [];
  const rows = [];
  for (let j = i + 1; j < lines.length && !/^## /.test(lines[j]); j++) {
    const t = lines[j].trim();
    if (!/^\|.*\|$/.test(t) || /^\|(\s*:?-{3,}:?\s*\|)+$/.test(t)) continue;
    rows.push(t.slice(1, -1).split('|').map((x) => x.trim()));
  }
  return rows.slice(1); // drop header
}

export function parseIds(text) {
  const lines = text.split('\n');
  const resolved = tableAfter(lines, '⚙ Resolved').map((r) => ({ core: r[0], type: r[1], name: r[2], versions: (r[3] || '').split(',').map((x) => x.trim()).filter(Boolean), path: r[4] }));
  const retired = tableAfter(lines, '⚙ Retired').map((r) => ({ core: r[0], type: r[1], name: r[2], last: r[3], merged: r[4] || '—' }));
  const marks = new Map();
  for (const r of tableAfter(lines, '⚙ High-water marks')) if (/^[A-Z]{2}$/.test(r[0]) && /^\d+$/.test(r[1])) marks.set(r[0], +r[1]);
  return { resolved, retired, marks };
}

/** Highest number per prefix: files of every workspace, Retired, High-water marks. */
export function highWater(P) {
  const hw = new Map();
  const bump = (core) => {
    const p = core.slice(0, 2), n = +core.slice(2);
    if (!/^[A-Z]{2}$/.test(p) || !Number.isFinite(n)) return;
    if (!hw.has(p) || hw.get(p) < n) hw.set(p, n);
  };
  for (const ws of P.workspaces) for (const core of ws.byCore.keys()) bump(core);
  for (const ws of P.workspaces) for (const d of ws.dupCores) bump(d.core);
  for (const r of P.ids.retired) bump(r.core);
  for (const [p, n] of P.ids.marks) if (!hw.has(p) || hw.get(p) < n) hw.set(p, n);
  return hw;
}
