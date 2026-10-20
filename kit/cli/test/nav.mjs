#!/usr/bin/env node
// Shell navigation and cold-start steering: stacked variants, one navigation list, the checks
// W017 / W048 / I027 / I028, mds frame, mds next through every phase, the lock, AGENTS.md.
//   node kit/cli/test/nav.mjs [--keep]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MDS = path.join(here, '..', 'mds.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mds-nav-'));
const R = path.join(tmp, 'shop');
const results = [];
let failed = 0;
const step = (name, pass, detail = '') => { results.push(`${pass ? '✓' : '✗'} ${name}${detail && !pass ? ' — ' + detail : ''}`); if (!pass) failed++; };
const mds = (...a) => { const r = spawnSync(process.execPath, [MDS, ...a], { encoding: 'utf8' }); return { code: r.status, out: r.stdout, err: r.stderr }; };
const put = (rel, t) => { fs.mkdirSync(path.dirname(path.join(R, rel)), { recursive: true }); fs.writeFileSync(path.join(R, rel), t); };
const get = (rel) => fs.readFileSync(path.join(R, rel), 'utf8');
const next = () => JSON.parse(mds('next', R, '--json').out);
const codes = () => JSON.parse(mds('check', R, '--json').out).diagnostics.map((d) => d.code);

