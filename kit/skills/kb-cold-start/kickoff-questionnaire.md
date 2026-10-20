# Kickoff questionnaire

> About 10 minutes. Answer in `inputs/kickoff-answers.md`, keeping the question numbers.
> "Unknown" is a fine answer — it becomes an open question in the KB instead of a guess.

## A. The product

1. **What is it, in two or three sentences?** Who is it for, and what problem does it solve?
2. **User types (roles).** Who uses it? One line per type of user — each becomes a role card. Include people of neighbouring systems the product must know about (back office), and say which platforms each uses if you know.
   | Role | Description |
   |---|---|
   | e.g. Visitor | not signed in, browses |
   | e.g. Member | signed in, creates items |
3. **States.** Does the product show a different set of screens depending on a mode — typically signed in vs not, or by plan? List the states and which roles see them, or write "no states".
4. **Platforms.** Desktop web, mobile web, native app, desktop app, CLI? Which of them get a different way of moving around (a top bar on desktop, a tab bar in the app)?

## B. Main use cases and features

5. **Main use cases (5–10)** as user stories, most important first:
   `As a <role>, I want <goal> so that <benefit>.`
   Main use cases only — not a backlog.
6. **Main features.** The top-level groups of the product (e.g. *Items*, *Account*, *Settings*), each with the capabilities it contains if you know them. Optional — the AI can propose them from the use cases.

## C. What exists

7. **Which version should the KB describe?** Is it released, being built, or planned?
8. **Sources.** What can you drop into `inputs/` (descriptions, designs, prototypes, screenshots, docs, API specs, exports)? Repo and design links go into `inputs/links.md`. If you know which design shows which screen, say so.
9. **Component list.** Is there a design system or component library? Where?

## D. Structure

10. **Navigation, per platform.** Where do users land first? What is always on screen to move around (top bar, tabs, sidebar, burger menu, footer), and which destinations does it list, in order? What changes once signed in (account menu, other tabs)?
11. **Frames.** Is anything visible on every screen besides navigation (consent banner, chat panel, toasts)? Which areas have their own back, breadcrumbs or section tabs (account, settings)? Which tasks hide the usual navigation (checkout, a wizard, an editor)? What opens over the page — modals, bottom sheets, side panels — and on which platform?
12. **External services and data.** Which outside services does it use? Who calls them (browser or server)? Where is data stored?
13. **Changes and history.** Can users undo changes? Is there versioning, history or snapshots?

## E. Direction

14. **Priorities.** What matters most in the next release? What is explicitly out of scope?
15. **Constraints.** Performance, offline use, privacy, security, accessibility, languages — anything that limits design or technology.
16. **Tech stack.** What is decided, and what is still open? Starter categories: Languages & runtimes · Frontend · Backend · Data & storage · Infrastructure & hosting · Integrations & third-party services · AI · Auth & security · Observability · Build, test & delivery · App wrappers (native, desktop).
17. **Open questions you already know about.**
