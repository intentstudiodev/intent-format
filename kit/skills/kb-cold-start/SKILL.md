---
name: kb-cold-start
description: Bootstrap an Intent Format knowledge base for a software project from raw inputs (description, prototypes, docs, repo). Use when a project is added for the first time, or when a large batch of new material arrives (e.g. the next version's designs). Produces a reviewed proposal first, then the KB and a short report.
---

# KB cold start

Turn raw project material into a valid Intent Format KB with as few guesses as possible.
Load the router skill first (`../intent-format/SKILL.md`). Do **not** read the full spec.

**Steer with `intent-format next <root>`.** Run it first, and again after every step. It reads only the
project folder and prints where the cold start stands, the one thing to do, what to read for
it, and when it is done. You never need to remember the phase — so a folder handed over half
built, or a new chat, picks up exactly where the last one stopped. Read only what it names.

## The owner sees four steps

1. **Kickoff questions.** The owner answers `kickoff-questionnaire.md` → `inputs/kickoff-answers.md`.
2. **Drop inputs.** Files go into `<project-root>/inputs/`; URLs into `inputs/links.md`.
3. **Review the proposal.** You write `<project-root>/proposal/`; the owner answers in `proposal/review.md`.
4. **Get the KB + report.** You build the KB and write `<project-root>/report.md`.

Everything else (scaffold, fill, regenerate, check) is your job, not the owner's.

## Procedure

**Phase 0 — Set up.** `intent-format init <root> --name "<Product>"` — the root may already hold
`inputs/`; nothing there is overwritten. It also writes `AGENTS.md` and `CLAUDE.md`, so the
next agent opening the folder is told to run `intent-format next`. The lifecycle starts as
`in-progress`; once kickoff question 7 is answered, set it in `V1.0/intent-format.md` (`planned`,
`in-progress` or `released`) — a plain edit, no decision card needed.

**Phase 1 — Kickoff.** If `inputs/kickoff-answers.md` is missing, hand the owner
`kickoff-questionnaire.md` and stop — unless you run unattended.

> **Unattended mode** (no owner available) is written down, never assumed: the kickoff answers
> file starts with `Mode: unattended`, and in Phase 3 you write `proposal/review.md` with the
> line `Unattended — recommendations applied.` Every kickoff question counts as unanswered.
> Apply your own recommendations; each becomes a decision card with `status: Proposed` (the
> owner confirms it later). Unanswered questions that block cards become `Open` decision cards
> — one card per topic, not per question.

**Phase 2 — Scan inputs.** List `inputs/`. Read every file. Extract candidates with
evidence (file + quote or locator):
- prototypes / screenshots → screens (titles, headings), navigation, panels, modals, components (repeated UI parts), flows (click paths);
- code → routes (screens), component folders (components), API clients/endpoints (APIs), package manifests (tech);
- docs / description → product summary, roles, states, rules ("must / never / always"), constraints, tech, open questions.

Inputs may show **sample or demo content inside the product's own UI** (example data, a demo
project). Document the product, not its sample content.

**Phase 3 — Proposal (no cards yet).** Read `types/_overview.md`, then write, using `templates.md`:
- `proposal/inventory.md` — every card you intend to create: type · name · parent/home · evidence · confidence.
- `proposal/frames.md` — the shells and their navigation, in display order: what is always there, per platform and state, and where each entry sits. The owner reviews navigation here, before any card exists.
- `proposal/decisions.md` — every judgment call and every conflict between inputs, with options and your recommendation.
- `proposal/questions.md` — only questions the inputs and kickoff answers don't settle.
Stop for the owner's `proposal/review.md` (unattended: apply your recommendations and continue).

**Phase 4 — Scaffold with the tool.** `intent-format init` (if no KB exists), then
`intent-format scaffold <root> --inventory proposal/inventory.md`. It creates every approved card in the
right order (features first, so homes resolve), and writes each core back into the inventory.
Never mint an ID by hand; use `intent-format mint` for flow steps and variants.

