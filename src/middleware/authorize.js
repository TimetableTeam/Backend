'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Roles, mirrored exactly from the `account_role` enum in Tanseek_PostgreSQL_schema.sql:
 * SUPER_ADMIN, ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR, LAB_MANAGER, LECTURER, TA, STUDENT
 */
const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SCHEDULER: 'SCHEDULER',
  DEPARTMENT_COORDINATOR: 'DEPARTMENT_COORDINATOR',
  LAB_MANAGER: 'LAB_MANAGER',
  LECTURER: 'LECTURER',
  TA: 'TA',
  STUDENT: 'STUDENT',
});

const ALL_STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SCHEDULER, ROLES.DEPARTMENT_COORDINATOR, ROLES.LAB_MANAGER, ROLES.LECTURER, ROLES.TA];

/** SUPER_ADMIN always passes; otherwise req.user.role must be one of `roles`. */
function authorize(...roles) {
  const allowed = new Set(roles);
  return function checkRole(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === ROLES.SUPER_ADMIN) return next(); // Super Admin bypasses granular checks.
    if (allowed.has(req.user.role)) return next();
    return next(ApiError.forbidden(`Role ${req.user.role} is not permitted to perform this action.`));
  };
}

module.exports = { authorize, ROLES, ALL_STAFF_ROLES };
