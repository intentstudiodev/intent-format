#!/usr/bin/env node
// intent-format — command-line tool for Intent Format knowledge bases. Node >= 18, no dependencies.
// Reads ../../schema.json (relative to this file); the schema drives the behaviour.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema } from './lib/schema.mjs';
import { exists, listDir, slugify, readText, copyDir, toPosix, withLock } from './lib/util.mjs';
import { parseFrontMatter, fmValue } from './lib/parse.mjs';
import { loadProject } from './lib/project.mjs';
import { checkProject } from './lib/check.mjs';
import { plan, apply } from './lib/regen.mjs';
import { renderCard } from './lib/templates.mjs';
import { buildKit } from './lib/kit.mjs';
import { Usage, Refused, mintCores, createCard, scaffold } from './lib/create.mjs';
import { STANDARD_DIR } from './lib/schema.mjs';
import { nextStep, renderNext } from './lib/next.mjs';
import { frameOf, renderFrame } from './lib/frame.mjs';
import { ensureAgentFiles } from './lib/agents.mjs';
import { migrate } from './lib/migrate.mjs';
import { openList, renderOpen } from './lib/open.mjs';

const HELP = `intent-format — Intent Format knowledge-base tool

Usage: node <standard>/kit/cli/intent-format.mjs <command> [arguments]

Commands
  init <root> --name "<Name>" [--kb <slug>] [--version 1.0] [--lifecycle in-progress] [--modules a,b]
        Create a project root (_index.md, _ids.md, inputs/links.md), the workspace
        V<version>/ with intent-format.md, project.md and module folders; then regen.
        <root> may already exist (e.g. with inputs/); refuses if it holds a manifest.
  new <type> "<Name>" --root <root> [--ws V1.0] [--feature FT…] [--state <State>] [--parent FT…]
        Mint a core and write the card from its template. Prints "<core> <path>".
  scaffold <root> --inventory <file> [--ws V1.0]
        Create a card for every inventory row without a Core (columns: Type, Name,
        Parent / home, …, Core) and write each new core into the row. Idempotent.
  mint <PREFIX> --root <root> [--count n]
        Mint cores (FS, SV, CV, HV for sub-documents). Prints one core per line and
        raises the High-water mark in _ids.md.
  check <root> [--ws V1.0] [--json]
        Diagnostics "<severity> <code> <path>:<line> <message>", then counts and health
        numbers (blind spots by kind · unresolved placeholders · open decisions).
        Exit 1 on errors.
  regen <root>
        Regenerate _index.md, _ids.md, folder rosters, ⚙ sections, status lines and
        CHANGES.md; refresh reference names/paths. Refuses on errors. Idempotent.
        Adds AGENTS.md and CLAUDE.md at the root when missing (never overwrites them).
  migrate <root>
        Bring a KB up to date with the current version: turns the deprecated ### Roles table
        into role cards (one core per role across versions); then regen. Idempotent.
  next [<root>] [--ws V1.0] [--json]
        Read the project folder and print the one next step: during a cold start
        (set up · kickoff · proposal · review · scaffold · fill · check · report) and after.
  open <root> [--ws V1.0] [--json]
        The open list: [ask: …] questions, open decisions, [assumed] and [likely] marks, whys
        missing, other blind spots per card. What to ask the owner next.
  frame <root> <screen core or name> [--ws V1.0] [--json]
        What surrounds a screen at each placement: the resolved shell and its stacked
        variants, parts, navigation and the Places inside contract.
  branch <root> <from> <to>
        Copy workspace V<from> to V<to> (version, lifecycle: in-progress, based-on); regen.

Maintainer only
  build-kit
        Regenerates the kit inside the standard (templates/, kit/skills/intent-format/types/,
        kit/skills/intent-format/links.md) from schema.json. Never run it in a KB project.

Exit codes: 0 ok · 1 errors in the KB, problems, or command refused · 2 usage error`;

const BOOL = new Set(['json', 'help', 'h']);

