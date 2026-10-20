#!/usr/bin/env node
// Role cards: stories resolve by name, ⚙ Stories, W049 / W050 / I029, mds migrate across
// versions (one core per role, archived skipped, idempotent), next sends old KBs to migrate.
//   node kit/cli/test/roles.mjs [--keep]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MDS = path.join(here, '..', 'mds.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mds-roles-'));
const R = path.join(tmp, 'kb');
const results = [];
let failed = 0;
const step = (name, pass, detail = '') => { results.push(`${pass ? '✓' : '✗'} ${name}${detail && !pass ? ' — ' + detail : ''}`); if (!pass) failed++; };
const mds = (...a) => { const r = spawnSync(process.execPath, [MDS, ...a], { encoding: 'utf8' }); return { code: r.status, out: r.stdout, err: r.stderr }; };
const get = (rel) => fs.readFileSync(path.join(R, rel), 'utf8');
const put = (rel, t) => { fs.mkdirSync(path.dirname(path.join(R, rel)), { recursive: true }); fs.writeFileSync(path.join(R, rel), t); };
const diags = () => JSON.parse(mds('check', R, '--json').out).diagnostics;
const has = (code) => diags().some((d) => d.code === code);

/* ---------- an old-style KB: Roles table, two versions, one archived ---------- */
mds('init', R, '--name', 'Kb');
const old = (p) => p.replace(/## Main use cases\n—/, '## Main use cases\n- As a Guest, I want to look around, so that I can decide.\n- As a Member, I want to buy, so that I get the thing.')
  .replace('## Vocabularies\n', '## Vocabularies\n### Roles\n| Role | Description | States |\n|---|---|---|\n| Guest | Looks around | Signed out |\n| Member | Buys things | Signed in |\n| Staff | Back office, not in this KB | |\n\n')
  .replace(/### States\n\| State \| Code \| Note \|\n\|---\|---\|---\|\n/, '### States\n| State | Code | Note |\n|---|---|---|\n| Signed out | SSO | |\n| Signed in | SSI | |\n');
put('V1.0/project.md', old(get('V1.0/project.md')));
step('old table still resolves stories (no W037)', !has('W037') && has('W050'));
mds('branch', R, 'V1.0', 'V1.1');
mds('branch', R, 'V1.1', 'V1.2');
put('V1.0/mdstandard.md', get('V1.0/mdstandard.md').replace(/lifecycle: .*/, 'lifecycle: archived'));
step('W050 silent in a read-only version', !diags().some((d) => d.code === 'W050' && d.path.startsWith('V1.0/')));
let n = JSON.parse(mds('next', R, '--json').out);
step('next sends an old KB to migrate', n.mode === 'migrate' && /mds migrate/.test(n.do[0]));

/* ---------- migrate ---------- */
let r = mds('migrate', R);
step('migrate runs', r.code === 0, r.out + r.err);
const cores = (ws) => fs.readdirSync(path.join(R, ws, 'roles')).filter((f) => f !== '_index.md').sort();
step('archived version untouched', (!fs.existsSync(path.join(R, 'V1.0', 'roles')) || !cores('V1.0').length) && /### Roles/.test(get('V1.0/project.md')));
step('one core per role across versions', JSON.stringify(cores('V1.1')) === JSON.stringify(cores('V1.2')) && cores('V1.1').length === 3, cores('V1.1').join(','));
step('table removed, module enabled', !/### Roles/.test(get('V1.1/project.md')) && /modules: \[roles,/.test(get('V1.1/mdstandard.md')));
const member = get('V1.2/roles/' + cores('V1.2').find((f) => f.includes('member')));
step('States column → state:, description kept', /^state: Signed in$/m.test(member) && /Buys things/.test(member));
step('⚙ Stories filled', /## ⚙ Stories\n- \[#PR000001 Kb\]\(\.\.\/project\.md\) · story: Main use cases/.test(member), member);
step('V1.2 role unchanged against V1.1', /· unchanged/.test(member));
r = mds('migrate', R);
step('migrate is idempotent', /0 role card\(s\) created · 0 reused/.test(r.out) && /regen: 0 file/.test(r.out), r.out);
const c = diags();
step('I029 for a role no story names (Staff)', c.filter((d) => d.code === 'I029').length === 2 && c.every((d) => d.code !== 'W049' && d.severity !== 'warning'), JSON.stringify(c.filter((d) => d.severity !== 'info')));

/* ---------- names resolve against cards now ---------- */
put('V1.2/project.md', get('V1.2/project.md').replace('- As a Member, I want to buy', '- As a Buyer, I want to buy'));
step('W037 when a story names no role card', has('W037'));
put('V1.2/project.md', get('V1.2/project.md').replace('- As a Buyer, I want to buy', '- As a Member, I want to buy'));
const dup = cores('V1.2').find((f) => f.includes('guest'));
put('V1.2/roles/ro000099-guest.md', get('V1.2/roles/' + dup).replace(/^id: RO\d+$/m, 'id: RO000099').replace(/· #RO\d+/, '· #RO000099'));
step('W049 for two roles with one name', has('W049'));
fs.rmSync(path.join(R, 'V1.2/roles/ro000099-guest.md'));

/* ---------- a role takes Links, Comments and decisions like any card ---------- */
const mfile = 'V1.2/roles/' + cores('V1.2').find((f) => f.includes('member'));
put(mfile, get(mfile).replace(/\n## ⚙ Stories/, '\n## Links\n- [Interview notes](https://example.com/notes) · type: Source\n\n## ⚙ Stories'));
const dc = mds('new', 'decision', 'Do members need a separate app?', '--root', R, '--ws', 'V1.2').out.trim().split(' ');
const mcore = /^id: (RO\d+)$/m.exec(get(mfile))[1];
put(dc[1], get(dc[1]).replace(/## Affects\n—/, `## Affects\n- #${mcore}`));
mds('regen', R);
const bad = diags().filter((d) => ['W017', 'W018'].includes(d.code));
step('Links on a role and decisions affecting it are legal', !bad.length, JSON.stringify(bad));
step('⚙ Decisions on the role', /## ⚙ Decisions\n- \[#DC/.test(get(mfile)), get(mfile));

/* ---------- scaffold puts roles first ---------- */
const inv = path.join(tmp, 'inv.md');
fs.writeFileSync(inv, '| # | Type | Name | Parent / home | Core |\n|---|---|---|---|---|\n| 1 | feature | Shop | | |\n| 2 | role | Courier | | |\n');
r = mds('scaffold', R, '--inventory', inv, '--ws', 'V1.2');
const lines = r.out.split('\n').filter((l) => /^(RO|FT)\d/.test(l));
step('scaffold creates roles before features', lines[0]?.startsWith('RO') && lines[1]?.startsWith('FT'), r.out);

console.log('mds roles test');
for (const l of results) console.log('  ' + l);
console.log(failed ? `FAILED (${failed})` : 'PASSED');
if (process.argv.includes('--keep')) console.log(`kept ${tmp}`); else fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
