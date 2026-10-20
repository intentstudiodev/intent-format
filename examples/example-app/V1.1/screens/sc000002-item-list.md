---
standard: MDStandard/1.0
type: screen
id: SC000002
name: Item list
status: In design
feature: FT000003
---
# Item list · #SC000002
> ⚙ #SC000002V1.1 · V1.1 in-progress · based on V1.0 · changed: Components

## Description & Requirements
Shows all of a Member's items as rows; choosing a row opens Item detail.

**R1 · GWT**
Given a Member with no items
When the Item list opens
Then an empty-list message and a create button are shown

## Components
1. [#CP000003 Item row](../components/cp000003-item-row.md) — one per item
2. [#CP000002 Text field](../components/cp000002-text-field.md) — filters the list
3. [#CP000001 Button](../components/cp000001-button.md) — creates an item

## Variants
### Picker · #SV000001
<a id="sv000001"></a>
appears-as: Side panel

1. [#CP000003 Item row](../components/cp000003-item-row.md) · variant: Compact

## Uses API
- [#AP000001 List items](../apis/ap000001-list-items.md)

## Comments
- [#CM000001 Empty-list message](../comments/cm000001-empty-list-message.md)

## ⚙ Placed on
- [#IA000001 Main map](../ia/ia000001-main-map.md) · parent: #SC000001

## ⚙ Reached from
- [#SH000001 App shell](../shells/sh000001-app-shell.md) · kind: tab

## ⚙ Flows
- [#UF000001 Create an item](../userflows/uf000001-create-an-item.md) · at: #FS000001
- [#UF000001 Create an item](../userflows/uf000001-create-an-item.md) · at: #FS000005
