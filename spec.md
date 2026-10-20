# MDStandard 1.0 — Specification

`standard: MDStandard/1.0` · Status: normative · Companion: `schema.json`

MDStandard is a format for the knowledge base (KB) of a software product, written as plain
Markdown files. This document is the normative text; `schema.json` is the machine-readable
source of the same rules — types, keys, sections, relations, generated sections, diagnostics,
grammar — and the two never disagree. Long tables live only in the schema and are cited by
path, e.g. `schema.json types.<type>.sections`.

**Reading the rules.** Rules are numbered `S-<TOPIC>-<n>`, stated once and cited by number
elsewhere. MUST, SHOULD and MAY have their RFC 2119 meaning. A bracketed code is the
diagnostic `mds check` reports when the rule is broken (`schema.json diagnostics`): a MUST on
KB content cites an error (`E…`) or warning (`W…`), a SHOULD an info (`I…`) where one exists.
A MUST on a tool cites the diagnostics that trigger or verify it, so fixtures can test it. Examples use the abstract `example-app`: screens Home, Item list, Item detail, Edit item
and Settings; features Items and Account.

## 1 Scope and principles

A **KB** is a folder of cards plus generated machinery. A **card** documents one thing of a
product: a screen, component, user flow, IA map, rule, API call, feature, edge case, backend
node, technology, decision, comment — or the project itself. People write cards in any
Markdown editor; agents and tools parse the same files. Canvas positions and tool snapshots
are outside the standard.

**S-CORE-1 · One card = one file = one panel.** A card is one Markdown file holding what a tool
panel shows for it, in the same order. Parts shown inside a card — screen and component
variants, flow steps — are sub-documents of its file (S-SUB-1) and MUST NOT be files of their
own [E002]: no card type exists for them.

**S-CORE-2 · Truth Law.** The files are the database: everything a tool shows is read from them
or computed from them, and no hidden store, index or sidecar knows more. Edges are relation
lines in card bodies (chapter 5) or one of the two membership keys (S-FM-8); front matter
MUST NOT carry any other edge [W003].

**S-CORE-3 · Ownership Law.** The one who knows writes; the one who is referenced computes. A
definition lives once, on its own card; usage is written at the point of use, at any
granularity — a screen and one of its flow steps may both name the same API. Each relation has
exactly one authored end (`schema.json relations`); its reverse is generated into a `⚙`
section and MUST NOT be authored [W016] [W017]. Repetition across authored lines is never a
finding; generated lists de-duplicate.

**S-CORE-4 · Four kinds of empty.** A section body, sub-document body, value or relation target
is in exactly one state:

- **content** — anything else;
- **`—`** (U+2014) alone — a **blind spot**: the question exists, the answer is unknown;
  counted in health (S-CONF-2);
- **`none`** alone — **verified none**: known to be empty; not counted;
- **generated** — a `⚙` section, written only when it has content (S-BODY-5).

A body state MUST be the whole body, never mixed with other lines [W015] — with one exception: in a
list section, a final item `—` (`- —` or `N. —`) marks the list as **incomplete** (more items
exist but are unknown) and counts as one blind spot. Values and relation targets use `—` only. An absent optional section means nothing to say; an absent required
section is a gap (S-BODY-3). `-`, `–`, `TBD` or `?` alone read as `—` and SHOULD be written
as `—` [I005].

**S-CORE-5 · Warn, never block.** An incomplete or inconsistent KB is a normal working state:
tools read, show, check and export it whatever its warnings and infos. Only errors stop
`regen` (regenerate), which MUST NOT run while one stands [E001] [E002] [E003] [E004] [E005].

**S-CORE-6 · Idempotency.** Generated content is a pure function of authored content: no dates,
clocks or tool names. Running `regen` twice with no authored change in between changes no
file; a conforming generator MUST meet this [I001] [I020].

## 2 Package

**S-PKG-1 · Project root.** A project root holds:

```
<project-root>/
  _index.md         ⚙ versions roster (version · lifecycle · based on)
  _ids.md           ⚙ project-wide ID register (S-ID-6)
  AGENTS.md         how a fresh agent starts; CLAUDE.md imports it (S-PKG-8)
  inputs/           raw sources; URLs in inputs/links.md (S-PKG-7)
  proposal/         cold-start working files; report.md beside it (S-PKG-8)
  layout/           tool-private canvas positions (S-PKG-5)
  V1.0/             one workspace per version (chapter 8)
    mdstandard.md   manifest
    project.md      project card
    CHANGES.md      ⚙ only when based-on is set (S-VER-5)
    roles/ screens/ components/ shells/ userflows/ ia/ rules/ apis/ features/
    edge-cases/ backend/ tech/ decisions/ comments/
      _index.md     ⚙ folder roster
```

Workspace folders are named `V<major>.<minor>`, explorations `V<major>.<minor>-<label>`.
`inputs/`, `layout/`, `proposal/` and the agent files MAY be absent.

**S-PKG-2 · Workspace.** A workspace holds one full KB and MUST contain exactly one manifest
`mdstandard.md` and one project card `project.md` at its root [W032]. A card outside any
workspace is a valid fragment: it announces its own standard, type and identity.

**S-PKG-3 · Manifest.** `mdstandard.md` describes the KB as an artifact; `project.md` describes
the product. The manifest's front matter MUST hold these keys in this order [W033]:
`standard`, `type: manifest`, `kb` (a lowercase slug), `name`, `version` (quoted, equal to the
folder name without `V`), `lifecycle` (S-VER-2), optional `based-on` (S-VER-3), `modules` (the
enabled type folders, e.g. `[screens, components, userflows]`), then optional `x-*` keys. Its
title is `# <name>`; its body is one paragraph on what the KB documents and who maintains it.
All workspaces of a project SHOULD share one `kb` [I023]; a copy that becomes a separate
project takes a new one.

**S-PKG-4 · Modules.** Each type folder is a module that works alone: arrangements (IA maps,
flows) reference libraries (screens, components), never the reverse, so any module is usable
and exportable by itself. A card MUST sit in an enabled module [W034]. Each enabled module
SHOULD have its folder, and the folder of a module that is not enabled SHOULD NOT exist
[I019]. A generated section is computed only when every module it reads is enabled; a required
section whose targets live only in a disabled module becomes optional (`relief` in the
registry).

**S-PKG-5 · Folders.** Type folders are flat, with the exact lowercase names above; grouping by
feature, state, platform or status is a computed perspective (S-FEAT-6), never a folder. A
card MUST sit directly in its type's folder — the project card at the workspace root — and
every `.md` file in a workspace MUST have front matter [W031]. A misfiled card is still what
its `type:` says; tools report it and MAY offer a move, never move silently. Names starting
with `_` are reserved for generated files; non-`.md` files are attachments, ignored by tools.
`layout/` is tool-private and outside the knowledge guarantee: it holds no fact. A canvas move
that changes hierarchy edits the IA map; a position-only move edits `layout/`.

**S-PKG-6 · Head files.** `_index.md` at the project root (versions roster) and in each module
folder (card roster) is fully generated: front matter `standard`, `type: index`, `name`; title
`# <name>`; a purpose line from the schema; a `## ⚙ Contents` table (`schema.json indexFile`).
Hand authors MAY omit head files; a missing or stale one SHOULD be regenerated [I020].
`_ids.md` and `CHANGES.md` are generated files of the same kind.

**S-PKG-7 · Inputs.** `inputs/` holds raw sources — documents, designs, exports, kickoff answers
— and `inputs/links.md` lists URLs. Cards MAY cite them as evidence (`Link` lines with
`type: Source`, S-LINK-6). `inputs/` belongs to no workspace and is not validated.

**S-PKG-8 · Agent entry and working files.** `AGENTS.md` at the project root tells a fresh
agent where the standard is and to start with `mds next`, which derives the next step from the
project's own files alone; `CLAUDE.md` holds `@AGENTS.md`. Tools create them when missing and
never overwrite them. `proposal/` (inventory, frames, decisions, questions, review) and
`report.md` are the cold start's working files; they are not cards and are never checked.
`.mds.lock` exists only while a writing command runs.

Filenames are defined with identifiers (S-ID-8).

## 3 Cards

A card has four parts, in order: front matter, title line, optional status line, sections.

