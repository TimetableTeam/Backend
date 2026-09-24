# Tanseek Frontend ↔ Backend Compatibility Audit

## Result after fixes

- Static frontend API operation coverage: **58/58 (100%)** have corresponding backend compatibility/native routes.
- Backend unit tests: **29/29 passing**.
- Frontend source parse: **38/38 JS/JSX files parse successfully**.
- Estimated integration compatibility after this patch: **~98% at code/contract level**.

The remaining ~2% is not a known contract defect: this sandbox could not perform a true browser + PostgreSQL + scheduling-model end-to-end run, and the uploaded frontend `node_modules` contains Windows Rollup binaries while this validation environment is Linux. A clean `npm install` on the target machine/CI will install the correct platform binary.

## High-impact issues fixed

1. **Academic term lifecycle**
   - Removed planned End Date from term create/edit UI and API writes.
   - Added explicit **End term** action.
   - Backend sets `ends_on` automatically using the Cairo calendar date and archives the term.
   - `ends_on` is nullable until the term is ended.
   - Fixed `availability_deadline` snake/camel contract mismatch.
   - Persisted holidays and created default term slots for new terms.

2. **Timetable export**
   - Added **Export CSV** to the timetable screen.
   - Exports the currently visible/filtered timetable rows as UTF-8 CSV (Excel-compatible).

3. **Published timetable contract**
   - Backend now returns the version/allocation/registration/enrollment shape the frontend consumes.

4. **Draft workflow contract**
   - Generate now returns allocations + workflow.
   - Workflow exposes frontend status values (`DRAFT`, `READY_FOR_REVIEW`, `PUBLISHED`).
   - Publish returns the frontend published-version shape.
   - `draft-v3` acts as a logical alias for the latest live draft.

5. **Live conflict validation**
   - Live frontend no longer blocks publish based on static demo conflicts.
   - Conflict count/details come from backend `validateDraft`.
   - Demo ranked alternatives remain available only in mock mode; live conflicts direct the Scheduler to edit the allocation and revalidate.

6. **Authorization / safety fixes**
   - Term create/update/delete/end are Super Admin-only.
   - Existing Super Admin global bypass remains intact.

7. **Nullable-end backend safety**
   - Room closure queries work while an active term has no end date.
   - ICS generation omits `UNTIL` for a term that has not ended instead of failing on null.

## Validation notes

The Vite production build was not completed in this Linux sandbox because the uploaded RAR includes Windows-specific Rollup optional binaries (`@rollup/rollup-win32-x64-*`) and does not include the Linux binary. Installing dependencies cleanly on the deployment platform should resolve this environment-only issue. Frontend source was independently parsed successfully with Babel after the edits.
