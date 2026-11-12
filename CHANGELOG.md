# Changelog — Intent Format

Newest first. Every published version has a `## <version> (<date>)` heading (two numbers: 1.0, 1.1; the GitHub tag is `v<version>`, the first release was tagged `v1.0.0`); changes waiting for
the next version collect under `## Unreleased`. Decision numbers (`D25`), `_work/` files and
inventory rows (`00-03 #n`, `04-07 #n`) refer to the maintainers' working notes, which are not
published.

## 1.2 (2026-11-12) — files read as plain language; why and confidence

- **Renamed.** The format is Intent Format (identifier `IntentFormat/1.2`; the old `MDStandard/…` spellings are read and migrated). The CLI is `intent-format` (was `mds`): `kit/cli/intent-format.mjs`, package bin `intent-format`. The repository is `intentstudiodev/intent-format` (was `mdstandard`; old links redirect).
- **Features group by purpose, never by screen.** A capability with a why, rules or decisions of its own is
  a Feature wherever the user reaches it from; a Sub-feature's `## Why` is normally `same as` its Feature's;
  one level deep; a grown Sub-feature drops `parent:`, keeps its id and records a decision. Type sheet
  (`whenToUse`, `levels`, not-to-confuse-with `ia`) and spec S-FEAT-1; guidance, no new check. D29.
- **Decided, not built yet** (D30): `_summary.md`, a generated one-page overview written by `intent-format regen`
  beside `_index.md` and clearly marked as not the source of truth; `intent-format export <id> [--for speckit|kiro|bmad]`,
  a feature pack for outside pipelines.

- **`## Why` on every card type** except `comment`, right after `## Description` (after `## Question`
  on decisions). Required on project, feature, rule, decision, userflow, shell, role and tech (which
  had it since 1.0); optional elsewhere — absent means nothing to say. Values: text, `none` or
  `none — <note>` (not counted), `same as #<id>` (another card's why covers it — any card by id; `check`
  follows it [I030], an id that names no card [W051]) and `—` (counted: blind-spot kind
  `why`, printed as **why debt**). Each type has a **why question** in one of three flavours —
  purpose (project, feature, userflow, role), choice (screen, component, shell, ia, api, backend,
  tech, decision), constraint (rule, edge-case) — printed on the type sheet. Spec S-BODY-7; schema `why`.
- **`[ask: <question>]`** inside any authored sentence: a question for the owner that no value can
  hold. Counted as **asks** (open · later: `[ask: … · later <date>]` · due: later than `ask.again` = 2 days), listed by `intent-format open` with
  card and line, never dropped by a tool. Spec S-BODY-8; schema `ask`.
- **Confidence marks** at the end of a Why text or a decision Outcome: `[likely]` (follows from
  inputs, not stated) and `[assumed]` (a guess). Unmarked = confirmed; `[confirmed]` is accepted and
  `regen` removes it [I031]. Health counts both; a mark elsewhere is [W051].
- **Decision record**: optional keys `decided: <YYYY-MM-DD>`, `by: owner|agent|<role>`,
  `superseded-by: <DC core>`. A Decided decision without `decided`, a Superseded one without
  `superseded-by`, or either key on another status → [W052]; `superseded-by` must name a decision.
- **Evidence lives in `inputs/`**: a `Source` link whose path is not a URL must point inside the
  project root's `inputs/` [W053].
- **`intent-format open <root>`**: the one list of what is open — `[ask: …]` questions, open decisions, `[assumed]`
  and `[likely]` marks, whys missing, other blind spots per card. `intent-format check` and `intent-format next` print why and confidence numbers.
- Renamed to **Intent Format** (1.0.1): `standard: IntentFormat/1.2`; the old `MDStandard/…` values
  are still read and `intent-format migrate` renames them. The CLI command stays `intent-format`.

- **Renamed, so a card reads without a glossary** (schema.json → `renames`; old spellings are still
  read, `intent-format migrate` and `regen` write the new ones): `## Description & Requirements` → `## Description`,
  `## Rules applied` → `## Rules`, `## Uses API` → `## APIs` (the relation `Uses API` keeps its name),
  `## Constraints` → `## Keep in mind`, `## Main use cases` → `## User stories`; generated:
  `⚙ Placed on` → `⚙ On maps`, `⚙ Flows` → `⚙ In user flows`, `⚙ Used on` → `⚙ Used in`,
  `⚙ Frames` → `⚙ Wraps`, `⚙ Shown as` → `⚙ Shown in`; the key and vocabulary `appears-as` /
  `### Appears-as` → `opens-as` / `### Opens-as`; the qualifier `· parent:` on map lines → `· under:`.
- **`users:`** on screens and user flows: the user types the card is for — one role card name or a
  list; omitted = every user type whose states include the card's state.
