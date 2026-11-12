---
standard: IntentFormat/1.2
type: userflow
id: UF000002
name: Edit an item
status: In design
feature: FT000004
---
# Edit an item · #UF000002
> ⚙ #UF000002V1.1 · V1.1 in-progress · based on V1.0 · unchanged

## Description
A Member changes an existing item and returns to its details.

## Why
Details change; the list must follow.

## Step list
1. [#FS000006 Open the item](#fs000006)
2. [#FS000007 Change the details](#fs000007)
3. [#FS000008 Save the changes](#fs000008)
4. [#FS000009 Item updated](#fs000009)

## Steps
### ○ Open the item · #FS000006
<a id="fs000006"></a>

- Entry: the Member chooses an item on the Item list.
- Screen: [#SC000003 Item detail](../screens/sc000003-item-detail.md)

### □ Change the details · #FS000007
<a id="fs000007"></a>

- Screen: [#SC000004 Edit item](../screens/sc000004-edit-item.md)
- Component: [#CP000002 Text field](../components/cp000002-text-field.md)

### ⚡ Save the changes · #FS000008
<a id="fs000008"></a>

- API: [#AP000002 Save item](../apis/ap000002-save-item.md)
- Applies rule: [#RL000001 Item name is required](../rules/rl000001-item-name-is-required.md)

### ◎ Item updated · #FS000009
<a id="fs000009"></a>

- Outcome: the changes are saved and shown on Item detail.
- Screen: [#SC000003 Item detail](../screens/sc000003-item-detail.md)
