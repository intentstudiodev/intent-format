// Per-card parsing of relation contexts: relation sections, sub-documents (variants, steps),
// step lists and IA trees. Pushes local diagnostics into card.diags; records relation lines
// (with atom offsets) into card.rels for resolution, regeneration and generated sections.
import { splitSub, contentIdx, bodyState, parseRelLine, parsePassport } from './parse.mjs';

export function relCx(S, defaultRel, glyphOk = false) {
  return { relations: S.relations, defaultRel, glyphOk };
}

/** Scan a text for mentions (bound, hand), placeholders and rendered ids. */
export function scanMentions(S, c, idx, text, base = 0, placeholderTypes = null) {
  const R = S.R;
  for (const m of text.matchAll(R.boundG)) {
    c.mentions.push({ idx, kind: 'bound', core: m.groups.core, name: m.groups.name ?? null, path: m.groups.path, anchor: m.groups.anchor ?? null, start: base + m.index, end: base + m.index + m[0].length });
  }
  for (const m of text.matchAll(R.handG)) c.mentions.push({ idx, kind: 'hand', core: m.groups.core, start: base + m.index });
  for (const m of text.matchAll(R.placeholderG)) c.placeholders.push({ idx, name: m.groups.name, types: placeholderTypes });
  for (const m of text.matchAll(R.renderedG)) c.d('W020', idx, `rendered ID ${m[0]} used as a reference — write the core only`);
}

/**
 * Record one parsed line of a relation context.
 * o: { legal:Set, ordered:true|false|null, section, sub, flowVariant, strict, countBlind, tree, defaultRel, group }
 */
export function handleRel(S, c, p, idx, o) {
  const line = c.lines[idx];
  switch (p.kind) {
    case 'generated': return null;
    case 'ext': c.extLines.add(idx); return null;
    case 'unknown-word': c.d('W016', idx, `unknown relation word "${p.word}:"`); return null;
    case 'nonlist':
    case 'prose':
      if (o.strict) c.d('W015', idx, `not a relation line: ${line.trim()}`);
      else scanMentions(S, c, idx, line);
      return null;
    default: break;
  }
  const def = S.relations[p.rel];
  if (p.indent > 0 && !o.tree) c.d('W015', idx, 'relation lines never nest (no indentation)');
  if (o.ordered === true && !p.ordered) c.d('W015', idx, 'ordered line expected: "1. <reference>"');
  if (o.ordered === false && p.ordered) c.d('W015', idx, 'bullet line expected: "- <reference>"');
  if (def.generatedOnly) { c.d('W017', idx, `${p.rel} lines are generated (⚙ ${p.rel}); do not write them by hand`); return null; }
  if (def.authoredAs) { c.d('W017', idx, `${p.rel} is a front-matter key, not a relation line`); return null; }
  if (!o.legal.has(p.rel)) { c.d('W017', idx, p.rel === 'Leads to' && c.type === 'shell' ? 'navigation is one list: move this line to ## Navigation and limit it with · state: / · platform:' : `relation ${p.rel} is not allowed here`); return null; }
  if (p.explicit && p.rel === o.defaultRel) c.d('I003', idx, `"${p.rel}:" repeats the section's default relation`);
  if (!p.ok) {
    if (S.R.rendered.test(line)) c.d('W020', idx, 'rendered ID used as a reference — write the core only (#SC000006)');
    else c.d(p.rel === 'Link' ? 'W038' : 'W015', idx, p.why);
    return null;
  }
  const rec = { ...p, idx, section: o.section, sub: o.sub || null, flowVariant: o.flowVariant ?? null };
  c.rels.push(rec);
  if (p.ordered && o.group) o.group.push(idx);
  if (def.textSlot) {
    if (p.text.trim() === '—' && o.countBlind) c.bs('targets');
    else scanMentions(S, c, idx, p.text, p.textStart);
    return rec;
  }
  for (const a of rec.atoms) {
    if (a.kind === 'unknown' && o.countBlind) { c.bs('targets'); rec.countedTarget = true; }
    if (a.kind === 'placeholder') c.placeholders.push({ idx, name: a.name, types: def.targetTypes });
  }
  checkQualifiers(S, c, rec, def);
  return rec;
}

