# Tanseek Backend — Frozen Frontend Compatibility

This build keeps the current React/Vite frontend API contract unchanged and adapts the backend to it under `/api/v1`.

## Production frontend base URL

```text
VITE_API_BASE=https://backend-production-2e50.up.railway.app/api/v1
VITE_USE_MOCK_API=false
```

## Compatibility surface

The adapter supports the frozen frontend paths, including:

- `/auth/me`, `/auth/change-password`, email + code password reset
- `/overview`, `/audit-log`, `/catalog/planning`
- `/departments` CRUD
- `/master-data/{terms|courses|sections|slots}` facade
- `/requirements`, `/instructor-assignments`
- `/availability/me`, `/lab-checks`
- `/rooms` including frontend `PUT` and `DELETE`
- `/schedule/drafts/:draftId/*` facade over `schedule_versions` and `allocations`
- `/timetable/published/me`
- course registrations and section enrollments
- `/admin/accounts` and `/admin/roles`

All JSON success responses continue to use:

```json
{"success":true,"data":{}}
```

## Final RBAC enforced

- `SUPER_ADMIN` has the global bypass.
- `DEPARTMENT_COORDINATOR` owns Courses/Sections/Requirements/Instructor + Student Section assignment.
- `LAB_MANAGER` owns Rooms/Labs/Lab checks.
- `REGISTRATION_OFFICER` owns Student Course registration.
- `SCHEDULER` generates/edits/resolves/submits the draft.
- `ADMIN` reviews/edits scoped allocations and is the role that publishes.
- `SCHEDULER` cannot publish.

## Database migration

Run migrations in the normal deployment pipeline. Migration `008_frontend_contract_compatibility.sql` adds:

- `student_course_registrations.registration_type`
- `lab_checks`
- `frontend_custom_roles`

The compatibility handlers also use idempotent `IF NOT EXISTS` setup for the auxiliary compatibility tables, so older development databases fail less abruptly.

## Important custom-role note

The original database uses a PostgreSQL enum for `accounts.role`. The frontend role builder can persist custom role definitions through `/admin/roles`, but assigning a custom role to an account still requires a future schema migration away from the fixed `account_role` enum. Built-in roles are fully assignable now.

## Model dependency

`POST /schedule/drafts/:draftId/generate` calls the configured scheduling model through `MODEL_API_URL`. Railway must therefore have a reachable model service configured for generation to work.

## v3 Requirement-page compatibility fix

The frozen React `CoordinatorRequirements` screen expects `/catalog/planning` to include
`term`, `equipment`, `roomTypes`, `sessionTypes`, `days`, and generic `slots`, and expects
`/requirements` records in the frontend snake_case shape (`session_type`, `weekly_count`,
`expected_students`, `required_room_type`, `required_equipment`, `preferred_windows`,
`notes`, `state`). The backend now emits and accepts that contract while keeping the
normalized PostgreSQL fields internally.

Compatibility metadata is persisted on `session_requirements` via migration
`009_frontend_requirement_contract.sql` and is also self-healed on application startup.

## Local rate limiting (v4)

During local frontend/backend integration, all Express rate limiters are skipped
when `NODE_ENV=development` or `NODE_ENV=test`. This prevents React development
requests from exhausting a shared IP quota and producing false 429 errors.

Production keeps rate limiting enabled. Defaults can be overridden with:

```env
API_RATE_LIMIT_MAX=1000
API_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
AUTH_RATE_LIMIT_WINDOW_MS=900000
PASSWORD_RESET_RATE_LIMIT_MAX=5
PASSWORD_RESET_RATE_LIMIT_WINDOW_MS=3600000
```

`DISABLE_RATE_LIMIT=true` can disable limits explicitly for a controlled local
environment, but should not be set in production.

## v6 compatibility fixes

The frozen v3.5.3 frontend expects three additional legacy response shapes:

- `GET /rooms` -> `{ rooms: [...] }` with presentation fields `name`, `type`, string-array `equipment`, `accessibility`, `status`, and `closure`.
- `GET /lab-checks` -> `{ requirements: [...], rooms: [...] }`; each practical requirement includes `candidates` and the latest `decision`.
- Student registration/section assignment endpoints -> wrapper objects (`{ students }`, `{ registrations }`, `{ assignments }`) and accept the frontend's code-based writes (`course_code`, `section_code`).

The compatibility layer also treats the frontend's hard-coded `term_id=1` as the active term when one exists.

## v6.3 compatibility fixes
- Draft allocation create/update now accepts the frozen React payload (`section_id`, `instructor_id`, room code/name, day name and `s1..s4` slot IDs) and resolves normalized requirement/room/timeslot IDs server-side.
- The requirement is resolved from the section instructor assignment first, preventing `Session requirement not found` when the frontend does not know requirement IDs.
- Draft allocation responses are mapped back to the frontend display contract (`course`, `code`, `section`, `staff`, `room`, `day`, `slot`, `type`).
- Instructor assignment now prefers the Lecture/Practical requirement matching the section component heuristic when a requirement ID is not submitted.
- Student course/section enrollment wrapper contracts remain `{ registrations: [...] }` and `{ assignments: [...] }`; an empty registered-course dropdown means the student has no course registration for the active term and must be registered by Registration Officer first.

## v6.4 compatibility + term lifecycle fixes

This revision is paired with frontend v3.5.4-compatible and closes the remaining high-impact frontend/backend contract gaps found during the integration audit:

- Academic terms no longer require or accept a planned End Date on create/edit. `academic_terms.ends_on` is nullable until the term is explicitly ended.
- `POST /master-data/terms/:id/end` is Super-Admin-only and sets the end date to the current Cairo date while archiving the term.
- Term payloads accept/emit the frontend `availability_deadline` field and preserve holidays.
- New terms receive the default Sat-Wed scheduling slots automatically so availability/scheduling can start without a second setup step.
- Published timetable responses now expose the exact frozen frontend `version` shape, allocations, course registrations and section enrollments.
- Draft generation/review/publish workflow responses now expose frontend `workflow.status` and allocation shapes consistently.
- The frontend logical draft alias `draft-v3` resolves to the latest actual DRAFT; literal version lookup remains available through explicit version aliases.
- Live conflict gating now uses backend `validateDraft` results instead of demo conflict data.
- Nullable term ends are supported by room-closure checks and ICS generation.

Database migration `010_term_end_lifecycle.sql` relaxes the old `ends_on NOT NULL` constraint and clears planned end dates from non-archived terms.
