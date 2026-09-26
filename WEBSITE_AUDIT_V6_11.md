# Tanseek v6.11 / Frontend v3.5.8 — Website & Integration Audit

## Scope

Reviewed the deployed public entry point plus the latest frontend/backend source bundle across authentication, RBAC, academic terms, master data, requirements, instructor assignments, enrollment, availability, rooms/labs, scheduling, conflicts, publishing, overview, export, and UI action wiring.

The public Vercel entry point is reachable. A complete authenticated live-browser E2E test was not possible without a current test login/session, so live authenticated behavior is distinguished from source/integration verification below.

## Current Instructor Assignment error

Observed UI error:

    staffId and requirementId are required.

Root cause:

- The frontend had a selected instructor, so `staffId` was present.
- Legacy section creation accepted a UI component (Lecture/Practical) but did not persist `sections.requirement_id`.
- The section list/catalog also omitted `requirement_id`.
- Instructor assignment therefore had no reliable requirement to attach the Lecturer/TA to.

This is a backend/data-contract defect affecting legacy section rows, not a bad instructor selection by the user.

## v6.11 fixes

### 1. Section -> Requirement linkage

- New sections now resolve their Lecture/Practical requirement before creation.
- `sections.requirement_id` is persisted.
- Section API/catalog responses expose `requirement_id` / `requirementId` and the real component.
- Editing a section re-resolves and persists the requirement link.
- Creating a section is blocked with a clear message if the matching requirement does not exist.

### 2. Legacy data repair

Added migration:

    011_backfill_section_requirement_links.sql

It repairs legacy unlinked sections conservatively:

1. Map an unlinked section when exactly one requirement matches the inferred component.
2. If still unlinked, map it only when the course/term has exactly one requirement total.
3. Ambiguous rows remain NULL and must be edited explicitly; the migration does not guess.

### 3. Instructor assignment contract

Frontend now sends both:

    staff_id
    requirement_id

Backend also has safe fallback inference for legacy clients. Error messages are now specific:

- Instructor missing -> `Instructor is required.`
- Requirement missing -> tells the Coordinator to create/edit the requirement/section.

### 4. Department Coordinator server-side scope

Strengthened backend ownership checks for:

- Course create/update
- Section create/update/delete
- Requirement create/update
- Instructor assignment
- Requirement list visibility

Frontend filtering is no longer the only protection.

### 5. Active term consistency

- Course registration UI no longer hardcodes `term_id = 1` in live flows.
- Student registration/section-enrollment API helpers require the real term id.
- Schedule workflow now returns `term_id` and `term_name`.
- Sidebar, timetable header, Add Session modal and publish dialog use the real current term instead of hardcoded `Fall 2026`.
- Publish payload no longer hardcodes Fall 2026.

### 6. Live vs Mock safety

Changed frontend default so Live API is the default:

    VITE_USE_MOCK_API === 'true'

Mock mode now requires explicitly setting `VITE_USE_MOCK_API=true`. This avoids accidentally deploying a production-looking site backed by mock data when the variable is missing.

### 7. Stale UI copy

Removed stale live-facing copy saying:

- publishing happened in "Mock API mode"
- students can view a timetable without login

Published timetable copy now matches the signed-in Student/Lecturer/TA workflow.

### 8. Overview accuracy

A previous v6.10 fix corrected the Overview response contract. This audit also removed a misleading frontend-style assumption by exposing real draft session counts instead of treating hard conflicts as a static zero metric.

## Existing verified fixes retained

- Academic Term explicit End Term lifecycle.
- Nullable End Date until End Term.
- Add Time Slot and real DB-backed time slots.
- CSV timetable export.
- Student section-assignment compatibility fix.
- Dynamic equipment catalog for requirements.
- Conflict recommendation/apply/revalidation flow.
- 30-minute inactivity logout (configurable using `VITE_SESSION_IDLE_MINUTES`).
- HTTP 401 forces re-login.
- Admin-only publish; Scheduler submits for review.

## Static/automated verification

Backend unit suite after v6.11 changes:

    32 tests passed
    0 failed

The unit suite includes conflict-engine scenarios, compatibility routes, publish RBAC, instructor-assignment contract, section-requirement linkage, legacy repair migration presence, enrollment wrappers, recommendation behavior, and time utilities.

Backend JavaScript syntax was checked with `node --check`.

A complete Vite production build was not completed in the audit environment because a clean npm dependency installation timed out. The generated frontend archive intentionally excludes partial `node_modules`; run a clean install in CI/deployment.

## UI action scan

A static scan of JSX found 117 Button/button instances. The only no-handler cases found were:

- the shared `Button` component definition itself
- the intentionally disabled `Confirmed lab` button

No additional obvious disconnected actionable button was found by this static scan.

## Remaining live verification required after deployment

Run these with real accounts after deploying v6.11 and migration 011:

1. SUPER_ADMIN: term create/edit/end; slots; accounts; departments; audit.
2. DEPARTMENT_COORDINATOR: course -> requirements -> sections -> instructor assignment -> student section assignment.
3. REGISTRATION_OFFICER: course registration.
4. LECTURER / TA: save + confirm availability.
5. LAB_MANAGER: rooms/equipment/closures/lab checks.
6. SCHEDULER: generate -> validate -> resolve conflicts -> submit review.
7. ADMIN: review/edit scoped allocations -> publish.
8. STUDENT / LECTURER / TA: published personal timetable only.
9. Idle timeout and HTTP 401 redirect to login.
10. CSV export and Arabic/dark-mode smoke tests.

## Deployment steps

Backend:

    npm install
    node database/migrations/run.js
    npm test   # or node --test tests/unit/*.js

Frontend environment:

    VITE_USE_MOCK_API=false
    VITE_API_BASE=<your deployed backend /api/v1 base>
    VITE_SESSION_IDLE_MINUTES=30

Frontend:

    npm install
    npm run build

## Important behavior after migration

If a legacy section has one unambiguous matching requirement, migration 011 links it automatically.

If a course genuinely has no matching Lecture/Practical requirement, the system will not invent one. The Department Coordinator must first create the requirement, then edit/create the section with the correct component, and then assign the instructor.
