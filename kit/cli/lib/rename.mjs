// Intent Format 1.2 renamed headings, one key, one vocabulary and one qualifier so files read as plain
// language (schema.json → renames). Old spellings stay readable: every file is modernized as it is
// read, so parsers, regen and the app see only the new names; regen then writes the new names back,
// and `intent-format migrate` (standard: + regen) brings a whole KB up to date in one go.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text of one file with the 1.0 spellings replaced by the 1.1 ones. Pure; idempotent. */
export function modernize(text, S) {
  const r = S.renames;
  if (!r) return text;
  let t = text;
  for (const [old, now] of Object.entries(r.headings || {})) t = t.replace(new RegExp('^(## )' + esc(old) + '[ \\t]*$', 'gmu'), '$1' + now);
  for (const [old, now] of Object.entries(r.vocabularies || {})) t = t.replace(new RegExp('^(### )' + esc(old) + '[ \\t]*$', 'gmu'), '$1' + now);
  for (const [old, now] of Object.entries(r.keys || {})) {
    t = t.replace(new RegExp('^' + esc(old) + ':', 'gmu'), now + ':');          // front matter and passport lines
    t = t.replace(new RegExp('( · )' + esc(old) + ':', 'gu'), '$1' + now + ':'); // passport pairs and qualifiers
  }
  for (const [old, now] of Object.entries(r.qualifiers || {})) t = t.replace(new RegExp('( · )' + esc(old) + ':', 'gu'), '$1' + now + ':');
  return t;
}

/** True when the text still carries a 1.0 spelling (for W001-style hints). */
export const isLegacy = (text, S) => modernize(text, S) !== text;
