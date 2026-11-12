// Pure generation: generated sections, status lines, change fingerprints, rosters, _ids.md, CHANGES.md.
import path from 'node:path';
import { relLink, cut, escapeCell, toPosix, sortBy } from './util.mjs';
import { contentIdx, bodyState } from './parse.mjs';
import { targetType, targetName, highWater } from './project.mjs';

/* ---------------- references ---------------- */

export function ref(fromFile, t) {
  const core = t.sub ? t.sub.core : t.card.id;
  const p = relLink(fromFile, t.card.file) + (t.sub ? '#' + t.sub.core.toLowerCase() : '');
  return `[#${core} ${targetName(t)}](${p})`;
}

export const homeOf = (c) => {
  const v = c.fm?.map.get('feature')?.value;
  return v && /^FT\d{6}$/.test(v) ? v : null;
};

/** Resolve a `· variant:` pin (name or core) to a sub-document of the target card. */
export function pinSub(card, value) {
  if (!value) return null;
  const core = value.replace(/^#/, '');
  return card.subs.find((s) => s.kind !== 'flow-step' && (s.core === core || s.name === value)) || null;
}

/* ---------------- one-liner ---------------- */

export function oneLiner(S, ws, card) {
  const { lines, sk, mask } = card;
  let start, end;
  if (card.def.preamble) { start = sk.preStart; end = sk.preEnd; }
  else {
    const dr = sk.sections.find((s) => s.full === 'Description')
      || sk.sections.find((s) => !s.gear && s.def && s.def.content === 'prose');
    if (!dr) return '—';
    start = dr.start; end = dr.end;
  }
  const idxs = contentIdx(lines, start, end, mask);
  const bs = bodyState(lines, idxs, S.R);
  if (bs && bs !== 'none') return '—';
  const para = [];
  for (let i = idxs[0]; i < end && lines[i].trim() !== '' && !mask[i]; i++) para.push(lines[i].trim());
  let text = para.join(' ').replace(/^\*\*R\d+ · [^*]+\*\*\s*/, '');
  text = text.replace(S.R.boundG, (...a) => {
    const g = a[a.length - 1];
    const t = ws.byCore.get(g.core);
    return t ? targetName(t) : (g.name || '#' + g.core);
  });
  text = text.replace(S.R.handG, (...a) => { const t = ws.byCore.get(a[a.length - 1].core); return t ? targetName(t) : a[0]; });
  text = text.replace(S.R.placeholderG, (...a) => a[a.length - 1].name)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const m = /^(.*?[.?!])(?=\s|$)/u.exec(text);
  if (m) text = m[1];
  return text ? cut(text, 120) : '—';
}

/* ---------------- edges ---------------- */

export function collectEdges(S, ws) {
  const edges = [];
  const enabled = (c) => !S.folderOfType[c.type] || ws.modules.includes(S.folderOfType[c.type]);
  const roleByName = new Map();
  for (const c of ws.cards) if (c.type === 'role' && c.id && c.name && !roleByName.has(c.name)) roleByName.set(c.name, { card: c, sub: null });
  for (const c of ws.cards) {
    if (!c.id || !enabled(c)) continue;
    // user stories name a role by its card name → ⚙ Stories on the role
    for (const st of c.stories || []) {
      const t = roleByName.get(st.role);
      if (t && t.card !== c) edges.push({ rel: 'Story', src: c, at: null, t, rec: null, story: st.n ? 'R' + st.n : 'User stories' });
    }
    for (const r of c.rels) {
      const def = S.relations[r.rel];
      if (r.rel === 'Branch') {
        const rq = r.quals.find((q) => q.key === 'rule');
        const h = rq && rq.value && S.R.hand.exec(rq.value);
        const t = h && ws.byCore.get(h.groups.core);
        if (t && !t.sub && t.card.type === 'rule') edges.push({ rel: 'Branch', src: c, at: r.sub?.core || null, t, rec: r });
        continue;
      }
      if (!def.generatedReverse) continue;
      for (const a of r.atoms) {
        if (a.kind !== 'bound' && a.kind !== 'hand') continue;
        const t = ws.byCore.get(a.core);
        if (!t || (def.targetTypes.length && !def.targetTypes.includes(targetType(t)))) continue;
        const pin = !t.sub && r.variant ? pinSub(t.card, r.variant) : null;
        edges.push({ rel: r.rel, src: c, at: r.sub?.core || null, t, pin, rec: r });
      }
    }
    for (const [key, rel, type] of [['feature', 'Home', 'feature'], ['parent', 'Parent', 'feature'], ['flow', 'Realises', 'userflow']]) {
      const v = c.fm.map.get(key)?.value;
      const t = v && ws.byCore.get(v);
      if (t && !t.sub && t.card.type === type && t.card !== c) edges.push({ rel, src: c, at: null, t, rec: null });
    }
    // framing (shell: keys, variant passports, · shell: on IA nodes and step Screen lines) → ⚙ Wraps on the shell
    const shellOf = (v) => {
      const t = v && /^SH\d{6}$/.test(v) && ws.byCore.get(v);
      return t && !t.sub && t.card.type === 'shell' ? t : null;
    };
    if (c.type === 'screen') {
      const t = shellOf(c.fm.map.get('shell')?.value);
      if (t) edges.push({ rel: 'Shell', src: c, at: null, t, rec: null });
      for (const sd of c.subs) {
        const t2 = shellOf(sd.passport?.find((x) => x.key === 'shell')?.value);
        if (t2) edges.push({ rel: 'Shell', src: c, at: sd.core, t: t2, rec: null });
      }
    }
    for (const r of c.rels) {
      if (r.rel !== 'Node' && r.rel !== 'Screen') continue;
      const t = shellOf(r.quals.find((x) => x.key === 'shell')?.value?.replace(/^#/, ''));
      if (!t) continue;
      edges.push({ rel: 'Shell', src: c, at: r.rel === 'Node' ? r.atoms[0]?.core || null : r.sub?.core || null, t, rec: r });
    }
  }
  return edges;
}

/* ---------------- generated sections ---------------- */

function lineText(card, l) {
  const q = l.quals.map(([k, v]) => ` · ${k}: ${v}`).join('');
  return `- ${ref(card.file, { card: l.card, sub: null })}${q}${l.note ? ' — ' + l.note : ''}`;
}

function finish(S, card, lines) {
  const seen = new Set(), out = [];
  for (const l of lines) {
    const k = l.card.id + '|' + l.quals.map((x) => x.join('=')).join('|') + '|' + (l.note || '');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  sortBy(out, (l) => S.typeIndex.get(l.card.type) ?? 99, (l) => l.card.id, (l) => l.quals.map((x) => x[1]).join(' '));
  return out.map((l) => lineText(card, l));
}

export function makeContext(S, ws) {
  const edges = collectEdges(S, ws);
  const partsOf = new Map();
  for (const e of edges) {
    if (e.rel !== 'Part') continue;
    const key = e.src.id + '|' + (e.at || '');
    if (!partsOf.has(key)) partsOf.set(key, { holder: { card: e.src, at: e.at }, parts: [] });
    partsOf.get(key).parts.push({ comp: e.t.card, pin: e.pin });
  }
  return { S, ws, edges, partsOf, oneLiners: new Map() };
}

function closure(ctx, comp, pin, seen = new Set()) {
  const key = comp.id + '|' + (pin ? pin.core : '');
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const p of ctx.partsOf.get(key)?.parts || []) closure(ctx, p.comp, p.pin, seen);
  return seen;
}

function usedOn(ctx, card) {
  const out = [];
  for (const { holder, parts } of ctx.partsOf.values()) {
    if (holder.card === card) continue;
    const at = holder.at ? [['at', '#' + holder.at]] : [];
    for (const p of parts) {
      if (p.comp === card) { out.push({ card: holder.card, quals: [...at] }); continue; }
      const reach = closure(ctx, p.comp, p.pin);
      if ([...reach].some((k) => k.startsWith(card.id + '|'))) out.push({ card: holder.card, quals: [...at, ['via', '#' + p.comp.id]] });
    }
  }
  return out;
}

function homedFlows(ctx, card) {
  return ctx.edges.filter((e) => e.rel === 'Home' && e.t.card === card && e.src.type === 'userflow').map((e) => e.src);
}

function alsoLines(ctx, card, rels) {
  const out = [];
  for (const f of homedFlows(ctx, card)) {
    for (const e of ctx.edges) {
      if (e.src !== f || !rels.includes(e.rel) || e.t.sub) continue;
      const h = homeOf(e.t.card);
      if (!h || h === card.id || !ctx.ws.byCore.has(h)) continue;
      out.push({ card: e.t.card, quals: [['home', '#' + h]] });
    }
  }
  return out;
}

function reverse(ctx, card, heading) {
  const { S } = ctx;
  const g = S.generated[heading];
  const withAt = /· at:/.test(g.line);
  const bySource = S.relations.Home?.generatedReverse?.bySource || {};
  const out = [];
  for (const e of ctx.edges) {
    if (e.t.card !== card || !g.from.includes(e.rel)) continue;
    if (e.rel === 'Home' && bySource[e.src.type] !== heading) continue;
    const l = { card: e.src, quals: [] };
    const at = e.at || (e.t.sub && e.t.sub.core) || (e.pin && e.pin.core) || null;
    if (withAt && at) l.quals.push(['at', '#' + at]);
    switch (heading) {
      case '⚙ On maps': {
        const pa = e.rec?.node?.parent?.rec?.atoms[0];
        const pt = pa && pa.core && ctx.ws.byCore.get(pa.core);
        if (pt && !pt.sub && pt.card.type === 'screen') l.quals.push(['under', '#' + pt.card.id]);
        break;
      }
      case '⚙ Edge cases': {
        const sv = e.src.fm.map.get('severity')?.value;
        if (sv && sv !== '—') l.quals.push(['severity', sv]);
        break;
      }
      case '⚙ Connected from': {
        const k = e.rec.quals.find((q) => q.key === 'kind');
        if (k && k.value) l.quals.push(['kind', k.value]);
        break;
      }
      case '⚙ Entered from':
        l.quals.push(['as', e.rel === 'Hand-off' ? 'hand-off' : e.rec.sub && e.rec.sub.shape === 'Connected flow' ? 'subflow' : 'attached']);
        break;
      case '⚙ Decisions':
        l.quals.push(['status', e.src.status || '—']);
        break;
      case '⚙ Stories':
        l.quals.push(['story', e.story]);
        break;
      case '⚙ Reached from': {
        const k = e.rec?.quals.find((q) => q.key === 'kind');
        if (k && k.value) l.quals.push(['kind', k.value]);
        break;
      }
      case '⚙ Sub-features': {
        const ol = oneLiner(S, ctx.ws, e.src);
        if (ol !== '—') l.note = ol;
        break;
      }
      default: break;
    }
    out.push(l);
  }
  return out;
}

/** Generated sections of one card, in registry order, only those with content. */
export function generatedFor(ctx, card) {
  const { S } = ctx;
  const out = [];
  for (const sec of S.sections(card.type)) {
    if (!sec.generated || !S.generated[sec.heading]) continue;
    let lines;
    if (sec.heading === '⚙ Used in') lines = usedOn(ctx, card);
    else if (sec.heading === '⚙ Also uses') lines = alsoLines(ctx, card, ['Screen']);
    else if (sec.heading === '⚙ Also connects') lines = alsoLines(ctx, card, ['Connected flow', 'Hand-off']);
    else lines = reverse(ctx, card, sec.heading);
    const text = finish(S, card, lines);
    if (text.length) out.push({ heading: sec.heading, lines: text });
  }
  return out;
}

/* ---------------- versions: fingerprints and status lines ---------------- */

export function fingerprint(S, card) {
  const R = S.R;
  const norm = (arr) => {
    const out = [];
    for (let l of arr) {
      if (R.anchor.test(l) || R.generatedLine.test(l.trimStart())) continue;
      l = l.replace(R.boundG, (...a) => '#' + a[a.length - 1].core).replace(/^(\s*)\d+\. /, '$1#. ').replace(/\s+$/, '');
      if (R.forgiveness.test(l.trim())) l = '—';
      if (l === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
      out.push(l);
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
  };
  const parts = new Map();
  const pp = card.fm.entries.filter((e) => e.key !== 'standard').map((e) => `${e.key}: ${e.value}`);
  const tm = card.sk.titleIdx >= 0 ? S.R.title.exec(card.lines[card.sk.titleIdx]) : null;
  parts.set('Passport', pp.join('\n') + '\n# ' + (tm ? tm.groups.name : card.name));
  const pre = norm(card.lines.slice(card.sk.preStart, card.sk.preEnd));
  if (pre) parts.set('Preamble', pre);
  for (const sec of card.sk.sections) if (!sec.gear) parts.set(sec.heading, norm(card.lines.slice(sec.start, sec.end)));
  return parts;
}

export function changeOf(S, ws, card) {
  if (!ws.basedOn || !ws.base) return null;
  const b = ws.base.byCore.get(card.id);
  if (!b || b.sub || b.card.kind !== 'card') return { state: 'new' };
  const fa = fingerprint(S, card), fb = fingerprint(S, b.card);
  const parts = [];
  for (const [k, v] of fa) if (fb.get(k) !== v) parts.push(k);
  for (const k of fb.keys()) if (!fa.has(k)) parts.push(k);
  return parts.length ? { state: 'changed', parts } : { state: 'unchanged' };
}

export function stateCode(S, ws, card) {
  if (!ws.vocab.declared.has('States')) return '';
  const st = card.fm.map.get('state');
  if (!st) return 'SG';
  if (st.kind === 'blind') return '';
  const vals = st.kind === 'list' ? st.items : [st.value];
  if (vals.length !== 1 || vals[0] === S.reserved.States) return 'SG';
  return ws.vocab.stateCodes.get(vals[0]) || '';
}

export function statusLine(S, ws, card, change) {
  const v = ws.version;
  let s = `> ${S.gear} #${card.id}${stateCode(S, ws, card)}V${v} · V${v} ${ws.lifecycle || 'in-progress'}`;
  if (ws.basedOn) {
    s += ` · based on V${ws.basedOn}`;
    if (change) s += ' · ' + (change.state === 'changed' ? 'changed: ' + change.parts.join(', ') : change.state);
  }
  return s;
}

/* ---------------- generated files ---------------- */

const fmBlock = (S, name) => ['---', `standard: ${S.standard}`, 'type: index', `name: ${name}`, '---'];

export function folderTitle(folder) {
  const special = { userflows: 'User flows', ia: 'IA maps', apis: 'APIs' };
  return special[folder] || folder[0].toUpperCase() + folder.slice(1).replace(/-/g, ' ');
}

export function renderFolderIndex(S, ws, folder) {
  const type = S.typeOfFolder[folder];
  const dir = path.join(ws.dir, folder);
  const file = path.join(dir, '_index.md');
  const cards = sortBy(ws.cards.filter((c) => c.type === type && c.id && path.dirname(c.file) === dir), (c) => c.id);
  const name = folderTitle(folder);
  const out = [...fmBlock(S, name), `# ${name}`, '', S.typeDef(type).purpose];
  if (cards.length) {
    const keys = S.keyOrder(type);
    const states = ws.vocab.declared.has('States') && keys.includes('state');
    const memb = keys.includes('feature') ? ['Feature', 'feature'] : keys.includes('parent') ? ['Parent', 'parent'] : null;
    const cols = ['ID', 'Name', 'Status', ...(states ? ['State'] : []), ...(memb ? [memb[0]] : []), 'One-liner', 'Blind spots'];
    out.push('', `## ${S.gear} Contents`, `| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`);
    for (const c of cards) {
      const row = [`[#${c.id}](${relLink(file, c.file)})`, escapeCell(c.name || '—'), escapeCell(c.status || '—')];
      if (states) row.push(escapeCell(c.fm.map.get('state')?.value || S.reserved.States));
      if (memb) {
        const v = c.fm.map.get(memb[1])?.value;
        const t = v && ws.byCore.get(v);
        row.push(t ? escapeCell(ref(file, t)) : '—');
      }
      row.push(escapeCell(oneLiner(S, ws, c)), String(c.blind));
      out.push(`| ${row.join(' | ')} |`);
    }
  }
  return out.join('\n') + '\n';
}

export function renderRootIndex(S, P) {
  const newest = P.workspaces[P.workspaces.length - 1];
  const name = (newest && newest.name) || path.basename(P.root);
  const out = [...fmBlock(S, name), `# ${name}`, '', S.raw.indexFile.projectRoster.purpose];
  if (P.workspaces.length) {
    out.push('', `## ${S.gear} Contents`, '| Version | Lifecycle | Based on |', '|---|---|---|');
    for (const ws of P.workspaces) out.push(`| [V${ws.version}](${ws.folder}/intent-format.md) | ${ws.lifecycle || '—'} | ${ws.basedOn ? 'V' + ws.basedOn : '—'} |`);
  }
  return out.join('\n') + '\n';
}

export function idsTables(S, P) {
  const rows = new Map();
  for (const ws of P.workspaces) {
    for (const [core, t] of ws.byCore) {
      const r = rows.get(core) || { core, versions: [] };
      r.type = t.sub ? t.sub.kind : t.card.type;
      r.name = targetName(t) || '—';
      r.versions.push(ws.version);
      r.path = toPosix(path.relative(P.root, t.card.file)) + (t.sub ? '#' + t.sub.core.toLowerCase() : '');
      rows.set(core, r);
    }
  }
  const retired = new Map(P.ids.retired.map((r) => [r.core, r]));
  for (const old of P.ids.resolved) {
    if (rows.has(old.core) || retired.has(old.core) || !/^[A-Z]{2}\d{6}$/.test(old.core)) continue;
    retired.set(old.core, { core: old.core, type: old.type, name: old.name, last: old.versions[old.versions.length - 1] || '—', merged: '—' });
  }
  const hw = highWater(P);
  for (const r of retired.values()) {
    const p = r.core.slice(0, 2), n = +r.core.slice(2);
    if (!hw.has(p) || hw.get(p) < n) hw.set(p, n);
  }
  return { rows, retired, hw };
}

export function renderIds(S, P, hwOverride = null) {
  const { rows, retired, hw } = idsTables(S, P);
  if (hwOverride) for (const [p, n] of hwOverride) if (!hw.has(p) || hw.get(p) < n) hw.set(p, n);
  const g = S.gear;
  const out = [...fmBlock(S, 'ID register'), '# ID register'];
  const cell = (s) => escapeCell(s ?? '—');
  out.push('', `## ${g} Resolved`, '| Core | Type | Name | Versions | Path |', '|---|---|---|---|---|');
  for (const r of [...rows.values()].sort((a, b) => (a.core < b.core ? -1 : 1))) out.push(`| ${r.core} | ${r.type} | ${cell(r.name)} | ${r.versions.join(', ')} | ${r.path} |`);
  out.push('', `## ${g} Retired`, '| Core | Type | Name | Last version | Merged into |', '|---|---|---|---|---|');
  for (const r of [...retired.values()].sort((a, b) => (a.core < b.core ? -1 : 1))) out.push(`| ${r.core} | ${cell(r.type)} | ${cell(r.name)} | ${cell(r.last)} | ${cell(r.merged)} |`);
  out.push('', `## ${g} High-water marks`, '| Prefix | Highest |', '|---|---|');
  for (const p of [...hw.keys()].sort()) out.push(`| ${p} | ${hw.get(p)} |`);
  return out.join('\n') + '\n';
}

export function renderChanges(S, ws, changes) {
  if (!ws.basedOn) return null;
  const file = path.join(ws.dir, 'CHANGES.md');
  const out = ['---', `standard: ${S.standard}`, 'type: index', 'name: Changes', '---', `# Changes · V${ws.version} · based on V${ws.basedOn}`];
  const order = (arr) => sortBy(arr, (c) => S.typeIndex.get(c.type) ?? 99, (c) => c.id);
  const nw = order(ws.cards.filter((c) => c.id && changes.get(c)?.state === 'new'));
  const ch = order(ws.cards.filter((c) => c.id && changes.get(c)?.state === 'changed'));
  const rm = ws.base ? order(ws.base.cards.filter((c) => c.id && !ws.byCore.has(c.id))) : [];
  const g = S.gear;
  if (nw.length) out.push('', `## ${g} New`, ...nw.map((c) => `- ${ref(file, { card: c, sub: null })}`));
  if (ch.length) out.push('', `## ${g} Changed`, ...ch.map((c) => `- ${ref(file, { card: c, sub: null })} · changed: ${changes.get(c).parts.join(', ')}`));
  if (rm.length) out.push('', `## ${g} Removed`, ...rm.map((c) => `- #${c.id} — ${c.name}`));
  return out.join('\n') + '\n';
}
