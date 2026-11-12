# Example app — knowledge base

This folder is a knowledge base in **Intent Format 1.0**: one markdown card per screen,
shell, flow, map, rule, API, feature and decision. The standard lives at `../..` (relative to
this folder).

**Start every session here:**

    node "../../kit/cli/intent-format.mjs" next .

It reads this folder and prints the one next step — during the cold start and after it.

Always:
- read `../../kit/skills/intent-format/SKILL.md` before you write cards; then only the sheet for the type you write;
- before writing or changing a screen: `intent-format frame . <screen>` — the shell owns navigation and controls;
- never mint IDs by hand, never edit `⚙` sections; after every batch: `intent-format regen .`, then `intent-format check .`.

If `../..` does not exist on this machine, find the Intent Format folder (it holds `schema.json`
and `kit/cli/intent-format.mjs`) and correct the path in this file.
