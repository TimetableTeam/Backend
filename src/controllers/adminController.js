'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const accountsRepo = require('../repositories/accountsRepo');
const { ROLES } = require('../middleware/authorize');

// Roles are not a database table - they are the fixed enum already used
// throughout authorize.js/the account_role DB enum. This just exposes that
// existing single source of truth; it does not create a second role system.
const listRoles = asyncHandler(async (req, res) => {
  return ok(res, Object.values(ROLES));
});

// Reuses accountsRepo.listAll, which already exists and already returns only
// the public columns (no password hashes, no tokens).
const listAccounts = asyncHandler(async (req, res) => {
  const { role, state, departmentId } = req.query;
  const accounts = await accountsRepo.listAll({
    role,
    state,
    departmentId: departmentId ? Number(departmentId) : undefined,
  });
  return ok(res, accounts);
});

module.exports = { listRoles, listAccounts };