```markdown
---
standard: MDStandard/1.0
type: screen
id: SC000002
name: Item list
status: In design
feature: FT000002
---
# Item list · #SC000002
> ⚙ #SC000002V1.1 · V1.1 in-progress · based on V1.0 · changed: Components

## Description & Requirements
Shows all of a Member's items as rows; choosing a row opens Item detail.

## Components
1. [#CP000003 Item row](../components/cp000003-item-row.md) — one per item
```

The top bar around it is not listed: it belongs to the shell that frames the page (section 6.4).

### 3.1 Front matter

**S-FM-1 · Shape.** Front matter is a flat YAML subset between two `---` lines at the very top
of the file: one `key: value` per line; no nesting, block lists or comments; a list is a
one-line flow list `[a, b]`, only where the key allows one. Front matter MUST parse this way
[E001]. If a key repeats, the first occurrence wins.

**S-FM-2 · Sniff key.** The first key of every file — card, manifest or generated file — MUST
be `standard: MDStandard/1.0` [W001].

**S-FM-3 · Keys and order.** Keys MUST follow this order [W002]: `standard`, `type`, `id`,
`name`, `status`, then `state` and `feature` where the type allows them, the type's extras in
schema order, `origin`, and `x-*` keys. Required keys MUST be present with a value, `—` when
unknown [W004]. A key not defined for the type MUST NOT be used [W003]; tools preserve it. Each
type's keys: `schema.json types.<type>.keys`.

**S-FM-4 · Type.** `type:` MUST name a card type (S-TYPE-1), `manifest`, `index` or an
extension type `x-<slug>` [E002].

**S-FM-5 · Name.** `name:` is the authored name; the title, reference text and filename slug
render it. It MUST NOT contain `[` or `]` [W007].

**S-FM-6 · Status.** `status:` MUST be a value of the type's status vocabulary, or `—` [W005].
Status is written only with evidence — a design, code, a release, an owner's answer. The
vocabularies (`schema.json statusVocabularies`):

- default: `Idea · In design · Approved · In build · Live · Parked`; Parked sets a card aside
  from any stage; movement is free in both directions;
- tech: `Candidate · Evaluating · Adopted · Deprecated · Rejected`;
- decision: `Open · Proposed · Decided · Superseded · Dropped`;
- comment: `Open · Resolved`, the only representation of a comment's state.

**S-FM-7 · State.** `state:` (not on the project card or comments) is optional and holds a
State name, `Shared`, or a list of State names; omitted means Shared. It MUST NOT appear when
`project.md` declares no States [W009]. A userflow or IA map MUST carry at most one state
[W042]. Cards store State names, never codes.

**S-FM-8 · Membership keys.** `feature:`, `parent:`, `shell:` (S-SHELL-4) and a stepper
shell's `flow:` (S-SHELL-1) are the only front-matter keys holding a core, one value each. `feature:` (screens, userflows, components) names the card's single
**home**, a Feature or Sub-feature; `parent:` (features) names a Sub-feature's top-level
Feature. The core MUST resolve in the workspace [W019] to a feature card [W018]. Their reverses
are generated on the feature card (S-FEAT-3).

**S-FM-9 · Values.** A value is plain text to the end of the line, double-quoted only where YAML
requires it: it contains `: ` or ` #`, starts with a special character or a space, or would
read as a number, boolean or null (`\"` escapes a quote). `version`, `based-on` and
`tech-version` are always quoted; `—` never is. Quoting MUST follow these rules [W008].
Unneeded quotes SHOULD be dropped [I013]. A value MUST match its key's enum or pattern, and a
list MUST NOT stand where one value is allowed [W007]; vocabulary values follow S-VOC-2.

### 3.2 Title and status line

**S-BODY-1 · Title.** The first body line MUST be the title [W010]: `# <name> · #<CORE>` for
cards — core only, no state code or version — and `# <name>` for manifests and generated
files. It SHOULD match `name:` and `id:`; `regen` rewrites it [I002].

**S-BODY-2 · Status line.** Directly under the title, `regen` writes the status line
`> ⚙ <rendered-id> · V<version> <lifecycle>[ · based on V<base>][ · new | unchanged | changed: <Part>, <Part>]`,
e.g. `> ⚙ #SC000006V1.1 · V1.1 in-progress · based on V1.0 · changed: Components` (rendered ID:
S-ID-7; change status: S-VER-4). It is machine-owned, never written by hand; a tool-grade card
SHOULD carry a current one [I001].

### 3.3 Sections and zones

**S-BODY-3 · Section registry.** Sections are `## <Heading>` lines spelled exactly as in the
type's registry (`schema.json types.<type>.sections`), which marks each section required or
optional, authored or generated, and gives its default relation and content shape. A section
is required when its absence is a real knowledge gap for its type; `Links`, `Tags` and
`Comments` are never required. Each required section MUST be present, holding content,
`—` or `none` [W011]. Sections MUST follow registry order, authored before generated [W012],
and a heading MUST NOT repeat [W013].

**S-BODY-4 · Unknown sections.** A `##` heading outside the registry is preserved where it
stands among the authored sections; it SHOULD be a registry heading or an extension section
`## x-<name>` (S-EXT-1) [I008].

**S-BODY-5 · Zones.** The **authored zone** — front matter, sections without `⚙`,
sub-documents, a comment's remark — belongs to people. The **generated zone** — `## ⚙
<Heading>` sections and generated files — belongs to `regen`, which rewrites it whole; hand
edits there are lost. A `## ⚙` heading MUST be in the type's registry or be `## ⚙ x-<name>`
[W014]. Generated sections hold bound reference lines only, one fact per line (the
`⚙ Contents` table excepted), and exist only with content: an empty one, or one holding `—` or
`none`, SHOULD NOT exist [I009]. The registry is closed; counts and roll-ups outside it come
only from `mds check`.

**S-BODY-6 · Content shapes.** The registry fixes each section's content: prose; relation lines
(chapter 5); ordered lines (S-REL-3); an IA tree (S-IA-1); sub-documents; vocabularies
(S-VOC-1); user stories (S-TYPE-2); Do & Don'ts, one `✅ <do>` or `🚫 <don't>` line each; Tags,
one comma-separated line. Do & Don'ts and Tags SHOULD keep their shapes [I024]. Prose sections
hold prose first, then requirement blocks.

### 3.4 Requirement blocks

**S-REQ-1 · Presets.** A requirement block opens with `**R<n> · <Preset>**`; `n` is unique in
the file, never reused or renumbered. The presets:

- `User story` — `As a <role>, I want <goal>, so that <benefit>.`; "so that" is mandatory and
  `<role>` the exact name of a role card (S-TYPE-15);
- `GWT` (Given/When/Then) — one keyword per line, in that order; `And` / `But` continue the
  previous one;
- `EARS` — `[When <trigger> | While <state> | If <condition> | Where <feature>, [then ]]the
  system shall <response>.`;
- `Checklist` — one `- [ ] <verifiable item>` per line, `[x]` when done.

A block MUST match its marker and preset [W036]. A slot written `—` is a counted blind spot.
Any preset MAY be used anywhere; templates and agents start with the type's default
(`schema.json requirementPresets.defaults`). Requirement blocks have no anchors and are not
link targets.

### 3.5 Sub-documents

**S-SUB-1 · Heading and anchor.** A sub-document is a part of a card with its own core: a screen
variant (`SV`) or component variant (`CV`) in `## Variants`, a flow step (`FS`) in
`## Steps`. It opens with `### [<glyph> ]<Name> · #<CORE>` (glyphs on steps only), and its
next line is the anchor `<a id="<core-lowercase>"></a>`. The heading MUST sit in its host
section, the anchor MUST equal the lowercase core, and a variant name MUST NOT repeat within
its host [W023]; the prefix MUST fit the host section [E003]. A missing anchor SHOULD be
added; `regen` adds it [I006].

**S-SUB-2 · Passport line.** After its anchor a variant MAY carry one passport line
`key: value · key: value` with these keys, in order, each omitted at its default: `state` (one
State name or `Shared`; default the host's), `appears-as` (default the host's), `platform`
(comma-separated; default all), `flag` (a feature-flag name, one token). Flow variants take
only `platform` and `flag`; flow steps take no passport line. A passport line MUST use only its
allowed keys, in order, with legal values [W024].

## 4 Card types

