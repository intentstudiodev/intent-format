# intent-format — the Intent Format command-line tool

Zero-dependency CLI for Intent Format 1.0 knowledge bases. Node ≥ 18; nothing to install.

```
node <standard>/kit/cli/intent-format.mjs <command> [arguments]
node <standard>/kit/cli/intent-format.mjs --help
```

`intent-format` reads `schema.json` two folders above this file (located via `import.meta.url`). Types,
prefixes, front-matter keys, sections, relations, step shapes, vocabularies, generated sections,
diagnostic severities and the grammar regexes all come from the schema; the code holds only the
algorithms (how to compute a generated section, how to compare versions).

## Commands

| Command | Does |
|---|---|
| `init <root> --name "<Name>" [--kb <slug>] [--version 1.0] [--lifecycle in-progress] [--modules a,b]` | Creates the project root (`_index.md`, `_ids.md`, `inputs/links.md`), the workspace `V<version>/` with `intent-format.md` (lifecycle from `--lifecycle`, default `in-progress`), `project.md` (core minted) and the module folders, then runs `regen`. `<root>` may exist already (e.g. holding `inputs/`): nothing in `inputs/` is overwritten; `inputs/links.md` is created only when missing. Refuses when `<root>` already holds a workspace manifest. |
| `new <type> "<Name>" --root <root> [--ws V1.0] [--feature FT…] [--state <State>] [--parent FT…]` | Mints the next core (D9.2, raising the High-water mark), writes `<ws>/<folder>/<core>-<slug>.md` from the type's template (same text as `templates/<type>.md`) and prints `<core> <path>` (path relative to the root). Without `--ws`: the only workspace, else the only `in-progress` one, else it asks for `--ws`. |
| `scaffold <root> --inventory <file> [--ws V1.0]` | Reads the first markdown table whose header has **Type**, **Name** and **Core** (optional **Parent / home**) and creates a card for every row without a Core, in this order: roles, features (top-level, then Sub-features), tech, backend, api, component, shell, screen, ia, userflow, rule, edge-case, decision, comment; row order within a type. Parent / home = the parent Feature (Sub-features) or the home feature (`feature:` on screens, userflows, components), resolved by name against existing cards and cards created in the same run. Writes each new core into that row's Core cell only. Rows with a Core and `project` rows are skipped; a row whose card already exists (same type and name) just gets its core. Idempotent. Prints one line per card and a summary; exit 1 when a row had a problem (unknown type, unresolved parent/home — the card is then created without the key). |
| `mint <PREFIX> --root <root> [--count n]` | Prints `n` new cores (one per line) for any prefix — `FS`, `SV`, `CV`, `HV` for sub-documents — and raises the prefix's High-water mark in `_ids.md` (other tables untouched). |
| `check <root> [--ws V1.0] [--json]` | Prints `<severity> <code> <path>:<line> <message>`, then `Summary: E errors · W warnings · I infos` and one health line per workspace: cards · blind spots with a breakdown by kind (status · front matter · required sections · list items · requirement slots · relation targets; `--json`: `health[].blindSpotsByKind`) · unresolved placeholders · open decisions, then why (filled · inherited · none · debt), confidence (assumed · likely) and asks. `<root>` may also be a workspace folder. |
| `regen <root>` | Refuses when `check` finds errors. Otherwise writes, per non-archived workspace: card title lines, status lines (with `new / unchanged / changed: <Part>` against `based-on`), refreshed bound-reference names/paths, hand references on relation lines upgraded to bound, sub-document anchors, ordered-line numbering, `—` for forgiveness values, every `⚙` section of the schema registry (only when non-empty, after all authored sections), folder `_index.md` rosters and `CHANGES.md` (only with `based-on`); and project-wide `_index.md` and `_ids.md` (Resolved · Retired, append-only · High-water marks). No dates. Prints the files it changed. |
| `branch <root> <from> <to>` | Copies `V<from>/` to `V<to>/`, sets `version`, `lifecycle: in-progress`, `based-on: <from>` in the manifest, then runs `regen`. |
| `migrate <root>` | Brings a KB up to date with the current version, idempotently, then runs `regen`. Files whose `standard:` key holds a pre-release name (`IntentFormat/1.0-draft.2`) get `IntentFormat/1.0`, in every workspace. Each row of the deprecated `### Roles` table becomes a role card (Description, States → `state:`), one core per role name across all workspaces so a role is the same card in every version; read-only workspaces are skipped; the table is removed and the `roles` module enabled. Exit 1 if a row had a problem. |
| `next [<root>] [--ws V1.0] [--json]` | Reads the project folder and prints the one next step: during a cold start (set up · kickoff · proposal · owner review · scaffold · fill · check · report) and after it. State comes only from the project's files (`inputs/kickoff-answers.md`, `proposal/`, `report.md`, empty cards, check results), so a folder handed over half built picks up where it stopped. Fill order: project, features, shells, maps, screens, then the rest. Read-only. |
| `open <root> [--ws V1.0] [--json]` | The open list of a workspace: `[ask: …]` questions with their card and line, open decisions, `[assumed]` and `[likely]` marks on Why texts and decision Outcomes, whys still `—` (why debt), other blind spots per card (by kind). What to ask the owner next. Read-only. |
| `frame <root> <screen core or name> [--ws V1.0] [--json]` | For every placement of the screen (map nodes, flow steps, else the screen alone) and every platform: the resolved shell (S-SHELL-4), the variants that apply (they stack), the merged parts, the navigation shown there (`· platform:`, `· state:`, `· in:` applied) and the shell's `## Places inside`. Identical frames print once. Read-only. |
| `build-kit` | **Maintainer only** — regenerates the kit inside the standard from the schema: `templates/<type>.md`, `kit/skills/intent-format/types/<type>.md` (with the requirement-preset syntax), `types/_overview.md` (purpose + not-to-confuse-with per type) and `links.md`. Never run it in a KB project. |

