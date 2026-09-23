'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const icsService = require('../services/icsService');
const termsRepo = require('../repositories/termsRepo');
const ApiError = require('../utils/ApiError');

const exportIcs = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) throw ApiError.notFound('No academic terms exist yet.');

  const { instructorId, sectionId, roomId } = req.query;
  const ics = await icsService.buildIcsForTerm({
    termId,
    instructorId: instructorId ? Number(instructorId) : undefined,
    sectionId: sectionId ? Number(sectionId) : undefined,
    roomId: roomId ? Number(roomId) : undefined,
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="timetable.ics"');
  return res.status(200).send(ics);
});

module.exports = { exportIcs };
