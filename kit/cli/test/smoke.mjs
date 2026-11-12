#!/usr/bin/env node
// End-to-end smoke test for intent-format. Runs in a temp dir; `--save <dir>` copies the final KB there.
//   node kit/cli/test/smoke.mjs [--save examples/example-app] [--keep]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MDS = path.join(here, '..', 'intent-format.mjs');
const STD = path.resolve(here, '..', '..', '..');
const schema = JSON.parse(fs.readFileSync(path.join(STD, 'schema.json'), 'utf8'));
const args = process.argv.slice(2);
const saveTo = args.includes('--save') ? path.resolve(args[args.indexOf('--save') + 1]) : null;
const keep = args.includes('--keep');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mds-smoke-'));
const R = path.join(tmp, 'example-app');
const results = [];
let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error(`FAIL ${what}`); } return !!cond; };
const step = (name, pass, detail = '') => { results.push(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); if (!pass) failed++; };

function mds(...a) {
  const r = spawnSync(process.execPath, [MDS, ...a], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
function hashTree(dir) {
  const h = crypto.createHash('sha256');
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { h.update(path.relative(dir, p)); h.update(fs.readFileSync(p)); }
    }
  };
  walk(dir);
  return h.digest('hex');
}
const read = (rel) => fs.readFileSync(path.join(R, rel), 'utf8');
const write = (rel, t) => fs.writeFileSync(path.join(R, rel), t);
function checkCounts(root, extra = []) {
  const r = mds('check', root, '--json', ...extra);
  const j = JSON.parse(r.out);
  return { ...j.counts, json: j, code: r.code };
}
const showProblems = (j) => j.diagnostics.filter((d) => d.severity !== 'info').slice(0, 20).forEach((d) => console.error(`  ${d.severity} ${d.code} ${d.path}:${d.line} ${d.message}`));

/* ---------- 1. init into an existing root with inputs/ ---------- */
fs.mkdirSync(path.join(R, 'inputs'), { recursive: true });
const brief = '# Product brief\n\nExample app: a Member keeps a personal list of items and can create, browse and change them.\n';
fs.writeFileSync(path.join(R, 'inputs', 'brief.md'), brief);
const links = '# Links\n\n- [Screen designs](https://example.com/designs) — every screen of Example app\n';
fs.writeFileSync(path.join(R, 'inputs', 'links.md'), links);
let r = mds('init', R, '--name', 'Example app', '--kb', 'example-app');
step('init (existing inputs/ kept)', r.code === 0 && read('inputs/brief.md') === brief && read('inputs/links.md') === links
  && fs.existsSync(path.join(R, '_ids.md')) && fs.existsSync(path.join(R, 'V1.0/project.md')), r.err.trim());
r = mds('init', R, '--name', 'Example app');
step('init refuses an existing manifest', r.code === 1);

/* ---------- 2. new cards of every type ---------- */
const C = {}; const F = {};
function make(key, type, name, ...extra) {
  const res = mds('new', type, name, '--root', R, ...extra);
  const m = /^([A-Z]{2}\d{6}) (\S.*)$/.exec(res.out.trim());
  if (!ok(res.code === 0 && m, `new ${type} "${name}": ${res.err}`)) return;
  C[key] = m[1]; F[key] = m[2];
}
make('Member', 'role', 'Member');
make('Admin', 'role', 'Admin');
make('Items', 'feature', 'Items');
make('Account', 'feature', 'Account');
make('Browse', 'feature', 'Browse items', '--parent', C.Items);
make('EditF', 'feature', 'Edit an item', '--parent', C.Items);
make('SettingsF', 'feature', 'Change settings', '--parent', C.Account);
make('UI', 'tech', 'UI framework');
make('DB', 'tech', 'Relational database');
make('Server', 'backend', 'App server');
make('MainDb', 'backend', 'Main database');
make('Files', 'backend', 'File storage');
make('List', 'api', 'List items');
make('Save', 'api', 'Save item');
make('Button', 'component', 'Button');
make('Field', 'component', 'Text field');
make('Row', 'component', 'Item row', '--feature', C.Browse);
make('Bar', 'component', 'Top bar');
make('Home', 'screen', 'Home');
make('ItemList', 'screen', 'Item list', '--feature', C.Browse);
make('Detail', 'screen', 'Item detail', '--feature', C.Browse);
make('EditS', 'screen', 'Edit item', '--feature', C.EditF);
make('Settings', 'screen', 'Settings', '--feature', C.SettingsF);
make('Map', 'ia', 'Main map');
make('Create', 'userflow', 'Create an item', '--feature', C.EditF);
make('EditFlow', 'userflow', 'Edit an item', '--feature', C.EditF);
make('NameRule', 'rule', 'Item name is required');
make('SaveFails', 'edge-case', 'Save fails');
make('Images', 'decision', 'Where do item images live?');
make('EmptyMsg', 'comment', 'Empty-list message');
C.Project = 'PR000001'; F.Project = 'V1.0/project.md';
const mint = (p, n) => { const x = mds('mint', p, '--root', R, '--count', String(n)); ok(x.code === 0, `mint ${p}`); return x.out.trim().split('\n'); };
const fs1 = mint('FS', 5), fs2 = mint('FS', 4), [sv1] = mint('SV', 1), [cv1] = mint('CV', 1);
fs1.forEach((c, i) => { C['S' + (i + 1)] = c; });
fs2.forEach((c, i) => { C['S' + (i + 6)] = c; });
C.Picker = sv1; C.Compact = cv1;
step('new + mint', Object.keys(C).length === 42 && new Set(Object.values(C)).size === 42 && fs1[0] === 'FS000001' && fs2[0] === 'FS000006', `${Object.keys(C).length - 11} cards, 11 sub-document cores`);

