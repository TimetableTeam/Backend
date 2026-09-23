'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const coursesRepo = require('../repositories/coursesRepo');
const sectionsRepo = require('../repositories/sectionsRepo');
const sessionRequirementsRepo = require('../repositories/sessionRequirementsRepo');
const termsRepo = require('../repositories/termsRepo');
const { getAccountDepartmentIds } = require('../middleware/departmentGrants');

// Course-planning view for a term: each course with its session requirements
// and its sections for that term. Composed entirely from the existing
// courses/sections/session_requirements repositories - no new tables or
// duplicated queries beyond the listByTerm helpers those endpoints already use.
const getPlanning = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, { termId: null, courses: [] });

  let departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
  let departmentIds;
  if (req.user.role === 'DEPARTMENT_COORDINATOR') {
    const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
    if (departmentId && !allowedDeptIds.includes(departmentId)) {
      return ok(res, { termId, courses: [] });
    }
    departmentIds = departmentId ? [departmentId] : allowedDeptIds;
    departmentId = undefined;
  }

  const [courses, sections, requirements] = await Promise.all([
    coursesRepo.listAll({ departmentId, departmentIds }),
    sectionsRepo.listByTerm(termId),
    sessionRequirementsRepo.listByTerm(termId),
  ]);

  const requirementsByCourse = new Map();
  for (const r of requirements) {
    if (!requirementsByCourse.has(r.course_id)) requirementsByCourse.set(r.course_id, []);
    requirementsByCourse.get(r.course_id).push(r);
  }

  const sectionsByCourse = new Map();
  for (const s of sections) {
    if (!sectionsByCourse.has(s.course_id)) sectionsByCourse.set(s.course_id, []);
    sectionsByCourse.get(s.course_id).push(s);
  }

  const courseList = courses.map((c) => ({
    ...c,
    requirements: requirementsByCourse.get(c.id) || [],
    sections: sectionsByCourse.get(c.id) || [],
  }));

  return ok(res, { termId, courses: courseList });
});

module.exports = { getPlanning };
