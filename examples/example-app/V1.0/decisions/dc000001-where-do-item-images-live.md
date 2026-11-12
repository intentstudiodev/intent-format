---
standard: IntentFormat/1.2
type: decision
id: DC000001
name: Where do item images live?
status: Open
---
# Where do item images live? · #DC000001
> ⚙ #DC000001V1.0 · V1.0 released

## Question
Should item images be kept in File storage or inside the Main database?

## Why
Images are the largest data the app stores; where they live decides backup and cost.

## Options
1. File storage — cheap and fast to serve; needs a cleanup job.
2. Main database — one backup for everything; larger tables.

## Outcome
—

## Affects
- [#BN000003 File storage](../backend/bn000003-file-storage.md)
- [#AP000002 Save item](../apis/ap000002-save-item.md)
