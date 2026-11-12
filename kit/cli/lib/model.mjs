// Builds the per-file model: front matter, skeleton, sections, relation lines, sub-documents.
// Only local (single-file) diagnostics are produced here; cross-card checks live in check.mjs.
import { readText } from './util.mjs';
import { modernize } from './rename.mjs';
import { parseFrontMatter, parseSkeleton, fenceMask, splitSub, contentIdx, bodyState, parseTable } from './parse.mjs';
import { scanMentions, parseRelSection, parseSubdocSection, parseStepList, finishFlow, parseIaParts } from './relations.mjs';

export function buildFile(S, file, rel, opts = {}) {
  const text = modernize(readText(file), S);
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const c = {
    file, rel, lines, text, kind: 'none', diags: [], rels: [], subs: [], mentions: [], placeholders: [],
    vocabUses: [], stories: [], qualRefs: [], stepLists: [], iaNodes: [], groups: [], forgive: [], extLines: new Set(),
    flowVariants: new Set(), reqNums: new Set(), blind: 0, blindBy: {}, mask: null, sk: null,
    why: null, outcomeMark: null, confirmedIdx: [], asks: [],
  };
  c.bs = (kind) => { c.blind++; c.blindBy[kind] = (c.blindBy[kind] || 0) + 1; };
  c.d = (code, idx, msg) => c.diags.push({ code, line: (idx ?? 0) + 1, msg });
  const fm = parseFrontMatter(lines, S.R);
  if (!fm) return c;
  c.fm = fm;
  if (fm.errors.length) { for (const e of fm.errors) c.d('E001', e.idx, e.msg); c.kind = 'broken'; return c; }
  const val = (k) => fm.map.get(k)?.value;
  c.type = val('type');
  c.name = val('name');
  c.status = val('status');
  c.mask = fenceMask(lines, fm.end + 1);
  c.sk = parseSkeleton(lines, fm.end + 1, S.R, c.mask);
  if (!c.type) { c.d('E002', 0, 'type: is missing'); c.kind = 'broken'; return c; }
  if (c.type === 'index' || c.type === 'manifest') {
    c.kind = c.type;
    checkStandard(S, c);
    const t = c.sk.titleIdx >= 0 ? lines[c.sk.titleIdx] : '';
    if (!S.R.plainTitle.test(t) || S.R.title.test(t)) c.d('W010', c.sk.titleIdx >= 0 ? c.sk.titleIdx : fm.end + 1, 'first body line must be "# <name>"');
    return c;
  }
  if (/^x-[a-z0-9-]+$/.test(c.type)) {
    c.kind = 'x';
    const id = val('id');
    if (!id || !S.R.idPattern.test(id) || !S.R.extPrefix.some((r) => r.test(id.slice(0, 2)))) c.d('E003', fm.map.get('id')?.idx ?? 0, `extension card needs an X*/Z* core (got "${id ?? ''}")`);
    else c.id = id;
    return c;
  }
  if (!S.isCardType(c.type)) { c.d('E002', fm.map.get('type').idx, `unknown type "${c.type}"`); c.kind = 'broken'; return c; }
  c.kind = 'card';
  c.def = S.typeDef(c.type);
  const idE = fm.map.get('id');
  const want = S.prefixOfType[c.type];
  if (!idE || idE.kind === 'empty') c.d('E003', 0, 'missing id: (mint one with intent-format new / intent-format mint)');
  else if (!S.R.idPattern.test(idE.value)) c.d('E003', idE.idx, `malformed id "${idE.raw}" (core only: ${want} + 6 digits)`);
  else if (idE.value.slice(0, 2) !== want) c.d('E003', idE.idx, `id prefix ${idE.value.slice(0, 2)} is not ${want} (type ${c.type})`);
  else c.id = idE.value;
  checkFrontMatter(S, c);
  checkTitle(S, c);
  parseSections(S, c, opts.modules || null);
  return c;
}

