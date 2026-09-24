# Academic Term master-data routing fix (v6.6)

Fixed the dedicated Super Admin academic-term routes so the shared master-data controllers receive `req.params.type = "terms"`.

Affected routes:
- `POST /master-data/terms`
- `PUT /master-data/terms/:id`
- `DELETE /master-data/terms/:id`

`POST /master-data/terms/:id/end` already uses its own controller and did not require this change.

Symptoms fixed:
- `Creating undefined through master-data is not supported.`
- `Updating undefined through master-data is not supported.`

No database migration is required for this routing fix.
