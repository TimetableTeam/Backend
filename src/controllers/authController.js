
'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const accountsRepo = require('../repositories/accountsRepo');
const authService = require('../services/authService');
const { hashPassword } = require('../utils/password');
const crypto = require('crypto');
const { query, withTransaction } = require('../db/pool');
const ApiError = require('../utils/ApiError');

const RESET_TOKEN_EXPIRY_HOURS = 2;

const login = asyncHandler(async (req, res) => {
  const result = await authService.login({
    email: req.body.email,
    password: req.body.password,
    deviceToken: req.body.deviceToken,
    ipAddress: req.ip,
  });

  return ok(res, result);
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw ApiError.badRequest('Email is required');
  }

  const account = await accountsRepo.findByEmail(email);

  if (!account) {
    return ok(res, {
      message: 'If the email exists, a reset link has been sent',
    });
  }

  const recent = await query(
    `SELECT 1
     FROM password_reset_tokens
     WHERE account_id = $1
     AND created_at > now() - interval '1 hour'`,
    [account.id]
  );

  if (recent.rows.length > 0) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please wait before requesting another reset.',
    });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE account_id = $1
       AND used_at IS NULL`,
      [account.id]
    );

    await client.query(
      `INSERT INTO password_reset_tokens
       (account_id, token_hash, expires_at, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [account.id, tokenHash, expiresAt, req.ip || null]
    );
  });

  const { env } = require('../config/env');

  const response = {
    message: 'If the email exists, a reset link has been sent',
  };

  if (env.DEV_EXPOSE_OTP) {
    response.dev_token = rawToken;
    response.dev_expires_at = expiresAt.toISOString();
  }

  return ok(res, response);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    throw ApiError.badRequest(
      'Token, password, and confirmPassword are required'
    );
  }

  if (password !== confirmPassword) {
    throw ApiError.badRequest('Passwords do not match');
  }

  const { validatePassword } = require('../utils/passwordPolicy');
  const policyResult = validatePassword(password);

  if (!policyResult.valid) {
    throw ApiError.badRequest(policyResult.errors.join(', '));
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const result = await query(
    `SELECT prt.*, a.id as account_id, a.email
     FROM password_reset_tokens prt
     JOIN accounts a ON a.id = prt.account_id
     WHERE prt.token_hash = $1
     AND prt.used_at IS NULL
     AND prt.expires_at > now()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  const resetToken = result.rows[0];

  await withTransaction(async (client) => {
    const passwordHash = await hashPassword(password);

    await client.query(
      `UPDATE accounts
       SET password_hash = $1, updated_at = now()
       WHERE id = $2`,
      [passwordHash, resetToken.account_id]
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE id = $1`,
      [resetToken.id]
    );
  });

  return ok(res, {
    message: 'Password has been reset successfully',
  });
});

const verifyResetToken = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw ApiError.badRequest('Token is required');
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const result = await query(
    `SELECT 1
     FROM password_reset_tokens
     WHERE token_hash = $1
     AND used_at IS NULL
     AND expires_at > now()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  return ok(res, {
    valid: true,
  });
});

const transferSuperAdmin = asyncHandler(async (req, res) => {
  const { newSuperAdminEmail, newSuperAdminPassword } = req.body;

  if (!newSuperAdminEmail || !newSuperAdminPassword) {
    throw ApiError.badRequest(
      'newSuperAdminEmail and newSuperAdminPassword are required'
    );
  }

  const result = await authService.transferSuperAdmin({
    currentSuperAdminId: req.user.id,
    newSuperAdminEmail,
    newSuperAdminPassword,
    actorId: req.user.id,
  });

  return ok(res, result);
});

module.exports = {
  login,
  requestPasswordReset,
  resetPassword,
  verifyResetToken,
  transferSuperAdmin,
};

