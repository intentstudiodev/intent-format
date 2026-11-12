---
name: intent-format
description: Read, write, check and answer questions from Intent Format knowledge bases — markdown KBs describing a software product (screens, components, user flows, IA maps, rules, APIs, backend, tech, decisions). Use whenever you create or edit a KB card, or work in a folder that contains an intent-format.md manifest.
---

# Intent Format — router

A KB describes one software product as a folder of markdown **cards**: one card = one
file. Every card has front matter, a title `# <Name> · #<CORE>`, and fixed `##` sections.
Cards link to each other by **core ID** (`SC000006`). A tool (`intent-format`) mints IDs, computes
the generated (`⚙`) sections and checks the KB.

**Arriving at a KB folder?** Run `intent-format next <root>` first. It reads the folder and tells you
the one next step — mid cold start or long after — and which page to read for it.

Read this page, then **only** the sheet for what you are doing (routing table below).
Don't read the full spec unless a sheet sends you there.

## Golden rules

1. **Know the version.** Start at the workspace manifest `V<x.y>/intent-format.md` (version, lifecycle, based on). Name the version whenever you change something ("In V1.1 (in-progress): …"). If it's unclear which version is meant, ask.
2. **Never mint IDs by hand.** Use `intent-format new`. Never reuse a core.
3. **Reference by core.** `[#SC000006 Item list](../screens/sc000006-item-list.md)`. Never put rendered IDs (`#SC000006V1.0`) in references or front matter.
4. **Never edit `⚙` sections or the `> ⚙` status line.** Run `intent-format regen`.
5. **No invented facts.** Unknown → `—` (blind spot). Known to be empty → `none`. A list you know is incomplete → end it with `—`. Should exist but isn't a card yet → `[~ Name]`.
   **Every card says why.** `## Why` right after Description (after Question on a decision): one or two sentences answering the type's why question — *purpose* (project, feature, flow, role: what problem, what goal), *choice* (screen, component, shell, tech, decision …: why this way and not another), *constraint* (rule, edge case: what goes wrong without it). The type sheet prints the question. A screen's why is not its feature's why. Required on project, feature, rule, decision, userflow, shell, role, tech; optional elsewhere. Says what the Description does not; nothing to add → `none` or `none — layout only`. Another card's why covers it → `same as #FT000003` (any card by id). Not asked yet → `—` (why debt).
   **Ask inside the sentence.** A question for the owner that no value can hold — an unknown fact, a doubt about one sentence — goes where it belongs: `… sorted by date [ask: newest first?]`. `intent-format open` lists every `[ask: …]` with its card and line. The answer rewrites the sentence; `· later <date>` when the owner says later (due again after two days); "unknown" leaves it as it is. Never drop one yourself.
   **Mark what you are not sure of.** End a why or a decision Outcome with `[likely]` (follows from inputs, not stated) or `[assumed]` (a guess). Unmarked = confirmed by the owner or an input. When the owner confirms, remove the mark. `intent-format open` lists what is still marked.
6. **Write each relation once**, at its authored end (the type sheet says where). The reverse appears after `intent-format regen`.
7. **Required sections must exist** (content, `—` or `none`). `Links`, `Tags`, `Comments` are optional.
8. **Front matter:** fixed key order, values from the vocabularies in `project.md`, `—` never quoted.
9. **Open questions and judgment calls → decision cards** (`status: Open`, `## Affects`). When decided: `status: Decided`, `decided: <date>`, `by: owner|agent|<role>`, the Outcome says which option and why. Replaced later → `status: Superseded` + `superseded-by:`.
10. **One fact, one home.** Don't restate a rule or fact in several cards — link to the card that owns it.
11. **Flows stay small:** ≤ 15 steps; extract reusable parts as subflows (⧉ Connected flow step).
12. **After every batch of edits:** `intent-format regen`, then `intent-format check`; fix all errors and warnings.
13. **Shells frame places.** Screens are content, shells are context. Before writing or editing a screen, run `intent-format frame <root> <screen>` and obey the `## Places inside` it prints. A screen card should not hold the frame's parts or controls (tabs, top bar, Continue, Close, Back) — allowed, but `check` flags it: it declares its content, its outcome and its primary action by name. Does the user go somewhere → a screen with `opens-as`. Does the frame unfold (a drawer, a menu) → a part of the shell. Navigation is one ordered list on the shell; variants stack. Details: **How to model** in `types/shell.md`.
14. **User types are role cards.** A story names a role by its exact card name ("As a Member, …"); the role lists its stories in `⚙ Stories`. A `### Roles` table in `project.md` is the old form: `intent-format migrate`.

