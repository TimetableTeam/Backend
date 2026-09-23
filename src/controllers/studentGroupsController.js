'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const studentGroupsRepo = require('../repositories/studentGroupsRepo');
const termsRepo = require('../repositories/termsRepo');
const { getAccountDepartmentIds } = require('../middleware/departmentGrants');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, []);
  const groups = await studentGroupsRepo.listByTerm(termId);
  return ok(res, groups);
});

const create = asyncHandler(async (req, res) => {
  const { termId, departmentId, name, studentCount } = req.body;
  
  // Check department grants for DEPARTMENT_COORDINATOR
  if (req.user.role === 'DEPARTMENT_COORDINATOR') {
    const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
    if (!allowedDeptIds.includes(Number(departmentId))) {
      throw ApiError.forbidden('Access denied to this department');
    }
  }
  
  const group = await studentGroupsRepo.createGroup({ termId, departmentId, name, studentCount });
  return created(res, group);
});

module.exports = { list, create };
