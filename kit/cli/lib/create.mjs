// Card creation shared by `intent-format new`, `intent-format mint` and `intent-format scaffold`: minting, High-water marks, templates.
import fs from 'node:fs';
import path from 'node:path';
import { exists, readText, slugify, pad6, toPosix } from './util.mjs';
import { highWater, parseIds } from './project.mjs';
import { renderIds } from './generate.mjs';
import { renderCard } from './templates.mjs';

export class Usage extends Error {}
export class Refused extends Error {}

/** Raise High-water marks in _ids.md without touching its other tables. */
export function bumpMarks(S, P, prefix, n) {
  const file = path.join(P.root, '_ids.md');
  const hw = highWater(P);
  if (!hw.has(prefix) || hw.get(prefix) < n) hw.set(prefix, n);
  if (!exists(file)) { fs.writeFileSync(file, renderIds(S, P, hw)); return; }
  const text = readText(file);
  const marks = parseIds(text).marks;
  for (const [p, v] of hw) if (!marks.has(p) || marks.get(p) < v) marks.set(p, v);
  const table = ['| Prefix | Highest |', '|---|---|', ...[...marks.keys()].sort().map((p) => `| ${p} | ${marks.get(p)} |`)];
  const lines = text.replace(/\n$/, '').split('\n');
  const i = lines.findIndex((l) => l.replace('⚙️', '⚙').trim() === `## ${S.gear} High-water marks`);
  let out;
  if (i < 0) out = [...lines, '', `## ${S.gear} High-water marks`, ...table];
  else {
    let j = i + 1;
    while (j < lines.length && !/^## /.test(lines[j])) j++;
    out = [...lines.slice(0, i + 1), ...table, ...(j < lines.length ? ['', ...lines.slice(j)] : [])];
  }
  fs.writeFileSync(file, out.join('\n') + '\n');
}

export function mintCores(S, P, prefix, count) {
  const start = (highWater(P).get(prefix) || 0) + 1;
  const cores = [];
  for (let k = 0; k < count; k++) cores.push(prefix + pad6(start + k));
  const last = start + count - 1;
  bumpMarks(S, P, prefix, last);
  P.ids.marks.set(prefix, Math.max(P.ids.marks.get(prefix) || 0, last));
  return cores;
}

/** Validate, mint a core and write the card from its template. opts: { state, feature, parent }. */
export function createCard(S, P, ws, type, name, opts = {}) {
  if (!S.isCardType(type)) throw new Usage(`unknown type "${type}" (${S.roster.join(', ')})`);
  name = String(name || '').trim();
  if (!name || /[[\]]/.test(name)) throw new Usage('the name must be non-empty and contain no [ or ]');
  if (S.raw.lifecycles.readOnly.includes(ws.lifecycle)) throw new Refused(`V${ws.version} is ${ws.lifecycle} (read-only)`);
  const keys = S.keyOrder(type);
  const folder = S.folderOfType[type];
  if (type === 'project' && ws.project) throw new Refused(`V${ws.version} already has a project card`);
  if (folder && !ws.modules.includes(folder)) throw new Refused(`module ${folder} is not enabled in V${ws.version}/intent-format.md`);
  const values = { name };
  if (opts.state !== undefined) {
    if (!keys.includes('state')) throw new Usage(`--state is not allowed on ${type}`);
    if (!ws.vocab.declared.has('States')) throw new Refused('project.md declares no States');
    if (opts.state !== S.reserved.States && !ws.vocab.values.States.has(opts.state)) throw new Refused(`state "${opts.state}" is not in ### States`);
    values.state = opts.state;
  }
  for (const k of ['feature', 'parent']) {
    if (opts[k] === undefined) continue;
    if (!keys.includes(k)) throw new Usage(`--${k} is not allowed on ${type}`);
    const t = ws.byCore.get(opts[k]);
    if (!t || t.sub || t.card.type !== 'feature') throw new Refused(`--${k} ${opts[k]} is not a feature in V${ws.version}`);
    if (k === 'parent' && t.card.fm.map.get('parent')) throw new Refused(`--parent ${opts[k]} is a Sub-feature (max two levels)`);
    values[k] = opts[k];
  }
  const [core] = mintCores(S, P, S.prefixOfType[type], 1);
  values.id = core;
  const file = folder ? path.join(ws.dir, folder, `${core.toLowerCase()}-${slugify(name, type)}.md`) : path.join(ws.dir, 'project.md');
  if (exists(file)) throw new Refused(`${file} already exists`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderCard(S, type, values));
  // register the new card so later calls in the same run can resolve it (scaffold)
  const fmMap = new Map(values.parent ? [['parent', { value: values.parent }]] : []);
  ws.byCore.set(core, { card: { id: core, type, name, file, fm: { map: fmMap }, subs: [] }, sub: null });
  return { core, file, rel: toPosix(path.relative(P.root, file)) };
}

/* ---------------- scaffold ---------------- */

const SCAFFOLD_ORDER = ['role', 'feature', 'tech', 'backend', 'api', 'component', 'shell', 'screen', 'ia', 'userflow', 'rule', 'edge-case', 'decision', 'comment'];

function splitRow(line) {
  const cells = [];
  let start = line.indexOf('|') + 1;
  for (let i = start; i < line.length; i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === '|') { cells.push({ text: line.slice(start, i), start, end: i }); start = i + 1; }
  }
  return cells;
}

