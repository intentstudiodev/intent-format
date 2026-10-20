// mds frame: what surrounds a screen at each of its placements (spec 6.4). Resolves the shell
// (S-SHELL-4), stacks the matching variants (S-SHELL-5), merges parts, filters navigation
// (S-SHELL-6) and quotes the contract (S-SHELL-7). A view over the files; nothing is stored.

const fmList = (c, key) => {
  const e = c.fm.map.get(key);
  if (!e || e.kind === 'empty' || e.kind === 'blind') return null;
  return e.kind === 'list' ? e.items : [e.value];
};
const fmOne = (c, key) => fmList(c, key)?.[0] ?? null;
const qual = (r, key) => r.quals.find((q) => q.key === key)?.value ?? null;
const coreOf = (r) => r.atoms.find((a) => a.kind === 'bound' || a.kind === 'hand')?.core ?? null;
const bare = (v) => (v ? v.replace(/^#/, '') : null);

/** `2+` matches depth ≥ 2, `3` exactly 3; a level variant never matches an unknown depth. */
function levelMatches(spec, depth) {
  if (!spec) return true;
  if (depth == null) return false;
  const m = /^(\d+)(\+?)$/.exec(spec);
  if (!m) return false;
  return m[2] ? depth >= +m[1] : depth === +m[1];
}

function passportOf(sd) {
  const p = {};
  for (const { key, value } of sd.passport || []) p[key] = value;
  return p;
}

/** The default shell: the app shell of the platform and state for a Page, else the overlay of that presentation. */
function defaultShell(S, ws, pres, platform, state) {
  let best = null;
  for (const c of ws.cards) {
    if (c.type !== 'shell') continue;
    const kind = fmOne(c, 'shell-type');
    if (pres === 'Page' ? kind !== 'app' : kind !== 'overlay' || fmOne(c, 'appears-as') !== pres) continue;
    let score = 0;
    const plats = fmList(c, 'platform');
    if (plats && !plats.includes(S.reserved.Platforms)) { if (!platform || !plats.includes(platform)) continue; score += 2; }
    const states = fmList(c, 'state');
    if (states && !states.includes(S.reserved.States)) { if (!states.includes(state)) continue; score += 1; }
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c ?? null;
}

/** Resolve one placement: { screen, platform, state, depth, presentation?, own, variantShell, ancestors }. */
export function resolvePlacement(S, ws, p) {
  const res = (core) => ws.byCore.get(core);
  const pres = p.presentation || 'Page';
  const stepper = p.flow ? ws.cards.find((c) => c.type === 'shell' && fmOne(c, 'shell-type') === 'stepper' && fmOne(c, 'flow') === p.flow.id) : null;
  const ladder = [
    [bare(p.own), 'set on this placement'],
    [bare(p.variantShell), 'from the screen variant'],
    [stepper?.id ?? null, `the stepper of ${p.flow?.name}`],
    [pres === 'Page' ? bare(fmOne(p.screen, 'shell')) : null, 'from the screen card'],
    ...(p.ancestors || []).map((a) => [bare(a), 'from the section above']),
  ];
  // a shell whose platform: excludes this placement's platform is skipped on every rung
  const fits = (c) => { const pl = fmList(c, 'platform'); return !pl || pl.includes(S.reserved.Platforms) || !p.platform || pl.includes(p.platform); };
  let shell = null, via = 'no shell';
  for (const [v, why] of ladder) {
    if (!v) continue;
    if (v === 'none') { via = `none (${why})`; return { shell: null, via, variants: [], parts: [], navigation: [], contract: [] }; }
    const t = res(v);
    if (t && !t.sub && t.card.type === 'shell' && fits(t.card)) { shell = t.card; via = why; break; }
  }
  if (!shell) { shell = defaultShell(S, ws, pres, p.platform, p.state); if (shell) via = 'by default'; }
  if (!shell) return { shell: null, via, variants: [], parts: [], navigation: [], contract: [] };

  const variants = shell.subs.filter((sd) => sd.kind === 'shell-variant').filter((sd) => {
    const pp = passportOf(sd);
    if (pp.platform && !pp.platform.split(',').map((x) => x.trim()).includes(p.platform)) return false;
    if (pp.state && pp.state !== S.reserved.States && pp.state !== p.state) return false;
    return levelMatches(pp.level, p.depth);
  });
  const active = new Set([null, ...variants]);
  const parts = [], seen = new Set();
  for (const r of shell.rels) {
    if (r.rel !== 'Part' || !active.has(r.sub)) continue;
    const core = coreOf(r);
    if (!core || seen.has(core)) continue;
    seen.add(core);
    const t = res(core);
    parts.push({ core, name: t?.card?.name ?? core, appearsAs: qual(r, 'appears-as'), from: r.sub ? r.sub.name : null });
  }
  const has = (x) => { const h = /^#?([A-Z]{2}\d{6})$/.exec(x); return parts.find((pt) => (h ? pt.core === h[1] : pt.name.toLowerCase() === x.toLowerCase())); };
  const navigation = [];
  for (const r of shell.rels) {
    if (r.rel !== 'Leads to' || r.sub) continue;
    const plats = qual(r, 'platform')?.split(',').map((x) => x.trim());
    if (plats && !plats.includes(p.platform)) continue;
    const st = qual(r, 'state');
    if (st && st !== S.reserved.States && st !== p.state) continue;
    let where = null;
    if (r.inParts?.length) { where = r.inParts.map(has).find(Boolean); if (!where) continue; }
    const core = coreOf(r);
    const t = core && res(core);
    navigation.push({ core, name: t ? (t.sub ? t.sub.name : t.card.name) : r.atoms[0]?.name ?? '—', label: qual(r, 'label'), kind: qual(r, 'kind') || 'link', in: where?.name ?? null });
  }
  const sec = shell.sk.sections.find((s) => s.heading === 'Places inside');
  const contract = sec ? shell.lines.slice(sec.start, sec.end).map((l) => l.trim()).filter(Boolean) : [];
  return { shell, via, variants, parts, navigation, contract };
}

/** Every placement of a screen: map nodes, flow steps, else the screen alone; one row per platform. */
export function frameOf(S, ws, screen) {
  const res = (core) => ws.byCore.get(core);
  const declared = [...(ws.vocab.values.Platforms || [])];
  const allStates = [...(ws.vocab.values.States || [])];
  const own = fmList(screen, 'state')?.filter((x) => x !== S.reserved.States);
  // a stated map or flow state wins; else the states the screen exists in; else every State
  const statesFor = (st) => (st && st !== S.reserved.States ? [st] : own?.length ? own : allStates.length ? allStates : [S.reserved.States]);
  const rows = [];
  const add = (where, platforms, st, base) => {
    for (const state of statesFor(st)) for (const platform of platforms.length ? platforms : [null]) rows.push({ where, platform, state, ...resolvePlacement(S, ws, { ...base, screen, platform, state }) });
  };
  const pinned = (r) => {
    const v = qual(r, 'variant');
    if (!v) return null;
    return screen.subs.find((sd) => sd.name === v || sd.core === bare(v)) || null;
  };
  const presOf = (r, sd) => qual(r, 'appears-as') || passportOf(sd || {})['appears-as'] || fmOne(screen, 'appears-as') || 'Page';
  for (const m of ws.cards) {
    if (m.type !== 'ia') continue;
    const plats = fmList(m, 'platform')?.filter((x) => x !== S.reserved.Platforms) || declared;
    const state = fmOne(m, 'state');
    for (const n of m.iaNodes) {
      if (!n.rec || coreOf(n.rec) !== screen.id) continue;
      const path = [], ancestors = [];
      for (let a = n.parent; a; a = a.parent) {
        const t = a.rec && res(coreOf(a.rec) || '');
        path.unshift(t ? t.card.name : '?');
        if (a.rec) ancestors.push(qual(a.rec, 'shell'));
      }
      const sd = pinned(n.rec);
      add(`${m.name} › ${[...path, screen.name].join(' › ')}`, plats, state, { depth: n.depth + 1, presentation: presOf(n.rec, sd), own: qual(n.rec, 'shell'), variantShell: passportOf(sd || {}).shell, ancestors });
    }
  }
  for (const f of ws.cards) {
    if (f.type !== 'userflow') continue;
    const state = fmOne(f, 'state');
    const fplats = fmList(f, 'platform')?.filter((x) => x !== S.reserved.Platforms);
    for (const r of f.rels) {
      if (r.rel !== 'Screen' || coreOf(r) !== screen.id) continue;
      const sd = pinned(r);
      add(`${f.name} › ${r.sub ? r.sub.name : 'step'}`, fplats?.length ? fplats : declared, state, { depth: null, presentation: presOf(r, sd), own: qual(r, 'shell'), variantShell: passportOf(sd || {}).shell, flow: f });
    }
  }
  if (!rows.length) add('not placed on a map or flow', declared, null, { depth: null, presentation: fmOne(screen, 'appears-as') || 'Page' });
  return rows;
}

/** Group placements that resolve to the same frame; print each frame once, its contract once per shell. */
export function renderFrame(screen, rows) {
  const out = [`${screen.name} · #${screen.id}`];
  const groups = new Map();
  for (const r of rows) {
    const key = JSON.stringify([r.shell?.id ?? r.via, r.variants.map((v) => v.core), r.parts.map((p) => p.core), r.navigation.map((n) => [n.core, n.label, n.in])]);
    if (!groups.has(key)) groups.set(key, { r, at: new Map() });
    const g = groups.get(key), where = `${r.where} · ${r.state}`;
    if (!g.at.has(where)) g.at.set(where, []);
    if (r.platform) g.at.get(where).push(r.platform);
  }
  const contracts = new Map();
  let n = 0;
  for (const { r, at } of groups.values()) {
    out.push('');
    if (!r.shell) out.push(`${++n}. ${r.via}`);
    else {
      out.push(`${++n}. #${r.shell.id} ${r.shell.name} (${r.shell.fm.map.get('shell-type')?.value}) — ${r.via}${r.variants.length ? ' · + ' + r.variants.map((v) => v.name).join(' + ') : ''}`);
      if (r.contract.length) contracts.set(r.shell.id, r);
    }
    for (const [where, plats] of at) out.push(`   at     ${where}${plats.length ? ' — ' + plats.join(', ') : ''}`);
    if (!r.shell) continue;
    out.push(`   parts  ${r.parts.map((p) => p.name + (p.appearsAs ? ` (${p.appearsAs})` : '')).join(' · ') || 'none'}`);
    out.push(`   leads  ${r.navigation.map((x) => `${x.label || x.name} (${[x.kind, x.in].filter(Boolean).join(', ')})`).join(' · ') || 'none'}`);
  }
  for (const r of contracts.values()) out.push('', `Places inside — #${r.shell.id} ${r.shell.name}:`, ...r.contract.map((l) => `  ${l}`));
  if (!contracts.size && rows.some((r) => r.shell)) out.push('', 'No ## Places inside on these shells — the frame states no rules yet.');
  return out.join('\n');
}
