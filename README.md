# MDStandard 1.0

MDStandard is a format for the knowledge base (KB) of a software product, written as plain
Markdown. Every user type, screen, shell, component, user flow, IA map, rule, API, feature, edge case, backend
node, technology, decision and comment is one **card** — one file — and cards link to each
other by permanent IDs. People read and edit the files in any editor; agents and tools parse
the same files. A small CLI mints IDs, computes the reverse links (`⚙` sections), checks the KB
and reports its health: blind spots, unresolved placeholders, open decisions.

**Status:** version 1.0 (`1.0.0`) — a rewrite of an unpublished prototype: the same core ideas, a
fraction of the size, one source of truth per concept. What changed and what was
cut: `CHANGELOG.md`. **Shells** — persistent UI is a card of type `shell`, bound per placement,
never a screen at the root; spec 6.4. **Navigation** — variants stack, one navigation list per
shell, `mds frame` and `mds next`; spec 6.4, S-PKG-8. **User types** — `role` cards replace the
Roles table (S-TYPE-15, `mds migrate`). Schema and spec change only when real use proves a need;
every change is listed in `CHANGELOG.md`.

## Get it

- **Download:** every version is on the [Releases](https://github.com/intentstudiodev/mdstandard/releases)
  page; the newest is marked *Latest*. Older versions stay available.
- **Run the CLI without installing** (Node 18 or later):
  `npx github:intentstudiodev/mdstandard#v1.0.0 check ./my-kb` — leave out `#…` for the
  latest version.
- **Versions:** `1.0.x` for fixes, `1.x.0` for additions that keep existing KBs valid, `2.0.0` for
  changes that need `mds migrate`. A KB names the version it follows in its
  `mdstandard.md` without the patch number: `standard: MDStandard/1.0`.

## Who reads what

- **People** (designers, product owners, developers): this README, then `spec.md` — the
  normative text, rules numbered `S-<TOPIC>-<n>`. `rationale.md` explains the choices.
- **Agents**: `kit/skills/mdstandard/` — a one-page router plus one sheet per card type — and
  `kit/skills/kb-cold-start/` for building a KB from raw inputs. They open `spec.md` only to
  settle an edge case.
- **Tools**: `schema.json` — the machine-readable source of types, keys, sections, relations,
  generated sections, diagnostics and grammar — and the reference CLI `kit/cli/mds.mjs`.

Also here: `templates/` (blank cards generated from the schema), `examples/example-app/` (an
abstract KB with zero errors and warnings).

## Quick start

The CLI needs Node 18 or later and nothing else. From this folder:

```sh
node kit/cli/mds.mjs init ../my-kb --name "Example app"     # project root, V1.0, manifest, project card
node kit/cli/mds.mjs next ../my-kb                           # where it stands and the one next step
node kit/cli/mds.mjs new screen "Item list" --root ../my-kb  # mints a core, writes the card
node kit/cli/mds.mjs mint FS --count 5 --root ../my-kb       # cores for flow steps (FS) or variants (SV, CV, HV)
node kit/cli/mds.mjs scaffold ../my-kb --inventory inv.md    # create every card listed in an inventory
node kit/cli/mds.mjs regen ../my-kb                          # register, rosters, ⚙ sections, status lines
node kit/cli/mds.mjs check ../my-kb                          # diagnostics and health
node kit/cli/mds.mjs frame ../my-kb "Item list"              # the shell, parts and navigation around a screen
node kit/cli/mds.mjs branch ../my-kb V1.0 V1.1               # next version, based on V1.0
```

Write facts only where you have them: unknown → `—`, known to be empty → `none`, not yet a
card → `[~ Name]`. Run `regen`, then `check`, after every batch of edits. Warnings never block;
only errors — files whose identity or format cannot be trusted — stop `regen`.
