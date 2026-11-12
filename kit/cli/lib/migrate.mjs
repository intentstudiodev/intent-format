// intent-format migrate: bring a KB written against an earlier reading of the standard up to date (S-OPS-5).
// Two steps, both idempotent: pre-release names of the standard (`standard:` first key) become the
// current one, and the deprecated ### Roles table in project.md becomes role cards — one core per
// role name across all workspaces, so a role is the same card in every version.
import fs from 'node:fs';
import path from 'node:path';
import { parseTable, contentIdx } from './parse.mjs';
import { renderCard } from './templates.mjs';
import { mintCores } from './create.mjs';
import { exists, readText, slugify, toPosix, walkMd } from './util.mjs';

/** Rows of the ### Roles table and the line range of the subsection, or null. */
function rolesTable(S, c) {
  const start = c.lines.findIndex((l, k) => !c.mask[k] && /^### Roles\s*$/.test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < c.lines.length && !(!c.mask[end] && /^#{2,3} /.test(c.lines[end]))) end++;
  const t = parseTable(c.lines, contentIdx(c.lines, start + 1, end, c.mask), S.R);
  const rows = t.rows.map((r) => ({ name: (r.cells[0] || '').trim(), description: (r.cells[1] || '').trim(), states: (r.cells[2] || '').split(',').map((x) => x.trim()).filter(Boolean) }));
  return { start, end, rows };
}

/** Every file whose `standard:` key holds a pre-release name gets the current one. The name is the
 *  format's label, not product content, so released workspaces are renamed too; inputs/ is left alone. */
function renameStandard(S, P, log) {
  let n = 0;
  for (const f of walkMd(P.root)) {
    if (toPosix(path.relative(P.root, f)).startsWith('inputs/')) continue;
    const t = readText(f);
    const m = /^---\r?\nstandard: (.+?)\s*\r?\n/.exec(t);
    if (!m || !S.legacyStandards.includes(m[1])) continue;
    fs.writeFileSync(f, t.replace(m[0], m[0].replace(m[1], S.standard)));
    n++;
  }
  // the project's AGENTS.md is the project's own text: only the standard's name in it changes
  const agents = path.join(P.root, 'AGENTS.md');
  if (exists(agents)) {
    const t = readText(agents);
    const u = S.legacyStandards.reduce((x, old) => x.split(old.replace('/', ' ')).join(S.standard.replace('/', ' ')), t);
    if (u !== t) { fs.writeFileSync(agents, u); n++; }
  }
  if (n) log(`standard: ${n} file(s) renamed to ${S.standard}`);
  return n;
}

export function migrate(S, P, log) {
  const stats = { renamed: renameStandard(S, P, log), created: 0, reused: 0, kept: 0, workspaces: 0, problems: 0 };
  const coreByName = new Map();
  for (const ws of P.workspaces) for (const c of ws.cards) if (c.type === 'role' && c.id && c.name && !coreByName.has(c.name)) coreByName.set(c.name, c.id);
  for (const ws of P.workspaces) {
    if (S.raw.lifecycles.readOnly.includes(ws.lifecycle)) { log(`${ws.folder}: ${ws.lifecycle} (read-only) — skipped`); continue; }
    const pc = ws.project;
    const table = pc && rolesTable(S, pc);
    if (!table) continue;
    stats.workspaces++;
    const have = new Set(ws.cards.filter((c) => c.type === 'role').map((c) => c.name));
    const dir = path.join(ws.dir, 'roles');
    for (const r of table.rows) {
      if (!r.name || /[[\]]/.test(r.name)) { stats.problems++; log(`${ws.folder}: row "${r.name}" has no usable name — skipped`); continue; }
      if (have.has(r.name)) { stats.kept++; continue; }
      let core = coreByName.get(r.name);
      if (core) stats.reused++;
      else { [core] = mintCores(S, P, 'RO', 1); coreByName.set(r.name, core); stats.created++; }
      const states = r.states.filter((x) => x !== S.reserved.States);
      const unknown = states.filter((x) => !ws.vocab.values.States?.has(x));
      if (unknown.length) { stats.problems++; log(`${ws.folder}: ${r.name} — States ${unknown.join(', ')} are not declared; kept on the card for check to report`); }
      const values = { id: core, name: r.name, ...(states.length === 1 ? { state: states[0] } : states.length > 1 ? { state: states } : {}) };
      let text = renderCard(S, 'role', values);
      if (r.description) text = text.replace('## Description\n—', `## Description\n${r.description}`);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${core.toLowerCase()}-${slugify(r.name, 'role')}.md`);
      if (!exists(file)) fs.writeFileSync(file, text);
      have.add(r.name);
      log(`${core} ${toPosix(path.relative(P.root, file))}`);
    }
    // drop the table from project.md (blank lines after it too)
    const lines = readText(pc.file).replace(/\n$/, '').split('\n');
    let end = table.end;
    lines.splice(table.start, end - table.start);
    while (lines[table.start] === '' && lines[table.start - 1] === '') lines.splice(table.start, 1);
    fs.writeFileSync(pc.file, lines.join('\n') + '\n');
    // enable the roles module
    const mf = path.join(ws.dir, 'intent-format.md');
    if (exists(mf)) {
      const t = readText(mf);
      const m = /^modules: \[(.*)\]$/m.exec(t);
      if (m) {
        const mods = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        if (!mods.includes('roles')) {
          const next = S.modules.filter((x) => x === 'roles' || mods.includes(x)).concat(mods.filter((x) => !S.modules.includes(x)));
          fs.writeFileSync(mf, t.replace(m[0], `modules: [${next.join(', ')}]`));
        }
      }
    }
  }
  return stats;
}