/* ---------- 3. fill the cards (hand references; regen upgrades them) ---------- */
const sub = (t) => t.replace(/\{(\w+)\}/g, (m, k) => (C[k] ? '#' + C[k] : m));
function fill(key, fm, body) {
  const rel = F[key];
  const lines = read(rel).split('\n');
  const end = lines.indexOf('---', 1);
  const type = lines.find((l) => l.startsWith('type: ')).slice(6);
  const order = schema.types[type].keys.map((k) => k.replace(/\?$/, ''));
  const entries = new Map(lines.slice(1, end).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 2)]));
  for (const [k, v] of Object.entries(fm)) entries.set(k, v);
  const fmOut = order.filter((k) => entries.has(k)).map((k) => `${k}: ${entries.get(k)}`);
  const title = lines[end + 1];
  write(rel, ['---', ...fmOut, '---', title, '', sub(body).trim(), ''].join('\n'));
}

fill('Project', { status: 'In design' }, `
## Description
A small app in which a Member keeps a list of items: create, browse and change them.

## Why
Members lose track of things kept in notes and chats; one list that is always at hand fixes that.

## User stories
- As a Member, I want to create an item, so that I can keep track of it.
- As a Member, I want to browse my items, so that I find one quickly.
- As a Member, I want to edit an item, so that its details stay current.
- As a Member, I want to change my settings, so that the app fits how I work.
- As an Admin, I want to review all items, so that the list stays clean.

## Keep in mind
**R1 · Checklist**
- [ ] The Item list opens in under one second with 1000 items.
- [ ] Every screen works with the keyboard alone.

## Vocabularies
### States
| State | Code | Note |
|---|---|---|

### Platforms
- Web
- Mobile

### Opens-as
- Side panel — opens beside the current page

### Tech categories
- Frontend
- Data & storage

## Built with
- {UI}
- {DB}
- [~ Graph canvas library]

## Links
- [Product brief](../inputs/brief.md) · type: Source`);

