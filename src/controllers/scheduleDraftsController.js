'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const scheduleService = require('../services/scheduleService');
const allocationService = require('../services/allocationService');
const termsRepo = require('../repositories/termsRepo');
const ApiError = require('../utils/ApiError');

// The frontend addresses drafts with slugs like "draft-v3" instead of the
// real numeric schedule_versions.id. There is no "draft" table/slug anywhere
// in the schema - version_number is the only thing "v3" can refer to, scoped
// to a term (schedule_versions has UNIQUE(term_id, version_number)). This
// resolves either form to the real row; it never fabricates draft data.
async function resolveDraft(draftId, termIdQuery) {
  if (/^\d+$/.test(draftId)) {
    const byId = await scheduleVersionsRepo.findById(Number(draftId));
    if (byId) return byId;
  }

  const match = /^(?:draft-)?v(?:ersion)?-?(\d+)$/i.exec(draftId);
  if (match) {
    const versionNumber = Number(match[1]);
    const termId = termIdQuery ? Number(termIdQuery) : (await termsRepo.findActiveOrLatest())?.id;
    if (termId) {
      const version = await scheduleVersionsRepo.findByTermAndVersionNumber(termId, versionNumber);
      if (version) return version;
    }
  }

  return null;
}

function assertViewable(version, user) {
  if (user.role === 'STUDENT' && version.state !== 'PUBLISHED') {
    throw ApiError.forbidden('Students may only view published schedules.');
  }
}

const getAllocations = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) throw ApiError.notFound('Schedule draft not found.');
  assertViewable(version, req.user);

  const allocations = await allocationService.listByVersion(version.id);
  return ok(res, {
    draftId: req.params.draftId,
    versionId: version.id,
    versionNumber: version.version_number,
    state: version.state,
    allocations,
  });
});

const getWorkflow = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) throw ApiError.notFound('Schedule draft not found.');
  assertViewable(version, req.user);

  const validation = await scheduleService.validateVersion(version.id);
  return ok(res, {
    draftId: req.params.draftId,
    versionId: version.id,
    versionNumber: version.version_number,
    state: version.state,
    ...validation,
  });
});

module.exports = { getAllocations, getWorkflow };