- KBs say `standard: IntentFormat/1.2`; `IntentFormat/1.0` gets the W001 hint and `intent-format migrate` renames it.

## 1.0 (2026-10-20) — first public release

Intent Format 1.0 is a rewrite of an unpublished prototype: the same core ideas, one source of truth
per concept, machine-checkable, domain-neutral. This release contains the spec, the schema, the
`intent-format` CLI, the agent skills, templates and an example KB.

- **Name:** KBs say `standard: IntentFormat/1.0`. KBs made with the pre-release name
  `IntentFormat/1.0-draft.2` get a W001 hint; `intent-format migrate <root>` renames them (all workspaces).
- **CLI:** runs through npm's `intent-format` link, so `npx github:intentstudiodev/intent-format#v1.0.0` works.

The dated entries below describe how 1.0 took shape before publication; "draft 1" there means the
prototype, "draft 2" the work that became 1.0.

## Domain on the project card (2026-10-19)

Decisions D25. Two optional passport keys on the project card: **`industry:`** (free text) and
**`audience:`** (B2C, B2B, B2B2C, Internal system, Marketplace; a list). They say which domain
the product lives in and who it is for, so an agent frames every suggestion — user types,
states, journeys, rules — in that domain before reading anything else. No new check: unknown
values are free text by design. Sniff key unchanged.

## User types are cards (2026-10-18)

Decisions D24. **`type: role`** (RO, `roles/`) replaces the `### Roles` table: one card per
user type with `state:` (the States it can be in), `platform:` (what it uses) and a description
of who they are and why they come. Stories keep plain text and resolve by exact role-card
name; the role lists them in generated `⚙ Stories` (`· story: R<n>` / `· story: Main use
cases`). New checks W049 (duplicate role name), W050 (the deprecated table; silent in
read-only versions), I029 (a role no story names). `intent-format migrate <root>` converts the table —
one core per role across versions, idempotent. Scaffold and `intent-format next` put roles right after
the project card; `next` sends an old KB to `migrate` first. The manifest `modules` values now
list `shells` and `roles`.
Also (D24.9): a stepper frames its own flow's steps by default; a shell whose `platform:` does
not fit is skipped on every resolution rung; flows take `platform:`; W045 covers two steppers
for one flow; roles take Links, Comments and decisions.

## Fix pass 3 — navigation and a self-steering cold start (2026-10-18)

Decisions D23 in `_work/decisions.md`. Additive except one rule: a shell variant no longer
carries navigation lines (W017 tells where to move them).

- **Variants stack.** Every matching shell variant applies; `Signed in`, `Mobile` and
  `Level 2+` are written once each, never as combinations (S-SHELL-5).
- **One navigation list per shell**, in display order. `Leads to` lines take `· in: <parts>`
  (the part holding the entry: Header, Footer, Tab bar, Account menu — W048), `· platform:`
  and `· state:` (S-SHELL-6). I028 flags a line shown where its screen does not exist.
- **New shell or variant** test and the usual set of shells (S-SHELL-8, How to model in the
  shell sheet). Typically three to eight shells.
