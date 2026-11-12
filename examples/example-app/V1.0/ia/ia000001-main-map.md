---
standard: IntentFormat/1.2
type: ia
id: IA000001
name: Main map
status: In design
default: true
---
# Main map · #IA000001
> ⚙ #IA000001V1.0 · V1.0 released

## Description
How the places of Example app are arranged for every Member.

## Parts
- [#SC000001 Home](../screens/sc000001-home.md)
  - [#SC000002 Item list](../screens/sc000002-item-list.md) · group: Items
    - [#SC000003 Item detail](../screens/sc000003-item-detail.md) · group: Items
      - [#SC000004 Edit item](../screens/sc000004-edit-item.md) · opens-as: Side panel · group: Items
  - [#SC000005 Settings](../screens/sc000005-settings.md)

### Lateral
- Edge: [#SC000005 Settings](../screens/sc000005-settings.md) → [#SC000002 Item list](../screens/sc000002-item-list.md) · label: Back to items