Versions may be written `1.1` or `V1.1`.

Writing commands (`init`, `new`, `scaffold`, `mint`, `regen`, `branch`, `migrate`) hold `<root>/.intent-format.lock` while they run; a second one waits up to 30 s (a lock older than 2 min is stale). `init` and `regen` create `AGENTS.md` and `CLAUDE.md` at the root when missing and never overwrite them.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | success (`check`: no errors; warnings and infos do not fail) |
| 1 | the KB has errors (`check`, `regen`), a `scaffold` row had a problem, or the command was refused (existing manifest, unknown workspace, target exists, read-only workspace…) |
| 2 | usage error (unknown command, missing or bad argument) |

### regen never

Mints cores, promotes placeholders, edits prose, front-matter values or relation targets, renames
files, reorders authored sections, or touches `archived` workspaces. `## x-<name>` and `## ⚙ x-<name>`
sections and `- x-<slug>:` lines are left byte-for-byte. Running it twice with no edits changes zero
bytes (the smoke test asserts this with a hash of the whole tree).

## Diagnostics

`check` implements **72 of the 73** schema diagnostics: all 5 errors, all 43 warnings, 24 of 25 infos.

| Not checked | Why |
|---|---|
| I022 Membership key dropped on import | emitted by import; `intent-format` has no import command yet |

Partial coverage (known limits, not yet checked):

- **E005** can only fire for extension (`X*`/`Z*`) cores: E003 already ties every roster prefix to one type.
- **W006** Role values are checked in `## User stories` (reported as W037) and in User story blocks; the Roles table's States column is checked against States.
- **W021** an unquoted qualifier value containing ` · ` cannot be told apart from a second qualifier; it is reported as an unknown or malformed qualifier.
- **W028** variant pins are checked by name or core on screens/components and by flow-variant name on flows.
- **W031** loose cards outside a workspace are not checked (valid fragments, D18.1).
- **I021** ignores references, requirement markers (`**R1 · …**`, `R1`) and version labels (`V1`, `v2.0`).
- **I014** compares placeholder names with card and sub-document names exactly (whitespace collapsed).
- **I020** compares whole files with what `regen` would write; **I001** compares status lines the same way (both skip `archived` workspaces).
- Step lines: too few of a required line (and forbidden lines) → W025; too many → W022; a ⧉ step without exactly one Connected flow → W022.

