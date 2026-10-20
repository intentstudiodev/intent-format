# MDStandard 1.0 — Rationale

Non-normative. Why the key choices were made, and what was rejected. The rules are in
`spec.md`.

## Schema first

The prototype stated many rules several times across nine documents, and the copies drifted.
1.0 has one machine-readable source, `schema.json`: the CLI reads it, templates and type
sheets are generated from it, and the spec states each rule once and cites the schema for
long tables. Every MUST names the diagnostic that reports it, so spec, schema and CLI can be
tested against each other. JSON, not YAML, keeps the CLI free of dependencies. Rejected: prose
tables as the source — they cannot be tested.

## One-file flows and subflows

The prototype let a large flow "explode" into a folder of step files, with thresholds and a lossless
fold/explode. That doubled the addressing rules, the parser and the exchange story for one
type. Now a flow is always one file, and size is handled by composition: a ⧉ step runs another
flow, an attached `Connected flow` adds a side journey, and an info diagnostic suggests a
subflow past 15 steps. Big journeys become small reusable flows.

## Project-wide IDs

In the prototype each workspace minted its own numbers, so one core could mean different cards in
sibling versions, and carrying work between versions meant re-minting through import. Now a
core is unique across the project: the same core in two workspaces is the same card in two
versions. Comparing versions, moving a card and listing removed cards become core lookups.
The Retired table and High-water marks keep a number from ever coming back. Import still
re-mints, because another project has its own numbering.

## Version status lines

The prototype stamped `version:` into every card and the full rendered ID into every title, so each
new version rewrote every file and stale stamps were common. Now the workspace owns the
version. Cards hold only their core, and `regen` writes one status line under the title:
rendered ID, lifecycle, base version, and whether the card is new, unchanged or changed —
naming the parts that changed. "What changed in this version?" is computed, never maintained.

## Optional states

The prototype required `state:` everywhere, so in the many products without meaningful states every
card said `Shared`, and a missing value counted as a blind spot. States are now an opt-in
vocabulary: none declared, no `state:` keys and no state codes. Roles — who uses the product —
became a separate vocabulary, because "signed in" (a mode) and "admin" (a person) kept being
mixed.

## The `none` token

The prototype had one honest token, `—`, and banned "not applicable". Authors then wrote `—` for
things they knew were empty, inflating blind spots and hiding real gaps. `none` says "checked,
nothing here" and is not counted. Generated sections no longer write `—` for "verified empty";
they are absent when empty, so the four kinds of empty — content, `—`, `none`, generated —
look different on the page.

## Severities

The prototype had a single hard error, and its documents disagreed on what a breached MUST meant.
Now a breached MUST is a warning, a SHOULD an info, and errors are kept for the few cases
where identity or parsing is broken and the KB cannot be trusted. Warnings never block
authors; errors stop `regen`, because regenerating over broken identities would spread the
damage.

## Idempotency

The prototype promised byte-identical output across all conforming tools — unverifiable without a
second implementation, and broken by its own dated logs. Now generated content is a pure
function of authored content, carries no dates, and a second `regen` changes nothing: a
promise one tool can be tested against with fixtures.

## Tech and decision types

Technology choices used to live in prose and open questions in comments, where nothing could
find or count them. A `tech` card gives each technology one home with its reasons and
alternatives, and `Built with` lines make the stack visible from any card. A `decision` card
turns a question into a tracked object — options, outcome, affected cards — and open decisions
become a health number. A cold-start agent records each judgment call as an Open decision
instead of guessing.

## Two-level features

The prototype had one-level features plus an Areas vocabulary that also drove folder shelves: two
concepts to keep in sync. Areas became top-level Features and the prototype's feature became a
Sub-feature. Membership is written once, on the member (`feature:`), and every list on the
feature is generated. Two levels answer "why" and "what"; a third would blur the altitude
rule. Rejected: many-to-many membership — it makes every list ambiguous.

## Flat folders

Area shelves, component-type subfolders and browse trees made a card's path depend on
judgments that change, and each change was a file move that broke outside links. Each type
now has one flat folder. Grouping by feature, state, platform or status is a view tools
compute; it never moves a file.

## Shells, not an App shell screen

An early reading of 1.0 said: put persistent UI in an *App shell* screen at the root of the map, with the
views as its children. It worked for one bar on every page and broke the moment a product had
levels — a section with breadcrumbs and back, a checkout with a stepper and no tabs, a payment
page that also opens as a bottom sheet. The shell screen was the root of every map although
nobody can *be* there, the same screen could not drop its chrome when it became an overlay, and
the tab bar's destinations had no place to live.

A **shell** is the frame around places. It started as a component with one special power, then
became its own type: it is never placed as a part, its variants are chosen by platform, state
and level rather than pinned by a host, it leads somewhere, and it carries a contract for
whatever it frames. Places bind to it. The binding resolves per placement exactly like the
presentation does, because the two are one decision seen from two sides — *appears-as* says
what kind of container, *shell* says what chrome is inside it. Defaults do most of the work: a
shell with `appears-as: Page` for a state frames every page of that state, a shell with
`appears-as: Bottom sheet` frames every sheet, a section node binds its shell once for the whole
subtree. Levels and breadcrumbs are computed from nesting and the map path, never written, so
nothing goes stale. Navigation lives on the shell as ordered `Leads to` lines: written once,
true wherever the shell is, and a tool can draw "reachable from everywhere" as a frame instead
of forty lateral edges.

**Why variants stack and navigation is one list (fix pass 3).** "Most specific variant wins"
looked tidy until a signed-in desktop page had to choose between the desktop top bar and the
account menu: one winner means every combination becomes a variant of its own, and the shell
card grows into a matrix nobody can read. Stacking keeps each fact once — Mobile adds the
burger, Signed in adds the account menu — and a page gets every variant that fits. Navigation
went the other way: spread over variants it had no display order, so it moved back into one
ordered list on the host, where a person reads the whole menu top to bottom, and each line
says where it sits (`· in:`) and for whom (`· state:`, `· platform:`). The sample KBs had
been writing exactly that into labels and notes.

## User types are cards

A row in a vocabulary table could hold a name, one line and a list of States — not who someone
is, why they come or what they use, and nothing could link to it. Yet who a screen is for is
the first thing an agent needs before writing it. So a user type became a card. Stories did not
change: they keep naming the role in plain words ("As a Member, …") and resolve by exact name,
the way they resolved against the table; the role card lists them in `⚙ Stories` instead of
restating them, because the stories already are the role's goals. States stay a vocabulary:
they decide which screens exist, a role only says who is there.

## Future work

- **Branch-time baselines and parallel-version warnings** — record what a version was
  branched from, so a card can be flagged as "also changed in a parallel version".
- **Persona module** — named people with their stories, beyond role cards (user types).
- **Domain data-model module** — entities and fields, linked from APIs and screens.
- **Merge and duplicate commands** — tool support for today's manual procedures.
- **Content hashes on import** — so a re-import can tell "unchanged upstream" from "changed
  upstream".
- **Component actions** — a per-interaction unit, if interactions come to need references of
  their own.