- **Chrome on a screen** is allowed but discouraged: I027.
- Templates carry recommended optional sections (`inTemplate`): shell Navigation, Places inside.
- CLI: `intent-format frame <root> <screen>` (what surrounds a screen per placement), `intent-format next <root>`
  (the one next step, from the project's files alone), a project lock for writing commands,
  `AGENTS.md` + `CLAUDE.md` at the project root (S-PKG-8).
- Kit: the cold-start skill steers by `intent-format next`; `proposal/frames.md` puts navigation in front
  of the owner before any card exists; fill order puts shells and maps before screens;
  unattended mode is written down; picking up, parallel work and later batches are covered.
  Kickoff questions 4, 10, 11 ask for navigation per platform and frames; "shell" no longer
  means a native wrapper there.

## Fix pass 2 — shells (2026-10-16 → 2026-10-18)

**Persistent UI is a shell, not a screen.** The draft 2 advice "model the app shell as a screen
at the IA root whose children are the views" made the shell the root of every map and left
navigation with no home. Replaced by a new card type, **shell** (spec section 6.4,
`schema.json shells`, type sheet `kit/skills/intent-format/types/shell.md`):

- `type: shell`, prefix SH, folder `shells/`; `shell-type` is `app`, `section`, `stepper`,
  `overlay`, `focus`, `split` or `embedded`; `platform`, `state`; `appears-as` on overlays
  (the presentation they frame); `flow` on steppers (the flow they show).
- Sections: `## Components` (the frame's parts; a part that unfolds over the page carries
  `· appears-as:`), `## Navigation` (ordered `Leads to` lines, `· kind: tab|menu|link`,
  `· label:`), `## Places inside` (the contract for whatever the shell frames), `## Variants`
  (`### <Name> · #HV…`, passport `platform` · `state` · `level`; a variant *adds* parts and
  `Leads to` lines to the host).
- Binding: `shell:` on screens and in screen-variant passports, `· shell:` on IA nodes
  (covers the subtree) and on a step's `Screen` line; otherwise the default: the app shell of
  the map's platform and state for pages, the overlay shell whose `appears-as` matches for
  everything else. Then the variant by platform, state and level. Reverses `⚙ Frames` on the
  shell, `⚙ Reached from` on screens, `⚙ Shown as` on a stepper's flow.
- Three things, each written once: `appears-as` on a placement says *how* content is shown;
  the overlay shell says *what* frames everything shown that way; the content is the screen
  card or the shell part. A screen card never holds a frame's control (Continue, Close, Back).
- Diagnostics W044 (not a shell), W045 (default-shell clash), W046 (a shell as a part), W047
  (shell keys and kind).
- The root of a map is a real place (Home). Existing KBs: turn the App shell screen (or the
  fix-pass-2 `component-type: shell` components of 2026-10-16) into shell cards, enable the
  `shells` module, re-root the maps.

## Draft 2 vs draft 1

**Package**
- Nine documents with restated rules → one `spec.md` (rules stated once) plus `schema.json` as
  the single machine-readable source; templates and type sheets are generated from it.
- The tool-conformance document → the reference CLI `intent-format` and fixtures, which make tool
  behaviour testable.
- Domain-specific examples and real product names → the abstract `example-app`.

**Cards**
- Workspace owns the version; cards no longer carry `version:`, so a new version rewrites
  nothing.
- Title holds the core only; rendered ID, lifecycle and change status move to a generated
  status line.
- `state:` is optional and exists only when the project declares States.
- Status vocabularies are per type (tech, decision, comment); status only with evidence.
- Front matter holds no edges except the membership keys `feature:` and `parent:`.
- Required sections are set per type in the schema; `Links`, `Tags`, `Comments` are never
  required, so they no longer inflate blind spots.
- `none` (verified none) joins `—` (blind spot); generated sections exist only with content.
- Generated sections move to the end of the card; their registry is closed.

**Types**
- New types `tech` (TC) and `decision` (DC), with `Built with` ⇄ `⚙ Used by` and
  `Affects` ⇄ `⚙ Decisions`.
- Features get two levels (Feature, Sub-feature) and replace Areas; members name their home.
- Screens and components: `## Components` is the default composition; `## Variants` is optional.
- The project card gains Main use cases, Constraints, Roles and Tech categories, Built with.
- APIs name their node in `## Served by`; backend types gain `storage` and lose `api`.
- Comments get a `name` and a single status representation.

**Flows and maps**
- A flow is always one file; large journeys become subflows (info above 15 steps).
- A step's type is its heading glyph only; System action uses ⚡.
- Step lists live in `## Step list` (relation `Step`); `⚙ Prev`/`⚙ Next` are optional.

**Links**
- A redundant default-relation prefix is tolerated (info), not a finding of its own.
- Link types are Design, Code, Doc, Source, Analytics, Other; `Source` marks evidence.
- Placeholder promotion is an explicit edit; `check` reports exact matches.

**IDs and versions**
- Cores are unique across the project; `_ids.md` moves to the project root with Retired and
  High-water marks; only `intent-format new`/`intent-format mint` mint.
- Lifecycle `planned · in-progress · released · archived · exploration`; versions form a tree
  through `based-on`; per-card change status and `CHANGES.md` replace stamps and logs.
- Moving a card between versions means copying it with its core; re-minting is for import.

**Conformance and exchange**
- Severities error / warning / info with codes; MUST → warning, SHOULD → info; more errors,
  all about broken identity or parsing.
- Health is blind spots, unresolved placeholders, open decisions.
- Idempotency replaces byte-identical output across tools.
- Judgment lints become review checks for a QA reviewer.
- Folders are flat; grouping is a computed perspective.
- Import is compact (re-mint, rewrite, placeholders, `origin`); merge and duplicate are
  manual procedures; extensions need no registration.

## Cut list

Cut rows of the inventories:

- Exploded flows — folder form, `_flow.md`, step files, fold/explode, thresholds, `step` type
  (00-03 #75; 04-07 #42, #76).
- Step-list echo cache — screen, wiring and one-liner tails on list lines (00-03 #61;
  04-07 #23).
- Per-card `version:` stamps, restamping on new versions and imports, the integer build clock
  (00-03 #42; 04-07 #62, #116, #123).
- Manifest `uuid` (00-03 #22).
- Import logs — manifest `## ⚙ Import log` and change-log lines (00-03 #20; 04-07 #117).
- Content hashes (`hash:`, `unverified`) and "changed upstream" detection on re-import
  (00-03 #49; 04-07 #119) — future work.
- Per-workspace KB `CHANGELOG.md` (04-07 #95); freshness footer (00-03 #51); dates in any
  generated content (04-07 #50).
- `_ids.md` Unresolved table (04-07 #78) — `intent-format check` and the health count instead.
- Component-type shelves `atoms/` … `integrations/` (00-03 #30).
- Drafting history in normative text — decision-ledger wording, re-lock clause, dated
  examples (00-03 #3; 04-07 #49) — moved to `rationale.md` and this file.

Also cut when open points were resolved:

- Requirement-block anchors `#r<n>` and links to single blocks (00-03 #102; 04-07 #60).
- Extension registry in the manifest (00-03 #26; 04-07 #36).
- Automatic, group-wide or logged placeholder promotion; fuzzy name grouping (00-03 #111;
  04-07 #9).
- Merge and duplicate as tool-mandatory operations; `merged-from` / `duplicated-from` maps
  (00-03 #112; 04-07 #71).
- Authored purpose paragraph and `version` key in `_index.md` (00-03 #96; 04-07 #92).
- The step `type:` passport word (00-03 #80); minting by `regen` (00-03 #46).
- Re-minting through import when moving work between versions (00-03 #18; 04-07 #73).
- Generated facts outside the closed registry — API and rule roll-ups, screens involved, flows
  here, reached-from / leads-to lines, feature status roll-up, project roll-up (00-03 #69,
  #88; 04-07 #32).
- Nameless comments and nameless references (00-03 #93; 04-07 #3).

Not carried from other rows:

- A mandatory Default variant and state-name matching of unpinned references (00-03 #71,
  #83; 04-07 #40).
- `⚙` sections holding `—` as "verified empty" (00-03 #57; 04-07 #125).
- Platform lints: two variants with one state and platform; no reachable variant (00-03 #67).
- IA map `variant:` key and `Explores:` line (00-03 #82).
- Origin matching before demoting a reference on import (04-07 #111).

## Renamed

- `IntentFormat/1.0-draft` → `IntentFormat/1.0`.
- Draft 1's button-style name for regenerating → **regenerate** (`intent-format regen`).
- Rule codes (CAT-n, S, M, O, F, T, E, Z, GC, B, P, G, V) → `S-<TOPIC>-<n>`.
- Areas (vocabulary, `area:`, shelves) → top-level **Feature**; draft 1's feature →
  **Sub-feature** (`parent:`).
- API `## Where` / `Where` → `## Served by` / `Served by`; backend `⚙ APIs` → `⚙ Serves`.
- Userflow `## Parts` / `Part` → `## Step list` / `Step`.
- Userflow `⚙ Connected flows` (with `Connected from:` lines) → `⚙ Entered from`.
- Screen `⚙ Part of` → `⚙ Placed on` (IA maps) and `⚙ Flows` (steps).
- `Delivers feature` → `⚙ Features`; `Edge cases (N)` → `⚙ Edge cases`.
- System-action glyph `⚙` → `⚡`.
- Lifecycle `draft · active · maintained · frozen` → `planned · in-progress · released ·
  archived` (+ `exploration`).
- Manifest record of the source version → `based-on`.
- Backend type `db` → `database`; IA key `platforms:` → `platform:`.
- Link type issue tracker → `Doc`; `other` → `Other`; `Source` added.
- Placeholder qualifier `· was: <core>@<kb>` → note `— was #<core> in <kb>`.
- `origin` block → `origin: <kb>/<core>`.
- Comment `resolved:` and "— resolved" suffix → `status: Open | Resolved`.
- Conformance tiers (Well-formed, Connected, Complete) → severities and health.
- Health "unresolved references", "uncomputed" → "unresolved placeholders", "open decisions".
- Byte-identical determinism → idempotency.
- KB `CHANGELOG.md` → `CHANGES.md`; freshness footer → status line.
- Roster column `Gaps` → `Blind spots`.
- Screen `## Variants` with a `Default` variant → `## Components` plus optional `## Variants`.
- Workspace `_ids.md` → project-root `_ids.md`.

## Fix pass after the cold-start tests

- `## Stack` renamed to `## Components` ("stack" collided with the tech stack).
- A final `—` in a list section marks the list as incomplete (one blind spot).
- Health: blind spots broken down by kind.
- CLI: `intent-format scaffold` (create all cards from an inventory), `init --lifecycle`; type sheets show the requirement formats; `types/_overview.md` added.
- Cold-start kit: unattended mode defined; derivation rule clarified; every judgment call becomes a decision card; persistent panels vs screens; sample content inside a product's UI is not documented.
