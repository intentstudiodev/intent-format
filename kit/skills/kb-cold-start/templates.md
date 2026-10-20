# Cold-start templates

Copy each block into its own file. Keep the column order.

## proposal/inventory.md

```markdown
# Inventory — <project name>

Every card the KB will get. Evidence = input file + quote or locator, or a kickoff answer number (K5).

| # | Type | Name | Parent / home | Evidence | Confidence | Notes | Core |
|---|---|---|---|---|---|---|---|
| 1 | role | Member | | K2 "Member — keeps a list" | high | Signed in · Web, Mobile | |
| 1 | feature | Items | | K6 "Items" | high | top-level Feature | |
| 2 | feature | Browse items | Items | K5 user story 1 | high | Sub-feature | |
| 3 | screen | Item list | Browse items | inputs/proto-02.html — `<h1>Items</h1>` | high | landing page after sign-in | |
| 4 | component | Item row | Browse items | inputs/proto-02.html — repeated `.row` | medium | | |
| 5 | tech | UI framework | | K16 "decided: <name>" | high | | |
```

Parent / home: a Sub-feature's parent Feature, or the home feature of a screen, flow or component (names from this table). Leave Core empty — `mds scaffold` fills it.

Confidence: **high** = stated or shown directly · **medium** = strongly implied · **low** = inferred; must also appear in decisions.md.

Shells are inventory rows too (`shell`, home column empty). Their frame and navigation go in frames.md.

## proposal/frames.md

Navigation is the part owners care most about and agents guess most: write it down for review
before any card exists. One block per shell; the navigation list is in display order.

```markdown
# Frames and navigation — <project name>

| Shell | Kind | For (platform · state) | Parts (top to bottom) | Variants (what each adds) |
|---|---|---|---|---|
| Web shell | app | Desktop web, Mobile web | Consent banner · Header · Footer · Toast | Mobile web: Burger, Navigation drawer · Signed in: Account menu · Level 2+: Back |
| App shell | app | App | Tab bar · Toast | Signed in: — |
| Checkout | stepper | — (flow: Checkout) | Progress · Back · Exit | — |
| Modal | overlay | appears-as: Modal | Title · Close · Confirm/Cancel | — |

### Web shell — navigation
1. Home · tab · in Header
2. Shop · tab · in Header, Navigation drawer
3. Sign in · in Header · Guest only
4. My account · menu · in Account menu · Signed in only
5. Contact · in Footer

### Bound once
- My account area (map node) → Account section shell
- Checkout flow steps → Checkout
```

A new shell when the frame does another job or follows another navigation model (a desktop
header vs a native tab bar, or different rules for the places inside); a variant when the same
frame adds or swaps a part or two. Variants stack, so never list a combination.

## proposal/decisions.md

```markdown
# Decisions to confirm — <project name>

| # | Question | Options | Recommendation | Why |
|---|---|---|---|---|
| D1 | Is the side panel a screen or a part of the frame? | a) screen b) a part of the app shell | b | it appears on every view |
```

## proposal/questions.md

```markdown
# Questions for the owner — <project name>

Only what inputs and kickoff answers don't settle. Most important first.

| # | Question | Why it matters | Affects |
|---|---|---|---|
| Q1 | Do snapshots use version control under the hood? | decides the history model | Snapshots feature, backend |
```

## proposal/review.md (written by the owner)

```markdown
# Review

- Inventory: approved / approved with changes: <row #: change>
- Frames: approved / changes: <shell: change>
- Decisions: D1 = b · D2 = a · …
- Answers: Q1 = … · Q2 = unknown · …
```

Unattended (no owner): the agent writes `Unattended — recommendations applied.` as the only
line, so the next agent knows the review was not skipped by accident.

## report.md

```markdown
# Cold-start report — <project name>

- **KB:** <path> · version V1.0 (<lifecycle>)
- **Created:** <n> cards — screens <n>, components <n>, flows <n>, … · sub-documents <n>
- **Check:** errors 0 · warnings 0 · info <n>
- **Health:** blind spots <n> · unresolved placeholders <n> · open decisions <n>
- **Assumptions made:** (each also exists as an Open decision card)
  - …
- **Questions for the owner:** top 5, with the decision card core for each
- **Next steps:** …
```
