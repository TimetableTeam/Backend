'use strict';

const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');

/**
 * Get department IDs that an account has access to.
 * Includes home_department_id and any granted departments via account_department_grants.
 */
async function getAccountDepartmentIds(accountId) {
  const homeDeptRes = await query(
    `SELECT home_department_id FROM accounts WHERE id = $1`,
    [accountId]
  );
  const homeDept = homeDeptRes.rows[0]?.home_department_id;

  const grantsRes = await query(
    `SELECT department_id FROM account_department_grants WHERE account_id = $1`,
    [accountId]
  );
  const grantedDepts = grantsRes.rows.map(r => r.department_id);

  const deptIds = new Set();
  if (homeDept) deptIds.add(homeDept);
  for (const d of grantedDepts) deptIds.add(d);

  return Array.from(deptIds);
}

/**
 * Middleware to enforce department grants on a target department ID.
 * Checks if the authenticated user has access to the specified department.
 */
function enforceDepartmentAccess(getDeptIdFromRequest) {
  return async function enforceDept(req, res, next) {
    if (!req.user) return next(); // Should not happen if authenticate middleware runs first

    // SUPER_ADMIN bypasses department restrictions
    if (req.user.role === 'SUPER_ADMIN') return next();

    const targetDeptId = getDeptIdFromRequest(req);
    if (!targetDeptId) return next(); // No department restriction

    try {
      const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
      if (!allowedDeptIds.includes(targetDeptId)) {
        return next(new Error(`Department access denied. User does not have access to department ${targetDeptId}.`));
      }
      return next();
    } catch (err) {
      return next(ApiError.internal('Failed to check department access'));
    }
  };
}

function enforceDepartmentAccessForCourse(req, res, next) {
  // Get department_id from course query param or body
  const departmentId = req.query.departmentId || req.body.departmentId;
  if (!departmentId) return next();
  return enforceDepartmentAccess(() => departmentId)(req, res, next);
}

function enforceDepartmentAccessForSection(req, res, next) {
  // Get department_id from section query param or body via course
  // For sections, we need to check the course's department
  return next(); // TODO: implement when section creation has department context
}

module.exports = {
  getAccountDepartmentIds,
  enforceDepartmentAccess,
  enforceDepartmentAccessForCourse,
  enforceDepartmentAccessForSection,
};