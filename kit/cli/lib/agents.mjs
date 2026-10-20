// AGENTS.md and CLAUDE.md at a project root: how a fresh agent finds the standard and its next
// step. Written when missing, never overwritten — they belong to the project once created.
import fs from 'node:fs';
import path from 'node:path';
import { STANDARD_DIR } from './schema.mjs';
import { exists, toPosix } from './util.mjs';

export function agentsText(root, name) {
  const std = toPosix(path.relative(root, STANDARD_DIR)) || '.';
  return `# ${name} — knowledge base

This folder is a knowledge base in **MDStandard 1.0**: one markdown card per screen,
shell, flow, map, rule, API, feature and decision. The standard lives at \`${std}\` (relative to
this folder).

**Start every session here:**

    node "${std}/kit/cli/mds.mjs" next .

It reads this folder and prints the one next step — during the cold start and after it.

Always:
- read \`${std}/kit/skills/mdstandard/SKILL.md\` before you write cards; then only the sheet for the type you write;
- before writing or changing a screen: \`mds frame . <screen>\` — the shell owns navigation and controls;
- never mint IDs by hand, never edit \`⚙\` sections; after every batch: \`mds regen .\`, then \`mds check .\`.

If \`${std}\` does not exist on this machine, find the MDStandard folder (it holds \`schema.json\`
and \`kit/cli/mds.mjs\`) and correct the path in this file.
`;
}

/** Create AGENTS.md (and a CLAUDE.md that imports it) when missing. Returns the files written. */
export function ensureAgentFiles(root, name) {
  const out = [];
  const a = path.join(root, 'AGENTS.md'), c = path.join(root, 'CLAUDE.md');
  if (!exists(a)) { fs.writeFileSync(a, agentsText(root, name)); out.push('AGENTS.md'); }
  if (!exists(c)) { fs.writeFileSync(c, '@AGENTS.md\n'); out.push('CLAUDE.md'); }
  return out;
}
