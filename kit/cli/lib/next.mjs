// intent-format next: read a project folder and say the one next step. All state comes from the project's
// own files (inputs/, proposal/, report.md, the cards), so any agent can pick up a half-built
// folder. The procedure itself lives in kit/skills/kb-cold-start/SKILL.md; this only points into it.
import path from 'node:path';
import { STANDARD_DIR } from './schema.mjs';
import { exists, readText, listDir } from './util.mjs';
import { readInventory } from './create.mjs';
import { checkProject } from './check.mjs';
import { renderCard } from './templates.mjs';
import { parseFrontMatter, parseSkeleton } from './parse.mjs';

const KIT = path.join(STANDARD_DIR, 'kit', 'skills');
const SKILL = path.join(KIT, 'kb-cold-start', 'SKILL.md');
const sheet = (t) => path.join(KIT, 'intent-format', 'types', `${t}.md`);
const STEPS = ['Set up', 'Kickoff', 'Proposal', 'Owner review', 'Scaffold', 'Fill', 'Check', 'Report'];
/** Frames and maps before places: a screen is written against the shells that frame it. */
export const FILL_ORDER = ['project', 'role', 'feature', 'shell', 'ia', 'screen', 'component', 'userflow', 'rule', 'api', 'backend', 'tech', 'edge-case', 'decision', 'comment'];

/** A card is pristine when its authored sections still read as its template: scaffolded, not filled. */
export function isPristine(S, c) {
  const body = (lines, sections) => sections.filter((x) => !x.gear).map((x) => [x.heading, ...lines.slice(x.start, x.end).map((l) => l.trim()).filter(Boolean)].join('\n')).join('\n');
  const secs = c.sk.sections;
  if (!secs.length || !S.typeDef(c.type)) return false;
  const t = renderCard(S, c.type, { id: c.id, name: c.name }).split('\n');
  const fm = parseFrontMatter(t, S.R);
  const tsk = parseSkeleton(t, fm.end + 1, S.R, new Array(t.length).fill(false));
  const mine = body(c.lines, secs), tmpl = body(t, tsk.sections);
  if (mine === tmpl) return true;
  return secs.filter((x) => !x.gear).every((x) => c.lines.slice(x.start, x.end).map((l) => l.trim()).filter(Boolean).every((l) => l === '—'));
}

const inputFiles = (root) => listDir(path.join(root, 'inputs')).filter((e) => e.isFile() && !/^(links|kickoff-answers)\.md$/.test(e.name) && !e.name.startsWith('.')).map((e) => e.name);
const tableRows = (file) => (exists(file) ? readText(file).split('\n').filter((l) => /^\|\s*D\d+\s*\|/.test(l)).length : 0);