**S-TYPE-1 · Roster.** The card types are closed, each with one prefix and one folder:
`project` PR (`project.md`) · `role` RO `roles/` · `screen` SC `screens/` · `component` CP `components/` ·
`shell` SH `shells/` · `userflow` UF `userflows/` · `ia` IA `ia/` · `rule` RL `rules/` · `api` AP `apis/` ·
`feature` FT `features/` · `edge-case` EC `edge-cases/` · `backend` BN `backend/` · `tech` TC
`tech/` · `decision` DC `decisions/` · `comment` CM `comments/`. A KB MAY use any subset. Each
type's purpose, keys and sections are in `schema.json types`; below is what they leave
implicit.

**S-TYPE-2 · project (PR).** The front door, read first by every agent; one per workspace
(S-PKG-2). `Description & Requirements` says what the product is and for whom. `Main use
cases` holds lines `- As a <Role>, I want <goal>, so that <benefit>.`: each MUST be a user
story whose role is the exact name of a role card, once role cards exist [W037]. There SHOULD be 5–10 of
them [I017]. `Constraints` holds non-functional requirements (performance, offline, privacy,
accessibility, languages) as requirement blocks, or `none`. `Built with` names project-wide
technologies. `industry:` (free text: Travel, Fintech …) and `audience:` (B2C, B2B, B2B2C,
Internal system, Marketplace; one or several) frame the product's domain; both optional, read
by agents before anything else so that suggestions use the domain's vocabulary, journeys and
rules.

**S-TYPE-3 · screen (SC).** A place the user can be — a page, a modal, a panel with its own
composition: what it is for and what it is made of. `appears-as` is its default presentation
(omitted = Page); acceptance criteria are GWT blocks. A screen never states where it sits (IA
maps) or how users move through it (flows). A piece placed inside places — a row, a toast, a
menu — is a component; the same place with another composition is a variant; a different
purpose is a new screen. Persistent UI — a top bar on every page, a section's breadcrumbs, a
sheet's chrome — is never a screen: it is a **shell** (section 6.4), and SHOULD NOT be a part
of one [I027]. `shell:` names the shell a
screen usually sits in; omitted = resolved per placement (S-SHELL-4).

**S-TYPE-4 · component (CP).** A reusable part placed in screens or other components: what it
does wherever it appears, never what one screen uses it for. `component-type` is `atom`,
`molecule`, `organism` or `integration` (wrapping a third-party capability); `provider`, who
provides that capability, SHOULD appear only on integrations [I018]. `Components` lists inner
components (`none` for atoms). Interactions are described on the component, not as cards. The
frame around places is not a component but a shell (S-TYPE-14).

**S-TYPE-5 · userflow (UF).** A journey in one file: typed steps, an ordered step list per
variant and fork wiring (section 6.1); `Description & Requirements` gives its intent, for whom
and its success criteria; `platform:` limits it to some platforms (omitted = all). A KB SHOULD have one flow per main use case or recurring journey.

**S-TYPE-6 · ia (IA).** One IA map: screens arranged in a hierarchy plus lateral edges — pure
arrangement (section 6.2); `platform` limits it (omitted = all). A KB MAY hold several maps,
one per arrangement of the product (per State when States change which screens exist).

**S-TYPE-7 · rule (RL).** One business rule stated once, in plain words — one precise sentence
or an EARS block — with its exact numbers and conditions. Other cards cite it (`Applies rule`,
or `· rule:` on a fork branch) and SHOULD NOT restate it (Appendix B). An acceptance criterion
of one card stays in that card; a situation with its handling is an edge case.

**S-TYPE-8 · api (AP).** One call the product makes or exposes: `method` is an uppercase token
(GET, POST…), `endpoint` a path or address (`/items/{id}`). `Served by` MUST hold exactly one
line, the backend node serving the call [W022].

**S-TYPE-9 · edge-case (EC).** A named exceptional situation and every place it can happen;
`severity` (`High · Medium · Low`) is the impact if unhandled. `Description & Requirements`
states the situation and its handling, as a GWT or EARS block with both parts; `Where` lists
every screen, variant, component, flow, step, API or backend node concerned. Status reads as a
risk register: Idea = spotted, Approved = handling agreed, Live = handled. An edge case that
grows steps SHOULD become a small flow attached where it applies.

**S-TYPE-10 · backend (BN).** A node of the product's backend: `backend-type` is `server`,
`service`, `database`, `storage`, `integration`, `repo` or `environment`. `Connections` lists
the nodes it talks to, `- <node> · kind: calls|stores|deploys|belongs`, or `none`; `kind` MUST
take one of these values [W021]. What a node runs on is tech; each call it serves is an api
card naming it in `Served by`.

**S-TYPE-11 · tech (TC).** A technology the product uses or considers: a language, framework,
library, platform or external service. `category` is one Tech category; `tech-version`
(quoted), `license` and `provider` are optional. Required: `Description & Requirements` (what
it is, what it is used for here), `Why` (with evidence or a decision reference),
`Alternatives` (TC references, placeholders or `none`). Cards name it in `Built with`. An open
technology need SHOULD be a placeholder in a `Built with` section (`- [~ Graph canvas
library]`) plus an Open decision. A node of this product is backend; the provider wrapped by
an integration component is tech.

**S-TYPE-12 · decision (DC).** A question that needs or got a decision: `Question` (one or two
sentences), `Options` (each with its trade-off; the recommendation, if any), `Outcome` (`—`
while Open or Proposed, then the choice and why) and `Affects` (every card or sub-document the
outcome changes). A Decided or Superseded decision MUST state its Outcome [W039]. Every open
question, judgment call or conflict between inputs SHOULD become a decision with
`status: Open`. A remark is a comment; a runtime branch is a Fork step. Exports include
decisions.

**S-TYPE-13 · comment (CM).** One remark, with a short `name` like every card; `author` (name or
role) is required, `date` (`YYYY-MM-DD`) optional. The remark is the prose directly under the
title and status line and MUST be present [W011]; `Links` is the only optional section. A card
attaches a comment with a line in its `## Comments` (in a sub-document, `- Comment: …`);
`⚙ Attached to` lists those places. A remark that needs a choice SHOULD be a decision instead.
Exports exclude comments by default.

**S-TYPE-14 · shell (SH).** The frame around places (section 6.4): `shell-type` names its
kind; `platform` and `state` say whom it frames; `appears-as` (overlays) the presentation it
frames; `flow` (steppers) the flow it shows. `Components` are its own parts, `Navigation`
where it leads, `Places inside` the contract for what it frames, `Variants` the frame per
platform, state and level. Typically three to eight per product (S-SHELL-8); a KB without
shells is valid.

**S-TYPE-15 · role (RO).** A user type: who uses the product, why they come and how they use
it — Guest, Member, Admin, or back-office staff the product must know about. Not a persona (a
named person). `state:` lists the States the role can be in (omitted = all); `platform:` the
platforms it uses (omitted = all), so its frames are the app shells of those platforms.
Stories name a role by its exact card name — "As a Member, …" — and the role card lists them
in `⚙ Stories`; what a role wants is never restated on it. Role names MUST be unique in a
workspace [W049]; a role that no story names is a finding [I029]. A role whose screens differ
from another's maps to its own State; content that differs by role inside one State is
written on the screen, in prose or GWT.

### 4.1 Features

**S-FEAT-1 · Two levels.** The `feature` type has two levels. A **Feature** is a top-level
product domain without `parent:`; it says why the domain exists and its scope in and out. A
**Sub-feature** is a user-facing capability named by its outcome, with `parent: <FT core of a
Feature>`; it says what capability, for whom, usually with User story blocks. `priority` is
`High`, `Medium` or `Low`. `parent:` MUST point to a top-level Feature — not itself, a
Sub-feature or another type [W030]. In `example-app`, Feature Items has Sub-features Browse
items and Edit an item; Feature Account has Change settings.

**S-FEAT-2 · Home line.** A screen, userflow or component MAY name its single home with
`feature:` (S-FM-8); other features reach it through flows and touchpoints. When the workspace
has feature cards, every screen and userflow SHOULD have a home [I025].

