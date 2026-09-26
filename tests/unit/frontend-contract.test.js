'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routes = fs.readFileSync(path.join(__dirname, '../../src/routes/frontendCompat.routes.js'), 'utf8');

const requiredRoutes = [
  "'/auth/forgot-password'",
  "'/auth/reset-password'",
  "'/auth/me'",
  "'/auth/change-password'",
  "'/overview'",
  "'/audit-log'",
  "'/catalog/planning'",
  "'/departments'",
  "'/master-data/:type'",
  "'/master-data/terms/:id/end'",
  "'/requirements'",
  "'/instructor-assignments'",
  "'/availability/me'",
  "'/lab-checks'",
  "'/rooms'",
  "'/schedule/drafts/:draftId/workflow'",
  "'/schedule/drafts/:draftId/generate'",
  "'/schedule/drafts/:draftId/submit-review'",
  "'/schedule/drafts/:draftId/allocations'",
  "'/schedule/drafts/:draftId/validate'",
  "'/schedule/drafts/:draftId/publish'",
  "'/timetable/published/me'",
  "'/students/:studentId/course-enrollments'",
  "'/course-enrollments'",
  "'/students/:studentId/section-enrollments'",
  "'/section-enrollments'",
  "'/admin/accounts'",
  "'/admin/roles'",
];

test('frozen frontend compatibility routes are declared', () => {
  for (const route of requiredRoutes) {
    assert.ok(routes.includes(route), `Missing compatibility route ${route}`);
  }
});

test('publish compatibility route is Admin-only (Super Admin bypasses authorize)', () => {
  assert.match(routes, /post\('\/schedule\/drafts\/:draftId\/publish',\s*authenticate,\s*admin,/);
});

test('system administration compatibility keeps the frozen frontend payload shape', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../../src/controllers/frontendCompatController.js'), 'utf8');
  assert.match(controller, /return ok\(res, \{ accounts: rows\.rows\.map\(camelAccount\) \}\)/);
  assert.match(controller, /return ok\(res,\{ roles:\[\.\.\.built,\.\.\.customRoles\] \}\)/);
  assert.match(controller, /id: 'super_admin'/);
  assert.match(controller, /id: 'department_coordinator'/);
  assert.match(controller, /id: 'registration_officer'/);
});


test('instructor assignments compatibility returns both assignments and eligible staff', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../../src/controllers/frontendCompatController.js'), 'utf8');
  assert.match(controller, /return ok\(res, \{\s*assignments,\s*staff: staff\.map\(camelAccount\),\s*\}\)/s);
  assert.match(controller, /req\.body\.staffId \?\? req\.body\.staff_id/);
  assert.match(controller, /staff_name: r\.instructor_name/);
  assert.match(controller, /staff_role: String\(r\.instructor_role/);
});

test('draft allocation compatibility resolves frozen frontend fields to normalized backend ids', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../../src/controllers/frontendCompatController.js'), 'utf8');
  assert.match(controller, /resolveFrontendAllocationInput/);
  assert.match(controller, /section_instructors/);
  assert.match(controller, /body\.room/);
  assert.match(controller, /body\.day/);
  assert.match(controller, /body\.slot/);
  assert.match(controller, /mapAllocationsForFrontend/);
});

test('student section assignment contract keeps registrations and assignments wrapper objects', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../../src/controllers/frontendCompatController.js'), 'utf8');
  assert.match(controller, /return ok\(res,\{ student:student \? .* registrations \}\)/s);
  assert.match(controller, /return ok\(res,\{ student:student \? .* assignments \}\)/s);
});


test('academic term lifecycle is Super Admin-only and uses explicit End Term', () => {
  assert.match(routes, /post\('\/master-data\/terms',\s*authenticate,\s*superAdmin,/);
  assert.match(routes, /put\('\/master-data\/terms\/:id',\s*authenticate,\s*superAdmin,/);
  assert.match(routes, /post\('\/master-data\/terms\/:id\/end',\s*authenticate,\s*superAdmin,/);
});

test('published timetable and workflow responses use the frozen frontend field names', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../../src/controllers/frontendCompatController.js'), 'utf8');
  assert.match(controller, /version_number:/);
  assert.match(controller, /published_at:/);
  assert.match(controller, /published_by:/);
  assert.match(controller, /allocations: mapped/);
  assert.match(controller, /status: 'READY_FOR_REVIEW'/);
});