function checkStandard(S, c) {
  const first = c.fm.entries[0];
  if (!first || first.key !== 'standard') c.d('W001', first ? first.idx : 0, 'standard: must be the first key');
  else if (S.legacyStandards.includes(first.value)) c.d('W001', first.idx, `standard: ${first.value} is a pre-release name — intent-format migrate renames it to ${S.standard}`);
  else if (first.value !== S.standard) c.d('W001', first.idx, `standard: must be ${S.standard}`);
}

function checkFrontMatter(S, c) {
  const R = S.R, type = c.type;
  checkStandard(S, c);
  const order = S.keyOrder(type);
  const xPos = order.indexOf('x-*');
  let maxPos = -1, orderReported = false;
  const seen = new Set();
  for (const e of c.fm.entries) {
    if (seen.has(e.key)) { c.d('W003', e.idx, `duplicate key ${e.key}: (the first one wins)`); continue; }
    seen.add(e.key);
    const isX = /^x-[a-z0-9-]+$/.test(e.key);
    const pos = isX ? xPos : order.indexOf(e.key);
    if (pos < 0) { c.d('W003', e.idx, `key ${e.key}: is not defined for type ${type}`); continue; }
    if (pos < maxPos && !orderReported) { c.d('W002', e.idx, `key order: ${order.filter((k) => k !== 'x-*').join(', ')}, x-*`); orderReported = true; }
    maxPos = Math.max(maxPos, pos);
    if (isX || e.key === 'standard' || e.key === 'type' || e.key === 'id') continue;
    const def = S.keyDef(type, e.key);
    if (!def) continue;
    checkQuoting(S, c, e, def);
    if (e.kind === 'empty') continue;
    if (e.kind === 'blind') { c.bs(e.key === 'status' ? 'status' : 'frontMatter'); continue; }
    if (e.key === 'status') {
      if (!S.statusValues(type).includes(e.value)) c.d('W005', e.idx, `status "${e.value}" is not one of ${S.statusValues(type).join(' · ')} (or —)`);
      continue;
    }
    if (e.kind === 'list' && !def.list) { c.d('W007', e.idx, `${e.key}: takes one value, not a list`); continue; }
    if (e.key === 'state') {
      if (e.kind === 'list' && e.items.length > 1 && (type === 'userflow' || type === 'ia')) c.d('W042', e.idx, `a ${type} carries one state`);
    }
    const values = e.kind === 'list' ? e.items : [e.value];
    const vn = S.vocabName(def.values);
    for (const v of values) {
      if (vn) c.vocabUses.push({ vocab: vn, value: v, idx: e.idx, code: 'W006', what: `${e.key}:` });
      else if (Array.isArray(def.values) && !def.values.includes(v)) c.d('W007', e.idx, `${e.key}: "${v}" is not one of ${def.values.join(' · ')}`);
      if (def.pattern) {
        if (R.rendered.test('#' + v)) { c.d('W020', e.idx, `${e.key}: holds a rendered ID — write the core only`); continue; }
        if (!new RegExp(def.pattern, 'u').test(v)) c.d('W007', e.idx, `${e.key}: "${v}" does not match ${def.pattern}`);
      }
    }
  }
  for (const k of S.requiredKeys(type)) {
    if (['standard', 'type', 'id'].includes(k)) continue;
    const e = c.fm.map.get(k);
    if (!e || e.kind === 'empty') c.d('W004', e ? e.idx : 0, `required key ${k}: is missing (write — when unknown)`);
  }
  if (type === 'shell') {
    const kind = c.fm.map.get('shell-type')?.value, ap = c.fm.map.get('opens-as'), fl = c.fm.map.get('flow');
    const has = (e) => e && e.kind !== 'empty' && e.kind !== 'blind';
    if (has(ap) && kind && kind !== 'overlay') c.d('W047', ap.idx, 'opens-as: belongs on overlay shells (shell-type: overlay)');
    if (has(fl) && kind && kind !== 'stepper') c.d('W047', fl.idx, 'flow: belongs on stepper shells (shell-type: stepper)');
    if (kind === 'overlay' && !has(ap)) c.d('W047', c.fm.map.get('shell-type').idx, 'an overlay shell needs opens-as: (the presentation it frames)');
    if (kind === 'stepper' && !has(fl)) c.d('W047', c.fm.map.get('shell-type').idx, 'a stepper shell needs flow: (the flow it shows)');
  }
  if (type === 'component') {
    const p = c.fm.map.get('provider'), ct = c.fm.map.get('component-type');
    if (p && ct && ct.value !== 'integration') c.d('I018', p.idx, 'provider: belongs on integration components');
  }
}

