---
standard: IntentFormat/1.2
type: screen
id: SC000004
name: Edit item
status: In design
feature: FT000004
opens-as: Side panel
---
# Edit item · #SC000004
> ⚙ #SC000004V1.1 · V1.1 in-progress · based on V1.0 · unchanged

## Description
Lets a Member change an item's name and notes.

## Rules
- [#RL000001 Item name is required](../rules/rl000001-item-name-is-required.md)

## Components
1. [#CP000004 Top bar](../components/cp000004-top-bar.md)
2. [#CP000002 Text field](../components/cp000002-text-field.md) — item name
3. [#CP000001 Button](../components/cp000001-button.md) — saves the item

## APIs
- [#AP000002 Save item](../apis/ap000002-save-item.md)

## ⚙ On maps
- [#IA000001 Main map](../ia/ia000001-main-map.md) · under: #SC000003

## ⚙ In user flows
- [#UF000001 Create an item](../userflows/uf000001-create-an-item.md) · at: #FS000002
- [#UF000002 Edit an item](../userflows/uf000002-edit-an-item.md) · at: #FS000007

## ⚙ Edge cases
- [#EC000001 Save fails](../edge-cases/ec000001-save-fails.md) · severity: Medium
