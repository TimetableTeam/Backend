# Tanseek v6.7 — Time Slot Management & Allocation Fix

## What changed

- Added **Add time slot** inside **Academic term setup → Time slots**, beside Filter.
- Only Super Admin can create time slots in the live API.
- A created slot is written to the active academic term for Saturday through Wednesday.
- Current project policy is still enforced: 2-hour slots inside 09:00–17:00, with overlap protection.
- Duplicate creation is idempotent and repairs missing weekday rows for the same slot.
- Add Session and Edit Allocation now read the real slot templates from `/catalog/planning` instead of hard-coded frontend mock slots.
- Allocation writes now send `start` and `end` explicitly, so the backend does not have to infer the selected slot only from `s1`, `s2`, etc.
- Timetable grid and CSV export now use the active term's live slot catalog.

## API

`POST /api/v1/master-data/slots`

Example body:

```json
{
  "start": "11:00",
  "end": "13:00"
}
```

Requires `SUPER_ADMIN`.

## Database

No new migration is required. The existing `time_slots` table is used.

## Validation

Backend syntax was checked with `node --check` for the modified controller and route files.
A full dependency-based frontend build could not be executed in the artifact environment because package installation was unavailable; no `node_modules` are included in the delivered frontend archive.
