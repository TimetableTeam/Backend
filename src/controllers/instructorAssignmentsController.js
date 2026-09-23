'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const sectionsRepo = require('../repositories/sectionsRepo');
const termsRepo = require('../repositories/termsRepo');
const { getAccountDepartmentIds } = require('../middleware/departmentGrants');

// Instructor-to-section assignments (section_instructors), independent of the
// timetable allocations. This is the real backing data for the frontend's
// "instructor assignments" view - not the room/time schedule.
const list = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, []);

  const instructorId = req.query.instructorId ? Number(req.query.instructorId) : undefined;
  const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;

  let assignments = await sectionsRepo.listInstructorAssignmentsByTerm(termId, { instructorId, courseId });

  // Same department-scoping convention used by staffController.list.
  if (req.user.role === 'DEPARTMENT_COORDINATOR') {
    const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
    assignments = assignments.filter((a) => allowedDeptIds.includes(a.department_id));
  }

  return ok(res, assignments);
});

module.exports = { list };
