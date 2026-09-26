# Tanseek Benchmark — DB Ready v1

Target: **Tanseek backend v6.7+**

This package prepares the uploaded synthetic benchmark for safe insertion into an existing Tanseek PostgreSQL database without reusing the CSV numeric IDs.

## What was fixed

- `academic_terms.ends_on` is blank/NULL. The term is ended only through the **End Term** action.
- `sections.requirement_id` is populated for all **100/100** sections using the matching course + term requirement.
- Benchmark departments are namespaced with `BM_` codes so they do not collide with real departments.
- Benchmark rooms use the building name `Benchmark Building` so room codes do not collide with real rooms.
- Requirements include frontend-compatible values for `expected_students`, `frontend_room_type`, `preferred_windows`, and `notes`.
- Original benchmark test files (`benchmark_requests.csv`, labelled constraint cases, notebook) are kept outside the application seed data and are **not inserted into app tables**.
- Accounts remain `INVITED`; no insecure shared demo password is created.

## Expected imported counts

- 1 academic term
- 8 departments
- 72 accounts
- 20 courses
- 20 session requirements
- 100 sections
- 200 student groups
- 20 rooms
- 20 time slots
- 60 availability submissions
- 1120 availability slot rows
- 1 draft schedule version
- 4 starter allocations

## Recommended import path

The easiest option is to use the included **Backend v6.8 Benchmark Ready** package, where the data and scripts are already installed.

From the backend folder:

```bash
npm install
node database/migrations/run.js
npm run db:import-benchmark:dry
npm run db:import-benchmark
npm run db:verify-benchmark
```

Your `.env` must contain the correct PostgreSQL connection string:

```env
DATABASE_URL=postgresql://...
```

### What `--dry-run` does

It validates the CSV relationships and section/requirement mappings only. It does **not** write to PostgreSQL.

### What the real importer does

The importer runs inside a database transaction. It maps source CSV IDs to the real DB-generated IDs, so existing database IDs are not overwritten. It uses natural keys for idempotent re-runs and rolls back the whole import if a validation or database error occurs.

## Existing migrations required

The importer checks that the current v6.7 schema is present, including:

- nullable `academic_terms.ends_on`
- `sections.requirement_id`
- frontend requirement columns from migration 009
- frontend room columns from migration 010

If those migrations have not been applied, it stops before inserting data.

## Important scope note

This benchmark tests scheduling data well, but it does not contain individual student accounts/course registrations. It contains aggregate `student_groups`. Keep the benchmark files as an AI/solver benchmark rather than treating them as real university data.
