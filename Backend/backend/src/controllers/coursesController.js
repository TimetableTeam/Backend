'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const coursesRepo = require('../repositories/coursesRepo');
const sessionRequirementsRepo = require('../repositories/sessionRequirementsRepo');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;
  const courses = await coursesRepo.listAll({ departmentId: departmentId ? Number(departmentId) : undefined });
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
