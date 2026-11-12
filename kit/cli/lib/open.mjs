// intent-format open: the one list of what is still open in a workspace — [ask: …] questions, open decisions, blind spots per card,
// whys missing, confidence marks to confirm. Computed from the cards; nothing is stored.
export function openList(S, ws) {
  const blind = [], whyMissing = [], assumed = [], likely = [], decisions = [], asks = [];
  const line = (c, i) => c.lines[i]?.trim() ?? '';
  const again = S.raw.ask?.again ?? 2, today = Date.now();
  const due = (d) => d && (today - Date.parse(d)) / 86400000 >= again;
  for (const c of ws.cards) {
    if (!c.id) continue;
    const kinds = Object.entries(c.blindBy).filter(([k, v]) => v && k !== 'why').map(([k, v]) => `${k} ${v}`);
    if (kinds.length) blind.push({ core: c.id, name: c.name, path: c.rel, kinds });
    if (c.why && (c.whyEffective || c.why.state) === 'missing') whyMissing.push({ core: c.id, name: c.name, path: c.rel });
    if (c.why?.mark === 'assumed') assumed.push({ core: c.id, name: c.name, path: c.rel, where: 'Why', text: line(c, c.why.textIdx) });
    if (c.why?.mark === 'likely') likely.push({ core: c.id, name: c.name, path: c.rel, where: 'Why', text: line(c, c.why.textIdx) });
    if (c.outcomeMark === 'assumed') assumed.push({ core: c.id, name: c.name, path: c.rel, where: 'Outcome' });
    if (c.outcomeMark === 'likely') likely.push({ core: c.id, name: c.name, path: c.rel, where: 'Outcome' });
    for (const a of c.asks || []) asks.push({ core: c.id, name: c.name, path: c.rel, line: a.idx + 1, question: a.question, later: a.later, due: due(a.later) });
    if (c.type === 'decision' && S.openStatuses.includes(c.status)) decisions.push({ core: c.id, name: c.name, path: c.rel, status: c.status });
  }
  asks.sort((a, b) => (b.due ? 1 : 0) - (a.due ? 1 : 0));
  return { workspace: ws.folder, asks, blindSpots: blind, whyMissing, assumed, likely, openDecisions: decisions };
}

export function renderOpen(o) {
  const out = [`intent-format open · ${o.workspace}`];
  const block = (title, items, f) => { out.push('', `${title} (${items.length})`); for (const x of items) out.push('  ' + f(x)); if (!items.length) out.push('  none'); };
  block('Questions to the owner ([ask: …])', o.asks, (x) => `#${x.core} ${x.name} · ${x.question}${x.later ? ` · later ${x.later}${x.due ? ' · due — ask again' : ''}` : ''} · ${x.path}:${x.line}`);
  block('Open decisions', o.openDecisions, (x) => `#${x.core} ${x.name} · ${x.status} · ${x.path}`);
  block('Assumed (a guess — ask the owner)', o.assumed, (x) => `#${x.core} ${x.name} · ${x.where} · ${x.path}`);
  block('Likely (follows from inputs — confirm)', o.likely, (x) => `#${x.core} ${x.name} · ${x.where} · ${x.path}`);
  block('Why missing (why debt)', o.whyMissing, (x) => `#${x.core} ${x.name} · ${x.path}`);
  block('Other blind spots', o.blindSpots, (x) => `#${x.core} ${x.name} · ${x.kinds.join(' · ')} · ${x.path}`);
  return out.join('\n');
}