**S-FEAT-3 · Generated lists.** A feature card lists only cards homed directly on it:
`⚙ Sub-features` (each with its one-liner, verbatim), `⚙ Screens`, `⚙ Also uses` (other
features' screens its flows pass through, with `· home:`), `⚙ User flows`, `⚙ Components`,
`⚙ Also connects` (other features' flows its flows run or hand off to, with `· home:`) and
`⚙ Decisions`. There is no roll-up from Sub-features, and the two "Also" lists skip unhomed
cards; tools MAY aggregate further in their UI.

**S-FEAT-4 · Touchpoints.** A Feature or Sub-feature MAY list in `## Touchpoints` delivery
points that homes and flows do not cover — a component, a variant (`#SV…`), a step. The
touched card shows the reverse in `⚙ Features`.

**S-FEAT-5 · Altitude rule.** Each level answers only its own question: Feature — why and
scope; Sub-feature — what capability, for whom; flow and step — how the user moves; screen —
what the place is for and made of; component — what the part does anywhere; rule — the exact
policy. A card's **one-liner** is the first sentence of its `Description & Requirements`
(decision: `Question`; comment: the remark). Parents never summarise children; child lists are
generated. Numbers, limits and conditions live in rules or the lowest owner: a top-level
Feature's `Description & Requirements` SHOULD contain no digits [I021].

**S-FEAT-6 · Perspectives.** Tools MAY group cards by feature, state, platform or status —
including a feature selector and the variants a feature touches — as views computed over the
files; nothing is stored for them.

### 4.2 Vocabularies

**S-VOC-1 · Defined once.** Project vocabularies are defined only in `project.md`
`## Vocabularies`, in four optional subsections that start empty: `### States`, a table
`State · Code · Note`; and `### Platforms`, `### Appears-as`, `### Tech categories`, one
bullet per value, `- <value>[ — <note>]`. Tables MUST have exactly these columns, lists one
bullet per value, and a value MUST NOT repeat [W035]. An empty vocabulary is not in use. User
types are role cards (S-TYPE-15); a `### Roles` table (`Role · Description · States`) from
earlier KBs is still read — its names resolve stories while no role card exists — but is
deprecated [W050]; `mds migrate` turns each row into a role card.

**S-VOC-2 · Selection.** Cards select values by exact name and never define them inline. A
state, platform, appears-as or Tech category value MUST be declared in `project.md` or be
reserved, and a story's role MUST name a role card once role cards exist [W006]. The reserved values `Shared` (state), `All` (platform) and `Page`
(appears-as) are always legal unlisted, and are what an omitted state, platform or appears-as
means. `Shared` MUST NOT be a States row [W035].

**S-VOC-3 · Roles and States.** A **Role** is who uses the product — a card (S-TYPE-15); user
stories name it. A **State** is a mode of the product in which a different set of screens exists — typically
signed in versus signed out; an app-wide mode that does not change which screens exist is a
screen. Without States, cards carry no `state:` and IDs no state code. A State's code is `S`
plus its first letter; on a collision the later row takes two letters, then three, until
unique; `SG` is reserved for Shared; a code never changes, even when the State is renamed.
Codes MUST follow this rule [W035].

## 5 Links and relations

**S-LINK-1 · Reference atoms.** A reference names its target by core, in one of four strengths:

- **bound** `[#<CORE> <Name>](<relative-path>[#<anchor>])`, e.g.
  `[#SC000003 Item detail](../screens/sc000003-item-detail.md)`; a step in the same file is
  `[#FS000004 Save the item](#fs000004)`;
- **hand** `#<CORE>` — a valid edge; `regen` upgrades it to bound;
- **placeholder** `[~ <Name>]` — should exist, does not yet (S-LINK-5);
- **unknown** `—` — a declared blind spot.

Only the core is load-bearing; name and path are courtesies that `regen` rewrites, and stale
text SHOULD be refreshed [I007]. A bound or hand reference MUST resolve to a card or
sub-document of its workspace [W019]. Nothing must exist before it is referenced: placeholders
and `—` are legal wherever a target is.

**S-LINK-2 · Relation lines.** In a relation context each line is one edge,
`- <Relation>: <atom>[ · <key>: <value>]…[ — <note>]`, with marker `- ` (`<n>. ` in ordered
sections). Such a line MUST be a relation line, a body state or an allowed sub-heading [W015].
A note follows ` — `, stays short and never restates the target card (Appendix B).

**S-LINK-3 · Qualifiers.** A qualifier ` · <key>: <value>` refines an edge. Keys are lowercase,
order-free and drawn from the relation's closed set (`schema.json
relations.<Relation>.qualifiers`); a valueless qualifier such as `· primary` is a mark. A value
is plain text, a placeholder or a bare core (`· rule: #RL000001`) — never a bound link — and is
quoted when it contains ` · `, `—` or `→`. Qualifiers MUST follow these rules, with values from
their enum or vocabulary [W021].

**S-LINK-4 · Mentions.** References MAY appear in prose, as untyped **mentions**: resolved and
refreshed, never a relation. A prose placeholder counts as unresolved; `—` in prose is
punctuation.

**S-LINK-5 · Placeholders and promotion.** Placeholders group by (relation target type,
whitespace-collapsed name), prose placeholders under target type "any"; each group is one
unresolved placeholder in health, and placeholders never feed generated sections. Promotion —
replacing `[~ X]` with a reference once the card exists — is an explicit edit; `regen` never
promotes. When a placeholder's name exactly matches a card of a target type, `check` reports
"`[~ X]` can now link to `#<CORE>`", and the author SHOULD promote it [I014].

**S-LINK-6 · External links.** `## Links` holds external links,
`- [<title>](<url or inputs/ path>) · type: <type>[ — <note>]`, with type `Design`, `Code`,
`Doc`, `Source`, `Analytics` or `Other`; `Source` marks evidence, a file in `inputs/` or a
URL. In a sub-document the line takes its prefix, `- Link: …` — e.g. a variant's own design.
Link lines MUST have this shape [W038].

**S-REL-1 · Closed vocabulary.** Relations come from `schema.json relations`, which gives each
one's meaning, authored places, target types, qualifiers and generated reverse. A relation word
outside it MUST NOT be used in a relation context, except an extension relation `x-<slug>`
[W016]. A relation MUST be legal where it is written — section, sub-document, step shape
[W017]; its target MUST be of an allowed type [W018]; its lines MUST respect its cardinality
[W022], such as exactly one `Served by` line. An explicit relation word overrides the section
default.

**S-REL-2 · Default relations.** A section with a default relation (`defaultRelation` in the
registry) takes prefix-less lines, `- <atom>[ · <key>: <value>]…[ — <note>]`. Writing the
default word anyway is tolerated and SHOULD be dropped [I003]. Sub-document lines and `Edge`,
`Branch`, `Entry`, `Outcome` and extension relations always carry their prefix.

**S-REL-3 · Ordered lines.** Where order is meaning — component lists and step lists — lines are numbered
`1.`, `2.`, … and the order is the truth. Such sections MUST use numbered lines that never nest
[W015]; the numbers SHOULD run 1..N, and `regen` renumbers them [I015].

**S-REL-4 · Generated reverses.** `regen` writes each authored relation's reverse on its target,
as listed in `schema.json generatedSections` — e.g. `Part` → `⚙ Used on`, `Built with` →
`⚙ Used by`, `Affects` → `⚙ Decisions`, `Leads to` → `⚙ Reached from`, membership keys → the
feature lists (S-FEAT-3), `shell:` and `· shell:` → `⚙ Frames` on the shell (S-SHELL-4), a
stepper's `flow:` → `⚙ Shown as` on the flow. A source inside a sub-document appears as its host card
with `· at: #<core>`; a component reached through another carries `· via: #CP…`; qualifier
cores use the hand form; lines are de-duplicated and sorted by target type (roster order),
core, then first qualifier. `Step`, `Edge`, `Branch`, `Entry`, `Outcome` and `Alternative`
have no reverse. A hand-grade KB MAY lack all of them (S-CONF-3).

## 6 Flows, IA maps, components, variants and shells

### 6.1 Flows

**S-FLOW-1 · Order lives in lists.** A flow is one file (S-CORE-1) whose steps are
sub-documents in `## Steps`. Its order lives only in step lists and its fork wiring only in
`Branch` lines; steps never store their position. A step MAY appear in any number of step
lists and is written once. Steps have no passport line, state, status or variants of their
own.

**S-FLOW-2 · Step shapes.** The glyph in a step heading is its type — required, and the only
source of truth; a glyph on a step-list line is ignored. Shapes and their lines:

- `○` **Start** — `Entry` 1, `Screen` 0–1, `Component` any; first in every step list;
- `□` **Action** — `Screen` exactly 1, `Component` any; the default user step;
- `◇` **Fork** — `Branch` 2 or more; `Screen`, `API`, `Backend` 0–1 each; `Component` any;
  its name is the question;
- `◎` **Finish** — `Outcome` 1, `Hand-off` 0–1, `Screen` 0–1, `Component` any; an ending,
  successful or not;
- `⧉` **Connected flow** — `Connected flow` exactly 1: runs another flow, then continues;
- `⚡` **System action** — `API` and/or `Backend`, never `Screen`: a product-side step.

Any step MAY add `Applies rule`, `Uses API`, `Connected flow` (an attached side journey that
returns), `Comment` and `Link` lines. A step MUST have its glyph and required lines [W025],
stay within these counts [W022], and carry no other relation [W017].

**S-FLOW-3 · Step body.** A step body SHOULD run: heading; anchor; where-lines (`Screen`,
`Component`, `API`, `Backend`; on ⧉ the `Connected flow` line); boundary lines (`Entry`;
`Outcome`, `Hand-off`); `Branch` lines; prose and requirement blocks; other relation lines;
optional `⚙ Prev` / `⚙ Next`. `Entry` (on Start: the trigger, origin screen or hand-off) and
`Outcome` (on Finish: what is true at the end) are free-text slots whose atoms are mentions.

```markdown
### ◇ Name valid? · #FS000003
<a id="fs000003"></a>

- Branch: Yes → [#FS000004 Save the item](#fs000004) · primary
- Branch: No → [#FS000002 Enter item details](#fs000002) · rule: #RL000001
```

**S-FLOW-4 · Step lists.** `## Step list` holds the default list as ordered `Step` lines
(`1. [#FS000001 Start from the list](#fs000001)`). Every step list MUST start with the flow's
one ○ Start step, hold no other Start, and list only steps of this flow [W026]; it SHOULD end
on a ◎ Finish or ◇ Fork [I012]. Every step SHOULD be reachable from a step list or a `Branch`
line [I011].

**S-FLOW-5 · Branches.** A Fork wires each outcome to the step that follows:
`- Branch: <label> → <step>[ · primary][ · rule: #RL…][ — <note>]`. The label names the
outcome (quoted when it contains ` · `, `—` or `→`); the target MUST be a step of the same
flow [W018]. Exactly one branch per Fork SHOULD carry `· primary` [I010]; the primary branches
from Start to a successful Finish form the happy path. Policy is cited with `· rule:`, never
paraphrased.

**S-FLOW-6 · Flow variants.** A flow variant is an alternative step list: a `### <Name>`
subsection of `## Step list` (no glyph, no core) with an optional passport line
`platform: <list> · flag: <token>` and its own full list drawn from the flow's steps. The list
directly under `## Step list` is the default. Variant names MUST be unique in the flow [W026].
A flow variant is referenced only by name, `· variant: <Name>` on a line targeting the flow,
and the name MUST exist [W028].

**S-FLOW-7 · Subflows and size.** A ⧉ step runs another flow in sequence (a subflow); a
`Connected flow` line on any other step, or in `## Connected flows`, attaches a side journey
that returns; a `Hand-off` on a Finish continues the journey in another flow and is the only
bridge into a flow of another State. Journeys are reused this way, never copied. A step list
longer than 15 steps SHOULD be split into subflows [I004].

**S-FLOW-8 · Prev and Next.** Tools MAY end a step with machine-owned
`- ⚙ Prev: <step>[ · variant: <name>]` and `- ⚙ Next: …` lines, one per step list containing
it, with no `⚙ Next` on a Fork. A `Prev` or `Next` line without `⚙` MUST NOT be written
[W017].

### 6.2 IA maps

**S-IA-1 · Tree.** An IA map's `## Parts` is an indentation tree of `Node` lines, each a screen
reference after `- `, indented exactly two spaces per level, no tabs. A node's parent is the
nearest line above with one level less; several roots are allowed; a screen MAY be placed more
than once. Indentation MUST follow these rules and never go more than one level deeper than
its parent [W027]. Node qualifiers: `· variant:` pins a screen variant (unpinned = the default
composition); `· appears-as:` sets this placement's presentation; `· shell:` binds a shell to this
placement and the subtree below it (S-SHELL-4); `· group:` labels a cluster — an annotation,
never nesting. The root of a map is a real place, such as Home — never a shell.

```markdown
## Parts
- [#SC000001 Home](../screens/sc000001-home.md)
  - [#SC000002 Item list](../screens/sc000002-item-list.md) · group: Items
    - [#SC000003 Item detail](../screens/sc000003-item-detail.md) · group: Items
  - [#SC000005 Settings](../screens/sc000005-settings.md)

### Lateral
- Edge: [#SC000005 Settings](../screens/sc000005-settings.md) → [#SC000002 Item list](../screens/sc000002-item-list.md) · label: Back to items
```

**S-IA-2 · Lateral edges.** `### Lateral`, under `## Parts`, holds lines
`- Edge: <screen> → <screen>[ · label: <text>][ — <note>]`; both endpoints MUST be placed on
the same map [W027].

**S-IA-3 · Pure arrangement.** A map holds only references: no canvas positions, screen facts
or reverse facts. It belongs to at most one state (S-FM-7); `default: true` marks the default
map of its state, and two default maps of one state MUST NOT exist [W040]. A screen on no map
is simply unplaced, which is no finding.

### 6.3 Components and variants

**S-COMP-1 · Components.** `## Components` (screens, components) is the default composition: ordered
`Part` lines, top to bottom, `1. <component>[ · variant: <name or #CV core>][ — <note>]`.
Deeper composition lives in the child component. Part nesting among components MUST be
acyclic, directly or through variants [W029].

**S-COMP-2 · Variants.** `## Variants` (optional) holds named alternatives of the same place or
part: sub-documents `### <Name> · #SV…` (screens) or `### <Name> · #CV…` (components), each
with its anchor, an optional passport line (S-SUB-2), an optional prose line and its own full
list of `Part` lines (or `none` / `—`), never inherited from `## Components`; explicit
`- Comment:` and `- Link: … · type: Design` lines may follow. There is no Default variant: the
default is `## Components`, and an unpinned reference resolves to it. Error, empty and loading
presentations are ordinary variants. A `· variant:` pin, by name or `#SV`/`#CV` core, MUST
name an existing variant of its target [W028].

```markdown
## Variants
### Picker · #SV000001
<a id="sv000001"></a>
appears-as: Side panel

1. [#CP000003 Item row](../components/cp000003-item-row.md) · variant: Compact
```

**S-COMP-3 · Presentation and platform.** A placement's presentation resolves from the most
specific source: its own `· appears-as:` (IA node or step `Screen` line), else the variant's
passport, else the screen's `appears-as:`, else Page. A variant's `platform` limits it to those
platforms (omitted = all). Tools MAY show resolved values; they are never stored. A placement's
shell resolves the same way (S-SHELL-4).

### 6.4 Shells

> **Added in fix pass 2 (2026-10-16 → 2026-10-18).** Shells replace the earlier advice to
> model persistent UI as an *App shell screen at the IA root*. The root of a map is a real
> place (Home); the frame around places is a card of type `shell`, described once and resolved
> per placement. `schema.json shells` holds the same rules for tools.

**S-SHELL-1 · A shell is the frame.** A **shell** (S-TYPE-14) is what surrounds places: what
is always there (`## Components`), where it leads (`## Navigation`), and the rules for
whatever it frames (`## Places inside`). It is never a screen and never a `Part` of one
[W046]: it frames nodes of a map, it is not one. `shell-type` names its kind: `app` (the
home frame of a platform and state), `section` (back, breadcrumbs, section tabs), `stepper`
(progress and Continue; `flow:` names the flow it shows), `overlay` (the frame of a modal,
sheet or drawer; `appears-as:` names the presentation it frames), `focus` (nothing but an
exit), `split` (a list that stays while the detail changes), `embedded` (a host provides the
frame). `appears-as:` belongs to overlays only and `flow:` to steppers only, and each of
those needs its key [W047].

**S-SHELL-2 · Three things, each written once.** `appears-as` on a placement says *how*
content is shown: over the current screen, which stays. The overlay shell whose `appears-as`
matches says *what* frames everything shown that way: title, close, Confirm or Cancel, and
the rules. The content is the screen card, or a part of a shell. None of the three repeats
the others: a screen card SHOULD NOT hold a frame's control (Continue, Close, Back, the
product's tabs) [I027]; it declares its outcome and its primary action by name, and the frame
renders it. Links that are the place's own content — a row opening its detail — are not frame
navigation; flows and lateral edges hold them.

**S-SHELL-3 · Places and parts.** Does the user go somewhere with content and purpose of its
own? Then it is a screen, with `appears-as` on its placement (a size guide as a modal, the
cart as a side drawer). Does the frame unfold — a navigation drawer, an account menu, a
search overlay? Then it is a part of the shell: a `Part` line in the shell's `## Components`
with `· appears-as:` saying how it unfolds. `· appears-as:` on a `Part` line is legal only in
shells [W047]. An overlay shell frames shell parts the same way it frames places.

**S-SHELL-4 · Binding and resolution.** A screen MAY name its usual shell with `shell:` (an SH
core, or `none`); a screen variant in its passport; an IA node or a step's `Screen` line with
`· shell:`. Every such target MUST be a shell [W044]. A placement's shell resolves from the
most specific source, like its presentation (S-COMP-3):

1. the placement's own `· shell:` (IA node or step `Screen` line); `none` = no shell;
2. the variant's passport `shell:`;
3. for a step of a flow, the `stepper` shell whose `flow:` is that flow — a stepper frames its
   own flow's steps without a qualifier on each;
4. the screen's `shell:`, only when the resolved presentation is Page — an overlay never
   inherits a page shell;
5. on a map, the nearest ancestor node's `· shell:` — one qualifier on a section's node frames
   the whole subtree;
6. the default: for a Page, the `app` shell whose `platform` and `state` match the map's or
   flow's (an omitted key matches any value; a stated match beats an omitted one); for any
   other presentation, the `overlay` shell whose `appears-as` equals it;
7. none.

On every rung, a shell whose `platform:` excludes the placement's platform is skipped and
resolution goes on down the list — a desktop-only section shell bound on a node leaves the
app's placements to the app shell. Two shells MUST NOT be the default for the same kind,
platform, state and presentation, nor two steppers show one flow [W045]. Then the shell's variant (S-SHELL-5) is chosen. Tools MAY show the resolved shell and
variant; they are never stored. The reverse, `⚙ Frames` on the shell, lists explicit bindings
only (S-REL-4); default bindings are computed.

**S-SHELL-5 · Variants stack.** `## Variants` of a shell holds sub-documents `### <Name> · #HV…`
whose passport takes `platform`, `state` and `level` (`1` = the root of the map, `2` = one
level down, `2+` = that level and deeper; omitted = any). A shell variant lists the parts it
**adds** to the host's `## Components` — the one place where a variant does not repeat the
host's list, because shell part lists are long and mostly shared (the consent banner, the
toast). **Every** variant whose passport matches the placement's platform, the map's or flow's
state and the node's depth applies, in variant order; the same part added twice appears once;
none matching = the host alone. So `Mobile`, `Signed in` and `Level 2+` are written once each
and a signed-in phone page deep in the map gets all three — a variant for a combination is
never needed. Variants carry parts only; navigation stays in the host's list (S-SHELL-6). A
part that some placements lack belongs in a variant, not in the host.

**S-SHELL-6 · Navigation.** `## Navigation` holds ordered `Leads to` lines,
`1. <screen>[ · kind: tab|menu|link][ · label: <text>][ · in: <parts>][ · platform: <list>][ · state: <State>][ — <note>]`
(kind omitted = link): the places the frame leads to, in display order. It is **one list** for
the host and all its variants: `· platform:` and `· state:` limit a line to some placements,
and a variant never carries navigation lines [W017]. `· in:` names the part of this shell that
holds the entry — the header, the footer, the tab bar, the account menu — by component name or
`#CP` core; with several, comma-separated, the resolved frame shows the one it has, and a
line none of whose `in:` parts is in the resolved frame is not shown there. Every
`in:` value MUST be a part of this shell, host or variant [W048]. A line shown in a State
where its screen does not exist is a finding [I028]. Written on the shell, never on the
screens reached; their reverse is `⚙ Reached from`. Breadcrumbs and back are parts; what they show is the map path,
computed. A stepper's order comes from its `flow:`, whose reverse is `⚙ Shown as`. A tool
reading a map treats a shell's navigation as reachable from every node the shell frames, so
lateral edges are for the rest.

**S-SHELL-7 · Places inside.** `## Places inside` is the contract for whatever the shell
frames, as ✅ / 🚫 lines and requirement blocks: what the frame provides, what it expects of a
place (a primary action by name, valid or not, done), what a place MUST NOT do (own
navigation, own close, own back), and what happens on complete, cancel, leave and error. An
agent, a designer or a developer reads the resolved shells' contracts before writing a place
(`mds frame <root> <screen>` prints them per placement); a place that lists a frame's control
is a review finding (Appendix B).

**S-SHELL-8 · New shell or variant.** A new shell when the frame does another job (another
`shell-type`) or follows another navigation model: mostly different destinations or parts, or
different rules in `## Places inside`, which a variant cannot change. A variant when the same
frame adds or swaps a part or two for a platform, a state or a level. The usual set: one app
shell per platform family whose frame is built differently (a desktop header against a native
tab bar), a section shell per area with its own wayfinding, a stepper per task flow, one
overlay shell per presentation — typically three to eight. Ask: is the user still in the same
place, only deeper or signed in (a variant), or in another mode — doing a task, inside an
area, looking at an overlay (another shell)?

```markdown
---
type: shell
id: SH000001
name: App shell
shell-type: app
---
## Components                 # common to every variant
1. [#CP000003 Consent banner](../components/cp000003-consent-banner.md)

## Navigation                 # one list, in display order
1. [#SC000002 Home](../screens/sc000002-home.md) · kind: tab · in: Top bar, Navigation drawer
2. [#SC000003 Shop](../screens/sc000003-shop.md) · kind: tab · in: Top bar, Navigation drawer
3. [#SC000016 Sign in](../screens/sc000016-sign-in.md) · in: Top bar · state: Guest
4. [#SC000018 My account](../screens/sc000018-my-account.md) · kind: menu · in: Account menu · state: Signed in
5. [#SC000015 Contact](../screens/sc000015-contact.md) · in: Footer

## Places inside
✅ Declare one primary action by name; the frame renders it.
🚫 Never show navigation of your own.

## Variants
### Desktop web · #HV000001
<a id="hv000001"></a>
platform: Desktop web

1. [#CP000001 Top bar](../components/cp000001-top-bar.md)
2. [#CP000002 Footer](../components/cp000002-footer.md)

### Mobile web · #HV000002
<a id="hv000002"></a>
platform: Mobile web

1. [#CP000011 Burger](../components/cp000011-burger.md)
2. [#CP000012 Navigation drawer](../components/cp000012-navigation-drawer.md) · appears-as: Side drawer — opened by the burger

### Signed in · #HV000003
<a id="hv000003"></a>
state: Signed in

1. [#CP000013 Account menu](../components/cp000013-account-menu.md) · appears-as: Dropdown
```

A signed-in desktop page gets the consent banner, the top bar, the footer and the account
menu: Desktop web and Signed in both match, and both apply.

The Payment screen is a page under Checkout, framed by the Checkout stepper through
`· shell:` on the checkout flow's step; in the edit-order flow its step says
`· appears-as: Modal`, so rule 3 skips the page shell and rule 5 gives it the Modal shell.
The Payment card has no Continue and no Save: the stepper renders its action as Continue, the
modal as Save. Nothing on the card changes between the two.

## 7 Identifiers

**S-ID-1 · Core.** A **core** is a two-letter prefix plus six digits (`SC000006`), the only
load-bearing token of a reference. `id:` holds the core only — no `#`, state code or version.
A card without `id:`, with a malformed core, an unknown or reserved prefix, or another type's
prefix MUST NOT exist [E003]. `regen` never mints; `mds new` or `mds mint` fixes a missing id.

**S-ID-2 · Prefixes.** Card prefixes are in S-TYPE-1; sub-documents use `SV` (screen variant),
`CV` (component variant), `HV` (shell variant) and `FS` (flow step). `X?` and `Z?` are reserved for extensions,
which a KB MAY use without registration (S-EXT-1); `SS` for tool snapshots, which never appear
in a KB.

**S-ID-3 · Project-wide identity.** A core is unique across the project, all workspaces
included: the same core in two workspaces is the same card in two versions, and references
resolve within their own workspace. Two files or sub-documents with one core in a workspace
[E004], or one core with two types anywhere in the project [E005], MUST NOT exist.

**S-ID-4 · Minting.** The next core for a prefix is one above the highest number ever used for
it — in any file of any workspace, in the Retired table, or as its High-water mark —
zero-padded. Tools mint (`mds new`, `mds mint`) and every mint raises the High-water mark, so
a minted but unused core is never handed out again. Hand minting MAY follow the same rule. A
core is minted when its file or sub-document is created; until then a placeholder points at
the thing.

**S-ID-5 · Never reused.** A core is never edited or reused, even after deletion or merge: a
retired core MUST NOT appear in a file [W041].

**S-ID-6 · Register.** The project root's `_ids.md` (`schema.json projectRoot.idRegister`) has
three generated tables: `⚙ Resolved` (Core · Type · Name · Versions · Path in the newest
version; sub-documents included), `⚙ Retired` (Core · Type · Name · Last version · Merged
into; append-only) and `⚙ High-water marks` (Prefix · Highest; never lowered). Retired rows and
marks are memory, not derivable: `regen` keeps them, and deleting `_ids.md` can lose them. The
register SHOULD be current [I020]; it is a cache, since a core resolves by its file.

**S-ID-7 · Rendered ID.** A card's **rendered ID** is `#` + core + state code (only when the
project declares States) + `V` + workspace version: `#SC000006V1.1`, or `#SC000006SLV1.1`
with States. A card whose state is omitted, `Shared` or several States renders `SG`; one with
`state: —` renders no code. Rendered IDs appear only in status lines and tool UIs and MUST NOT be used in
references or front matter [W020].