/** The next step for the project at root. P may be null (no workspace yet). */
export function nextStep(S, P, root, wsFolder) {
  const f = (...p) => path.join(root, ...p);
  const step = (n, o) => ({ mode: 'cold start', step: n, of: STEPS.length, title: STEPS[n - 1], read: [], ...o });
  if (!P || !P.workspaces.length) {
    return step(1, { do: [`Create the project: intent-format init ${root} --name "<Product name>" (inputs/ may already hold files; nothing in it is overwritten).`], done: 'V1.0/intent-format.md exists' });
  }
  const ws = (wsFolder && P.workspaces.find((w) => w.folder === wsFolder)) || P.workspaces.find((w) => w.lifecycle === 'in-progress') || P.workspaces[P.workspaces.length - 1];
  const base = { project: ws.name || path.basename(root), workspace: `${ws.folder} (${ws.lifecycle || '—'})` };
  const kickoff = f('inputs', 'kickoff-answers.md');
  const unattended = exists(kickoff) && /^\s*Mode:\s*unattended\b/im.test(readText(kickoff));
  const hasProposal = exists(f('proposal'));
  const r = checkProject(S, P, { ws: ws.folder });
  const errors = r.counts.error, warnings = r.counts.warning;
  const pristine = ws.cards.filter((c) => isPristine(S, c));
  const health = r.health.find((h) => h.workspace === ws.folder);
  const status = { ...base, unattended, cards: ws.cards.length, pristine: pristine.length, errors, warnings, blindSpots: health?.blindSpots ?? 0, openDecisions: health?.openDecisions ?? 0, whyDebt: health?.why?.missing ?? 0, assumed: health?.confidence?.assumed ?? 0, asks: (health?.asks?.open ?? 0) + (health?.asks?.later ?? 0) };

  // A KB that was built by hand or whose cold start is over: ongoing work.
  // files that still carry a pre-release name of the standard: migrate first, whatever the phase
  const legacy = P.workspaces.flatMap((w) => w.cards).map((c) => c.fm?.entries?.[0]).find((e) => e?.key === 'standard' && S.legacyStandards.includes(e.value));
  if (legacy) {
    return { ...status, mode: 'migrate', step: null, title: 'Migrate first', do: [`files still say ${legacy.value} — the standard is ${S.standard} now: intent-format migrate ${root}`], read: [], done: 'intent-format check shows no W001' };
  }
  // a KB from before role cards: migrate first, whatever the phase
  if (r.diagnostics.some((d) => d.code === 'W050')) {
    return { ...status, mode: 'migrate', step: null, title: 'Migrate first', do: [`project.md still holds a ### Roles table — user types are role cards now: intent-format migrate ${root}`], read: [], done: 'intent-format check shows no W050' };
  }
  const ongoing = exists(f('report.md')) || (!hasProposal && !exists(kickoff) && ws.cards.length > 1);
  if (ongoing) {
    const todo = [];
    if (errors || warnings) todo.push(`Fix ${errors} error(s) and ${warnings} warning(s): intent-format check ${root}`);
    if (pristine.length) todo.push(`${pristine.length} card(s) still empty — e.g. ${pristine.slice(0, 3).map((c) => c.rel).join(', ')}`);
    todo.push('Before writing or changing a screen: intent-format frame <root> <screen> — obey the Places inside it prints.');
    return { ...status, mode: 'ongoing', step: null, title: exists(f('report.md')) ? 'Cold start complete' : 'Established KB', do: todo, read: [path.join(KIT, 'intent-format', 'SKILL.md')], done: 'after every batch of edits: intent-format regen, then intent-format check' };
  }
  if (!exists(kickoff)) {
    return { ...status, ...step(2, {
      do: ['Hand the owner kickoff-questionnaire.md; their answers go to inputs/kickoff-answers.md, keeping the question numbers.',
        'No owner available: write inputs/kickoff-answers.md yourself, first line "Mode: unattended", every answer "Unknown", then continue.'],
      read: [path.join(KIT, 'kb-cold-start', 'kickoff-questionnaire.md'), `${SKILL} — Phase 1`],
      done: 'inputs/kickoff-answers.md exists' }) };
  }
  const inputs = inputFiles(root);
  if (!exists(f('proposal', 'inventory.md'))) {
    return { ...status, ...step(3, {
      do: [`Read every input (${inputs.length} file(s) in inputs/, plus links.md and the kickoff answers). Set the lifecycle in ${ws.folder}/intent-format.md from kickoff question 7 if it is not in-progress.`,
        'Write proposal/inventory.md (one table: Type · Name · Parent / home · Evidence · Confidence · Core), proposal/frames.md (shells and navigation), proposal/decisions.md and proposal/questions.md. No cards yet.'],
      read: [`${SKILL} — Phase 2 and 3`, path.join(KIT, 'intent-format', 'types', '_overview.md'), path.join(KIT, 'kb-cold-start', 'templates.md')],
      done: 'proposal/inventory.md exists' }) };
  }
  if (!exists(f('proposal', 'review.md'))) {
    return { ...status, ...step(4, {
      do: unattended
        ? ['Unattended: write proposal/review.md with the line "Unattended — recommendations applied." and continue.']
        : ['Stop and hand the proposal to the owner: they answer in proposal/review.md (approve, change, or answer each decision). Do not scaffold before.'],
      read: [`${SKILL} — Phase 3`],
      done: 'proposal/review.md exists' }) };
  }
  if (errors) {
    return { ...status, ...step(7, { do: [`Fix ${errors} error(s) first — regen refuses while they stand: intent-format check ${root}`], read: [path.join(KIT, 'intent-format', 'SKILL.md')], done: 'intent-format check shows 0 errors' }) };
  }
  const inv = readInventory(S, f('proposal', 'inventory.md'));
  const open = inv ? inv.rows.filter((x) => !x.core && x.type !== 'project') : [];
  if (!inv || open.length) {
    return { ...status, ...step(5, {
      do: inv ? [`Apply the review to proposal/inventory.md, then: intent-format scaffold ${root} --inventory ${f('proposal', 'inventory.md')} (${open.length} row(s) without a Core).`]
        : ['proposal/inventory.md has no table with Type, Name and Core columns — fix it (templates.md), then run intent-format next.'],
      read: [`${SKILL} — Phase 4`],
      done: 'every inventory row has a Core' }) };
  }
  const byType = new Map();
  for (const c of pristine) { if (!byType.has(c.type)) byType.set(c.type, []); byType.get(c.type).push(c); }
  const type = FILL_ORDER.find((t) => byType.has(t)) || [...byType.keys()][0];
  const decisionsMissing = Math.max(0, tableRows(f('proposal', 'decisions.md')) - ws.cards.filter((c) => c.type === 'decision').length);
  if (type || decisionsMissing) {
    const cards = type ? byType.get(type) : [];
    const todo = type ? [`Fill ${cards.length} ${type} card(s): ${cards.slice(0, 6).map((c) => c.rel).join(', ')}${cards.length > 6 ? ', …' : ''}`] : [];
    if (type === 'screen') todo.push('For each screen first run intent-format frame <root> <core>: write content, outcome and primary action only — the frame owns navigation and controls.');
    if (type === 'shell') todo.push('Shells before screens: Components, the one ordered Navigation list (· in: · state: · platform:), Places inside, Variants that stack. Use proposal/frames.md.');
    if (decisionsMissing && (!type || type === 'decision')) todo.push(`proposal/decisions.md has ${decisionsMissing} more row(s) than there are decision cards — every row becomes a decision card (intent-format new decision "<question>").`);
    todo.push('Then intent-format regen and intent-format next.');
    return { ...status, ...step(6, { do: todo, read: [`${SKILL} — Phase 5`, ...(type ? [sheet(type)] : [sheet('decision')])], done: 'no card is still empty and every decision row has a card' }) };
  }
  if (warnings) {
    return { ...status, ...step(7, { do: [`Fix ${warnings} warning(s): intent-format check ${root}. Infos are optional.`], read: [`${SKILL} — Phase 6`], done: 'intent-format check shows 0 errors and 0 warnings' }) };
  }
  return { ...status, ...step(8, { do: ['Write report.md at the project root (template in templates.md): what was created, health, open decisions, questions for the owner, assumptions.'], read: [`${SKILL} — Phase 7`, path.join(KIT, 'kb-cold-start', 'templates.md')], done: 'report.md exists — the cold start is over' }) };
}

export function renderNext(n, mds) {
  const head = n.step == null ? `${n.title}` : `Cold start · step ${n.step} of ${n.of} · ${n.title}`;
  const out = [`intent-format next · ${n.project ?? 'new project'}${n.workspace ? ' · ' + n.workspace : ''}${n.unattended ? ' · unattended' : ''}`, head];
  n.do.forEach((l, i) => out.push(`${i ? '      ' : '  Do  '}${l}`));
  n.read.forEach((l, i) => out.push(`${i ? '      ' : '  Read'} ${l}`));
  out.push(`  Done ${n.done}`);
  if (n.cards != null) out.push(`  Now  ${n.cards} cards · ${n.pristine} still empty · ${n.errors} errors · ${n.warnings} warnings · blind spots ${n.blindSpots} · why debt ${n.whyDebt} · assumed ${n.assumed} · asks ${n.asks} · open decisions ${n.openDecisions}`);
  out.push(`  intent-format = ${mds}`);
  return out.join('\n');
}
