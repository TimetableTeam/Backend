'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboardService');
const termsRepo = require('../repositories/termsRepo');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const ApiError = require('../utils/ApiError');

const getSummary = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) throw ApiError.notFound('No academic terms exist yet.');

  let versionId = req.query.versionId ? Number(req.query.versionId) : undefined;
  if (!versionId) {
    const published = await scheduleVersionsRepo.findPublished(termId);
    const versions = published ? [published] : await scheduleVersionsRepo.listByTerm(termId);
    versionId = (published || versions[0])?.id;
  }
  if (!versionId) throw ApiError.notFound('No schedule versions exist for this term yet.');

  const summary = await dashboardService.getSummary({ termId, versionId });
  return ok(res, summary);
});

module.exports = { getSummary };