## Routing table

| You are about to… | Read |
|---|---|
| decide which type something is (modelling) | `types/_overview.md` (one page) |
| write or edit a screen | `intent-format frame <root> <screen>`, then `types/screen.md` |
| shape navigation, frames, platforms | **How to model** in `types/shell.md` |
| write or edit a card of type X | `types/X.md` (X = project, screen, component, shell, userflow, ia, rule, api, feature, edge-case, backend, tech, decision, comment) |
| write relation lines or links | `links.md` |
| bootstrap a KB / add a project / ingest a big batch of material | `../kb-cold-start/SKILL.md` |
| create a new version | § Versions below, then `intent-format branch` |
| answer a question from a KB | `_ids.md` at the project root → the cards; `project.md` for vocabularies and use cases |
| find out what is still unknown, guessed or asked | `intent-format open <root>` |
| settle an edge case of the format | `spec.md` in the standard folder — search the one relevant section |

## Versions

- Each version is a workspace folder: `V1.0/`, `V1.1/`, `V2.0/` (explorations: `V2.0-<label>/`).
- Its manifest says `lifecycle` (planned · in-progress · released · archived · exploration) and `based-on` (the version it was created from). Several versions can be in progress at once.
- A core means the same card in every version. IDs are unique across the whole project.
- After `intent-format regen`, each card's status line says whether it is **new**, **changed** (which sections) or **unchanged** compared with its base; `CHANGES.md` lists new, changed and removed cards.

## CLI

`intent-format` = `node <standard>/kit/cli/intent-format.mjs` (Node ≥ 18, no install).

| Command | Does |
|---|---|
| `intent-format init <root> --name "<Name>" [--lifecycle planned]` | new project root with `V1.0/`, manifest, project card |
| `intent-format new <type> "<Name>" --root <root> [--ws V1.0]` | mints a core, creates the card from its template, prints `<core> <path>` |
| `intent-format mint <PREFIX> --root <root> [--count n]` | mints cores for flow steps (FS) and variants (SV screen, CV component, HV shell) |
| `intent-format scaffold <root> --inventory <file>` | creates every card listed in an inventory table in one call (features first) and writes the cores back |
| `intent-format regen <root>` | ID register, rosters, generated sections, status lines, `CHANGES.md` |
| `intent-format check <root> [--json]` | diagnostics (error · warning · info) and health numbers |
| `intent-format branch <root> <from> <to>` | new version workspace based on another |
| `intent-format next [<root>]` | where the project stands and the one next step (cold start and after) |
| `intent-format migrate <root>` | brings an older KB up to date (today: the `### Roles` table → role cards) |
| `intent-format frame <root> <screen>` | the resolved shell, stacked variants, parts, navigation and contract per placement |
| `intent-format open <root>` | the open list: `[ask: …]` questions, open decisions, `[assumed]` / `[likely]` marks, whys missing, other blind spots per card — what to ask the owner |

## Project root at a glance

```
<root>/
  AGENTS.md   CLAUDE.md   how a fresh agent starts (written once by init; yours to edit)
  _index.md   _ids.md     ⚙ versions tree · project-wide ID register
  inputs/                 raw sources (evidence); links in inputs/links.md — the only place a Source link may point
  proposal/  report.md   cold-start working files (inventory, frames, decisions, review)
  V1.0/
    intent-format.md         manifest
    project.md            description, main use cases, constraints, vocabularies, built with
    roles/ screens/ components/ shells/ userflows/ ia/ rules/ apis/ features/ edge-cases/ backend/ tech/ decisions/ comments/
```
