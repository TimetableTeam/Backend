'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const sessionRequirementsRepo = require('../repositories/sessionRequirementsRepo');
const termsRepo = require('../repositories/termsRepo');

// Flat, term-wide view of session_requirements. The existing
// GET /courses/:id/requirements?termId= endpoint stays as-is for the
// per-course use case; this reuses the same repository for the frontend's
// flat /requirements call (optionally filtered by course).
const list = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, []);

  const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
  const requirements = await sessionRequirementsRepo.listByTerm(termId, { courseId });
  const withEquipment = await Promise.all(
    requirements.map(async (r) => ({ ...r, requiredEquipment: await sessionRequirementsRepo.getRequiredEquipment(r.id) }))
  );
  return ok(res, withEquipment);
});

module.exports = { list };
