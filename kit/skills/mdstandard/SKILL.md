---
name: mdstandard
description: Read, write, check and answer questions from MDStandard knowledge bases — markdown KBs describing a software product (screens, components, user flows, IA maps, rules, APIs, backend, tech, decisions). Use whenever you create or edit a KB card, or work in a folder that contains an mdstandard.md manifest.
---

# MDStandard — router

A KB describes one software product as a folder of markdown **cards**: one card = one
file. Every card has front matter, a title `# <Name> · #<CORE>`, and fixed `##` sections.
Cards link to each other by **core ID** (`SC000006`). A tool (`mds`) mints IDs, computes
the generated (`⚙`) sections and checks the KB.

**Arriving at a KB folder?** Run `mds next <root>` first. It reads the folder and tells you
the one next step — mid cold start or long after — and which page to read for it.

Read this page, then **only** the sheet for what you are doing (routing table below).
Don't read the full spec unless a sheet sends you there.

## Golden rules

1. **Know the version.** Start at the workspace manifest `V<x.y>/mdstandard.md` (version, lifecycle, based on). Name the version whenever you change something ("In V1.1 (in-progress): …"). If it's unclear which version is meant, ask.
2. **Never mint IDs by hand.** Use `mds new`. Never reuse a core.
3. **Reference by core.** `[#SC000006 Item list](../screens/sc000006-item-list.md)`. Never put rendered IDs (`#SC000006V1.0`) in references or front matter.
4. **Never edit `⚙` sections or the `> ⚙` status line.** Run `mds regen`.
5. **No invented facts.** Unknown → `—` (blind spot). Known to be empty → `none`. A list you know is incomplete → end it with `—`. Should exist but isn't a card yet → `[~ Name]`.
6. **Write each relation once**, at its authored end (the type sheet says where). The reverse appears after `mds regen`.
7. **Required sections must exist** (content, `—` or `none`). `Links`, `Tags`, `Comments` are optional.
8. **Front matter:** fixed key order, values from the vocabularies in `project.md`, `—` never quoted.
9. **Open questions and judgment calls → decision cards** (`status: Open`, `## Affects`).
10. **One fact, one home.** Don't restate a rule or fact in several cards — link to the card that owns it.
11. **Flows stay small:** ≤ 15 steps; extract reusable parts as subflows (⧉ Connected flow step).
12. **After every batch of edits:** `mds regen`, then `mds check`; fix all errors and warnings.
13. **Shells frame places.** Screens are content, shells are context. Before writing or editing a screen, run `mds frame <root> <screen>` and obey the `## Places inside` it prints. A screen card should not hold the frame's parts or controls (tabs, top bar, Continue, Close, Back) — allowed, but `check` flags it: it declares its content, its outcome and its primary action by name. Does the user go somewhere → a screen with `appears-as`. Does the frame unfold (a drawer, a menu) → a part of the shell. Navigation is one ordered list on the shell; variants stack. Details: **How to model** in `types/shell.md`.
14. **User types are role cards.** A story names a role by its exact card name ("As a Member, …"); the role lists its stories in `⚙ Stories`. A `### Roles` table in `project.md` is the old form: `mds migrate`.

## Routing table

| You are about to… | Read |
|---|---|
| decide which type something is (modelling) | `types/_overview.md` (one page) |
| write or edit a screen | `mds frame <root> <screen>`, then `types/screen.md` |
| shape navigation, frames, platforms | **How to model** in `types/shell.md` |
| write or edit a card of type X | `types/X.md` (X = project, screen, component, shell, userflow, ia, rule, api, feature, edge-case, backend, tech, decision, comment) |
| write relation lines or links | `links.md` |
| bootstrap a KB / add a project / ingest a big batch of material | `../kb-cold-start/SKILL.md` |
| create a new version | § Versions below, then `mds branch` |
| answer a question from a KB | `_ids.md` at the project root → the cards; `project.md` for vocabularies and use cases |
| settle an edge case of the format | `spec.md` in the standard folder — search the one relevant section |

## Versions

- Each version is a workspace folder: `V1.0/`, `V1.1/`, `V2.0/` (explorations: `V2.0-<label>/`).
- Its manifest says `lifecycle` (planned · in-progress · released · archived · exploration) and `based-on` (the version it was created from). Several versions can be in progress at once.
- A core means the same card in every version. IDs are unique across the whole project.
- After `mds regen`, each card's status line says whether it is **new**, **changed** (which sections) or **unchanged** compared with its base; `CHANGES.md` lists new, changed and removed cards.

## CLI

`mds` = `node <standard>/kit/cli/mds.mjs` (Node ≥ 18, no install).

| Command | Does |
|---|---|
| `mds init <root> --name "<Name>" [--lifecycle planned]` | new project root with `V1.0/`, manifest, project card |
| `mds new <type> "<Name>" --root <root> [--ws V1.0]` | mints a core, creates the card from its template, prints `<core> <path>` |
| `mds mint <PREFIX> --root <root> [--count n]` | mints cores for flow steps (FS) and variants (SV screen, CV component, HV shell) |
| `mds scaffold <root> --inventory <file>` | creates every card listed in an inventory table in one call (features first) and writes the cores back |
| `mds regen <root>` | ID register, rosters, generated sections, status lines, `CHANGES.md` |
| `mds check <root> [--json]` | diagnostics (error · warning · info) and health numbers |
| `mds branch <root> <from> <to>` | new version workspace based on another |
| `mds next [<root>]` | where the project stands and the one next step (cold start and after) |
| `mds migrate <root>` | brings an older KB up to date (today: the `### Roles` table → role cards) |
| `mds frame <root> <screen>` | the resolved shell, stacked variants, parts, navigation and contract per placement |

## Project root at a glance

```
<root>/
  AGENTS.md   CLAUDE.md   how a fresh agent starts (written once by init; yours to edit)
  _index.md   _ids.md     ⚙ versions tree · project-wide ID register
  inputs/                 raw sources (evidence); links in inputs/links.md
  proposal/  report.md   cold-start working files (inventory, frames, decisions, review)
  V1.0/
    mdstandard.md         manifest
    project.md            description, main use cases, constraints, vocabularies, built with
    roles/ screens/ components/ shells/ userflows/ ia/ rules/ apis/ features/ edge-cases/ backend/ tech/ decisions/ comments/
```