fill('Member', { status: 'In design', platform: '[Web, Mobile]' }, `
## Description
Keeps a personal list of items; mostly on the phone, several times a week.

## Why
The product exists for this user; every story names them.`);
fill('Admin', { status: 'Idea', platform: 'Web' }, `
## Description
Reviews the items of all Members, on the web.

## Why
Someone has to keep the shared list clean. [likely]`);
fill('Items', { status: 'In design', priority: 'High' }, `
## Description
Members need one dependable place for the things they keep track of.

In scope: finding, creating and changing items. Out of scope: sharing items with other people.

## Why
Keeping track of things is the reason the app exists. [confirmed]`);
fill('Account', { status: 'Idea', priority: 'Medium' }, `
## Description
Members need to adjust the app to how they work.

In scope: personal settings. Out of scope: settings shared between Members.

## Why
Members asked for a dark theme in the first interviews. [assumed]`);
fill('Browse', { status: 'In design', priority: 'High' }, `
## Description
Lets a Member find an item in their list.

**R1 · User story** As a Member, I want to browse my items, so that I find one quickly.

## Why
same as #${C.Items}`);
fill('EditF', { status: 'In design', priority: 'High' }, `
## Description
Lets a Member create an item or change its details.

**R1 · User story** As a Member, I want to change an item's details, so that my list stays accurate.

## Why
A list nobody can change goes stale within a week.

## Touchpoints
- {Field} — name entry`);
fill('SettingsF', { status: 'Idea' }, `
## Description
Lets a Member change their personal settings.

**R1 · User story** As a Member, I want to change my settings, so that the app fits how I work.

## Why
One app, many working habits.`);
fill('UI', { status: 'Adopted', category: 'Frontend' }, `
## Description
Renders every screen and component of the app.

## Why
One component model for the web and mobile screens.

## Alternatives
none`);
fill('DB', { status: 'Adopted', category: 'Data & storage', 'tech-version': '"16"', license: 'Open source' }, `
## Description
Keeps items and settings in tables with transactions.

## Why
Items have a fixed shape and need safe concurrent updates.

## Alternatives
- [~ Document database]`);
fill('Server', { status: 'In build', 'backend-type': 'server' }, `
## Description
Serves the item APIs and reads and writes the stored data.

## Connections
- {MainDb} · kind: stores
- {Files} · kind: stores

## Built with
- [~ Server runtime]`);
fill('MainDb', { status: 'In build', 'backend-type': 'database' }, `
## Description
Stores items and settings.

## Connections
none

## Built with
- {DB}`);
fill('Files', { status: 'Idea', 'backend-type': 'storage' }, `
## Description
Keeps files attached to items.

## Connections
none`);
fill('List', { status: 'In build', method: 'GET', endpoint: '/items' }, `
## Description
Returns the items of the signed-in Member, newest first.

## Served by
- {Server}`);
fill('Save', { status: 'In build', method: 'PUT', endpoint: '/items/{id}' }, `
## Description
Creates or updates one item and returns the stored version.

## Served by
- {Server}`);
fill('Button', { status: 'Live', 'component-type': 'atom' }, `
## Description
Starts one action when chosen.

## Why
none — layout only

## Components
none`);
fill('Field', { status: 'Live', 'component-type': 'atom' }, `
## Description
Lets the user type one line of text.

**R1 · GWT**
Given an empty Text field
When the user types a name
Then the name is shown in the field

## Components
none`);
fill('Row', { status: 'In design', 'component-type': 'molecule' }, `
## Description
Shows one item's name in a list and opens the item when chosen.

## Why
same as #${C.Browse}

## Do & Don'ts
✅ Show the whole name on one line and cut it at the end.
🚫 Don't put more than one button in a row.

## Components
1. {Button} — opens the item

## Variants
### Compact · {Compact}

none`);
fill('Bar', { status: 'In design', 'component-type': 'organism' }, `
## Description
Shows the title of the current screen and its main action.

## Components
1. {Button} — main action

## Built with
- {UI}`);
fill('Home', { status: 'In design' }, `
## Description
The starting point of the app.

## Components
1. {Bar}`);
fill('ItemList', { status: 'In design' }, `
## Description
Shows all of a Member's items as rows; choosing a row opens Item detail.

**R1 · GWT**
Given a Member with no items
When the Item list opens
Then an empty-list message and a create button are shown

## Components
1. {Bar}
2. {Row} — one per item
3. {Button} — creates an item

## Variants
### Picker · {Picker}
opens-as: Side panel

1. {Row} · variant: Compact

## APIs
- {List}

## Comments
- {EmptyMsg}`);
fill('Detail', { status: 'In design' }, `
## Description
Shows one item with all its details.

## Components
1. {Bar}
2. {Button} — edits the item`);
fill('EditS', { status: 'In design', 'opens-as': 'Side panel' }, `
## Description
Lets a Member change an item's name and notes.

## Rules
- {NameRule}

## Components
1. {Bar}
2. {Field} — item name
3. {Button} — saves the item

## APIs
- {Save}`);
fill('Settings', { status: 'Idea' }, `
## Description
Lets a Member change how the app behaves.

## Components
1. {Bar}`);
fill('Map', { status: 'In design', default: 'true' }, `
## Description
How the places of Example app are arranged for every Member.

## Parts
- {Home}
  - {ItemList} · group: Items
    - {Detail} · group: Items
      - {EditS} · opens-as: Side panel · group: Items
  - {Settings}

### Lateral
- Edge: {Settings} → {ItemList} · label: Back to items`);
fill('Create', { status: 'In design' }, `
## Description
A Member adds a new item from the Item list and returns to the list with the item saved.

## Why
The main use case of Items: without it nothing gets into the list.

## Step list
1. {S1}
2. {S2}
3. {S3}
4. {S4}
5. {S5}

### Quick add
platform: Mobile

1. {S1}
2. {S2}
3. {S4}
4. {S5}

## Steps
### ○ Start from the list · {S1}
- Entry: the Member taps Create on the Item list.
- Screen: {ItemList}

### □ Enter item details · {S2}
- Screen: {EditS}
- Component: {Field}

The Member types a name and optional notes.

### ◇ Name valid? · {S3}
- Branch: Yes → {S4} · primary
- Branch: No → {S2} · rule: {NameRule}

### ⚡ Save the item · {S4}
- API: {Save}

### ◎ Item created · {S5}
- Outcome: the new item is saved and shown on the Item list.
- Screen: {ItemList}`);
fill('EditFlow', { status: 'In design' }, `
## Description
A Member changes an existing item and returns to its details.

## Why
Details change; the list must follow.

## Step list
1. {S6}
2. {S7}
3. {S8}
4. {S9}

## Steps
### ○ Open the item · {S6}
- Entry: the Member chooses an item on the Item list.
- Screen: {Detail}

### □ Change the details · {S7}
- Screen: {EditS}
- Component: {Field}

### ⚡ Save the changes · {S8}
- API: {Save}
- Applies rule: {NameRule}

### ◎ Item updated · {S9}
- Outcome: the changes are saved and shown on Item detail.
- Screen: {Detail}`);
fill('NameRule', { status: 'Approved' }, `
## Description
**R1 · EARS** If the item name is empty, then the system shall refuse to save the item and say why.

## Why
An item without a name cannot be found again in the list.`);
fill('SaveFails', { status: 'Idea', severity: 'Medium' }, `
## Description
**R1 · GWT**
Given a Member editing an item
When Save item does not answer in time
Then the edits stay on screen and a retry option is shown

## Rules
none

## Where
- {EditS}
- {S4}
- {Save}`);
fill('Images', { status: 'Open' }, `
## Question
Should item images be kept in File storage or inside the Main database?

## Why
Images are the largest data the app stores; where they live decides backup and cost.

## Options
1. File storage — cheap and fast to serve; needs a cleanup job.
2. Main database — one backup for everything; larger tables.

## Outcome
—

## Affects
- {Files}
- {Save}`);
fill('EmptyMsg', { status: 'Open', author: 'Product owner' }, `
Should the empty Item list also offer to import items? Only if it is cheap.`);