Health numbers (D12.6, D19.2), with blind spots broken down by kind (`schema.health.numbers.blindSpots.kinds`):
**status** (`status: —`) · **front matter** (any other front-matter or variant-passport value `—`) ·
**required sections** (`—` as the body of a required section, a step or a comment remark; a decision's
Outcome is not counted while Open/Proposed) · **list items** (`—` as a whole variant/flow-variant list, or a
final `- —` / `N. —` item = incomplete list: more items exist but are unknown — counted in any section,
never a bad line) · **requirement slots** (preset and user-story slots) · **relation targets** (`—` as a
target or as Entry/Outcome text, in required sections and sub-documents). Forgiveness values (`-`, `–`,
`TBD`, `?`) count as `—`. Unresolved placeholders = distinct (target types, name) groups. Open decisions =
decision cards with status Open or Proposed.

## Behaviour choices

- Generated lines: one per target + qualifiers, sorted by type roster order, then core, then
  qualifier values; sources inside sub-documents carry `· at: #<core>`; `⚙ Used in` adds transitive
  hosts with `· via:` and follows `· variant:` pins. `⚙ Edge cases` omits `· severity:` when the edge
  case has none; `⚙ Sub-features` omits the one-liner note when it is `—`.
- Sources in disabled modules are ignored when computing generated sections.
- Change status compares fingerprints (front matter except `standard`, the name, the remark of a
  comment as part `Preamble`, each authored section) with references reduced to `#CORE`, numbering,
  anchors, ⚙ lines and trailing spaces normalised.
- Templates use the core `<PREFIX>000000` and the name `New <type>`; `new` replaces both.
- Not written: optional `⚙ Prev` / `⚙ Next` step lines (MAY); courtesy file renames when a name
  changes (I016 reports the slug drift).

## Tests

```
node kit/cli/test/smoke.mjs [--save <dir>] [--keep]
```

Runs end to end in a temp dir: `init` into a root that already has `inputs/` → `new` for every type
(features with Sub-features and `feature:` homes, tech via `Built with`, a decision with `Affects`, a
screen with a component list and a variant, flows whose `FS` cores come from `mint`) → `regen` → `check` = 0
errors / 0 warnings → second `regen` changes nothing → V1.0 released, `branch` V1.0→V1.1 → one card
edited and one created in V1.1 → `regen` → status line `changed: Components`, `CHANGES.md` lists it →
check + idempotency again; `scaffold` from an inventory (a second run creates nothing and leaves the file
unchanged), the incomplete-list marker (counted as a list blind spot, no warning) and `init --lifecycle`. It also checks every `templates/<type>.md` in a fresh workspace and
assembles every `schema.types.*.example` (plus stubs for the cards they reference) into a KB that must
pass with 0 errors / 0 warnings. `--save` copies the final KB (this is how
`examples/example-app/` is produced).

## Files

| File | Role |
|---|---|
| `intent-format.mjs` | argument parsing and the commands |
| `lib/create.mjs` | minting, High-water marks, card creation (`new`) and `scaffold` |
| `lib/schema.mjs` | loads `schema.json`, compiles the grammar, derives lookup tables |
| `lib/parse.mjs` | front matter, card skeleton, relation lines, passports, tables |
| `lib/model.mjs` | per-file model and local diagnostics (front matter, title, sections, prose, vocabularies) |
| `lib/relations.mjs` | relation sections, variants, steps, step lists, IA trees |
| `lib/project.mjs` | project root, workspaces, core index, `_ids.md` |
| `lib/check.mjs` | cross-card, workspace and generated-file checks; health numbers |
| `lib/generate.mjs` | generated sections, status lines, fingerprints, rosters, `_ids.md`, `CHANGES.md` |
| `lib/regen.mjs` | card rewriting and the regen plan |
| `lib/templates.mjs` | blank cards from the schema |
| `lib/kit.mjs` | `build-kit`: templates, type sheets, `links.md` |
| `test/smoke.mjs` | end-to-end smoke test |