function parseArgs(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('-') && a !== '-') {
      const k = a.replace(/^-+/, '');
      const eq = k.indexOf('=');
      if (eq >= 0) flags[k.slice(0, eq)] = k.slice(eq + 1);
      else if (BOOL.has(k)) flags[k] = true;
      else {
        if (i + 1 >= argv.length) throw new Usage(`--${k} needs a value`);
        flags[k] = argv[++i];
      }
    } else pos.push(a);
  }
  return { pos, flags };
}

const vNorm = (v) => String(v || '').replace(/^V/, '');

function pickWorkspace(P, wsFlag) {
  if (wsFlag) {
    const ws = P.byVersion.get(vNorm(wsFlag));
    if (!ws) throw new Refused(`no workspace V${vNorm(wsFlag)} in ${P.root}`);
    return ws;
  }
  if (P.workspaces.length === 1) return P.workspaces[0];
  const open = P.workspaces.filter((w) => w.lifecycle === 'in-progress');
  if (open.length === 1) return open[0];
  throw new Refused(`several workspaces (${P.workspaces.map((w) => w.folder).join(', ')}) — name one with --ws`);
}

function requireProject(S, root) {
  const P = loadProject(S, root);
  if (!P.workspaces.length) throw new Refused(`no workspace (V<x.y>/) in ${path.resolve(root)} — run intent-format init`);
  return P;
}

function regenProject(S, root, log = console.log) {
  const P = loadProject(S, root);
  const r = checkProject(S, P, { skipGenerated: true });
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length) {
    for (const d of errors) log(`${d.severity} ${d.code} ${d.path}:${d.line} ${d.message}`);
    throw new Refused(`regen refused: ${errors.length} error(s) — fix them and run again`);
  }
  const changed = apply(P, plan(S, P));
  const ws = P.workspaces[P.workspaces.length - 1];
  changed.push(...ensureAgentFiles(P.root, ws?.name || path.basename(P.root)));
  log(`regen: ${changed.length} file(s) changed`);
  for (const c of changed) log(`  ${c}`);
  return changed;
}

/* ---------------- commands ---------------- */

function cmdInit(S, pos, f) {
  const root = pos[0];
  if (!root || !f.name) throw new Usage('init <root> --name "<Name>" [--kb <slug>] [--version 1.0] [--lifecycle in-progress] [--modules a,b]');
  const name = String(f.name).trim();
  if (!name || /[[\]]/.test(name)) throw new Usage('--name must be non-empty and contain no [ or ]');
  const kb = f.kb || slugify(name, 'kb');
  if (!S.R.kbSlug.test(kb)) throw new Usage(`--kb "${kb}" is not a slug (a-z, 0-9, -)`);
  const version = vNorm(f.version || '1.0');
  if (!S.R.version.test(version)) throw new Usage(`--version "${version}" must look like 1.0 or 1.1-label`);
  const lifecycle = f.lifecycle || 'in-progress';
  if (!S.lifecycles.includes(lifecycle)) throw new Usage(`--lifecycle must be one of ${S.lifecycles.join(', ')}`);
  const modules = f.modules ? String(f.modules).split(',').map((x) => x.trim()).filter(Boolean) : [...S.modules];
  for (const m of modules) if (!S.modules.includes(m)) throw new Usage(`unknown module "${m}" (${S.modules.join(', ')})`);
  const abs = path.resolve(root);
  if (exists(path.join(abs, 'intent-format.md'))) throw new Refused(`${abs} already holds a workspace manifest (intent-format.md)`);
  for (const e of listDir(abs)) {
    if (e.isDirectory() && exists(path.join(abs, e.name, 'intent-format.md'))) throw new Refused(`${abs} already holds a workspace manifest (${e.name}/intent-format.md)`);
  }
  fs.mkdirSync(path.join(abs, 'inputs'), { recursive: true });
  const links = path.join(abs, 'inputs', 'links.md');
  if (!exists(links)) fs.writeFileSync(links, `# Links\n\nURLs used as sources for this knowledge base, one per line: - [<title>](<url>) — <what it is>\n`);
  const wsDir = path.join(abs, 'V' + version);
  fs.mkdirSync(wsDir, { recursive: true });
  const ordered = S.modules.filter((m) => modules.includes(m));
  const manifest = ['---', `standard: ${S.standard}`, 'type: manifest', `kb: ${kb}`, `name: ${fmValue(S, 'name', name)}`,
    `version: ${fmValue(S, 'version', version)}`, `lifecycle: ${lifecycle}`, `modules: [${ordered.join(', ')}]`, '---',
    `# ${name}`, '', `Knowledge base of ${name}. Maintainer: —.`, ''].join('\n');
  fs.writeFileSync(path.join(wsDir, 'intent-format.md'), manifest);
  for (const m of ordered) fs.mkdirSync(path.join(wsDir, m), { recursive: true });
  const pfile = path.join(wsDir, 'project.md');
  if (exists(pfile)) console.log(`kept existing ${toPosix(path.relative(abs, pfile))}`);
  else {
    const P = loadProject(S, abs);
    const [core] = mintCores(S, P, S.prefixOfType.project, 1);
    fs.writeFileSync(pfile, renderCard(S, 'project', { id: core, name }));
  }
  console.log(`initialised ${abs} (V${version} ${lifecycle}, kb ${kb}, ${ordered.length} modules)`);
  regenProject(S, abs);
}

