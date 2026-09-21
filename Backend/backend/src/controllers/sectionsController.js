'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const sectionsRepo = require('../repositories/sectionsRepo');
const termsRepo = require('../repositories/termsRepo');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, []);
  const sections = await sectionsRepo.listByTerm(termId);
  const sectionIds = sections.map((s) => s.id);
  const groupsBySection = await sectionsRepo.getGroupsForSections(sectionIds);
  const withGroups = sections.map((s) => ({ ...s, groups: groupsBySection.get(s.id) || [] }));
  return ok(res, withGroups);
});

const getOne = asyncHandler(async (req, res) => {
  const section = await sectionsRepo.findById(req.params.id);
  if (!section) throw ApiError.notFound('Section not found.');
  const groups = await sectionsRepo.getGroupsForSection(section.id);
  return ok(res, { ...section, groups });
});

const getInstructors = asyncHandler(async (req, res) => {
  const { requirementId } = req.query;
  if (!requirementId) throw ApiError.badRequest('requirementId query parameter is required.');
  const instructors = await sectionsRepo.getInstructorsForSection(req.params.id, Number(requirementId));
  return ok(res, instructors);
});

const create = asyncHandler(async (req, res) => {
  const { termId, courseId, code } = req.body;
  const section = await sectionsRepo.createSection({ termId, courseId, code, createdBy: req.user.id });
  return created(res, section);
});

module.exports = { list, getOne, getInstructors, create };