function checkQualifiers(S, c, rec, def) {
  const R = S.R, idx = rec.idx;
  const qdefs = new Map((def.qualifiers || []).map((q) => [q.key, q]));
  const seen = new Set();
  const link = rec.rel === 'Link';
  for (const q of rec.quals) {
    if (q.bad) { c.d(link ? 'W038' : 'W021', idx, `malformed qualifier "${q.raw.trim()}"`); continue; }
    const qd = qdefs.get(q.key);
    if (!qd) { c.d(link ? 'W038' : 'W021', idx, `unknown qualifier "${q.key}" on ${rec.rel}`); continue; }
    if (seen.has(q.key)) c.d('W021', idx, `duplicate qualifier "${q.key}"`);
    seen.add(q.key);
    if (qd.valueless) { if (q.value != null) c.d('W021', idx, `"${q.key}" takes no value`); continue; }
    if (q.value == null || q.value === '') { c.d('W021', idx, `qualifier "${q.key}" needs a value`); continue; }
    if (/\[#[A-Z]{2}\d{6}[^\]]*\]\(/u.test(q.value)) c.d('W021', idx, `qualifier "${q.key}" holds a bound link — use the bare core`);
    if (!q.quoted && /—|→/.test(q.value)) c.d('W021', idx, `qualifier value with — or → must be quoted`);
    if (Array.isArray(qd.values) && !qd.values.includes(q.value)) {
      c.d(link ? 'W038' : 'W021', idx, `${q.key}: ${q.value} is not one of ${qd.values.join(' · ')}`);
    }
    const vn = S.vocabName(qd.values);
    const items = qd.list ? q.value.split(',').map((x) => x.trim()).filter(Boolean) : [q.value];
    if (vn) for (const v of items) c.vocabUses.push({ vocab: vn, value: v, idx, code: 'W021', what: `${q.key}:` });
    if (q.key === 'in') rec.inParts = items;
    if (q.key === 'state' && rec.rel === 'Leads to') rec.lineState = q.value;
    if (q.key === 'rule') {
      const h = R.hand.exec(q.value), ph = R.placeholder.exec(q.value);
      if (h) c.qualRefs.push({ idx, core: h.groups.core, types: ['rule'], key: 'rule', rec });
      else if (ph) c.placeholders.push({ idx, name: ph.groups.name, types: ['rule'] });
      else c.d('W021', idx, `rule: takes #RL… or [~ Name]`);
    }
    if (q.key === 'shell') {
      const h = R.hand.exec(q.value);
      if (h) c.qualRefs.push({ idx, core: h.groups.core, types: ['shell'], key: 'shell', rec });
      else if (q.value !== 'none') c.d('W021', idx, 'shell: takes #SH… or none');
    }
    if (q.key === 'opens-as' && rec.rel === 'Part' && c.type !== 'shell') c.d('W047', idx, '· opens-as: on a part is for shells only');
    if (q.key === 'variant') rec.variant = q.value;
  }
  if (link && !seen.has('type')) c.d('W038', idx, 'link line needs "· type: Design|Code|Doc|Source|Analytics|Other"');
}

/** A final `- —` / `N. —` item = incomplete list: more items exist but are unknown (blind spot, kind lists). */
export function markIncomplete(S, c, recs) {
  const last = recs[recs.length - 1];
  if (!last || !S.R.incompleteItem.test(c.lines[last.idx].trim())) return false;
  last.incomplete = true;
  if (last.countedTarget) { c.blind--; c.blindBy.targets--; }
  c.bs('lists');
  return true;
}

/** ## sections whose content is relations or ordered-relations (not step lists). */
export function parseRelSection(S, c, sec, def) {
  const { lines, mask } = c;
  const sub = splitSub(lines, sec.start, sec.end, mask);
  for (const s of sub.subs) c.d(S.R.subdoc.test(lines[s.idx]) ? 'W023' : 'W015', s.idx, `### heading not allowed in ## ${def.heading}`);
  const legal = S.legalIn(c.type, def.heading);
  const group = [];
  const cx = relCx(S, def.defaultRelation);
  const recs = [];
  for (const idx of contentIdx(lines, sub.intro[0], sub.intro[1], mask)) {
    const p = parseRelLine(lines[idx], cx, S.R);
    const rec = handleRel(S, c, p, idx, { legal, ordered: !!def.ordered, section: def.heading, strict: true, countBlind: def.required, defaultRel: def.defaultRelation, group });
    if (rec) recs.push(rec);
  }
  const n = recs.length - (markIncomplete(S, c, recs) ? 1 : 0);
  if (group.length) c.groups.push(group);
  if (def.max && n > def.max) c.d('W022', sec.idx, `## ${def.heading} takes exactly ${def.max} line`);
}

function checkPassport(S, c, pairs, idx, keyDefs, what) {
  let last = -1;
  const seen = new Set();
  for (const { key, value } of pairs) {
    const pos = keyDefs.findIndex((k) => k.key === key);
    if (pos < 0) { c.d('W024', idx, `unknown passport key "${key}" on ${what}`); continue; }
    if (pos < last) c.d('W024', idx, `passport keys out of order (${keyDefs.map((k) => k.key).join(' · ')})`);
    last = Math.max(last, pos);
    if (seen.has(key)) c.d('W024', idx, `duplicate passport key "${key}"`);
    seen.add(key);
    if (value === '—') { c.bs('frontMatter'); continue; }
    const kd = keyDefs[pos];
    const vn = S.vocabName(kd.values);
    const vals = kd.list ? value.split(',').map((x) => x.trim()) : [value];
    if (vn) for (const v of vals) c.vocabUses.push({ vocab: vn, value: v, idx, code: 'W024', what: `${key}:` });
    if (kd.pattern && !new RegExp(kd.pattern, 'u').test(value)) c.d('W024', idx, `${key}: ${value} does not match ${kd.pattern}`);
  }
}

/** ## Variants and ## Steps. */
export function parseSubdocSection(S, c, sec, def) {
  const { lines, mask } = c, R = S.R;
  const kind = def.subdocuments;
  const want = S.subdocPrefix[kind];
  const sub = splitSub(lines, sec.start, sec.end, mask);
  const intro = contentIdx(lines, sub.intro[0], sub.intro[1], mask);
  if (intro.length && (sub.subs.length || !bodyState(lines, intro, R))) {
    for (const i of intro) c.d('W015', i, `text before the first ### sub-document in ## ${def.heading}`);
  }
  const names = new Set();
  for (const s of sub.subs) {
    const m = R.subdoc.exec(lines[s.idx]);
    if (!m) { c.d('W023', s.idx, `sub-document heading must be "### ${kind === 'flow-step' ? '<glyph> ' : ''}<Name> · #${want}<6 digits>"`); continue; }
    const core = m.groups.core;
    if (core.slice(0, 2) !== want) { c.d('E003', s.idx, `${core} does not fit ## ${def.heading} (expects ${want}…)`); continue; }
    const sd = { core, kind, name: m.groups.name, glyph: m.groups.glyph || null, idx: s.idx, end: s.end, section: def.heading, anchorIdx: -1, host: c };
    c.subs.push(sd);
    const next = s.idx + 1 < s.end ? lines[s.idx + 1] : null;
    const am = next != null ? R.anchor.exec(next) : null;
    if (am) {
      sd.anchorIdx = s.idx + 1;
      if (am.groups.anchor !== core.toLowerCase()) c.d('W023', s.idx + 1, `anchor id must be ${core.toLowerCase()}`);
    } else c.d('I006', s.idx, `anchor line <a id="${core.toLowerCase()}"></a> missing under the heading`);
    if (kind !== 'flow-step') {
      if (names.has(sd.name)) c.d('W023', s.idx, `variant name "${sd.name}" used twice`);
      names.add(sd.name);
      parseVariantBody(S, c, sd);
    } else parseStepBody(S, c, sd);
  }
}

function bodyStart(sd) { return sd.anchorIdx >= 0 ? sd.anchorIdx + 1 : sd.idx + 1; }

function parseVariantBody(S, c, sd) {
  const { lines, mask } = c, R = S.R;
  let idxs = contentIdx(lines, bodyStart(sd), sd.end, mask);
  if (idxs.length) {
    const pp = parsePassport(lines[idxs[0]], R);
    if (pp) { checkPassport(S, c, pp, idxs[0], S.raw.subdocuments[sd.kind].passport.keys, 'a variant'); sd.passport = pp; sd.passportIdx = idxs[0]; idxs = idxs.slice(1); }
  }
  const legal = new Set(S.legalInSubdoc(sd.kind).keys());
  const prefixless = S.prefixlessIn(sd.kind);
  const cx = relCx(S, prefixless);
  const group = [];
  let states = 0, parts = 0;
  const recs = [];
  for (const idx of idxs) {
    const t = lines[idx].trim();
    if (R.blind.test(t) || R.none.test(t) || R.forgiveness.test(t)) {
      states++;
      if (R.forgiveness.test(t)) { c.d('I005', idx, `"${t}" read as —`); c.forgive.push(idx); }
      if (!R.none.test(t)) c.bs('lists');
      continue;
    }
    const p = parseRelLine(lines[idx], cx, R);
    const rec = handleRel(S, c, p, idx, { legal, ordered: p.kind === 'rel' && p.rel === prefixless ? true : p.kind === 'rel' ? false : null, section: sd.section, sub: sd, strict: false, countBlind: true, defaultRel: prefixless, group });
    if (rec && rec.rel === prefixless) { parts++; recs.push(rec); }
  }
  markIncomplete(S, c, recs);
  if (states && parts) c.d('W015', sd.idx, "a variant's component list is either lines or — / none, not both");
  if (group.length) c.groups.push(group);
}

function parseStepBody(S, c, sd) {
  const { lines, mask } = c, R = S.R;
  const shape = sd.glyph ? S.shapeByGlyph[sd.glyph] : null;
  if (!shape) c.d('W025', sd.idx, 'step heading needs its glyph: ○ □ ◇ ◎ ⧉ ⚡');
  sd.shape = shape ? shape.name : null;
  const idxs = contentIdx(lines, bodyStart(sd), sd.end, mask);
  if (idxs.length && parsePassport(lines[idxs[0]], R)) c.d('W024', idxs[0], 'steps carry no passport line (the glyph is the type)');
  const bs = bodyState(lines, idxs, R);
  if (bs === 'forgive') { c.d('I005', idxs[0], `"${lines[idxs[0]].trim()}" read as —`); c.forgive.push(idxs[0]); }
  if (bs === 'blind' || bs === 'forgive') { c.bs('sections'); return; }
  if (bs === 'none' || bs === 'empty') { if (shape) checkShape(c, sd, shape, {}); return; }
  const legalMap = S.legalInSubdoc('flow-step');
  const legal = new Set(legalMap.keys());
  const counts = {};
  const cx = relCx(S, null);
  let primaries = 0;
  for (const idx of idxs) {
    const p = parseRelLine(lines[idx], cx, R);
    if (p.kind === 'rel' && shape && legalMap.has(p.rel)) {
      const e = legalMap.get(p.rel);
      if ((e.shapes && !e.shapes.includes(shape.name)) || !shape.lines[p.rel]) {
        c.d(shape.forbidden.includes(p.rel) ? 'W025' : 'W017', idx, `${p.rel} is not allowed on a ${shape.glyph} ${shape.name} step`);
        continue;
      }
    }
    const rec = handleRel(S, c, p, idx, { legal, ordered: p.kind === 'rel' ? false : null, section: sd.section, sub: sd, strict: false, countBlind: true });
    if (!rec) continue;
    counts[rec.rel] = (counts[rec.rel] || 0) + 1;
    if (rec.rel === 'Branch' && rec.quals.some((q) => q.key === 'primary')) primaries++;
  }
  if (shape) checkShape(c, sd, shape, counts);
  if (shape && shape.name === 'Fork' && primaries !== 1) c.d('I010', sd.idx, `a fork marks exactly one Branch with · primary (found ${primaries})`);
}

function checkShape(c, sd, shape, counts) {
  for (const [rel, [lo, hi]] of Object.entries(shape.lines)) {
    const n = counts[rel] || 0;
    const own = shape.name === 'Connected flow' && rel === 'Connected flow';
    if (n < lo) c.d(own ? 'W022' : 'W025', sd.idx, `${shape.glyph} ${shape.name} step needs ${lo === hi ? 'exactly' : 'at least'} ${lo} ${rel} line${lo > 1 ? 's' : ''}`);
    if (n > hi) c.d('W022', sd.idx, `${shape.glyph} ${shape.name} step allows at most ${hi} ${rel} line${hi === 1 ? '' : 's'}`);
  }
  if (shape.atLeastOneOf.length && !shape.atLeastOneOf.some((r) => counts[r])) {
    c.d('W025', sd.idx, `${shape.glyph} ${shape.name} step needs ${shape.atLeastOneOf.join(' or ')}`);
  }
}

/** userflow ## Step list: default list + ### flow variants. */
export function parseStepList(S, c, sec, def) {
  const { lines, mask } = c, R = S.R;
  const sub = splitSub(lines, sec.start, sec.end, mask);
  const legal = S.legalIn(c.type, def.heading);
  const cx = relCx(S, def.defaultRelation, true);
  const fvKeys = S.raw.subdocuments['flow-variant'].passport.keys;
  const parseList = (name, start, end, headIdx) => {
    let idxs = contentIdx(lines, start, end, mask);
    if (name !== null && idxs.length) {
      const pp = parsePassport(lines[idxs[0]], R);
      if (pp) { checkPassport(S, c, pp, idxs[0], fvKeys, 'a flow variant'); idxs = idxs.slice(1); }
    }
    const list = { name, idx: headIdx, items: [] };
    c.stepLists.push(list);
    const bs = bodyState(lines, idxs, R);
    if (bs === 'blind' || bs === 'forgive') {
      if (bs === 'forgive') { c.d('I005', idxs[0], `"${lines[idxs[0]].trim()}" read as —`); c.forgive.push(idxs[0]); }
      c.bs('lists');
      return;
    }
    if (bs) return;
    const group = [];
    for (const idx of idxs) {
      const p = parseRelLine(lines[idx], cx, R);
      const rec = handleRel(S, c, p, idx, { legal, ordered: true, section: def.heading, flowVariant: name, strict: true, countBlind: true, defaultRel: def.defaultRelation, group });
      if (rec) list.items.push(rec);
    }
    if (markIncomplete(S, c, list.items)) { list.items.pop(); list.incomplete = true; }
    if (group.length) c.groups.push(group);
  };
  parseList(null, sub.intro[0], sub.intro[1], sec.idx);
  const seen = new Set();
  for (const s of sub.subs) {
    if (R.subdoc.test(lines[s.idx])) { c.d('W023', s.idx, 'step heading outside ## Steps'); continue; }
    if (seen.has(s.text)) c.d('W026', s.idx, `flow variant "${s.text}" repeated`);
    seen.add(s.text);
    c.flowVariants.add(s.text);
    parseList(s.text, s.start, s.end, s.idx);
  }
}

/** Checks that need both ## Step list and ## Steps parsed. */
export function finishFlow(S, c) {
  const steps = new Map(c.subs.filter((s) => s.kind === 'flow-step').map((s) => [s.core, s]));
  const reached = new Set();
  for (const list of c.stepLists) {
    const items = list.items;
    if (!items.length) continue;
    let starts = 0;
    items.forEach((it, k) => {
      const a = it.atoms[0];
      if (!a || (a.kind !== 'bound' && a.kind !== 'hand')) return;
      const st = steps.get(a.core);
      if (!st) { c.d('W026', it.idx, `#${a.core} is not a step of this flow`); return; }
      reached.add(a.core);
      if (st.shape === 'Start') starts++;
      if (k === 0 && st.shape && st.shape !== 'Start') c.d('W026', it.idx, 'a step list starts with the ○ Start step');
    });
    if (starts > 1) c.d('W026', list.idx, 'a step list has exactly one ○ Start step');
    if (items.length > 15) c.d('I004', list.idx, `${items.length} steps — consider a subflow (⧉ Connected flow)`);
    const la = items[items.length - 1].atoms[0];
    const last = la && steps.get(la.core);
    if (!list.incomplete && last && last.shape && last.shape !== 'Finish' && last.shape !== 'Fork') c.d('I012', list.idx, 'a step list should end on a ◎ Finish or ◇ Fork');
  }
  for (const r of c.rels) {
    if (r.rel !== 'Branch' || !r.atoms[0]) continue;
    const a = r.atoms[0];
    if (a.kind !== 'bound' && a.kind !== 'hand') continue;
    if (!steps.has(a.core)) c.d('W018', r.idx, `Branch target #${a.core} is not a step of this flow`);
    else reached.add(a.core);
  }
  for (const s of steps.values()) if (!reached.has(s.core)) c.d('I011', s.idx, `step #${s.core} is in no step list and no Branch`);
}

/** ia ## Parts: indentation tree + ### Lateral. */
export function parseIaParts(S, c, sec, def) {
  const { lines, mask } = c, R = S.R;
  const sub = splitSub(lines, sec.start, sec.end, mask);
  const idxs = contentIdx(lines, sub.intro[0], sub.intro[1], mask);
  const bs = bodyState(lines, idxs, R);
  const legal = S.legalIn(c.type, def.heading);
  const cx = relCx(S, def.defaultRelation);
  const stack = [];
  let prev = -1;
  if (!bs) for (const idx of idxs) {
    const line = lines[idx];
    if (/\t/.test(line) || R.iaBadIndent.test(line)) { c.d('W027', idx, 'indent the tree with two spaces per level, no tabs'); continue; }
    const m = R.iaNode.exec(line);
    if (!m) { c.d('W015', idx, `not a tree line "- <screen>": ${line.trim()}`); continue; }
    const depth = m.groups.indent.length / 2;
    if (depth > prev + 1) c.d('W027', idx, 'a line is at most one level deeper than its parent');
    const p = parseRelLine(line, cx, R);
    const rec = handleRel(S, c, p, idx, { legal, ordered: false, section: def.heading, strict: true, countBlind: true, tree: true, defaultRel: def.defaultRelation });
    stack.length = depth;
    const node = { idx, depth, rec, parent: depth > 0 ? stack[depth - 1] || null : null };
    stack[depth] = node;
    prev = depth;
    c.iaNodes.push(node);
    if (rec) rec.node = node;
  }
  markIncomplete(S, c, c.iaNodes.map((n) => n.rec).filter(Boolean));
  const lat = S.legalIn(c.type, def.heading, 'Lateral');
  for (const s of sub.subs) {
    if (s.text !== 'Lateral') { c.d('W015', s.idx, `only ### Lateral may follow the tree in ## ${def.heading}`); continue; }
    for (const idx of contentIdx(lines, s.start, s.end, mask)) {
      const p = parseRelLine(lines[idx], relCx(S, null), R);
      handleRel(S, c, p, idx, { legal: lat, ordered: false, section: def.heading, strict: true, countBlind: true });
    }
  }
  const placed = new Set(c.iaNodes.map((n) => n.rec?.atoms[0]?.core).filter(Boolean));
  for (const r of c.rels) {
    if (r.rel !== 'Edge') continue;
    for (const a of r.atoms) if (a.core && !placed.has(a.core)) c.d('W027', r.idx, `Lateral endpoint #${a.core} is not placed on this map`);
  }
}