**S-ID-8 · Filenames.** A card file is named `<core-lowercase>-<slug>.md`
(`sc000006-item-list.md`), the project card `project.md`; the core part MUST equal `id:`
[W031]. The slug is the name folded to lowercase ASCII with hyphens, at most 60 characters
(`schema.json ids.slug`); it SHOULD match the name [I016], and tools MAY rename files as a
courtesy, since references resolve by core.

## 8 Versions

**S-VER-1 · Workspaces.** A version of the KB is a workspace folder `V<major>.<minor>/` holding a
full KB; an exploration — an alternative direction — is `V<major>.<minor>-<label>/`. The
workspace owns the version: cards carry no `version:` key (S-FM-3), and the manifest's
`version` MUST equal the folder name without `V` [W033].

**S-VER-2 · Lifecycle.** The manifest's `lifecycle` MUST be one of [W033]: `planned` (created
for a future version; work not started), `in-progress` (being changed now; several may be in
progress at once), `released` (matches what shipped; editable for corrections), `archived`
(read-only history, S-VER-6) or `exploration` (an alternative direction).

**S-VER-3 · Based on.** Versions form a tree: `based-on` names the version a workspace was
branched from, is omitted for a root version, and MUST name another existing workspace
[W033]. `mds branch <root> <from> <to>` copies a workspace and sets `version`,
`lifecycle: in-progress` and `based-on`.

