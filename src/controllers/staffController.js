'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const accountsRepo = require('../repositories/accountsRepo');
const availabilityRepo = require('../repositories/availabilityRepo');
const termsRepo = require('../repositories/termsRepo');
const { getAccountDepartmentIds } = require('../middleware/departmentGrants');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  // Filter staff by department grants for DEPARTMENT_COORDINATOR
  let staff = await accountsRepo.listStaff();
  
  if (req.user.role === 'DEPARTMENT_COORDINATOR') {
    const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
    // Filter staff by department - staff have home_department_id
    staff = staff.filter(s => allowedDeptIds.includes(s.home_department_id));
  }
  
  return ok(res, staff);
});

const getAvailability = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  const availability = await availabilityRepo.getAvailabilityForEngine(termId, req.params.id);
  return ok(res, availability);
});

module.exports = { list, getAvailability };
