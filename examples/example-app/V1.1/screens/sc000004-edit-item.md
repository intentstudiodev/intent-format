---
standard: MDStandard/1.0
type: screen
id: SC000004
name: Edit item
status: In design
feature: FT000004
appears-as: Side panel
---
# Edit item · #SC000004
> ⚙ #SC000004V1.1 · V1.1 in-progress · based on V1.0 · changed: Components

## Description & Requirements
Lets a Member change an item's name and notes.

## Rules applied
- [#RL000001 Item name is required](../rules/rl000001-item-name-is-required.md)

## Components
1. [#CP000002 Text field](../components/cp000002-text-field.md) — item name
2. [#CP000001 Button](../components/cp000001-button.md) — saves the item

## Uses API
- [#AP000002 Save item](../apis/ap000002-save-item.md)

## ⚙ Placed on
- [#IA000001 Main map](../ia/ia000001-main-map.md) · parent: #SC000003

## ⚙ Flows
- [#UF000001 Create an item](../userflows/uf000001-create-an-item.md) · at: #FS000002
- [#UF000002 Edit an item](../userflows/uf000002-edit-an-item.md) · at: #FS000007

## ⚙ Edge cases
- [#EC000001 Save fails](../edge-cases/ec000001-save-fails.md) · severity: Medium