/* ---------- 4. regen, check, idempotency ---------- */
r = mds('regen', R);
step('regen', r.code === 0, r.out.split('\n')[0]);
let k = checkCounts(R);
if (k.error || k.warning) showProblems(k.json);
step('check after regen', k.error === 0 && k.warning === 0 && k.code === 0, `${k.error} errors · ${k.warning} warnings · ${k.info} infos`);
const hw = k.json.health[0];
step('why and confidence counted', hw.why.filled === 13 && hw.why.inherited === 2 && hw.why.none === 1 && hw.why.missing === 0 && hw.confidence.assumed === 1 && hw.confidence.likely === 1
  && hw.blindSpotsByKind.why === 0 && !read(F.Items).includes('[confirmed]') && read(F.Items).includes('reason the app exists.\n'), JSON.stringify({ why: hw.why, confidence: hw.confidence }));
let h1 = hashTree(R);
r = mds('regen', R);
let h2 = hashTree(R);
step('regen is idempotent', h1 === h2 && /regen: 0 file/.test(r.out), r.out.split('\n')[0]);

// spot checks of generated content
const has = (key, text) => read(F[key]).includes(sub(text));
ok(has('ItemList', '> ⚙ {ItemList}V1.0 · V1.0 in-progress'), 'status line V1.0');
ok(has('Create', '1. [{S1} Start from the list](#fs000001)'), 'hand step reference upgraded to bound');
ok(has('Create', '<a id="fs000003"></a>'), 'anchor inserted');
ok(has('Row', `- [{ItemList} Item list](../screens/${path.basename(F.ItemList)}) · at: {Picker}`), '⚙ Used in with at:');
ok(has('Button', `· via: {Bar}`) && has('Button', '## ⚙ Used in'), '⚙ Used in with via:');
ok(has('NameRule', '## ⚙ Applied in') && has('NameRule', '· at: {S3}') && has('NameRule', '· at: {S8}'), '⚙ Applied in');
ok(has('Save', '## ⚙ Called from') && has('Save', '· at: {S4}') && has('Save', '## ⚙ Edge cases') && has('Save', '· status: Open'), '⚙ Called from / Edge cases / Decisions');
ok(has('EditF', '## ⚙ Also uses') && has('EditF', '· home: {Browse}') && has('EditF', '## ⚙ User flows'), '⚙ Also uses / User flows');
ok(has('Items', '## ⚙ Sub-features') && has('Items', '— Lets a Member find an item in their list.'), '⚙ Sub-features with one-liner');
ok(has('UI', '## ⚙ Used by') && has('UI', '[#PR000001 Example app](../project.md)'), '⚙ Used by');
ok(has('EmptyMsg', '## ⚙ Attached to'), '⚙ Attached to');
ok(has('Home', '## ⚙ On maps') && has('ItemList', '· under: {Home}'), '⚙ On maps');
ok(has('Server', '## ⚙ Serves') && has('MainDb', '## ⚙ Connected from') && has('MainDb', '· kind: stores'), '⚙ Serves / Connected from');
ok(has('Field', '## ⚙ Features') && has('Browse', '## ⚙ Screens') && has('Browse', '## ⚙ Components'), '⚙ Features / Screens / Components');
ok(read('V1.0/screens/_index.md').includes('| Feature | One-liner | Blind spots |'), 'roster columns');
ok(read('_ids.md').includes(`| ${C.Picker} | screen-variant | Picker | 1.0 |`), '_ids.md lists sub-documents');
ok(has('Member', '## ⚙ Stories') && has('Member', '[#PR000001 Example app](../project.md) · story: User stories') && has('Member', '{Browse}') && has('Member', '· story: R1'), '⚙ Stories on a role');
ok(has('Admin', '· story: User stories') && !has('Admin', '{Browse}'), '⚙ Stories only for the role named');
step('generated sections', failed === 0);