function normType(S, raw) {
  let x = raw.trim().toLowerCase().replace(/\s+/g, '-');
  const alias = { 'sub-feature': 'feature', subfeature: 'feature', 'user-flow': 'userflow', flow: 'userflow', 'ia-map': 'ia', edgecase: 'edge-case' };
  x = alias[x] || x;
  if (!S.isCardType(x) && x.endsWith('s') && S.isCardType(x.slice(0, -1))) x = x.slice(0, -1);
  return S.isCardType(x) ? x : null;
}

const blank = (v) => !v || /^(—|-|–)$/.test(v);
const norm = (n) => String(n || '').replace(/\s+/g, ' ').trim().toLowerCase();

/** The inventory's first table with Type, Name and Core columns: { lines, rows } or null. */
export function readInventory(S, invFile) {
  const lines = readText(invFile).split('\n');
  let h = -1, cols = null;
  for (let i = 0; i < lines.length && h < 0; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const cells = splitRow(lines[i]).map((c) => c.text.trim().toLowerCase());
    const c = { type: cells.indexOf('type'), name: cells.indexOf('name'), core: cells.indexOf('core'), home: cells.findIndex((x) => x.startsWith('parent')) };
    if (c.type >= 0 && c.name >= 0 && c.core >= 0) { h = i; cols = c; }
  }
  if (h < 0) return null;
  const rows = [];
  for (let i = h + 1; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    if (/^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[i])) continue;
    const cells = splitRow(lines[i]);
    const get = (k) => (cols[k] >= 0 && cells[cols[k]] ? cells[cols[k]].text.trim().replace(/\\\|/g, '|') : '');
    rows.push({ idx: i, no: rows.length + 1, rawType: get('type'), type: normType(S, get('type')), name: get('name'), home: get('home'), core: get('core'), coreCell: cells[cols.core] });
  }
  return { lines, rows };
}

/**
 * Create a card for every inventory row without a Core; write each new core into that row's Core cell.
 * Columns located by header: Type, Name, Core (required) and "Parent / home" (optional).
 */
export function scaffold(S, P, ws, invFile, log) {
  const inv = readInventory(S, invFile);
  if (!inv) throw new Refused(`${invFile}: no table with Type, Name and Core columns`);
  const { lines, rows } = inv;
  const stats = { created: 0, linked: 0, skipped: 0, problems: 0 };
  const problem = (r, msg) => { stats.problems++; log(`row ${r.no} (${r.rawType} "${r.name}"): ${msg}`); };
  const cardsNamed = (type, name) => [...new Set([...ws.byCore.values()].filter((t) => !t.sub && t.card.type === type && norm(t.card.name) === norm(name)).map((t) => t.card.id))];
  const writeCore = (r, core) => {
    const l = lines[r.idx];
    lines[r.idx] = l.slice(0, r.coreCell.start) + ` ${core} ` + l.slice(r.coreCell.end);
    r.core = core;
    fs.writeFileSync(invFile, lines.join('\n'));
  };
  const queue = [];
  for (const r of rows) {
    if (!blank(r.core)) stats.skipped++;
    else if (!r.type) problem(r, `unknown type "${r.rawType}" — skipped`);
    else if (r.type === 'project') { stats.skipped++; log(`row ${r.no}: project skipped (intent-format init creates the project card)`); }
    else if (!r.name) problem(r, 'no name — skipped');
    else if (!r.coreCell) problem(r, 'row has no Core cell — skipped');
  }
  // every card type is scaffolded; a type the order does not list yet goes last, never skipped
  for (const type of [...SCAFFOLD_ORDER, ...S.roster.filter((t) => t !== 'project' && !SCAFFOLD_ORDER.includes(t))]) {
    const rs = rows.filter((r) => r.type === type && blank(r.core) && r.name && r.coreCell);
    queue.push(...(type === 'feature' ? [...rs.filter((r) => blank(r.home)), ...rs.filter((r) => !blank(r.home))] : rs));
  }
  for (const r of queue) {
    const existing = cardsNamed(r.type, r.name);
    if (existing.length === 1) { writeCore(r, existing[0]); stats.linked++; log(`${existing[0]} already exists (${r.type} "${r.name}") — core written to the inventory`); continue; }
    if (existing.length > 1) { problem(r, `several ${r.type} cards are named "${r.name}" (${existing.join(', ')}) — skipped`); continue; }
    const opts = {};
    if (!blank(r.home)) {
      const key = r.type === 'feature' ? 'parent' : S.keyOrder(r.type).includes('feature') ? 'feature' : null;
      if (!key) log(`row ${r.no}: Parent / home ignored for ${r.type}`);
      else {
        const hits = cardsNamed('feature', r.home);
        if (hits.length !== 1) problem(r, `${key === 'parent' ? 'parent' : 'home'} feature "${r.home}" ${hits.length ? 'is ambiguous' : 'not found'} — created without ${key}:`);
        else if (key === 'parent' && ws.byCore.get(hits[0]).card.fm.map.get('parent')) problem(r, `"${r.home}" is a Sub-feature (max two levels) — created without parent:`);
        else opts[key] = hits[0];
      }
    }
    try {
      const { core, rel } = createCard(S, P, ws, r.type, r.name, opts);
      writeCore(r, core);
      stats.created++;
      log(`${core} ${rel}${opts.parent ? ' · under: ' + opts.parent : ''}${opts.feature ? ' · feature: ' + opts.feature : ''}`);
    } catch (e) {
      if (e instanceof Refused || e instanceof Usage) problem(r, e.message);
      else throw e;
    }
  }
  log(`scaffold: ${stats.created} created · ${stats.linked} linked to existing cards · ${stats.skipped} skipped (core present or project) · ${stats.problems} problem(s)`);
  return stats;
}
