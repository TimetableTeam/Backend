'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const authService = require('../services/authService');
const accountsRepo = require('../repositories/accountsRepo');
const ApiError = require('../utils/ApiError');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const deviceToken = req.headers['x-device-token'] || null;
  const result = await authService.login({ email, password, deviceToken, ipAddress: req.ip });
  return ok(res, result);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, challengeId, code, deviceLabel } = req.body;
  const result = await authService.verifyOtp({ email, challengeId, code, deviceLabel, ipAddress: req.ip });
  return ok(res, result);
});

const me = asyncHandler(async (req, res) => {
  const account = await accountsRepo.findPublicById(req.user.id);
  if (!account) throw ApiError.notFound('Account not found.');
  return ok(res, account);
});

/** Admin-only: provision a new ACTIVE account with an initial password (see API.md for rationale). */
const adminCreateAccount = asyncHandler(async (req, res) => {
  const { email, fullName, role, homeDepartmentId, initialPassword } = req.body;
  const account = await authService.adminCreateAccount({ email, fullName, role, homeDepartmentId, initialPassword, createdBy: req.user.id });
  return ok(res, account, 201);
});

module.exports = { login, verifyOtp, me, adminCreateAccount };
