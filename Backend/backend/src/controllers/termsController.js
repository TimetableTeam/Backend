'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const termsRepo = require('../repositories/termsRepo');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const terms = await termsRepo.listAll();
  return ok(res, terms);
});

const getActive = asyncHandler(async (req, res) => {
  const term = await termsRepo.findActiveOrLatest();
  if (!term) throw ApiError.notFound('No academic terms exist yet.');
  return ok(res, term);
});

module.exports = { list, getActive };