function checkQuoting(S, c, e, def) {
  const R = S.R;
  const enumKey = Array.isArray(def.values);
  if (e.kind === 'quoted' && e.value === '—') { c.d('W008', e.idx, 'never quote —'); return; }
  if (S.alwaysQuoted.has(e.key)) {
    if (e.kind !== 'quoted' && e.kind !== 'blind' && e.kind !== 'empty') c.d('W008', e.idx, `${e.key}: is always quoted ("…")`);
    return;
  }
  if (e.kind === 'plain' && (R.needsQuotes.test(e.value) || (!enumKey && R.readsAsNonString.test(e.value)))) c.d('W008', e.idx, `${e.key}: value needs double quotes`);
  if (e.kind === 'quoted' && !R.needsQuotes.test(e.value) && !(!enumKey && R.readsAsNonString.test(e.value))) c.d('I013', e.idx, `${e.key}: quotes are not needed`);
}

function checkTitle(S, c) {
  const { sk, lines } = c;
  if (sk.titleIdx < 0) { c.d('W010', c.fm.end + 1, 'first body line must be "# <name> · #<CORE>"'); return; }
  const m = S.R.title.exec(lines[sk.titleIdx]);
  if (!m) { c.d('W010', sk.titleIdx, 'title must be "# <name> · #<CORE>"'); return; }
  if (m.groups.name !== c.name || m.groups.core !== c.id) c.d('I002', sk.titleIdx, 'title out of sync with name: / id: (regen rewrites it)');
}

