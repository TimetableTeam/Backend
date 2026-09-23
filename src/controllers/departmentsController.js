'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const departmentsRepo = require('../repositories/departmentsRepo');

const list = asyncHandler(async (req, res) => {
  const departments = await departmentsRepo.listAll();
  return ok(res, departments);
});

module.exports = { list };