/* ---------- 5. release V1.0, branch V1.0 → V1.1, change one card ---------- */
write('V1.0/intent-format.md', read('V1.0/intent-format.md').replace('lifecycle: in-progress', 'lifecycle: released'));
r = mds('regen', R);
ok(read(F.Home).includes('V1.0 released'), 'status line follows the lifecycle');
r = mds('branch', R, 'V1.0', 'V1.1');
const v11 = (key) => F[key].replace(/^V1\.0\//, 'V1.1/');
const man = read('V1.1/intent-format.md');
step('branch', r.code === 0 && man.includes('version: "1.1"') && man.includes('based-on: "1.0"') && man.includes('lifecycle: in-progress')
  && read(v11('ItemList')).includes('· based on V1.0 · unchanged'), r.err.trim());
const il = read(v11('ItemList')).replace('3. [#' + C.Button, `4. #${C.Field} — filters the list\n3. [#${C.Button}`);
write(v11('ItemList'), il);
r = mds('new', 'comment', 'Filter placement', '--root', R, '--ws', 'V1.1');
const nm = /^(CM\d{6}) (\S+)$/.exec(r.out.trim());
ok(nm, 'new in V1.1');
if (nm) {
  const t = read(nm[2]).replace('author: —', 'author: Designer').replace(/\n—\n$/, '\nShould the filter field sit in the Top bar instead?\n');
  write(nm[2], t);
}
r = mds('regen', R);
const ilText = read(v11('ItemList'));
const changes = read('V1.1/CHANGES.md');
step('change detection', r.code === 0 && ilText.includes('> ⚙ #' + C.ItemList + 'V1.1 · V1.1 in-progress · based on V1.0 · changed: Components')
  && /3\. \[#CP000002 Text field\]/.test(ilText) && changes.includes('## ⚙ Changed') && changes.includes(`· changed: Components`)
  && changes.includes('## ⚙ New') && nm && changes.includes(nm[1]) && read(v11('Home')).includes('· unchanged'),
  ilText.split('\n').find((l) => l.startsWith('> ⚙')));
k = checkCounts(R);
if (k.error || k.warning) showProblems(k.json);
h1 = hashTree(R); r = mds('regen', R); h2 = hashTree(R);
step('check + idempotency after branch', k.error === 0 && k.warning === 0 && h1 === h2, `${k.error} errors · ${k.warning} warnings · ${k.info} infos; second regen: ${r.out.split('\n')[0]}`);

/* ---------- 5b. scaffold from an inventory; incomplete-list marker; --lifecycle ---------- */
const Q = path.join(tmp, 'scaffold-kb');
mds('init', Q, '--name', 'Scaffold check', '--lifecycle', 'planned');
const inv = path.join(tmp, 'inventory.md');
fs.writeFileSync(inv, ['# Inventory — Scaffold check', '',
  '| # | Type | Name | Parent / home | Evidence | Confidence | Notes | Core |',
  '|---|---|---|---|---|---|---|---|',
  '| 1 | project | Scaffold check | | K1 | high | | |',
  '| 2 | screen | Item list | Browse items | inputs/a.html — `<h1>` | high | | |',
  '| 3 | feature | Browse items | Items | K6 | high | | |',
  '| 4 | feature | Items | | K6 | high | | |',
  '| 5 | tech | UI framework | | K16 | high | | |',
  '| 6 | component | Item row | Browse items | inputs/a.html | medium | | |',
  '| 7 | userflow | Create an item | Browse items | K15 | high | | |',
  '| 8 | rule | Item name is required | | doc | high | kept | RL000009 |', ''].join('\n'));
r = mds('scaffold', Q, '--inventory', inv);
const invText = fs.readFileSync(inv, 'utf8');
const coreOf = (name) => (new RegExp(`^\\| \\d+ \\| [a-z-]+ \\| ${name} \\|[^\\n]*\\| ([A-Z]{2}\\d{6}) \\|$`, 'm').exec(invText) || [])[1];
const qf = (rel) => fs.readFileSync(path.join(Q, rel), 'utf8');
const scafOk = r.code === 0 && coreOf('Items') === 'FT000001' && coreOf('Browse items') === 'FT000002' && coreOf('Item list') === 'SC000001'
  && coreOf('UI framework') === 'TC000001' && coreOf('Create an item') === 'UF000001' && coreOf('Item name is required') === 'RL000009'
  && qf('V1.0/features/ft000002-browse-items.md').includes('parent: FT000001') && qf('V1.0/screens/sc000001-item-list.md').includes('feature: FT000002')
  && qf('V1.0/components/cp000001-item-row.md').includes('feature: FT000002');
const r2 = mds('scaffold', Q, '--inventory', inv);
step('scaffold', scafOk && /scaffold: 6 created/.test(r.out) && /scaffold: 0 created/.test(r2.out) && fs.readFileSync(inv, 'utf8') === invText, r.out.trim().split('\n').pop());
const scr = path.join(Q, 'V1.0/screens/sc000001-item-list.md');
fs.writeFileSync(scr, fs.readFileSync(scr, 'utf8').replace(/## Components\n—/, '## Components\n1. #CP000001\n2. —'));
mds('regen', Q);
k = checkCounts(Q);
if (k.error || k.warning) showProblems(k.json);
step('incomplete-list marker + lifecycle', k.error === 0 && k.warning === 0 && k.json.health[0].blindSpotsByKind.lists === 1 && qf('V1.0/screens/sc000001-item-list.md').includes('V1.0 planned'),
  `blind spots ${k.json.health[0].blindSpots}: ${JSON.stringify(k.json.health[0].blindSpotsByKind)}`);

/* ---------- 5c. why values, decision keys, Source links, open ---------- */
const dec = mds('new', 'decision', 'Keep it simple?', '--root', Q);
const dm = /^(DC\d{6}) (\S+)$/.exec(dec.out.trim());
ok(dm, 'new decision in scaffold KB');
const dpath = path.join(Q, dm[2]);
const decText = (fm, source) => `---\nstandard: ${schema.standard}\ntype: decision\nid: ${dm[1]}\nname: Keep it simple?\nstatus: Decided\n${fm}---\n# Keep it simple? · #${dm[1]}\n\n## Question\nKeep it simple?\n\n## Why\nIt decides the shape of everything else.\n\n## Options\n1. Yes\n2. No\n\n## Outcome\nYes. [assumed]\n\n## Affects\nnone\n\n## Links\n- [Owner note](${source}) · type: Source\n`;
fs.writeFileSync(dpath, decText('', '../../notebook/raw/note.md'));
const tech = path.join(Q, 'V1.0/tech/tc000001-ui-framework.md');
fs.writeFileSync(tech, fs.readFileSync(tech, 'utf8').replace(/## Why\n—/, '## Why\nsame as #ZZ999999'));
const comp = path.join(Q, 'V1.0/components/cp000001-item-row.md');
fs.writeFileSync(comp, fs.readFileSync(comp, 'utf8').replace(/## Description\n—/, '## Description\n—\n\n## Why\nsame as #FT000002'));
k = checkCounts(Q);
const codes = (j) => new Set(j.diagnostics.map((d) => d.code));
let cs = codes(k.json);
const hq = k.json.health[0];
step('W052 · W053 · W051 · I030 reported', cs.has('W052') && cs.has('W053') && cs.has('W051') && cs.has('I030') && hq.confidence.assumed === 1 && hq.why.inherited === 0,
  [...cs].filter((c) => /^(W05[123]|I03[01])$/.test(c)).join(' ') + ` · why ${JSON.stringify(hq.why)}`);
fs.writeFileSync(dpath, decText('decided: 2026-11-10\nby: owner\n', '../../inputs/note.md'));
fs.writeFileSync(tech, fs.readFileSync(tech, 'utf8').replace(/## Why\nsame as #ZZ999999/, '## Why\nnone'));
const feat = path.join(Q, 'V1.0/features/ft000002-browse-items.md');
fs.writeFileSync(feat, fs.readFileSync(feat, 'utf8').replace(/## Why\n—/, '## Why\nFinding things is the point.').replace(/## Description\n—/, '## Description\nA Member finds an item by name [ask: also by tag?]; the list is sorted by date [ask: newest first? · later 2026-11-12].'));
k = checkCounts(Q);
cs = codes(k.json);
const op = mds('open', Q);
step('decision keys and Source fixed; intent-format open lists the assumed Outcome', !cs.has('W052') && !cs.has('W053') && !cs.has('W051') && !cs.has('I030') && k.json.health[0].why.inherited === 1
  && op.code === 0 && op.out.includes(`#${dm[1]} Keep it simple? · Outcome`) && op.out.includes('Why missing (why debt) (')
  && k.json.health[0].asks.open === 1 && k.json.health[0].asks.later === 1 && op.out.includes('Questions to the owner ([ask: …]) (2)') && op.out.includes('also by tag?') && op.out.includes('later 2026-11-12'),
  op.out.split('\n').slice(0, 5).join(' | ') + ` · asks ${JSON.stringify(k.json.health[0].asks)}`);

// a "later" ask older than ask.again days is due: counted, flagged, listed first
fs.writeFileSync(feat, fs.readFileSync(feat, 'utf8').replace('[ask: newest first? · later 2026-11-12]', '[ask: newest first? · later 2020-01-01]'));
k = checkCounts(Q);
const op2 = mds('open', Q);
step('a later ask past ask.again days is due and listed first', k.json.health[0].asks.due === 1 && k.json.health[0].asks.later === 1 && op2.code === 0
  && op2.out.includes('later 2020-01-01 · due — ask again') && op2.out.indexOf('newest first?') < op2.out.indexOf('also by tag?'),
  `asks ${JSON.stringify(k.json.health[0].asks)}`);

/* ---------- 6. templates pass check in a fresh workspace ---------- */
const T = path.join(tmp, 'templates-kb');
mds('init', T, '--name', 'Template check');
const TPL = path.join(STD, 'templates');
let tplOk = fs.existsSync(TPL);
for (const type of schema.typeRoster) {
  const f = path.join(TPL, `${type}.md`);
  if (!fs.existsSync(f)) { tplOk = false; continue; }
  const text = fs.readFileSync(f, 'utf8');
  const id = /^id: (\S+)$/m.exec(text)[1], name = /^name: (.+)$/m.exec(text)[1];
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dest = type === 'project' ? path.join(T, 'V1.0', 'project.md') : path.join(T, 'V1.0', schema.types[type].folder, `${id.toLowerCase()}-${slug}.md`);
  fs.writeFileSync(dest, text);
}
k = checkCounts(T);
if (k.error || k.warning) showProblems(k.json);
step('templates pass check', tplOk && k.error === 0 && k.warning === 0, `${k.error} errors · ${k.warning} warnings · ${k.info} infos`);

/* ---------- 7. schema examples assembled into a KB ---------- */
const E = path.join(tmp, 'schema-examples');
mds('init', E, '--name', 'Example app', '--kb', 'example-app');
const exFiles = new Map();
for (const type of schema.typeRoster) {
  const t = schema.types[type];
  for (const ex of [t.example, t.exampleSubfeature].filter(Boolean)) {
    const id = /^id: (\S+)$/m.exec(ex)[1], name = /^name: (.+)$/m.exec(ex)[1];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const rel = type === 'project' ? 'V1.0/project.md' : `V1.0/${t.folder}/${id.toLowerCase()}-${slug}.md`;
    exFiles.set(id, rel);
    fs.writeFileSync(path.join(E, rel), ex);
  }
}
// stubs for referenced cards that no example defines (authored zones only)
const stubs = new Map(), known = new Map(), needed = new Set();
for (const rel of exFiles.values()) {
  const full = fs.readFileSync(path.join(E, rel), 'utf8');
  for (const m of full.matchAll(/\[#([A-Z]{2}\d{6}) ([^\]]+)\]\(([^)#]*)/g)) {
    if (m[3] && !known.has(m[1])) known.set(m[1], { name: m[2], rel: path.posix.join(path.posix.dirname(rel), m[3]) });
  }
  const authored = full.split('\n## ⚙')[0];
  for (const m of authored.matchAll(/\[#([A-Z]{2}\d{6}) /g)) needed.add(m[1]);
  for (const m of authored.matchAll(/^(?:feature|parent): ([A-Z]{2}\d{6})$/gm)) needed.add(m[1]);
}
for (const core of needed) {
  if (exFiles.has(core) || !/^(PR|SC|CP|UF|IA|RL|AP|FT|EC|BN|TC|DC|CM)/.test(core) || !known.has(core)) continue;
  stubs.set(core, known.get(core));
}
const { renderCard } = await import('../lib/templates.mjs');
const { loadSchema } = await import('../lib/schema.mjs');
const S = loadSchema();
for (const [core, s] of stubs) fs.writeFileSync(path.join(E, s.rel), renderCard(S, S.typeOfCore(core), { id: core, name: s.name }));
// stories name roles by card name: give every named role a stub card
const roleNamed = new Set();
for (const t of Object.values(schema.types)) for (const m of (t.example || '').matchAll(/As an? ([^,]+?), I want/g)) roleNamed.add(m[1]);
roleNamed.delete(/name: (.+)/.exec(schema.types.role.example)[1]);
let rn = 900;
fs.mkdirSync(path.join(E, 'V1.0', 'roles'), { recursive: true });
for (const name of roleNamed) { const core = 'RO000' + rn++; fs.writeFileSync(path.join(E, 'V1.0', 'roles', `${core.toLowerCase()}-${name.toLowerCase()}.md`), renderCard(S, 'role', { id: core, name })); }
k = checkCounts(E);
if (k.error || k.warning) showProblems(k.json);
step('schema examples pass check', k.error === 0 && k.warning === 0, `${exFiles.size} examples + ${stubs.size} stubs: ${k.error} errors · ${k.warning} warnings · ${k.info} infos`);

/* ---------- summary ---------- */
if (saveTo && failed === 0) {
  fs.rmSync(saveTo, { recursive: true, force: true });
  fs.cpSync(R, saveTo, { recursive: true });
  results.push(`✓ saved the KB to ${path.relative(process.cwd(), saveTo) || saveTo}`);
}
console.log('mds smoke test');
for (const l of results) console.log('  ' + l);
console.log(failed ? `FAILED (${failed})` : 'PASSED');
if (!keep) fs.rmSync(tmp, { recursive: true, force: true });
else console.log(`kept ${tmp}`);
process.exitCode = failed ? 1 : 0;
