# Tanseek v6.9 — Section Assignment + Requirement Equipment Fix

## 1. Student section assignment 500 fix

Two compatibility problems were removed:

- The React screen no longer hard-codes `term_id=1`. It uses the current term returned by `/catalog/planning` for registration reads, section-assignment reads, and assignment writes.
- The backend no longer relies on `ON CONFLICT(registration_id, section_kind)` when saving a student-section assignment. Older deployed databases can lack that exact unique constraint, which makes PostgreSQL raise `42P10` and production returns the generic `Internal server error`. The compatibility controller now explicitly updates an existing assignment or inserts a new one.

The business rule remains unchanged: one Lecture and one Practical assignment per registered course.

## 2. Department Coordinator can add requirement equipment

The three equipment buttons were not a frontend limit. They were the only three rows seeded in the `equipment` table (`COMPUTER_WITH_PYTHON`, `GPU_WORKSTATION`, `PROJECTOR`).

Added:

- `POST /api/v1/equipment` — Department Coordinator (and Super Admin bypass) can create a new equipment catalog item.
- The Requirement editor now has a free-text field and **Add equipment** button.
- A newly created equipment item is immediately selected in the current requirement and becomes available to the shared planning catalog, including room/lab inventory screens that consume the same catalog.
- Equipment names are normalized to uppercase underscore identifiers, e.g. `Smart Board` -> `SMART_BOARD`.

Room inventory ownership is still Lab Manager-only. A coordinator can define an equipment requirement, but does not edit which rooms physically contain it.

## Verification

Backend unit suite: **30/30 tests passed**.

No database migration is required for these changes because the existing `equipment` and student enrollment tables are reused.