function parseSections(S, c, modules) {
  const { lines, mask, sk } = c, R = S.R;
  const defs = S.sections(c.type);
  const seen = new Set();
  let maxPos = -1, sawGen = false;
  for (const sec of sk.sections) {
    sec.full = (sec.gear ? S.gear + ' ' : '') + sec.heading;
    sec.ext = /^x-/.test(sec.heading);
    if (seen.has(sec.full)) c.d('W013', sec.idx, `duplicate section ## ${sec.full}`);
    seen.add(sec.full);
    sec.def = defs.find((x) => x.heading === sec.full) || null;
    if (!sec.def) {
      if (sec.gear && !sec.ext) c.d('W014', sec.idx, `## ${sec.full} is not a generated section of ${c.type}`);
      else if (!sec.gear && !sec.ext) c.d('I008', sec.idx, `## ${sec.full} is not a ${c.type} section (kept as is)`);
    } else {
      const pos = defs.indexOf(sec.def);
      if (pos < maxPos) c.d('W012', sec.idx, `## ${sec.full} is out of order (${defs.filter((d) => !d.generated).map((d) => d.heading).join(' · ')}, then ⚙ sections)`);
      maxPos = Math.max(maxPos, pos);
    }
    if (!sec.gear && sawGen && !sec.ext) c.d('W012', sec.idx, `authored section ## ${sec.full} after a generated one`);
    if (sec.gear) sawGen = true;
  }
  for (const def of defs) {
    if (!def.required || def.generated || seen.has(def.heading)) continue;
    if (def.relief && modules && !modules.includes(def.relief)) continue;
    c.d('W011', sk.sections.length ? sk.sections[sk.sections.length - 1].end - 1 : lines.length - 1, `required section ## ${def.heading} is missing (write — when unknown)`);
  }
  // preamble: comment remark (required) or free prose
  const pre = contentIdx(lines, sk.preStart, sk.preEnd, mask);
  if (c.def.preamble) {
    const bs = bodyState(lines, pre, R);
    if (bs === 'empty') c.d('W011', sk.titleIdx >= 0 ? sk.titleIdx : 0, 'the remark (text under the title) is missing');
    if (bs === 'blind' || bs === 'forgive') c.bs('sections');
    if (bs === 'forgive') { c.d('I005', pre[0], `"${lines[pre[0]].trim()}" read as —`); c.forgive.push(pre[0]); }
  }
  parseProse(S, c, pre);
  for (const sec of sk.sections) {
    if (sec.ext) continue;
    const idxs = contentIdx(lines, sec.start, sec.end, mask);
    const bs = bodyState(lines, idxs, R);
    if (sec.gear) {
      if (sec.def && (bs === 'empty' || bs === 'blind' || bs === 'none')) c.d('I009', sec.idx, `## ${sec.full} is empty (regen removes it)`);
      continue;
    }
    const def = sec.def;
    if (!def) { parseProse(S, c, idxs); continue; }
    if (def.content === 'why') { parseWhy(S, c, sec, idxs, def, bs); continue; }
    if (bs === 'forgive') { c.d('I005', idxs[0], `"${lines[idxs[0]].trim()}" read as —`); c.forgive.push(idxs[0]); }
    if (bs === 'empty' && def.required) c.d('W011', sec.idx, `required section ## ${def.heading} is empty (write — or none)`);
    if (bs === 'blind' || bs === 'forgive') {
      const open = def.notCountedWhileOpen && S.openStatuses.includes(c.status);
      if (def.required && !open) c.bs('sections');
      continue;
    }
    if (bs === 'none' || bs === 'empty') continue;
    if (def.content !== 'subdocuments' && def.subsections !== 'flow-variant') {
      for (const s of splitSub(lines, sec.start, sec.end, mask).subs) if (R.subdoc.test(lines[s.idx])) c.d('W023', s.idx, `sub-document heading outside its host section`);
    }
    switch (def.content) {
      case 'relations': parseRelSection(S, c, sec, def); break;
      case 'ordered-relations':
        if (def.subsections === 'flow-variant') parseStepList(S, c, sec, def);
        else parseRelSection(S, c, sec, def);
        break;
      case 'tree': parseIaParts(S, c, sec, def); break;
      case 'subdocuments': parseSubdocSection(S, c, sec, def); break;
      case 'user-stories': parseUseCases(S, c, idxs); break;
      case 'vocabularies': parseVocabularies(S, c, sec, def); break;
      case 'do-donts':
        for (const i of idxs) if (!R.doDont.test(lines[i])) c.d('I024', i, 'Do & Don\'ts lines start with ✅ or 🚫');
        parseProse(S, c, idxs, false);
        break;
      case 'tags':
        if (idxs.length !== 1 || !R.tags.test(lines[idxs[0]])) c.d('I024', idxs[0], 'Tags are one line of comma-separated tags');
        break;
      default: parseProse(S, c, idxs); break;
    }
  }
  if (c.type === 'userflow') finishFlow(S, c);
  scanAsks(S, c);
  for (const g of c.groups) {
    g.forEach((idx, k) => {
      const m = /^\s*(\d+)\./.exec(lines[idx]);
      if (m && +m[1] !== k + 1 && !g.reported) { c.d('I015', idx, 'ordered lines are numbered 1..N (regen renumbers them)'); g.reported = true; }
    });
  }
  cardChecks(S, c);
}