**S-VER-4 · Change status.** In a workspace with `based-on`, each card is compared by core with
the base workspace's **current** content, part by part: **Passport** (front matter except
`standard`, plus the title name) and each authored section by heading, sub-documents counting
in their host section; references, anchors, status lines and `⚙` lines are normalised away
first (`schema.json versions.fingerprint`). The result is `new` (core absent from the base),
`unchanged`, or `changed: <Part>, <Part>` (Passport first, then sections in card order).
`regen` writes it into the status line; tools MAY show it anywhere.

**S-VER-5 · CHANGES.md.** A workspace with `based-on` has a generated `CHANGES.md`
(`type: index`, `name: Changes`; title `# Changes · V<version> · based on V<base>`) with
`⚙ New`, `⚙ Changed` (`· changed: <Part>, …`) and `⚙ Removed` (base cores missing here, as
`- #<CORE> — <name in the base>`): cards only, sorted by type, then core. It SHOULD be current,
and a workspace without `based-on` SHOULD have none [I020]. There is no other change log.

**S-VER-6 · Archived is read-only.** `regen` skips archived workspaces and `check` still reads
them; authors SHOULD NOT edit them. Released workspaces stay editable.

**S-VER-7 · Moving changes between versions.** A card MAY be carried to another version of the
same project by copying its file — same core — into that workspace and running `regen`.
Import and re-minting (S-OPS-4) are only for material from another project.