function cmdNew(S, pos, f) {
  const [type, name] = pos;
  if (!type || !name) throw new Usage('new <type> "<Name>" --root <root> [--ws V1.0] [--feature FT…] [--state <s>] [--parent FT…]');
  if (!S.isCardType(type)) throw new Usage(`unknown type "${type}" (${S.roster.join(', ')})`);
  const P = requireProject(S, f.root || '.');
  const ws = pickWorkspace(P, f.ws);
  const { core, rel } = createCard(S, P, ws, type, name, { state: f.state, feature: f.feature, parent: f.parent });
  console.log(`${core} ${rel}`);
}

function cmdScaffold(S, pos, f) {
  const root = pos[0] || f.root;
  if (!root || !f.inventory) throw new Usage('scaffold <root> --inventory <file> [--ws V1.0]');
  if (!exists(f.inventory)) throw new Refused(`inventory ${f.inventory} not found`);
  const P = requireProject(S, root);
  const ws = pickWorkspace(P, f.ws);
  const stats = scaffold(S, P, ws, path.resolve(f.inventory), console.log);
  return stats.problems ? 1 : 0;
}

function cmdMint(S, pos, f) {
  const prefix = pos[0];
  if (!prefix) throw new Usage('mint <PREFIX> --root <root> [--count n]');
  const known = !!S.kindOfPrefix[prefix] || S.R.extPrefix.some((r) => r.test(prefix));
  if (!/^[A-Z]{2}$/.test(prefix) || !known) throw new Usage(`unknown prefix "${prefix}" (${Object.keys(S.kindOfPrefix).join(', ')}, or X*/Z*)`);
  const count = f.count === undefined ? 1 : Number(f.count);
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Usage('--count must be 1..1000');
  const P = requireProject(S, f.root || '.');
  for (const c of mintCores(S, P, prefix, count)) console.log(c);
}

const KIND_LABEL = { status: 'status', frontMatter: 'front matter', sections: 'required sections', lists: 'list items', requirements: 'requirement slots', targets: 'relation targets', why: 'why' };

