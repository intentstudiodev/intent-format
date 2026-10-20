---
standard: MDStandard/1.0
type: api
id: AP000002
name: Save item
status: In build
method: PUT
endpoint: /items/{id}
---
# Save item · #AP000002
> ⚙ #AP000002V1.0 · V1.0 released

## Description & Requirements
Creates or updates one item and returns the stored version.

## Served by
- [#BN000001 App server](../backend/bn000001-app-server.md)

## ⚙ Called from
- [#SC000004 Edit item](../screens/sc000004-edit-item.md)
- [#UF000001 Create an item](../userflows/uf000001-create-an-item.md) · at: #FS000004
- [#UF000002 Edit an item](../userflows/uf000002-edit-an-item.md) · at: #FS000008

## ⚙ Edge cases
- [#EC000001 Save fails](../edge-cases/ec000001-save-fails.md) · severity: Medium

## ⚙ Decisions
- [#DC000001 Where do item images live?](../decisions/dc000001-where-do-item-images-live.md) · status: Open
