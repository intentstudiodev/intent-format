---
standard: IntentFormat/1.2
type: userflow
id: UF000001
name: Create an item
status: In design
feature: FT000004
---
# Create an item · #UF000001
> ⚙ #UF000001V1.1 · V1.1 in-progress · based on V1.0 · unchanged

## Description
A Member adds a new item from the Item list and returns to the list with the item saved.

## Why
The main use case of Items: without it nothing gets into the list.

## Step list
1. [#FS000001 Start from the list](#fs000001)
2. [#FS000002 Enter item details](#fs000002)
3. [#FS000003 Name valid?](#fs000003)
4. [#FS000004 Save the item](#fs000004)
5. [#FS000005 Item created](#fs000005)

### Quick add
platform: Mobile

1. [#FS000001 Start from the list](#fs000001)
2. [#FS000002 Enter item details](#fs000002)
3. [#FS000004 Save the item](#fs000004)
4. [#FS000005 Item created](#fs000005)

## Steps
### ○ Start from the list · #FS000001
<a id="fs000001"></a>

- Entry: the Member taps Create on the Item list.
- Screen: [#SC000002 Item list](../screens/sc000002-item-list.md)

### □ Enter item details · #FS000002
<a id="fs000002"></a>

- Screen: [#SC000004 Edit item](../screens/sc000004-edit-item.md)
- Component: [#CP000002 Text field](../components/cp000002-text-field.md)

The Member types a name and optional notes.

### ◇ Name valid? · #FS000003
<a id="fs000003"></a>

- Branch: Yes → [#FS000004 Save the item](#fs000004) · primary
- Branch: No → [#FS000002 Enter item details](#fs000002) · rule: #RL000001

### ⚡ Save the item · #FS000004
<a id="fs000004"></a>

- API: [#AP000002 Save item](../apis/ap000002-save-item.md)

### ◎ Item created · #FS000005
<a id="fs000005"></a>

- Outcome: the new item is saved and shown on the Item list.
- Screen: [#SC000002 Item list](../screens/sc000002-item-list.md)

## ⚙ Edge cases
- [#EC000001 Save fails](../edge-cases/ec000001-save-fails.md) · at: #FS000004 · severity: Medium