/** ## Why: — (missing, counted as kind why) · none[ — note] · same as #id (resolved in check) · text with an optional confidence mark. */
function parseWhy(S, c, sec, idxs, def, bs) {
  const { lines } = c, R = S.R;
  const w = { state: 'filled', mark: null, note: null, idx: sec.idx, textIdx: idxs[idxs.length - 1] ?? sec.idx };
  if (bs === 'empty') { if (def.required) c.d('W011', sec.idx, 'required section ## Why is empty (write — or none)'); w.state = 'missing'; c.bs('why'); }
  else if (bs === 'blind' || bs === 'forgive') {
    if (bs === 'forgive') { c.d('I005', idxs[0], `"${lines[idxs[0]].trim()}" read as —`); c.forgive.push(idxs[0]); }
    w.state = 'missing'; c.bs('why');
  } else if (idxs.length === 1 && R.whyNone.test(lines[idxs[0]].trim())) {
    w.state = 'none'; const m = /^none — (.+)$/.exec(lines[idxs[0]].trim()); w.note = m ? m[1] : null;
  } else if (idxs.length === 1 && R.sameAs.test(lines[idxs[0]].trim())) {
    const m = R.sameAs.exec(lines[idxs[0]].trim());
    w.state = 'inherited'; w.sameAs = m.groups.core;
    if (c.fm.map.get('id')?.value === w.sameAs) { c.d('W051', idxs[0], 'same as: a card cannot borrow its own why'); w.state = 'missing'; w.sameAs = null; c.bs('why'); }
  } else {
    parseProse(S, c, idxs, false);
    const last = lines[w.textIdx].trimEnd();
    const m = R.confidenceMark.exec(last);
    if (m) { w.mark = m.groups.mark; if (m.groups.mark === 'confirmed') { c.d('I031', w.textIdx, '[confirmed] is the default — regen removes it'); c.confirmedIdx.push(w.textIdx); } }
    for (const i of idxs) if (i !== w.textIdx && R.confidenceMark.test(lines[i].trimEnd())) c.d('W051', i, 'a confidence mark goes only at the end of the Why text');
  }
  c.why = w;
}

/** [ask: …] markers in authored body lines: questions to the owner, counted in health and listed by intent-format open. */
function scanAsks(S, c) {
  const { lines, sk, mask } = c;
  const gear = sk.sections.filter((s) => s.gear);
  for (let i = sk.preStart; i < lines.length; i++) {
    if (mask?.[i] || gear.some((s) => i >= s.idx && i < s.end)) continue;
    for (const m of lines[i].matchAll(S.R.askMarker)) c.asks.push({ idx: i, question: m.groups.q.trim(), later: m.groups.date || null });
  }
}

/** Prose: mentions, placeholders, requirement blocks. */
export function parseProse(S, c, idxs, req = true) {
  const { lines } = c, R = S.R;
  const set = new Set(idxs);
  for (let k = 0; k < idxs.length; k++) {
    const i = idxs[k];
    scanMentions(S, c, i, lines[i]);
    if (!req || !/^\*\*R\d/.test(lines[i])) continue;
    const m = R.reqMarker.exec(lines[i]);
    if (!m) { c.d('W036', i, 'requirement marker must be **R<n> · User story|GWT|EARS|Checklist**'); continue; }
    if (c.reqNums.has(m.groups.n)) c.d('W036', i, `duplicate requirement number R${m.groups.n}`);
    c.reqNums.add(m.groups.n);
    const block = [];
    for (let j = i + 1; set.has(j) && !/^\*\*R\d/.test(lines[j]); j++) block.push(j);
    checkPreset(S, c, i, m.groups.preset, m.groups.rest || null, block, m.groups.n);
  }
}

