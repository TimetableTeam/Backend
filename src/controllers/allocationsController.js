'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const allocationService = require('../services/allocationService');
const recommendationService = require('../services/recommendationService');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const ApiError = require('../utils/ApiError');

const listByVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.query;
  if (!versionId) throw ApiError.badRequest('versionId query parameter is required.');

  if (req.user.role === 'STUDENT') {
    const version = await scheduleVersionsRepo.findById(versionId);
    if (!version || version.state !== 'PUBLISHED') {
      throw ApiError.forbidden('Students may only view published schedules.');
    }
  }

  const allocations = await allocationService.listByVersion(Number(versionId));
  return ok(res, allocations);
});

const checkConflicts = asyncHandler(async (req, res) => {
  const { versionId, sectionId, requirementId, instructorId, roomId, weekday, start, excludeAllocationId } = req.body;
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');

  const { result } = await allocationService.checkConflicts({
    termId: version.term_id,
    versionId,
    sectionId,
    requirementId,
    instructorId,
    roomId,
    weekday,
    start,
    excludeAllocationId: excludeAllocationId || null,
  });

  if (!result.feasible) {
    return res.status(200).json({ success: true, data: { feasible: false, conflicts: result.conflicts } });
  }
  return ok(res, { feasible: true, conflicts: [] });
});

const recommend = asyncHandler(async (req, res) => {
  const { versionId, sectionId, requirementId, instructorId, weekday, start, sameDayOnly, limit, excludeAllocationId } = req.body;
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');

  const results = await recommendationService.suggestAlternatives({
    termId: version.term_id,
    versionId,
    sectionId,
    requirementId,
    instructorId,
    weekday,
    start,
    sameDayOnly: sameDayOnly !== false,
    limit: limit ? Number(limit) : 5,
    excludeAllocationId: excludeAllocationId ? Number(excludeAllocationId) : null,
  });
  return ok(res, results);
});

const create = asyncHandler(async (req, res) => {
  const { versionId, sectionId, requirementId, instructorId, roomId, weekday, start } = req.body;
  const allocation = await allocationService.createAllocation({ versionId, sectionId, requirementId, instructorId, roomId, weekday, start, actor: req.user });
  return created(res, allocation);
});

const update = asyncHandler(async (req, res) => {
  const { roomId, weekday, start, instructorId } = req.body;
  const allocation = await allocationService.updateAllocation({ allocationId: req.params.id, roomId, weekday, start, instructorId, actor: req.user });
  return ok(res, allocation);
});

const remove = asyncHandler(async (req, res) => {
  await allocationService.deleteAllocation({ allocationId: req.params.id, actor: req.user });
  return res.status(204).send();
});

module.exports = { listByVersion, checkConflicts, recommend, create, update, remove };
