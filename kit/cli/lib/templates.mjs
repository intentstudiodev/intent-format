// Blank cards, generated from schema.json. Used by build-kit (templates/<type>.md), init and new.
import { fmValue } from './parse.mjs';

/** Template core: the type prefix + 000000 (never minted). */
export const templateCore = (S, type) => S.prefixOfType[type] + '000000';

export const templateName = (type) => 'New ' + type.replace(/-/g, ' ');

/**
 * Render a blank card. values: { id, name, status?, state?, feature?, parent?, ... } — keys are
 * written in schema order; required keys get — (status: the type's templateStatus).
 */
export function renderCard(S, type, values = {}) {
  const def = S.typeDef(type);
  const v = { ...values };
  v.id = v.id || templateCore(S, type);
  v.name = v.name || templateName(type);
  const fm = ['---'];
  for (const raw of def.keys) {
    const key = raw.replace(/\?$/, '');
    if (key === 'x-*') continue;
    const optional = raw.endsWith('?');
    let val;
    if (key === 'standard') val = S.standard;
    else if (key === 'type') val = type;
    else if (key === 'status') val = v.status ?? def.templateStatus;
    else if (v[key] !== undefined && v[key] !== null) val = v[key];
    else if (!optional) val = '—';
    else continue;
    const kd = S.keyDef(type, key);
    fm.push(`${key}: ${fmValue(S, key, val, Array.isArray(kd?.values))}`);
  }
  fm.push('---');
  const body = [`# ${v.name} · #${v.id}`];
  if (def.preamble && def.preamble.required) body.push('', '—');
  for (const sec of def.sections) {
    if ((!sec.required && !sec.inTemplate) || sec.generated) continue;
    body.push('', `## ${sec.heading}`, sec.template || '—');
  }
  return [...fm, ...body].join('\n') + '\n';
}