function checkPreset(S, c, i, preset, rest, block, n = null) {
  const { lines } = c, R = S.R;
  const first = rest ?? (block.length ? lines[block[0]] : '');
  const at = rest ? i : block[0] ?? i;
  if (preset === 'User story') {
    const m = R.userStory.exec(first);
    if (!m) { c.d('W036', at, 'User story: "As a <role>, I want <goal>, so that <benefit>."'); return; }
    for (const s of ['role', 'goal', 'benefit']) if (m.groups[s].trim() === '—') c.bs('requirements');
    if (m.groups.role !== '—') { c.vocabUses.push({ vocab: 'Roles', value: m.groups.role, idx: at, code: 'W006', what: 'role' }); c.stories.push({ role: m.groups.role.trim(), idx: at, n }); }
  } else if (preset === 'EARS') {
    const m = R.ears.exec(first);
    if (!m) { c.d('W036', at, 'EARS block needs "the system shall"'); return; }
    if ((m.groups.condition || '').trim() === '—') c.bs('requirements');
    if (m.groups.response.replace(/\.$/, '').trim() === '—') c.bs('requirements');
  } else if (preset === 'GWT') {
    const ls = (rest ? [rest] : []).concat(block.map((j) => lines[j]));
    let stage = 0;
    for (const l of ls) {
      const m = R.gwt.exec(l);
      if (!m) { c.d('W036', at, `GWT line must start with Given/When/Then/And/But: ${l}`); return; }
      const k = ['Given', 'When', 'Then'].indexOf(m.groups.keyword);
      if (k >= 0) { if (k !== stage) { c.d('W036', at, 'GWT needs Given, When, Then in this order'); return; } stage++; }
      else if (stage === 0) { c.d('W036', at, 'GWT starts with Given'); return; }
      if (m.groups.text.trim() === '—') c.bs('requirements');
    }
    if (stage !== 3) c.d('W036', at, 'GWT needs Given, When and Then');
  } else if (preset === 'Checklist') {
    if (!block.length) { c.d('W036', i, 'Checklist needs at least one "- [ ] item"'); return; }
    for (const j of block) {
      const m = R.checklist.exec(lines[j]);
      if (!m) { c.d('W036', j, 'checklist items are "- [ ] <item>"'); continue; }
      if (m.groups.text.trim() === '—') c.bs('requirements');
    }
  }
}

function parseUseCases(S, c, idxs) {
  const { lines } = c, R = S.R;
  let n = 0;
  for (const i of idxs) {
    const m = R.useCase.exec(lines[i]);
    const us = m && R.userStory.exec(m.groups.story);
    if (!us) { c.d('W037', i, 'main use case: "- As a <Role>, I want <goal>, so that <benefit>."'); continue; }
    n++;
    for (const s of ['role', 'goal', 'benefit']) if (us.groups[s].trim() === '—') c.bs('requirements');
    if (us.groups.role !== '—') { c.vocabUses.push({ vocab: 'Roles', value: us.groups.role, idx: i, code: 'W037', what: 'role' }); c.stories.push({ role: us.groups.role.trim(), idx: i, n: null }); }
    scanMentions(S, c, i, lines[i]);
  }
  if (n && (n < 5 || n > 10)) c.d('I017', idxs[0], `${n} main use cases (5–10 expected)`);
}