**S-VER-8 · Naming the version.** An agent changing a KB SHOULD name the version in every
change it reports — "In V1.1 (in-progress): …" — and SHOULD ask when the target version is
unclear.

## 9 Conformance

**S-CONF-1 · Severities.** A checker MUST report every finding with the code and severity
listed in `schema.json diagnostics` [E001] … [I025]. The severities:

- **error** (`E`) — the KB cannot be trusted (unparsable front matter, unknown type,
  malformed id, ID collisions) and `regen` stops (S-CORE-5);
- **warning** (`W`) — a MUST is broken; it never blocks authors;
- **info** (`I`) — a SHOULD is broken, or something `regen` will tidy.

`mds check` prints `severity · code · file:line · message` and health, and exits 1 when an
error exists.

**S-CONF-2 · Health.** Health is three numbers, reported side by side per card, module and
workspace, never combined into one score:

- **blind spots** — every authored `—`: the whole body of a required section or of a
  sub-document component list or step, a front-matter or passport value, a requirement slot, a relation
  target, the final `—` of an incomplete list; not counted: optional sections, `none`, generated content, table cells, and a
  decision's `Outcome` while Open or Proposed;
- **unresolved placeholders** — distinct placeholder groups (S-LINK-5);
- **open decisions** — decisions with status Open or Proposed.

Tools SHOULD report diagnostic counts per severity beside them, and SHOULD break blind spots down
by kind (status, other keys, required sections, list items, requirement slots, relation targets).

**S-CONF-3 · Hand-grade and tool-grade.** A **hand-grade** KB — no generated sections, status
lines or generated files — is valid; a **tool-grade** KB adds them over the same authored
bytes. Generated content MAY be removed at any time without losing authored knowledge,
except the Retired rows and High-water marks of `_ids.md` (S-ID-6).

**S-CONF-4 · Regenerate.** `regen <root>` writes, for every workspace not archived: the project
`_index.md` and `_ids.md`, folder rosters, generated sections, status lines and `CHANGES.md`.
In authored zones it changes only machine-owned tokens: title lines; status lines; names and
paths in bound references, and hand references in relation lines (made bound); anchor lines;
the numbering of ordered lines; forgiveness values; optional `⚙ Prev` / `⚙ Next` lines. It MAY
rename files to their slug (S-ID-8). It never edits prose, front-matter values or relation
targets, mints cores (S-ID-1) or promotes placeholders (S-LINK-5). A conforming `regen`
MUST leave none of these findings in what it writes [I001] [I002] [I005] [I006] [I007] [I009]
[I015] [I020]. `fixtures/` gives expected diagnostics for testing tools.

**S-CONF-5 · Review checks.** Judgment checks (Appendix B) are not validator rules. A reviewer
— a person or a QA agent — SHOULD run them; they never change a diagnostic's severity.

## 10 Operations

**S-OPS-1 · Merge.** Two cards that are one thing MAY be merged by hand: pick the survivor;
rebind every reference to the other card, `feature:` and `parent:` included, to the survivor;
delete the other file; add its core to `⚙ Retired` with `Merged into` = the survivor. The
survivor keeps its own core and `origin`. Every reference to the retired core MUST be rebound
[W041].

**S-OPS-2 · Duplicate.** A card MAY be started from a copy of another: take a new core from
`mds mint`, set `id:` and rename the file; no provenance is stamped. A copy that keeps the
original's core MUST NOT stay in the workspace [E004].

