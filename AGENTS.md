# Intent Format 1.2 — for agents

This folder is the standard, not a knowledge base. Never write project files here.

- **Build a KB for a project:** read `kit/skills/kb-cold-start/SKILL.md`, then run
  `node kit/cli/intent-format.mjs next <project-root>` and do the step it prints. Repeat.
- **Continue a KB someone else started:** `node kit/cli/intent-format.mjs next <project-root>` — it
  works from the project folder alone.
- **Write or change cards:** `kit/skills/intent-format/SKILL.md`, then only the sheet for the type.
- Each project is its own folder; this one is shared and read-only. `spec.md` only settles edge
  cases; `schema.json` is for tools.
