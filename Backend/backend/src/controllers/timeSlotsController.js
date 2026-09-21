'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const timeSlotsRepo = require('../repositories/timeSlotsRepo');
const termsRepo = require('../repositories/termsRepo');

const list = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, []);
  const slots = await timeSlotsRepo.listByTerm(termId);
  return ok(res, slots);
});

module.exports = { list };
