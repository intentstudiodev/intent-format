---
standard: IntentFormat/1.2
type: backend
id: BN000001
name: App server
status: In build
backend-type: server
---
# App server · #BN000001
> ⚙ #BN000001V1.0 · V1.0 released

## Description
Serves the item APIs and reads and writes the stored data.

## Connections
- [#BN000002 Main database](bn000002-main-database.md) · kind: stores
- [#BN000003 File storage](bn000003-file-storage.md) · kind: stores

## Built with
- [~ Server runtime]

## ⚙ Serves
- [#AP000001 List items](../apis/ap000001-list-items.md)
- [#AP000002 Save item](../apis/ap000002-save-item.md)
