---
standard: MDStandard/1.0
type: backend
id: BN000001
name: App server
status: In build
backend-type: server
---
# App server · #BN000001
> ⚙ #BN000001V1.1 · V1.1 in-progress · based on V1.0 · unchanged

## Description & Requirements
Serves the item APIs and reads and writes the stored data.

## Connections
- [#BN000002 Main database](bn000002-main-database.md) · kind: stores
- [#BN000003 File storage](bn000003-file-storage.md) · kind: stores

## Built with
- [~ Server runtime]

## ⚙ Serves
- [#AP000001 List items](../apis/ap000001-list-items.md)
- [#AP000002 Save item](../apis/ap000002-save-item.md)
