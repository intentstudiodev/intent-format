// Loads schema.json (located relative to this file) and derives lookup tables from it.
// Nothing here restates schema data: every table is computed from the JSON.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SCHEMA_PATH = fileURLToPath(new URL('../../../schema.json', import.meta.url));
export const STANDARD_DIR = path.dirname(SCHEMA_PATH);

const CARD = 'card';

function parseCount(s) {
  const m = /^(\d+)(\.\.(\d+)?)?$/.exec(s);
  if (!m) return [0, Infinity];
  const lo = +m[1];
  if (!m[2]) return [lo, lo];
  return [lo, m[3] === undefined ? Infinity : +m[3]];
}

export function loadSchema(file = SCHEMA_PATH) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const flags = s.regexFlags || 'u';
  const re = (src, extra = '') => new RegExp(src, flags + extra);
  const g = s.grammar;
  const R = {
    fmLine: re(g.frontMatterLine),
    quoted: re(g.values.quoted),
    list: re(g.values.list),
    needsQuotes: re(g.values.needsQuotes),
    readsAsNonString: re(g.values.readsAsNonString),
    core: re(g.core),
    title: re(g.titleLine),
    plainTitle: re(g.plainTitle),
    statusLine: re(g.statusLine),
    section: re(g.sectionHeading),
    subsection: re(g.subsectionHeading),
    subdoc: re(g.subdocumentHeading),
    anchor: re(g.anchorLine),
    passportLine: re(g.passportLine),
    passportPair: re(g.passportPair),
    listLine: re(g.listLine),
    relationPrefix: re(g.relationPrefix),
    stepGlyph: re(g.stepGlyph),
    generatedLine: re(g.generatedLine),
    qualifier: re(g.qualifier),
    bound: re('^' + g.atoms.bound + '$'),
    boundG: re(g.atoms.bound, 'g'),
    hand: re('^' + g.atoms.hand + '$'),
    handG: re(g.atoms.hand, 'g'),
    placeholder: re('^' + g.atoms.placeholder + '$'),
    placeholderG: re(g.atoms.placeholder, 'g'),
    renderedG: re(g.atoms.renderedIdInReference, 'g'),
    rendered: re(g.atoms.renderedIdInReference),
    link: re(g.link),
    iaNode: re(g.iaNodeLine),
    iaBadIndent: re(g.iaBadIndent),
    ordered: re(g.orderedLine),
    incompleteItem: re(g.incompleteListItem),
    blind: re(g.body.blindSpot),
    none: re(g.body.none),
    forgiveness: re(g.body.forgiveness),
    reqMarker: re(g.requirementMarker),
    userStory: re(g.userStory),
    useCase: re(g.useCaseLine),
    gwt: re(g.gwtLine),
    ears: re(g.earsLine),
    checklist: re(g.checklistLine),
    tags: re(g.tagsLine),
    doDont: re(g.doDontLine),
    tableRow: re(g.tableRow),
    tableSep: re(g.tableSeparator),
    vocabBullet: re(g.vocabularyBullet),
    filename: re(g.filename),
    workspaceFolder: re(g.workspaceFolder),
    version: re(g.version),
    kbSlug: re(g.kbSlug),
    origin: re(g.origin),
    stateCode: re(g.stateCode),
    idPattern: re(s.idPattern),
    extPrefix: s.reservedPrefixes.filter((p) => !/SS/.test(p.pattern)).map((p) => re(p.pattern)),
    reservedPrefix: s.reservedPrefixes.map((p) => re(p.pattern)),
  };

  const roster = s.typeRoster;
  const typeIndex = new Map(roster.map((t, i) => [t, i]));
  const prefixOfType = {}, typeOfPrefix = {}, kindOfPrefix = {}, subdocPrefix = {};
  for (const [p, d] of Object.entries(s.prefixes)) {
    if (d.kind === CARD) { prefixOfType[d.type] = p; typeOfPrefix[p] = d.type; }
    else { typeOfPrefix[p] = d.subdocument; subdocPrefix[d.subdocument] = p; }
    kindOfPrefix[p] = d.kind;
  }
  const folderOfType = {}, typeOfFolder = {};
  for (const t of roster) {
    const f = s.types[t].folder;
    folderOfType[t] = f;
    if (f) typeOfFolder[f] = t;
  }

  // Relation legality, from relations.*.authoredIn
  const inSection = new Map();   // "type\0section[\0subsection]" -> Set(rel)
  const inSubdoc = new Map();    // subdoc kind -> Map(rel -> {shapes, prefixless})
  const prefixlessSubdoc = {};
  for (const [name, r] of Object.entries(s.relations)) {
    for (const a of r.authoredIn || []) {
      if (a.subdocument && !a.passportKey) {
        if (!inSubdoc.has(a.subdocument)) inSubdoc.set(a.subdocument, new Map());
        inSubdoc.get(a.subdocument).set(name, { shapes: a.shapes || null, prefixless: !!a.prefixless });
        if (a.prefixless) prefixlessSubdoc[a.subdocument] = name;
      } else if (a.section) {
        const k = [a.type, a.section, a.subsection].filter(Boolean).join('\0');
        if (!inSection.has(k)) inSection.set(k, new Set());
        inSection.get(k).add(name);
      }
    }
  }

  // Step shapes
  const fsDef = s.subdocuments['flow-step'];
  const shapeByGlyph = {};
  for (const [name, d] of Object.entries(fsDef.shapes)) {
    const lines = {};
    for (const [rel, c] of Object.entries(d.lines)) lines[rel] = parseCount(c);
    for (const [rel, c] of Object.entries(fsDef.commonLines)) {
      if ((d.excludeCommon || []).includes(rel) || lines[rel]) continue;
      lines[rel] = parseCount(c);
    }
    shapeByGlyph[d.glyph] = { name, glyph: d.glyph, lines, atLeastOneOf: d.atLeastOneOf || [], forbidden: d.forbidden || [] };
  }

  const keyDefs = {};
  for (const t of roster) {
    const m = new Map();
    for (const k of s.universalKeys) m.set(k.key, k);
    for (const k of s.types[t].extras) m.set(k.key, k);
    m.set(s.originKey.key, s.originKey);
    keyDefs[t] = m;
  }

  const diag = new Map(s.diagnostics.map((d) => [d.code, d]));

  const S = {
    raw: s, R, roster, typeIndex, prefixOfType, typeOfPrefix, kindOfPrefix, subdocPrefix,
    folderOfType, typeOfFolder, shapeByGlyph, diag,
    standard: s.standard,
    legacyStandards: s.legacyStandards || [],
    gear: s.conventions.gear,
    relations: s.relations,
    generated: s.generatedSections,
    modules: s.workspace.moduleFolders,
    lifecycles: s.lifecycles.values,
    isCardType: (t) => typeIndex.has(t),
    typeDef: (t) => s.types[t],
    sections: (t) => s.types[t].sections,
    sectionDef: (t, h) => s.types[t]?.sections.find((x) => x.heading === h) || null,
    legalIn: (type, section, subsection) =>
      inSection.get([type, section, subsection].filter(Boolean).join('\0')) || new Set(),
    legalInSubdoc: (kind) => inSubdoc.get(kind) || new Map(),
    prefixlessIn: (kind) => prefixlessSubdoc[kind] || null,
    statusValues: (t) => s.statusVocabularies[s.types[t].statusVocabulary].values,
    openStatuses: s.statusVocabularies.decision.open,
    keyOrder: (t) => s.types[t].keys.map((k) => k.replace(/\?$/, '')),
    keyDef: (t, k) => keyDefs[t]?.get(k) || null,
    requiredKeys: (t) => s.types[t].keys.filter((k) => !k.endsWith('?')),
    alwaysQuoted: new Set(s.frontMatter.values.alwaysQuoted),
    reserved: s.vocabularies.reservedValues,
    vocabName: (v) => (typeof v === 'string' && v.startsWith('@vocabulary:') ? v.slice(12) : null),
    /** card type, sub-document kind, 'x' for extension prefixes, or null */
    typeOfCore(core) {
      const p = core.slice(0, 2);
      if (typeOfPrefix[p]) return typeOfPrefix[p];
      if (R.extPrefix.some((r) => r.test(p))) return 'x';
      return null;
    },
    isSubdocKind: (k) => !!subdocPrefix[k],
    hostOfKind: (k) => s.subdocuments[k]?.host || null,
  };
  return S;
}