**S-OPS-3 · Export.** Export units are a workspace, a module folder and a single card. Export
copies files without transforming them; a module or card export carries a manifest stub whose
`modules` lists only what ships. Comments are excluded unless requested; decisions are
included. Generated content MAY ship, but receivers never trust it. A unit MUST NOT be
exported while an ID collision stands in it [E004] [E005].

**S-OPS-4 · Import.** Importing material from another project:

1. re-mint every core, cards and sub-documents, into this project's counters, even without a
   collision;
2. rewrite references inside the imported set to the new cores;
3. turn references to targets outside the set into placeholders with a note,
   `[~ <Name>] — was #<core> in <kb>`;
4. rewrite `feature:` and `parent:` when the target is in the set; otherwise drop the key and
   report it [I022];
5. record `origin: <kb>/<core>` after the extras;
6. drop shipped `⚙` content and regenerate.

Files are placed by their front matter; missing module folders are created and enabled. A
foreign vocabulary value is mapped, added to `project.md`, or kept and reported [W006] — never
silently changed. A card whose `origin` already exists in the project is skipped with a
warning; two cards with one `origin` in a workspace MUST NOT exist [W043]. Import is authoring:
it never fails as a whole, and SHOULD be followed by `check`.

**S-OPS-5 · Migrate.** `mds migrate <root>` brings a KB written against an earlier reading of
the current version up to date, idempotently: each `### Roles` row becomes a role card (Description →
the card's description, States → `state:`), one core per role name across all workspaces so
the same role is the same card in every version; read-only workspaces are skipped; the table
is removed and the `roles` module enabled. Stories need no change.

## 11 Extensions

**S-EXT-1 · No registration.** A KB MAY extend the standard without registering anything:
extension types `x-<slug>` with `X?` or `Z?` prefixes; `x-*` front-matter keys, last and never
validated; authored `## x-<name>` sections, kept where they stand; `## ⚙ x-<name>` sections
generated by extension tools; and extension relations, always prefixed: `- x-<slug>: <atom>…`.
Tools accept all of them and preserve them byte for byte.

**S-EXT-2 · Evolution.** A minor version of the standard only adds; a major version ships a
migration map, which MAY promote widely used extensions into the core.

## Appendix A · Grammar

A readable form of `schema.json grammar`: JavaScript regular expressions with the `u` flag,
whose named groups are the parse result. Files are UTF-8 with LF line endings and a final
newline; a U+FE0F variation selector after `⚙` or a step glyph is tolerated.

**A.1 Shapes**

```
relation line     - <Relation>: <atom>[ · <key>: <value>]…[ — <note>]
prefix-less line  - <atom>[ · <key>: <value>]…[ — <note>]
ordered line      <n>. <atom>[ · <key>: <value>]…[ — <note>]
edge line         - Edge: <atom> → <atom>[ · label: <text>][ — <note>]
branch line       - Branch: <label> → <atom>[ · primary][ · rule: #RL…][ — <note>]
text slot         - Entry: <text>   |   - Outcome: <text>
generated line    - ⚙ Prev: <atom>[ · variant: <name>]   |   - ⚙ Next: …
title line        # <name> · #<CORE>
status line       > ⚙ <rendered-id> · V<version> <lifecycle>[ · based on V<base>][ · <change>]
section heading   ## [⚙ ]<Heading>
sub-document      ### [<glyph> ]<Name> · #<CORE>
anchor line       <a id="<core-lowercase>"></a>
passport line     <key>: <value>[ · <key>: <value>]…
requirement       **R<n> · <Preset>**[ <text>]
IA node line      <two spaces per level>- <atom>[ · <key>: <value>]…
```

Atoms: bound `[#<CORE> <Name>](<relative-path>[#<anchor>])` · hand `#<CORE>` · placeholder
`[~ <Name>]` · unknown `—`. Bodies: `—` alone = blind spot · `none` alone = verified none ·
`-`, `–`, `TBD`, `?` alone = forgiveness for `—`.

**A.2 Parsing a relation line**

1. Match the marker `- ` or `<n>. `; leading spaces are indentation.
2. A `⚙` directly before a relation word marks a machine-owned line (`⚙ Prev`, `⚙ Next`).
3. A vocabulary word or `x-<slug>` followed by `: ` makes an explicit relation; otherwise, in
   a section with a default relation, a body starting with an atom (in step lists, optionally
   after a glyph) is a prefix-less line; otherwise the line is prose.
4. `Entry` / `Outcome`: the rest is one text value whose atoms are mentions. Stop.
5. Split off the note at the first ` — ` outside `[]`, `()` and quotes.
6. `Edge` and `Branch`: split at the first ` → ` outside `[]`, `()` and quotes; the left side
   is an atom or the Branch label.
7. Split the rest at ` · ` outside `[]`, `()` and quotes: the first part is the atom, the
   others are qualifiers `<key>[: <value>]`.
8. Parse the atom — bound, hand, placeholder or `—`; anything else is a bad line shape.

**A.3 Tokens.** Core: two capitals and six digits. Slugs, `kb` values and labels: runs of
lowercase letters and digits joined by single hyphens. Version `<major>.<minor>[-<label>]`;
`origin` `<kb>/<CORE>`; state code `S` plus 1–4 capitals; `date` `YYYY-MM-DD`; front-matter
keys of lowercase letters, digits and hyphens.

## Appendix B · Review checks

Judgment checks for a reviewer (`schema.json reviewChecks`; S-CONF-5):

1. **Paraphrased rule** — a card restates a rule's policy instead of citing `#RL`.
2. **Cross-card contradiction** — two cards state incompatible facts.
3. **Unobservable outcome** — a Then or shall-response that cannot be observed ("works
   correctly").
4. **Overlong or restating note** — a note longer than about half a line, or repeating the
   target card.
5. **Altitude** — a Feature's scope against its Sub-features' one-liners; a parent summarising
   its children.
6. **Wrong type** — an edge case describing the normal path; a screen without components of its
   own (a component); a requirement that is a policy (rule) or an exception (edge case); a
   place that lists a frame's control — Continue in a stepper, Close in a modal, the product's
   tabs on a page (S-SHELL-2).
7. **Duplicates** — two cards that are one thing (merge candidates, S-OPS-1).
8. **Evidence** — a status or fact without a source, owner answer or decision.

## Appendix C · Glossary

- **Altitude rule** — each card level answers only its own question (S-FEAT-5).
- **Blind spot** — `—`: a known question without an answer; counted in health.
- **Card** — one file documenting one thing of the product.
- **Core** — prefix plus six digits; a card's permanent, project-wide identity.
- **Default relation** — the relation a section's prefix-less lines express.
- **Feature / Sub-feature** — a product domain / a capability inside one.
- **Hand-grade / tool-grade** — a KB without / with generated content.
- **Health** — blind spots, unresolved placeholders and open decisions.
- **Home** — the one feature a screen, flow or component belongs to.
- **Membership key** — `feature:` or `parent:`, the only front-matter keys holding a core.
- **Navigation** — a shell's ordered `Leads to` lines: the places it leads to (S-SHELL-6).
- **One-liner** — the first sentence of `Description & Requirements`.
- **Ownership Law** — the one who knows writes; the referenced side is computed.
- **Placeholder** — `[~ Name]`: something that should exist but is not a card yet.
- **Rendered ID** — `#<CORE>[<state code>]V<version>`; for display only.
- **Role / State** — who uses the product (a card) / a mode with its own set of screens (a vocabulary).
- **Components / Variant** — a screen's or component's default composition / a named alternative with its own component list.
- **Shell** — a card of type `shell`: the frame around places — its parts, where it leads,
  and the contract for what it frames; resolved per placement, variants by platform, state
  and level (section 6.4).
- **Places inside** — a shell's contract for whatever it frames (S-SHELL-7).
- **Status line** — `> ⚙ …` under the title: version, lifecycle, change status.
- **Sub-document** — a variant or step with its own core inside its card.
- **Truth Law** — the files are the database.
- **Verified none** — `none`: known to be empty; not counted.
- **Workspace** — `V<major>.<minor>/`, holding one version of the KB.
- **Zone** — authored (people write it) or generated (`⚙`, `regen` writes it).
