'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const studentGroupsRepo = require('../repositories/studentGroupsRepo');
const termsRepo = require('../repositories/termsRepo');

const list = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, []);
  const groups = await studentGroupsRepo.listByTerm(termId);
  return ok(res, groups);
});

const create = asyncHandler(async (req, res) => {
  const { termId, departmentId, name, studentCount } = req.body;
  const group = await studentGroupsRepo.createGroup({ termId, departmentId, name, studentCount });
  return created(res, group);
});

module.exports = { list, create };