function parseVocabularies(S, c, sec, def) {
  const { lines, mask } = c, R = S.R;
  const lists = S.raw.vocabularies.lists;
  const sub = splitSub(lines, sec.start, sec.end, mask);
  for (const i of contentIdx(lines, sub.intro[0], sub.intro[1], mask)) c.d('W035', i, 'vocabulary content belongs under ### <Vocabulary>');
  const vocab = { declared: new Set(), values: {}, stateCodes: new Map(), roleStates: [] };
  for (const name of def.subsections) vocab.values[name] = new Set();
  for (const s of sub.subs) {
    const ld = lists[s.text];
    if (!ld || !def.subsections.includes(s.text)) { c.d('W035', s.idx, `unknown vocabulary ### ${s.text} (${def.subsections.join(' · ')})`); continue; }
    const idxs = contentIdx(lines, s.start, s.end, mask);
    const vals = vocab.values[s.text];
    if (ld.shape === 'table') {
      const t = parseTable(lines, idxs, R);
      for (const b of t.bad) c.d('W035', b, `### ${s.text} is a table: | ${ld.columns.join(' | ')} |`);
      if (t.header && t.header.join('|') !== ld.columns.join('|')) c.d('W035', idxs[0], `### ${s.text} columns must be ${ld.columns.join(' · ')}`);
      const codes = new Set();
      for (const row of t.rows) {
        const v = row.cells[0];
        if (!v) { c.d('W035', row.idx, 'empty vocabulary value'); continue; }
        if (vals.has(v)) c.d('W035', row.idx, `duplicate value "${v}"`);
        vals.add(v);
        if (s.text === 'States') {
          const code = row.cells[1] || '';
          if (v === S.reserved.States) c.d('W035', row.idx, `${v} is implicit — never a row`);
          if (!R.stateCode.test(code) || code === 'SG' || codes.has(code)) c.d('W035', row.idx, `state code "${code}" must be S + letters, unique, not SG`);
          codes.add(code);
          vocab.stateCodes.set(v, code);
        }
        if (s.text === 'Roles' && row.cells[2]) for (const st of row.cells[2].split(',').map((x) => x.trim()).filter(Boolean)) vocab.roleStates.push({ value: st, idx: row.idx });
      }
    } else {
      for (const i of idxs) {
        const m = R.vocabBullet.exec(lines[i]);
        if (!m) { c.d('W035', i, `### ${s.text}: one "- <value>[ — note]" bullet per value`); continue; }
        if (vals.has(m.groups.value)) c.d('W035', i, `duplicate value "${m.groups.value}"`);
        vals.add(m.groups.value);
      }
    }
    if (vals.size) vocab.declared.add(s.text);
  }
  for (const r of vocab.roleStates) c.vocabUses.push({ vocab: 'States', value: r.value, idx: r.idx, code: 'W006', what: 'Roles · States' });
  c.vocab = vocab;
}

function cardChecks(S, c) {
  const { lines } = c;
  const sec = (h) => c.sk.sections.find((s) => s.full === h);
  if (c.type === 'decision') {
    const o = sec('Outcome');
    const oi = o ? contentIdx(lines, o.start, o.end, c.mask) : [];
    const st = o ? bodyState(lines, oi, S.R) : 'empty';
    if (['Decided', 'Superseded'].includes(c.status) && st) c.d('W039', o ? o.idx : 0, `a ${c.status} decision needs its Outcome`);
    if (!st && oi.length) {
      const li = oi[oi.length - 1], m = S.R.confidenceMark.exec(lines[li].trimEnd());
      if (m) { c.outcomeMark = m.groups.mark; if (m.groups.mark === 'confirmed') { c.d('I031', li, '[confirmed] is the default — regen removes it'); c.confirmedIdx.push(li); } }
    }
    const has = (k) => { const e = c.fm.map.get(k); return e && e.kind !== 'empty' && e.kind !== 'blind'; };
    if (c.status === 'Decided' && !has('decided')) c.d('W052', 0, 'a Decided decision records decided: <YYYY-MM-DD> (and by: who)');
    if (c.status === 'Superseded' && !has('superseded-by')) c.d('W052', 0, 'a Superseded decision names superseded-by: <DC core>');
    if (has('decided') && !['Decided', 'Superseded'].includes(c.status)) c.d('W052', c.fm.map.get('decided').idx, `decided: on a ${c.status} decision — set status: Decided or remove it`);
    if (has('superseded-by') && c.status !== 'Superseded') c.d('W052', c.fm.map.get('superseded-by').idx, `superseded-by: on a ${c.status} decision — set status: Superseded or remove it`);
  }
  if (c.type === 'feature' && !c.fm.map.get('parent')) {
    const dr = sec('Description');
    if (dr) for (const i of contentIdx(lines, dr.start, dr.end, c.mask)) {
      const t = lines[i].replace(S.R.boundG, '').replace(S.R.handG, '').replace(/\*\*R\d+ · [^*]+\*\*/g, '')
        .replace(/\b[Vv]\d+(?:\.\d+)*\b/g, '').replace(/\bR\d+\b/g, '');
      if (/\d/.test(t)) { c.d('I021', i, 'numbers in a top-level Feature — consider a rule'); break; }
    }
  }
}
