// Cross-card checks, workspace checks and health numbers. Local diagnostics come from model.mjs.
import path from 'node:path';
import { slugify, exists, readText } from './util.mjs';
import { targetType, targetName } from './project.mjs';
import { ref, pinSub, changeOf, statusLine, renderFolderIndex, renderRootIndex, renderIds, renderChanges } from './generate.mjs';

export function checkProject(S, P, opts = {}) {
  const diags = [];
  const add = (code, rel, line, message) => diags.push({ severity: S.diag.get(code)?.severity || 'info', code, path: rel, line, message });
  const fileDiags = (f) => { for (const d of f.diags) add(d.code, f.rel, d.line, d.msg); };
  for (const f of P.rootFiles) fileDiags(f);
  const types = new Map(); // core -> {type, rel}
  const retired = new Set(P.ids.retired.map((r) => r.core));
  const kbs = new Set();
  for (const ws of P.workspaces) {
    if (ws.manifest) fileDiags(ws.manifest);
    for (const f of ws.files) fileDiags(f);
    if (ws.kb) kbs.add(ws.kb);
    checkWorkspace(S, P, ws, add);
    for (const d of ws.dupCores) {
      const where = (e) => e.card.rel + (e.sub ? '#' + e.sub.core.toLowerCase() : '');
      add('E004', (d.b.card).rel, (d.b.sub ? d.b.sub.idx : 0) + 1, `core ${d.core} also declared in ${where(d.a)}`);
    }
    for (const [core, t] of ws.byCore) {
      const ty = targetType(t);
      const prev = types.get(core);
      if (prev && prev.type !== ty) add('E005', t.card.rel, 1, `core ${core} is a ${ty} here but a ${prev.type} in ${prev.rel}`);
      else if (!prev) types.set(core, { type: ty, rel: t.card.rel });
      if (retired.has(core)) add('W041', t.card.rel, (t.sub ? t.sub.idx : 0) + 1, `core ${core} is listed as retired in _ids.md`);
    }
    checkReferences(S, ws, add);
    checkNavigation(S, ws, add);
  }
  if (kbs.size > 1) add('I023', '_index.md', 1, `workspaces carry different kb: slugs (${[...kbs].join(', ')})`);
  checkGenerated(S, P, add, opts);
  const order = { error: 0, warning: 1, info: 2 };
  let out = diags;
  if (opts.ws) out = diags.filter((d) => d.path.startsWith(opts.ws + '/'));
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line || order[a.severity] - order[b.severity] || (a.code < b.code ? -1 : 1)));
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of out) counts[d.severity]++;
  const health = P.workspaces.filter((w) => !opts.ws || w.folder === opts.ws).map((w) => ({ workspace: w.folder, lifecycle: w.lifecycle, ...healthOf(S, w) }));
  return { diagnostics: out, counts, health };
}

export function healthOf(S, ws) {
  const why = { filled: 0, inherited: 0, none: 0, missing: 0 };
  const confidence = { likely: 0, assumed: 0 };
  const asks = { open: 0, later: 0, due: 0 };
  const again = S.raw.ask?.again ?? 2, today = Date.now();
  for (const c of ws.cards) {
    if (c.why) why[c.whyEffective || c.why.state]++;
    for (const m of [c.why?.mark, c.outcomeMark]) if (m && m !== 'confirmed') confidence[m]++;
    for (const a of c.asks || []) { if (!a.later) asks.open++; else { asks.later++; if ((today - Date.parse(a.later)) / 86400000 >= again) asks.due++; } }
  }
  let blind = 0;
  const groups = new Set();
  const byKind = Object.fromEntries(Object.keys(S.raw.health.numbers.blindSpots.kinds || {}).map((k) => [k, 0]));
  for (const c of ws.cards) {
    blind += c.blind;
    for (const [k, v] of Object.entries(c.blindBy)) byKind[k] = (byKind[k] || 0) + v;
    for (const p of c.placeholders) groups.add((p.types ? [...p.types].sort().join(',') : 'any') + '|' + p.name.replace(/\s+/g, ' ').trim());
  }
  const open = ws.cards.filter((c) => c.type === 'decision' && S.openStatuses.includes(c.status)).length;
  return { cards: ws.cards.length, blindSpots: blind, blindSpotsByKind: byKind, unresolvedPlaceholders: groups.size, openDecisions: open, why, confidence, asks };
}

