# Contributing to Intent Format

Thanks for helping. Intent Format is made by one person, in the open. This repository holds the
**released versions**; each version is prepared in a working copy and published here as a tagged release.

- **Questions, bugs, unclear rules:** [open an issue](https://github.com/intentstudiodev/intent-format/issues/new/choose)
  and pick **Something is wrong or unclear**. Name the rule (`S-<TOPIC>-<n>`) or the CLI command, and
  paste a small example card if you can. Made-up content is fine; don't paste anything private.
  As it's one person, replies can take a while: we'll do our best to get back to you soon, but can't promise when.
- **Proposing a change to the spec or schema:** open an issue (**Idea or change to the format**) first and describe the problem it
  solves, with a real example. The standard changes only when real use proves a need.
- **Pull requests** are welcome. They are carried into the working copy by hand and shipped in the
  next version; you are credited in `CHANGELOG.md`.
- **A release that changes the shape of files** (a key, a section, a folder, a name) adds its step to
  `intent-format migrate` and keeps a small project of the previous version as a test that it migrates
  cleanly. A release that changes nothing on disk only adds the old name to `legacyStandards`.
- **Tests:** `npm test` (Node 18 or later, no dependencies).

Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md). By contributing you agree that your contribution is licensed under the MIT licence in `LICENSE`.