**Phase 5 — Fill per type**, in the order `intent-format next` gives: project, roles, features, **shells
and maps before screens**, then components, flows and the rest. For each type, read only its type
sheet, then fill the cards. Before each screen, run `intent-format frame <root> <screen>`: write the
place's content, outcome and primary action by name — the frame it prints owns navigation,
back, close and Continue.
- facts come from evidence or owner answers — nothing else;
- every card gets its `## Why` (required on project, roles, features, rules, decisions, flows, shells, tech): the reason from the inputs or the owner; the type sheet says which question it answers (a feature: what problem; a screen: why a screen of its own; a rule: what goes wrong without it); `none — <note>` when there is nothing to add; `same as #<id>` when another card's why covers it; `—` only when nobody has asked yet. A question for the owner about one sentence goes into that sentence as `[ask: …]`. End a why you derived rather than read with `[likely]`, a guess with `[assumed]` — the inventory's Confidence column tells you which;
- unknown → `—`; known to be empty → `none`; a list you know is incomplete → end it with `—`; referenced but not (yet) a card → `[~ Name]`;
- every row of `decisions.md` becomes a decision card: `Decided` (with the owner's choice and why) when the review settled it, otherwise `Open` (unattended: `Proposed`). `## Affects` points at the cards concerned;
- cite evidence in `## Links` as `- [<file or page>](<path or URL>) · type: Source` — a file path must be inside `inputs/`; move the file there first if it is not.

**Phase 6 — Regenerate and check.** `intent-format regen <root>`, then `intent-format check <root>`. Fix every
error and warning. Info items are optional. `intent-format open <root>` then lists what is still unknown or
guessed — the questions for the report.

**Phase 7 — Report.** Write `<project-root>/report.md` (template in `templates.md`): what was
created, health numbers, open decisions, questions for the owner, assumptions made. If your
environment refuses to create the file, put the report in your final reply instead.

## Evidence rules

- Status only with evidence: a design or prototype exists → `In design`; code exists → `In build`; shipped → `Live`; otherwise `—`.
- Create what the inputs show or name, and the flows and features that follow from the stated use cases. Anything else you derive is `low` confidence and also goes into `decisions.md`.
- One input statement → one place in the KB. Don't restate it in several cards; link instead.
- If two inputs disagree, don't pick silently: it's a row in `decisions.md`.

## Modelling guide (the calls two agents most often make differently)

- **Screen vs component.** A place the user navigates to or opens (page, modal, panel with its own content) → screen, with `opens-as`. A part placed inside places → component.
- **Persistent UI and navigation** (top bar, tabs, footer, side panel, a modal's close, a checkout's progress) → **shells**, never screens and not parts of screens. Read **How to model** in `../intent-format/types/shell.md` — it is the one place this is explained. In short: screens are content, shells are context; a new shell for another job or another navigation model, a variant for a part or two (variants stack); one ordered navigation list per shell with `· in:` / `· state:` / `· platform:`. The root of a map is a real place (Home), never a shell.
- **App-wide mode** (read-only mode, presentation mode) → a State if it changes which screens exist; otherwise a screen.
- **User types are role cards** (`roles/`), one per kind of user (kickoff K2), with `state:` (the States they can be in) and `platform:` (what they use). Stories name them by exact card name ("As a Member, …"); never restate the stories on the role — `⚙ Stories` lists them. States only if the product shows different screens per mode (usually sign-in); a role whose screens differ gets its own State. A single-user tool without sign-in has one role and no states.
- **Features have two levels.** Top-level **Features** are product domains (from kickoff K6 or grouped from the use cases); **Sub-features** are capabilities named by outcome ("Rearrange the sitemap"), not by view ("IA view"), with `parent:` = their Feature. Don't invent more than the inputs support.
- **Home feature.** Give each screen, flow and (where obvious) component one home via `feature:` (the inventory's parent/home column). Cross-feature use is computed, never written twice.
- **Altitude.** Feature: why + scope · Sub-feature: what capability, for whom · flow: how the user moves · screen: what the place is for · rule: the exact policy. Numbers and limits belong in rules, not in feature descriptions.
- **Flows**: one per main use case that the inputs describe as a path. Keep ≤ 15 steps; reuse via subflows (⧉ Connected flow steps). A use case without a known path → a placeholder or an Open decision, not an invented flow.
- **Rules** = explicit policy statements ("must", "never", "always"). Keep in mind that apply to the whole product go to the project card's `## Keep in mind`.
- **Tech** from stack statements or manifests. Undecided → a placeholder in `## Built with` plus a decision card.
- **Version.** First KB = `V1.0` unless the owner says otherwise; lifecycle from kickoff question 7, edited in `V1.0/intent-format.md` once answered (init runs before the kickoff).

## Picking up, parallel work, later batches

- **Picking up a folder** (new chat, another agent, another person): run `intent-format next <root>`. It
  needs nothing but the folder. Read `proposal/decisions.md` and `report.md` if they exist —
  they hold the judgment calls made so far; don't re-decide them.
- **Several projects at once:** each project is its own root; the standard folder is shared
  and read-only. Nothing about a project is stored outside its root.
- **Several agents on one project:** split by type or by feature, never by card halves.
  Writing commands (`new`, `mint`, `scaffold`, `regen`) take a lock (`.intent-format.lock`) and wait for
  each other, so cores never collide. Hand-edits to the same card still collide — give each
  agent its own cards. Run `intent-format check` once at the end.
- **A later batch** (the next version's designs): `intent-format branch <root> V1.0 V1.1`, rename
  `proposal/` to `proposal-V1.0/` and `report.md` to `report-V1.0.md`, then `intent-format next --ws V1.1`
  starts again at the proposal.

## Done when

- `intent-format check` shows 0 errors and 0 warnings;
- every inventory row has a core or a recorded reason;
- every decision and open question is a decision card;
- the report exists (file or final reply).