function checkWorkspace(S, P, ws, add) {
  const R = S.R;
  const mrel = `${ws.folder}/intent-format.md`;
  if (!ws.manifest) add('W032', ws.folder + '/', 1, 'workspace has no intent-format.md');
  else if (ws.manifest.kind === 'manifest') checkManifest(S, P, ws, add, mrel);
  else if (ws.manifest.kind !== 'broken') add('W033', mrel, 1, 'intent-format.md must have type: manifest');
  const projects = ws.cards.filter((c) => c.type === 'project');
  if (!exists(path.join(ws.dir, 'project.md'))) add('W032', ws.folder + '/', 1, 'workspace has no project.md');
  if (projects.length > 1) for (const p of projects.slice(1)) add('W032', p.rel, 1, 'more than one project card in the workspace');
  for (const sf of ws.subfolders) add('W031', sf, 1, 'type folders are flat (no subfolders)');
  for (const m of S.modules) {
    const has = exists(path.join(ws.dir, m));
    if (ws.modules.includes(m) && !has) add('I019', mrel, 1, `enabled module ${m}/ has no folder`);
    if (!ws.modules.includes(m) && has && !ws.cards.some((c) => c.type === S.typeOfFolder[m])) add('I019', `${ws.folder}/${m}`, 1, `folder ${m}/ is not an enabled module and holds no cards`);
  }
  const vocab = ws.vocab;
  const roleCards = ws.cards.filter((c) => c.type === 'role' && c.name);
  const roleNames = new Set(roleCards.map((c) => c.name));
  for (const c of ws.files) {
    if (c.kind === 'none') { add('W031', c.rel, 1, '.md file without front matter in a workspace'); continue; }
    if (c.kind === 'index' && c.rel !== `${ws.folder}/CHANGES.md` && path.basename(c.file) !== '_index.md') add('W031', c.rel, 1, 'index files are _index.md or CHANGES.md');
    if (c.kind !== 'card') continue;
    // placement
    const relWs = path.relative(ws.dir, c.file).split(path.sep);
    if (c.type === 'project') {
      if (relWs.join('/') !== 'project.md') add('W031', c.rel, 1, 'the project card is <workspace>/project.md');
    } else {
      const folder = S.folderOfType[c.type];
      if (relWs.length !== 2 || relWs[0] !== folder) add('W031', c.rel, 1, `a ${c.type} card lives in ${folder}/`);
      else if (!ws.modules.includes(folder)) add('W034', c.rel, 1, `module ${folder} is not enabled in intent-format.md`);
      const m = R.filename.exec(relWs[relWs.length - 1]);
      if (!m) add('W031', c.rel, 1, 'filename must be <core-lowercase>-<slug>.md');
      else if (c.id && m.groups.core !== c.id.toLowerCase()) add('W031', c.rel, 1, `filename core ${m.groups.core} differs from id ${c.id}`);
      else if (c.name && m.groups.slug !== slugify(c.name, c.type)) add('I016', c.rel, 1, `filename slug differs from "${slugify(c.name, c.type)}"`);
    }
    // vocabulary values
    for (const u of c.vocabUses) {
      if (u.vocab === 'States') {
        if (!vocab.declared.has('States')) { add('W009', c.rel, u.idx + 1, `${u.what} ${u.value} — project.md declares no States`); continue; }
      }
      if (u.vocab === 'Roles') {
        // roles are cards; the deprecated ### Roles table resolves stories only while no role card exists
        if (roleNames.size) { if (!roleNames.has(u.value.trim())) add(u.code, c.rel, u.idx + 1, `${u.what} "${u.value}" is not the name of a role card`); continue; }
        if (!vocab.declared.has('Roles')) continue;
      }
      if (u.value === S.reserved[u.vocab]) continue;
      if (!vocab.values[u.vocab] || !vocab.values[u.vocab].has(u.value)) add(u.code, c.rel, u.idx + 1, `${u.what} "${u.value}" is not in ### ${u.vocab} of project.md`);
    }
  }
  // roles: unique names, stories that name them, the deprecated table
  const seenRole = new Map();
  for (const r of roleCards) {
    if (seenRole.has(r.name)) add('W049', r.rel, 1, `another role card is named "${r.name}": ${seenRole.get(r.name)}`);
    else seenRole.set(r.name, r.rel);
  }
  const named = new Set(ws.cards.flatMap((c) => c.stories.map((x) => x.role)));
  for (const r of roleCards) if (!named.has(r.name)) add('I029', r.rel, 1, `no user story names "${r.name}"`);
  if (ws.project && !S.raw.lifecycles.readOnly.includes(ws.lifecycle)) {
    const i = ws.project.lines.findIndex((l, k) => !ws.project.mask[k] && /^### Roles\s*$/.test(l));
    if (i >= 0) add('W050', ws.project.rel, i + 1, 'user types are role cards now: run intent-format migrate (each row becomes a card in roles/)');
  }
  // borrowed whys: same as #id names any card; a target without a why makes this card count as missing
  const resolveWhy = (c, seen = new Set()) => {
    if (!c.why) return 'missing';
    if (c.whyEffective) return c.whyEffective;
    if (c.why.state !== 'inherited') return c.why.state;
    if (seen.has(c)) return 'missing';
    seen.add(c);
    const t = c.why.sameAs ? ws.byCore.get(c.why.sameAs) : null;
    if (!t || t.sub) return 'unresolved';
    const r = resolveWhy(t.card, seen);
    return r === 'filled' || r === 'none' || r === 'inherited' ? 'inherited' : 'missing';
  };
  for (const c of ws.cards) {
    if (!c.why || c.why.state !== 'inherited') continue;
    const r = resolveWhy(c);
    if (r === 'unresolved') { add('W051', c.rel, c.why.idx + 1, `same as #${c.why.sameAs}: names no card in this workspace — write the why, none or —`); c.whyEffective = 'missing'; c.bs('why'); }
    else if (r === 'missing') { add('I030', c.rel, c.why.idx + 1, `same as #${c.why.sameAs}: that card has no why yet — counted as missing here`); c.whyEffective = 'missing'; c.bs('why'); }
    else c.whyEffective = 'inherited';
  }
  // Source links cite evidence: a URL or a file inside <root>/inputs/
  const inputsDir = path.resolve(P.root, 'inputs') + path.sep;
  for (const c of ws.cards) for (const r of c.rels) {
    if (r.rel !== 'Link' || !r.quals.some((q) => q.key === 'type' && q.value === 'Source')) continue;
    const target = r.atoms[0]?.target;
    if (!target || /^[a-z][a-z0-9+.-]*:\/\//i.test(target)) continue;
    const abs = path.resolve(path.dirname(c.file), target.split('#')[0]);
    if (!abs.startsWith(inputsDir)) add('W053', c.rel, r.idx + 1, `Source ${target} is outside inputs/ — evidence lives in <root>/inputs/`);
  }
  // default maps, origins, homes
  const defaults = new Map(), origins = new Map();
  const hasFeature = ws.cards.some((c) => c.type === 'feature');
  for (const c of ws.cards) {
    const m = c.fm.map;
    if (c.type === 'ia' && m.get('default')?.value === 'true') {
      const st = m.get('state')?.value || S.reserved.States;
      if (defaults.has(st)) add('W040', c.rel, m.get('default').idx + 1, `another default map for ${st}: ${defaults.get(st)}`);
      else defaults.set(st, c.rel);
    }
    const o = m.get('origin')?.value;
    if (o && o !== '—') { if (origins.has(o)) add('W043', c.rel, m.get('origin').idx + 1, `origin ${o} also on ${origins.get(o)}`); else origins.set(o, c.rel); }
    if (hasFeature && (c.type === 'screen' || c.type === 'userflow') && !m.get('feature')) add('I025', c.rel, 1, 'no home feature (feature:)');
  }
}

function checkManifest(S, P, ws, add, rel) {
  const f = ws.manifest, m = f.fm.map, R = S.R;
  const keys = S.raw.manifest.keys;
  let max = -1, reported = false;
  for (const e of f.fm.entries) {
    if (/^x-/.test(e.key)) continue;
    const pos = keys.findIndex((k) => k.key === e.key);
    if (pos < 0) { add('W033', rel, e.idx + 1, `unknown manifest key ${e.key}:`); continue; }
    if (pos < max && !reported) { add('W033', rel, e.idx + 1, `manifest keys out of order (${keys.map((k) => k.key).join(', ')})`); reported = true; }
    max = Math.max(max, pos);
    if (keys[pos].quoted && e.kind !== 'quoted') add('W008', rel, e.idx + 1, `${e.key}: is always quoted ("…")`);
  }
  for (const k of keys) if (k.required && (!m.get(k.key) || m.get(k.key).kind === 'empty')) add('W033', rel, 1, `manifest key ${k.key}: is missing`);
  const v = m.get('version')?.value;
  if (v && v !== ws.version) add('W033', rel, m.get('version').idx + 1, `version "${v}" does not match the folder ${ws.folder}`);
  const kb = m.get('kb')?.value;
  if (kb && !R.kbSlug.test(kb)) add('W033', rel, m.get('kb').idx + 1, `kb: "${kb}" is not a slug`);
  const lc = m.get('lifecycle')?.value;
  if (lc && !S.lifecycles.includes(lc)) add('W033', rel, m.get('lifecycle').idx + 1, `lifecycle "${lc}" is not one of ${S.lifecycles.join(' · ')}`);
  const b = ws.basedOn;
  if (b && (b === ws.version || !P.byVersion.has(b))) add('W033', rel, m.get('based-on').idx + 1, `based-on "${b}" names no other workspace`);
  const mods = m.get('modules');
  if (mods && mods.kind !== 'list') add('W033', rel, mods.idx + 1, 'modules: is a list [a, b]');
  else if (mods) for (const x of mods.items) if (!S.modules.includes(x)) add('W033', rel, mods.idx + 1, `unknown module "${x}"`);
}

function checkReferences(S, ws, add) {
  const R = S.R;
  const res = (core) => ws.byCore.get(core);
  const allNames = new Map(); // name -> [{card,sub}]
  for (const t of ws.byCore.values()) {
    const n = targetName(t);
    if (!n) continue;
    if (!allNames.has(n)) allNames.set(n, []);
    allNames.get(n).push(t);
  }
  const compGraph = new Map();
  const isShell = (t) => !t.sub && t.card.type === 'shell';
  for (const c of ws.cards) {
    const rel = c.rel;
    const stale = (idx, a, t) => {
      const want = ref(c.file, t);
      if (a.kind === 'bound' && c.lines[idx].slice(a.start, a.end) !== want) add('I007', rel, idx + 1, `reference text of #${a.core} is stale (regen rewrites it)`);
      if (a.kind === 'hand') add('I007', rel, idx + 1, `#${a.core} will be upgraded to a bound reference`);
    };
    for (const r of c.rels) {
      const def = S.relations[r.rel];
      for (const a of r.atoms) {
        if (a.kind !== 'bound' && a.kind !== 'hand') continue;
        const t = res(a.core);
        if (!t) { add('W019', rel, r.idx + 1, `#${a.core} does not resolve in ${ws.folder}`); continue; }
        const ty = targetType(t);
        if (r.rel === 'Part' && ty === 'shell') { add('W046', rel, r.idx + 1, `#${a.core} is a shell — it frames places, it is never a part`); continue; }
        if (def.targetTypes.length && !def.targetTypes.includes(ty)) { add('W018', rel, r.idx + 1, `${r.rel} cannot point at a ${ty} (#${a.core})`); continue; }
        stale(r.idx, a, t);
        if (r.rel === 'Part' && c.type === 'component') {
          if (!compGraph.has(c.id)) compGraph.set(c.id, new Set());
          compGraph.get(c.id).add(t.card.id);
        }
      }
      if (r.variant) {
        const a = r.atoms[r.atoms.length - 1];
        const t = a && (a.kind === 'bound' || a.kind === 'hand') && res(a.core);
        if (t && !t.sub) {
          const ok = t.card.type === 'userflow' ? t.card.flowVariants.has(r.variant) : !!pinSub(t.card, r.variant);
          if (!ok) add('W028', rel, r.idx + 1, `variant "${r.variant}" is not a variant of #${t.card.id}`);
        }
      }
    }
    for (const m of c.mentions) {
      const t = res(m.core);
      if (!t) { add('W019', rel, m.idx + 1, `#${m.core} does not resolve in ${ws.folder}`); continue; }
      if (m.kind === 'bound' && c.lines[m.idx].slice(m.start, m.end) !== ref(c.file, t)) add('I007', rel, m.idx + 1, `reference text of #${m.core} is stale (regen rewrites it)`);
    }
    for (const q of c.qualRefs) {
      const t = res(q.core);
      if (!t) add('W019', rel, q.idx + 1, `#${q.core} does not resolve in ${ws.folder}`);
      else if (!q.types.includes(targetType(t))) add('W021', rel, q.idx + 1, `${q.key}: #${q.core} is a ${targetType(t)}, not a ${q.types.join('/')}`);
      else if (q.key === 'shell' && !isShell(t)) add('W044', rel, q.idx + 1, `shell: #${q.core} is not a shell`);
    }
    // framing: shell: on screens and in variant passports; flow: on stepper shells
    const shellKey = (value, idx) => {
      if (!value || !/^SH\d{6}$/.test(value)) return null;
      const t = res(value);
      if (!t) add('W019', rel, idx + 1, `shell: ${value} does not resolve in ${ws.folder}`);
      else if (!isShell(t)) add('W044', rel, idx + 1, `shell: ${value} is not a shell`);
      else return t;
      return null;
    };
    if (c.type === 'screen') {
      const sh = c.fm.map.get('shell');
      if (sh) shellKey(sh.value, sh.idx);
      for (const sd of c.subs) {
        const p = sd.passport?.find((x) => x.key === 'shell');
        if (p) shellKey(p.value, sd.passportIdx ?? sd.idx);
      }
    }
    if (c.type === 'shell') {
      const fl = c.fm.map.get('flow');
      if (fl && /^UF\d{6}$/.test(fl.value)) {
        const t = res(fl.value);
        if (!t) add('W019', rel, fl.idx + 1, `flow: ${fl.value} does not resolve in ${ws.folder}`);
        else if (t.sub || t.card.type !== 'userflow') add('W018', rel, fl.idx + 1, `flow: ${fl.value} is not a user flow`);
      }
    }
    for (const p of c.placeholders) {
      const hits = (allNames.get(p.name.replace(/\s+/g, ' ').trim()) || []).filter((t) => !p.types || p.types.includes(targetType(t)));
      if (hits.length) add('I014', rel, p.idx + 1, `[~ ${p.name}] can now link to #${hits[0].sub ? hits[0].sub.core : hits[0].card.id}`);
    }
    // membership keys
    const fe = c.fm.map.get('feature');
    if (fe && /^FT\d{6}$/.test(fe.value)) {
      const t = res(fe.value);
      if (!t) add('W019', rel, fe.idx + 1, `feature: ${fe.value} does not resolve in ${ws.folder}`);
      else if (t.sub || t.card.type !== 'feature') add('W018', rel, fe.idx + 1, `feature: ${fe.value} is not a feature`);
    }
    const sb = c.fm.map.get('superseded-by');
    if (sb && /^DC\d{6}$/.test(sb.value)) {
      const t = res(sb.value);
      if (!t) add('W019', rel, sb.idx + 1, `superseded-by: ${sb.value} does not resolve in ${ws.folder}`);
      else if (t.sub || t.card.type !== 'decision') add('W018', rel, sb.idx + 1, `superseded-by: ${sb.value} is not a decision`);
      else if (t.card === c) add('W052', rel, sb.idx + 1, 'a decision cannot supersede itself');
    }
    const pa = c.fm.map.get('parent');
    if (pa && /^FT\d{6}$/.test(pa.value)) {
      const t = res(pa.value);
      if (!t) add('W019', rel, pa.idx + 1, `parent: ${pa.value} does not resolve in ${ws.folder}`);
      else if (t.sub || t.card.type !== 'feature') add('W030', rel, pa.idx + 1, `parent: ${pa.value} is not a feature`);
      else if (t.card === c) add('W030', rel, pa.idx + 1, 'a feature cannot be its own parent');
      else if (t.card.fm.map.get('parent')) add('W030', rel, pa.idx + 1, `parent: ${pa.value} is a Sub-feature (max two levels)`);
    }
  }
  // nesting cycles among components
  const color = new Map();
  const visit = (id, stack) => {
    color.set(id, 1);
    for (const n of compGraph.get(id) || []) {
      if (color.get(n) === 1) {
        const c = res(id)?.card;
        if (c) add('W029', c.rel, 1, `Part lines form a cycle: ${[...stack, id, n].slice(stack.indexOf(n) >= 0 ? stack.indexOf(n) : 0).map((x) => '#' + x).join(' → ')}`);
      } else if (!color.get(n)) visit(n, [...stack, id]);
    }
    color.set(id, 2);
  };
  for (const id of compGraph.keys()) if (!color.get(id)) visit(id, []);
  // default-shell clash: two shells would frame the same placement by default
  const defaults = new Map();
  const steppers = new Map();
  for (const c of ws.cards) {
    if (c.type !== 'shell') continue;
    const kind = c.fm.map.get('shell-type')?.value;
    const fl = kind === 'stepper' && c.fm.map.get('flow')?.value;
    if (fl && /^UF\d{6}$/.test(fl)) {
      if (steppers.has(fl)) add('W045', c.rel, 1, `also the stepper of ${fl}: ${steppers.get(fl)} — a flow has one stepper`);
      else steppers.set(fl, c.rel);
    }
    if (!['app', 'overlay', 'embedded'].includes(kind)) continue;
    const ap = c.fm.map.get('opens-as');
    if (kind === 'overlay' && (!ap || ap.kind === 'empty' || ap.kind === 'blind')) continue;
    const listOf = (key, dflt) => { const e = c.fm.map.get(key); return e && e.kind !== 'empty' && e.kind !== 'blind' ? (e.kind === 'list' ? e.items : [e.value]) : [dflt]; };
    for (const p of listOf('platform', S.reserved.Platforms)) for (const st of listOf('state', S.reserved.States)) {
      const k = [kind, p, st, kind === 'overlay' ? ap.value : ''].join('|');
      if (defaults.has(k)) add('W045', c.rel, 1, `also the default ${kind} shell for ${p} · ${st}${kind === 'overlay' ? ' · ' + ap.value : ''}: ${defaults.get(k)}`);
      else defaults.set(k, c.rel);
    }
  }
}

/** Shell navigation and chrome (6.4): W048 · in: names no part of the shell; I027 a shell part also on a screen; I028 a line shown where its screen does not exist. */
function checkNavigation(S, ws, add) {
  const res = (core) => ws.byCore.get(core);
  const coreOf = (r) => r.atoms.find((a) => a.kind === 'bound' || a.kind === 'hand')?.core;
  const states = ws.vocab.declared.has('States') ? [...(ws.vocab.values.States || [])] : [];
  const statesOf = (e) => (!e || e.kind === 'empty' || e.kind === 'blind' || e.value === S.reserved.States ? states : e.kind === 'list' ? e.items : [e.value]);
  const shellOfPart = new Map();
  for (const c of ws.cards) {
    if (c.type !== 'shell') continue;
    const cores = c.rels.filter((r) => r.rel === 'Part').map(coreOf).filter(Boolean);
    for (const k of cores) if (!shellOfPart.has(k)) shellOfPart.set(k, c);
    const names = new Set(cores.map((k) => res(k)?.card?.name?.toLowerCase()).filter(Boolean));
    const shown = statesOf(c.fm.map.get('state'));
    for (const r of c.rels) {
      if (r.rel !== 'Leads to') continue;
      for (const p of r.inParts || []) {
        const h = /^#?([A-Z]{2}\d{6})$/.exec(p);
        if (h ? !cores.includes(h[1]) : !names.has(p.toLowerCase())) add('W048', c.rel, r.idx + 1, `in: ${p} is not a part of this shell`);
      }
      const t = res(coreOf(r) || '');
      if (!states.length || !t || t.sub || t.card.type !== 'screen') continue;
      const reach = statesOf(t.card.fm.map.get('state'));
      const missing = (r.lineState ? [r.lineState] : shown).filter((st) => st !== S.reserved.States && !reach.includes(st));
      if (missing.length) add('I028', c.rel, r.idx + 1, `#${t.card.id} does not exist in ${missing.join(', ')} — add · state: to this line`);
    }
  }
  for (const c of ws.cards) {
    if (c.type !== 'screen') continue;
    for (const r of c.rels) {
      const k = r.rel === 'Part' && coreOf(r);
      const sh = k && shellOfPart.get(k);
      if (sh) add('I027', c.rel, r.idx + 1, `#${k} is also a part of shell #${sh.id} — frame parts belong on the shell`);
    }
  }
}

/** I001 (status lines) and I020 (generated files), compared with what regen would write. */
function checkGenerated(S, P, add, opts) {
  if (opts.skipGenerated) return;
  for (const ws of P.workspaces) {
    if (S.raw.lifecycles.readOnly.includes(ws.lifecycle)) continue;
    const changes = new Map();
    for (const c of ws.cards) {
      if (!c.id) continue;
      const ch = changeOf(S, ws, c);
      changes.set(c, ch);
      const want = statusLine(S, ws, c, ch);
      if (c.sk.statusIdx < 0) add('I001', c.rel, (c.sk.titleIdx >= 0 ? c.sk.titleIdx : 0) + 1, 'status line missing (regen writes it)');
      else if (c.lines[c.sk.statusIdx] !== want) add('I001', c.rel, c.sk.statusIdx + 1, 'status line is stale (regen rewrites it)');
    }
    const stale = (file, want) => {
      const rel = path.relative(P.root, file).split(path.sep).join('/');
      if (!exists(file)) add('I020', rel, 1, 'generated file missing (run intent-format regen)');
      else if (want !== null && readText(file) !== want) add('I020', rel, 1, 'generated file is stale (run intent-format regen)');
    };
    for (const folder of S.modules) {
      if (ws.modules.includes(folder) || exists(path.join(ws.dir, folder))) stale(path.join(ws.dir, folder, '_index.md'), renderFolderIndex(S, ws, folder));
    }
    const ch = renderChanges(S, ws, changes);
    const cf = path.join(ws.dir, 'CHANGES.md');
    if (ch) stale(cf, ch);
    else if (exists(cf)) add('I020', `${ws.folder}/CHANGES.md`, 1, 'CHANGES.md without based-on (regen removes it)');
  }
  stale2(P, add, path.join(P.root, '_index.md'), renderRootIndex(S, P));
  stale2(P, add, path.join(P.root, '_ids.md'), renderIds(S, P));
}

function stale2(P, add, file, want) {
  const rel = path.relative(P.root, file).split(path.sep).join('/');
  if (!exists(file)) add('I020', rel, 1, 'generated file missing (run intent-format regen)');
  else if (readText(file) !== want) add('I020', rel, 1, 'generated file is stale (run intent-format regen)');
}
