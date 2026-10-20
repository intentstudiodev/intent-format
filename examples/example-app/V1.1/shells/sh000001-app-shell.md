---
standard: MDStandard/1.0
type: shell
id: SH000001
name: App shell
status: In design
shell-type: app
---
# App shell · #SH000001
> ⚙ #SH000001V1.1 · V1.1 in-progress · based on V1.0 · new

## Description & Requirements
The frame around every page: the top bar with the product name and the main navigation. Described once; every page resolves to it.

## Components
1. [#CP000004 Top bar](../components/cp000004-top-bar.md)

## Navigation
1. [#SC000001 Home](../screens/sc000001-home.md) · kind: tab
2. [#SC000002 Item list](../screens/sc000002-item-list.md) · kind: tab · label: Items
3. [#SC000005 Settings](../screens/sc000005-settings.md) · kind: menu

## Places inside
✅ Declare one primary action by name; the top bar renders it.
🚫 Never show navigation of your own.
