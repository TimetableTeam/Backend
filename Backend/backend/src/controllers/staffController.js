'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const accountsRepo = require('../repositories/accountsRepo');
const availabilityRepo = require('../repositories/availabilityRepo');
const termsRepo = require('../repositories/termsRepo');

const list = asyncHandler(async (req, res) => {
  const staff = await accountsRepo.listStaff();
  return ok(res, staff);
});

const getAvailability = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  const availability = await availabilityRepo.getAvailabilityForEngine(termId, req.params.id);
  return ok(res, availability);
});

module.exports = { list, getAvailability };