function cmdCheck(S, pos, f) {
  let root = path.resolve(pos[0] || f.root || '.');
  let ws = f.ws ? 'V' + vNorm(f.ws) : null;
  if (exists(path.join(root, 'intent-format.md'))) { ws = ws || path.basename(root); root = path.dirname(root); }
  const P = requireProject(S, root);
  if (ws && !P.workspaces.some((w) => w.folder === ws)) throw new Refused(`no workspace ${ws} in ${root}`);
  const r = checkProject(S, P, { ws });
  if (f.json) console.log(JSON.stringify(r, null, 2));
  else {
    for (const d of r.diagnostics) console.log(`${d.severity} ${d.code} ${d.path}:${d.line} ${d.message}`);
    console.log(`Summary: ${r.counts.error} errors · ${r.counts.warning} warnings · ${r.counts.info} infos`);
    for (const h of r.health) {
      const by = Object.entries(h.blindSpotsByKind).map(([k, v]) => `${KIND_LABEL[k] || k} ${v}`).join(' · ');
      console.log(`${h.workspace} (${h.lifecycle || '—'}): ${h.cards} cards · blind spots ${h.blindSpots} (${by}) · unresolved placeholders ${h.unresolvedPlaceholders} · open decisions ${h.openDecisions}`);
      console.log(`  why: filled ${h.why.filled} · inherited ${h.why.inherited} · none ${h.why.none} · debt ${h.why.missing} · confidence: assumed ${h.confidence.assumed} · likely ${h.confidence.likely} · asks ${h.asks.open}${h.asks.later ? ` (+${h.asks.later} later${h.asks.due ? `, ${h.asks.due} due` : ''})` : ''}`);
    }
  }
  return r.counts.error ? 1 : 0;
}

function cmdRegen(S, pos, f) {
  const root = pos[0] || f.root;
  if (!root) throw new Usage('regen <root>');
  requireProject(S, root);
  regenProject(S, root);
}

function setManifest(S, file, updates) {
  const lines = readText(file).replace(/\n$/, '').split('\n');
  const fm = parseFrontMatter(lines, S.R);
  if (!fm || fm.errors.length) throw new Refused(`${file}: unparsable front matter`);
  const order = S.raw.manifest.keys.map((k) => k.key);
  const out = ['---'];
  for (const k of order) {
    if (k in updates) { if (updates[k] != null) out.push(`${k}: ${fmValue(S, k, updates[k])}`); continue; }
    const e = fm.map.get(k);
    if (e) out.push(lines[e.idx]);
  }
  for (const e of fm.entries) if (!order.includes(e.key)) out.push(lines[e.idx]);
  out.push(...lines.slice(fm.end));
  fs.writeFileSync(file, out.join('\n') + '\n');
}

function cmdBranch(S, pos) {
  const [root, from, to] = pos;
  if (!root || !from || !to) throw new Usage('branch <root> <from> <to>   e.g. branch kb V1.0 V1.1');
  const P = requireProject(S, root);
  const src = P.byVersion.get(vNorm(from));
  if (!src) throw new Refused(`no workspace V${vNorm(from)} in ${P.root}`);
  const v = vNorm(to);
  if (!S.R.version.test(v)) throw new Usage(`"${to}" must look like V1.1 or V1.1-label`);
  const dst = path.join(P.root, 'V' + v);
  if (exists(dst)) throw new Refused(`${dst} already exists`);
  if (!exists(path.join(src.dir, 'intent-format.md'))) throw new Refused(`V${src.version} has no intent-format.md`);
  copyDir(src.dir, dst);
  fs.rmSync(path.join(dst, 'CHANGES.md'), { force: true });
  setManifest(S, path.join(dst, 'intent-format.md'), { version: v, lifecycle: 'in-progress', 'based-on': src.version });
  console.log(`V${v} created from V${src.version}`);
  regenProject(S, P.root);
}

const MDS = `node "${toPosix(path.join(STANDARD_DIR, 'kit', 'cli', 'intent-format.mjs'))}"`;

function cmdMigrate(S, pos, f) {
  const root = pos[0] || f.root;
  if (!root) throw new Usage('migrate <root>');
  const P = requireProject(S, root);
  const st = migrate(S, P, console.log);
  console.log(`migrate: ${st.renamed} file(s) renamed to ${S.standard} · ${st.created} role card(s) created · ${st.reused} reused across versions · ${st.kept} already there · ${st.workspaces} workspace(s) · ${st.problems} problem(s)`);
  regenProject(S, root);
  return st.problems ? 1 : 0;
}

