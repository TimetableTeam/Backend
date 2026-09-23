'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const coursesRepo = require('../repositories/coursesRepo');
const sessionRequirementsRepo = require('../repositories/sessionRequirementsRepo');
const { getAccountDepartmentIds } = require('../middleware/departmentGrants');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;
  
  // If user is DEPARTMENT_COORDINATOR, filter by their accessible departments
  let allowedDeptId = departmentId ? Number(departmentId) : undefined;
  if (req.user.role === 'DEPARTMENT_COORDINATOR') {
    const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
    if (departmentId) {
      if (!allowedDeptIds.includes(Number(departmentId))) {
        throw ApiError.forbidden('Access denied to this department');
      }
    } else {
      // If no departmentId specified, filter by allowed departments
      // Pass the allowed departments to the repo
    }
  }
  
  const courses = await coursesRepo.listAll({ departmentId: allowedDeptId });
  return ok(res, courses);
});

const getOne = asyncHandler(async (req, res) => {
  const course = await coursesRepo.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found.');
  return ok(res, course);
});

const getRequirements = asyncHandler(async (req, res) => {
  const { termId } = req.query;
  if (!termId) throw ApiError.badRequest('termId query parameter is required.');
  const requirements = await sessionRequirementsRepo.listByCourseTerm(req.params.id, Number(termId));
  const withEquipment = await Promise.all(
    requirements.map(async (r) => ({ ...r, requiredEquipment: await sessionRequirementsRepo.getRequiredEquipment(r.id) }))
  );
  return ok(res, withEquipment);
});

const create = asyncHandler(async (req, res) => {
  const { departmentId, code, title } = req.body;
  const course = await coursesRepo.createCourse({ departmentId, code, title, createdBy: req.user.id });
  return created(res, course);
});

module.exports = { list, getOne, getRequirements, create };