/* ---------- cold start, phase by phase ---------- */
let n = next();
step('next: no project → set up', n.step === 1, JSON.stringify(n));
fs.mkdirSync(path.join(R, 'inputs'), { recursive: true });
put('inputs/brief.md', '# Brief\n\nA shop: guests browse, members buy.\n');
mds('init', R, '--name', 'Shop');
step('init writes AGENTS.md and CLAUDE.md', /mds\.mjs" next \./.test(get('AGENTS.md')) && get('CLAUDE.md') === '@AGENTS.md\n');
put('AGENTS.md', '# mine\n');
mds('regen', R);
step('regen never overwrites AGENTS.md', get('AGENTS.md') === '# mine\n');
n = next();
step('next: kickoff', n.step === 2 && !n.unattended);
put('inputs/kickoff-answers.md', 'Mode: unattended\n\n1. Unknown\n');
n = next();
step('next: proposal, unattended noticed', n.step === 3 && n.unattended);
const inv = ['# Inventory', '', '| # | Type | Name | Parent / home | Evidence | Confidence | Notes | Core |', '|---|---|---|---|---|---|---|---|',
  '| 1 | shell | Web shell | | brief | high | | |', '| 2 | screen | Home | | brief | high | | |', '| 3 | screen | Account | | brief | high | | |',
  '| 4 | screen | Sign in | | brief | high | | |', '| 5 | component | Header | | brief | high | | |', '| 6 | component | Account menu | | brief | high | | |',
  '| 7 | component | Burger | | brief | high | | |', '| 8 | ia | Main map | | brief | high | | |', ''].join('\n');
put('proposal/inventory.md', inv);
put('proposal/decisions.md', '| # | Question | Options | Recommendation | Why |\n|---|---|---|---|---|\n| D1 | One shell or two? | a) b) | a | same nav |\n');
n = next();
step('next: unattended review is written, not skipped', n.step === 4 && /Unattended/.test(n.do[0]));
put('proposal/review.md', 'Unattended — recommendations applied.\n');
n = next();
step('next: scaffold', n.step === 5 && /mds scaffold/.test(n.do[0]));
mds('scaffold', R, '--inventory', path.join(R, 'proposal/inventory.md'));
n = next();
step('next: fill project first', n.step === 6 && /project card/.test(n.do[0]), n.do?.[0]);

/* ---------- fill: vocabularies, shell, map, screens ---------- */
const ids = Object.fromEntries([...get('proposal/inventory.md').matchAll(/\| \d+ \| [a-z]+ \| ([^|]+?) \|.*\| ([A-Z]{2}\d{6}) \|/g)].map((m) => [m[1], m[2]]));
const ref = (name, folder) => `[#${ids[name]} ${name}](../${folder}/${ids[name].toLowerCase()}-${name.toLowerCase().replace(/ /g, '-')}.md)`;
const proj = get('V1.0/project.md');
put('V1.0/project.md', proj.replace(/## Description & Requirements\n—/, '## Description & Requirements\nA shop.')
  .replace(/### States\n[\s\S]*?(?=### Platforms)/, '### States\n| State | Code | Note |\n|---|---|---|\n| Guest | SGU | not signed in |\n| Member | SM | signed in |\n\n')
  .replace(/### Platforms\n[^#]*/, '### Platforms\n- Desktop web\n- Mobile web\n\n')
  .replace(/### Appears-as\n[^#]*/, '### Appears-as\n- Dropdown\n- Side panel\n\n'));
const shellFile = `V1.0/shells/${ids['Web shell'].toLowerCase()}-web-shell.md`;
put(shellFile, get(shellFile).replace('shell-type: —', 'shell-type: app').replace(/## Description & Requirements\n—/, '## Description & Requirements\nThe web frame.')
  .replace(/## Components\n—/, `## Components\n1. ${ref('Header', 'components')}`)
  .replace(/## Navigation\n—/, `## Navigation\n1. ${ref('Home', 'screens')} · kind: tab · in: Header\n2. ${ref('Sign in', 'screens')} · in: Header · state: Guest\n3. ${ref('Account', 'screens')} · kind: menu · in: Account menu · state: Member\n4. ${ref('Account', 'screens')} · in: Header`)
  .replace(/## Places inside\n—/, '## Places inside\n🚫 Never show navigation of your own.')
  + `\n## Variants\n### Mobile web · #HV000001\n<a id="hv000001"></a>\nplatform: Mobile web\n\n1. ${ref('Burger', 'components')}\n- Leads to: ${ref('Home', 'screens')}\n\n### Member · #HV000002\n<a id="hv000002"></a>\nstate: Member\n\n1. ${ref('Account menu', 'components')} · appears-as: Dropdown\n`);
mds('mint', 'HV', '--root', R, '--count', '2');
const homeFile = `V1.0/screens/${ids.Home.toLowerCase()}-home.md`;
put(homeFile, get(homeFile).replace(/## Description & Requirements\n—/, '## Description & Requirements\nThe start.').replace(/## Components\n—/, `## Components\n1. ${ref('Header', 'components')}`));
const accFile = `V1.0/screens/${ids.Account.toLowerCase()}-account.md`;
put(accFile, get(accFile).replace(/^status: —\n/m, 'status: —\nstate: Member\n'));
const mapFile = `V1.0/ia/${ids['Main map'].toLowerCase()}-main-map.md`;
put(mapFile, get(mapFile).replace(/## Parts\n—/, `## Parts\n- ${ref('Home', 'screens')}\n  - ${ref('Account', 'screens')}`));
const c = codes();
step('W017: navigation in a variant', c.includes('W017'));
step('I027: a shell part on a screen', c.includes('I027'));
step('I028: a line shown where its screen does not exist', c.filter((x) => x === 'I028').length === 1, c.join(' '));
step('W048 absent while every in: is a part', !c.includes('W048'));
put(shellFile, get(shellFile).replace('· in: Header\n', '· in: Footer\n').replace(/\n- Leads to: .*\n/, '\n'));
step('W048: in: names no part of the shell', codes().includes('W048'));
put(shellFile, get(shellFile).replace('· in: Footer\n', '· in: Header\n').replace(/\n4\. .* · in: Header\n/, '\n'));
put(homeFile, get(homeFile).replace(/## Components\n1\. .*\n/, '## Components\nnone\n'));
mds('regen', R);

/* ---------- frame: stacking and one list ---------- */
const fr = JSON.parse(mds('frame', R, 'Account', '--json').out);
const at = (p) => fr.find((r) => r.platform === p);
const mob = at('Mobile web');
step('frame: variants stack (Mobile web + Member)', mob && mob.variants.map((v) => v.name).join('+') === 'Mobile web+Member', JSON.stringify(mob?.variants));
step('frame: parts merge across variants', mob && mob.parts.map((p) => p.name).join(',') === 'Header,Burger,Account menu', JSON.stringify(mob?.parts));
step('frame: navigation filtered by state, entry placed by in:', mob && mob.navigation.map((x) => `${x.name}@${x.in}`).join(',') === 'Home@Header,Account@Account menu', JSON.stringify(mob?.navigation));
const txt = mds('frame', R, 'Account').out;
step('frame: identical frames print once, contract once', (txt.match(/Places inside —/g) || []).length === 1 && /at {5}Main map › Home › Account · Member — Desktop web/.test(txt), txt);

/* ---------- resolution: platform skip, stepper of a flow, flow platform ---------- */
const area = mds('new', 'shell', 'Account area', '--root', R).out.trim().split(' ');
put(area[1], get(area[1]).replace('shell-type: —', 'shell-type: section\nplatform: Desktop web'));
put(mapFile, get(mapFile).replace(/(  - \[#SC\d+ Account\]\([^)]*\))/, `$1 · shell: #${area[0]}`));
let fa = JSON.parse(mds('frame', R, 'Account', '--json').out);
step('a node binding applies where the shell fits the platform', fa.find((r) => r.platform === 'Desktop web' && r.where.startsWith('Main map'))?.shell?.id === area[0]);
step('a node binding to a desktop-only shell is skipped on mobile', fa.find((r) => r.platform === 'Mobile web' && r.where.startsWith('Main map'))?.shell?.id === ids['Web shell']);
const st = mds('new', 'shell', 'Sign-in stepper', '--root', R).out.trim().split(' ');
put(st[1], get(st[1]).replace('shell-type: —', 'shell-type: stepper\nflow: UF000777'));
const { loadSchema } = await import('../lib/schema.mjs');
const { loadProject } = await import('../lib/project.mjs');
const { resolvePlacement } = await import('../lib/frame.mjs');
const S2 = loadSchema(), P2 = loadProject(S2, R), ws2 = P2.workspaces[0];
const signIn = ws2.cards.find((c) => c.name === 'Sign in');
const rp = resolvePlacement(S2, ws2, { screen: signIn, platform: 'Desktop web', state: 'Guest', depth: null, flow: { id: 'UF000777', name: 'Sign in' } });
step('a step of a flow gets that flow’s stepper by default', rp.shell?.id === st[0] && /stepper/.test(rp.via), rp.via);
const rp2 = resolvePlacement(S2, ws2, { screen: signIn, platform: 'Desktop web', state: 'Guest', depth: 1 });
step('the same screen on the map keeps the app shell', rp2.shell?.id === ids['Web shell']);
const st2 = mds('new', 'shell', 'Second stepper', '--root', R).out.trim().split(' ');
put(st2[1], get(st2[1]).replace('shell-type: —', 'shell-type: stepper\nflow: UF000777'));
step('W045: two steppers for one flow', codes().filter((x) => x === 'W045').length >= 1);
for (const f of [st[1], st2[1], area[1]]) fs.rmSync(path.join(R, f));
put(mapFile, get(mapFile).replace(/ · shell: #SH\d+/, ''));
mds('regen', R);

/* ---------- next during fill, then the end ---------- */
n = next();
step('next: fill order (shell before screen, decisions counted)', n.step === 6 && !/shell card/.test(n.do[0]), n.do?.join(' | '));
put('report.md', '# Report\n');
n = next();
step('next: report present → ongoing', n.mode === 'ongoing');

/* ---------- lock ---------- */
fs.mkdirSync(path.join(R, '.mds.lock'));
const t0 = Date.now();
const locked = spawn(process.execPath, [MDS, 'mint', 'FS', '--root', R]);
let lockedOut = '';
locked.stdout.on('data', (d) => (lockedOut += d));
setTimeout(() => fs.rmSync(path.join(R, '.mds.lock'), { recursive: true, force: true }), 600);
await new Promise((res) => locked.on('close', res));
step('lock: a writer waits for the lock, then runs', /^FS\d{6}$/m.test(lockedOut) && Date.now() - t0 >= 500 && !fs.existsSync(path.join(R, '.mds.lock')));
const par = await Promise.all([0, 1, 2, 3].map(() => new Promise((res) => { let o = ''; const p = spawn(process.execPath, [MDS, 'mint', 'CV', '--root', R, '--count', '5']); p.stdout.on('data', (d) => (o += d)); p.on('close', () => res(o.trim().split('\n'))); })));
const all = par.flat();
step('lock: parallel mints never collide', all.length === 20 && new Set(all).size === 20, all.join(' '));

console.log('mds navigation + next test');
for (const l of results) console.log('  ' + l);
console.log(failed ? `FAILED (${failed})` : 'PASSED');
if (process.argv.includes('--keep')) console.log(`kept ${tmp}`); else fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