function cmdNext(S, pos, f) {
  const root = path.resolve(pos[0] || f.root || '.');
  const P = exists(root) ? loadProject(S, root) : null;
  const n = nextStep(S, P, root, f.ws ? 'V' + vNorm(f.ws) : null);
  if (f.json) console.log(JSON.stringify(n, null, 2));
  else console.log(renderNext(n, MDS));
}

function cmdFrame(S, pos, f) {
  const [root, what] = pos;
  if (!root || !what) throw new Usage('frame <root> <screen core or name> [--ws V1.0] [--json]');
  const P = requireProject(S, root);
  const ws = pickWorkspace(P, f.ws);
  const key = what.replace(/^#/, '');
  const screens = ws.cards.filter((c) => c.type === 'screen');
  const hit = screens.find((c) => c.id === key) || screens.filter((c) => c.name.toLowerCase() === what.toLowerCase());
  const screen = Array.isArray(hit) ? (hit.length === 1 ? hit[0] : null) : hit;
  if (!screen) throw new Refused(Array.isArray(hit) && hit.length > 1 ? `several screens are named "${what}" — use the core` : `no screen ${what} in ${ws.folder}`);
  const rows = frameOf(S, ws, screen);
  if (f.json) console.log(JSON.stringify(rows.map((r) => ({ ...r, shell: r.shell ? { id: r.shell.id, name: r.shell.name } : null, variants: r.variants.map((v) => ({ core: v.core, name: v.name })) })), null, 2));
  else console.log(renderFrame(screen, rows));
}

function cmdOpen(S, pos, f) {
  let root = path.resolve(pos[0] || f.root || '.');
  let ws = f.ws ? 'V' + vNorm(f.ws) : null;
  if (exists(path.join(root, 'intent-format.md'))) { ws = ws || path.basename(root); root = path.dirname(root); }
  const P = requireProject(S, root);
  const w = ws ? P.workspaces.find((x) => x.folder === ws) : pickWorkspace(P, null);
  if (!w) throw new Refused(`no workspace ${ws} in ${root}`);
  checkProject(S, P, { ws: w.folder, skipGenerated: true });
  const o = openList(S, w);
  console.log(f.json ? JSON.stringify(o, null, 2) : renderOpen(o));
}

function cmdBuildKit(S) {
  const written = buildKit(S);
  console.log(`build-kit: ${written.length} file(s) changed`);
  for (const w of written) console.log(`  ${w}`);
}

/* ---------------- main ---------------- */

export function main(argv) {
  const S = loadSchema();
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const [cmd, ...pos] = args.pos;
  if (!cmd || args.flags.help || args.flags.h || cmd === 'help') { console.log(HELP); return cmd || args.flags.help || args.flags.h ? 0 : 2; }
  const table = { init: cmdInit, new: cmdNew, scaffold: cmdScaffold, mint: cmdMint, check: cmdCheck, regen: cmdRegen, branch: cmdBranch, next: cmdNext, frame: cmdFrame, migrate: cmdMigrate, open: cmdOpen, 'build-kit': cmdBuildKit };
  if (!table[cmd]) { console.error(`unknown command "${cmd}"\n\n${HELP}`); return 2; }
  // writing commands hold the project lock: parallel agents on one project take turns
  const writes = { init: pos[0], new: args.flags.root || '.', scaffold: pos[0] || args.flags.root, mint: args.flags.root || '.', regen: pos[0] || args.flags.root, branch: pos[0], migrate: pos[0] || args.flags.root };
  try {
    const run = () => table[cmd](S, pos, args.flags) || 0;
    return writes[cmd] ? withLock(path.resolve(writes[cmd]), run) : run();
  } catch (e) {
    if (e.locked) { console.error(e.message); return 1; }
    if (e instanceof Usage) { console.error(`usage: intent-format ${e.message}`); return 2; }
    if (e instanceof Refused) { console.error(e.message); return 1; }
    throw e;
  }
}

// Run when started as a program — directly, or through a link such as npm's `intent-format` bin — not when imported.
const realOf = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && realOf(process.argv[1]) === realOf(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
