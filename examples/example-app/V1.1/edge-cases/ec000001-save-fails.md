---
standard: IntentFormat/1.2
type: edge-case
id: EC000001
name: Save fails
status: Idea
severity: Medium
---
# Save fails · #EC000001
> ⚙ #EC000001V1.1 · V1.1 in-progress · based on V1.0 · unchanged

## Description
**R1 · GWT**
Given a Member editing an item
When Save item does not answer in time
Then the edits stay on screen and a retry option is shown

## Rules
none

## Where
- [#SC000004 Edit item](../screens/sc000004-edit-item.md)
- [#FS000004 Save the item](../userflows/uf000001-create-an-item.md#fs000004)
- [#AP000002 Save item](../apis/ap000002-save-item.md)
