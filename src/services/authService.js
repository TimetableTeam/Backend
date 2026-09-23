'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { withTransaction, query } = require('../db/pool');

const accountsRepo = require('../repositories/accountsRepo');
const authChallengesRepo = require('../repositories/authChallengesRepo');
const auditRepo = require('../repositories/auditRepo');
const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');
const { validatePassword } = require('../utils/passwordPolicy');

const OTP_TTL_MINUTES = 10;
const TRUSTED_DEVICE_DAYS = 30;

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function signJwt(account) {
  return jwt.sign(
    {
      sub: account.id,
      email: account.email,
      role: account.role,
      homeDepartmentId: account.home_department_id
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function toPublicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    fullName: account.full_name,
    role: account.role,
    state: account.state,
    homeDepartmentId: account.home_department_id
  };
}

/**
 * Step 1 of login: verify email/password.
 * - SUPER_ADMIN: no OTP, ever. Returns a token immediately.
 * - Everyone else: if the device token maps to a trusted device, also skip
 *   OTP; otherwise issue a challenge and require verifyOtp() next.
 */
async function login({ email, password, deviceToken, ipAddress }) {
  const account = await accountsRepo.findByEmail(email);

  if (!account || !account.password_hash) {
    await auditRepo.record({
      actorEmail: email,
      action: 'LOGIN_FAILED',
      outcome: 'FAILURE',
      ipAddress,
      details: { reason: 'no_account_or_password' }
    });

    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (account.state === 'DISABLED' || account.state === 'SUSPENDED') {
    await auditRepo.record({
      actorAccountId: account.id,
      actorEmail: email,
      action: 'LOGIN_FAILED',
      outcome: 'FAILURE',
      ipAddress,
      details: {
        reason: 'account_' + account.state.toLowerCase()
      }
    });

    throw ApiError.unauthorized('This account is not active.');
  }

  const passwordOk = await bcrypt.compare(password, account.password_hash);

  if (!passwordOk) {
    await auditRepo.record({
      actorAccountId: account.id,
      actorEmail: email,
      action: 'LOGIN_FAILED',
      outcome: 'FAILURE',
      ipAddress,
      details: { reason: 'bad_password' }
    });

    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (account.role === 'SUPER_ADMIN') {
    await accountsRepo.touchLastLogin(account.id);

    await auditRepo.record({
      actorAccountId: account.id,
      actorEmail: email,
      action: 'LOGIN_SUCCESS',
      outcome: 'SUCCESS',
      ipAddress,
      details: {
        otp: false,
        reason: 'super_admin_exempt'
      }
    });

    return {
      requiresOtp: false,
      token: signJwt(account),
      user: toPublicAccount(account)
    };
  }

  // For all other roles, direct login with JWT - no OTP required
  await accountsRepo.touchLastLogin(account.id);

  await auditRepo.record({
    actorAccountId: account.id,
    actorEmail: email,
    action: 'LOGIN_SUCCESS',
    outcome: 'SUCCESS',
    ipAddress,
    details: {
      otp: false,
      reason: 'direct_login'
    }
  });

  return {
    requiresOtp: false,
    token: signJwt(account),
    user: toPublicAccount(account)
  };
}

async function verifyOtp({
  email,
  challengeId,
  code,
  deviceLabel,
  ipAddress
}) {
  const account = await accountsRepo.findByEmail(email);

  if (!account) {
    throw ApiError.unauthorized('Invalid challenge.');
  }

  const challenge =
    await authChallengesRepo.findPendingChallenge(challengeId);

  if (
    !challenge ||
    String(challenge.account_id) !== String(account.id)
  ) {
    throw ApiError.unauthorized('Invalid or already-used challenge.');
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await authChallengesRepo.markChallengeExpired(challenge.id);

    throw ApiError.unauthorized(
      'This code has expired. Please log in again.'
    );
  }

  if (challenge.failed_attempts >= 5) {
    throw ApiError.unauthorized(
      'Too many incorrect attempts. Please log in again.'
    );
  }

  const codeHash = hashToken(code);

  if (codeHash !== challenge.code_hash) {
    await authChallengesRepo.incrementFailedAttempts(challenge.id);

    await auditRepo.record({
      actorAccountId: account.id,
      actorEmail: email,
      action: 'LOGIN_OTP_FAILED',
      outcome: 'FAILURE',
      ipAddress
    });

    throw ApiError.unauthorized('Incorrect code.');
  }

  await authChallengesRepo.markChallengeUsed(challenge.id);

  const deviceToken = crypto.randomBytes(32).toString('hex');

  const deviceExpiresAt = new Date(
    Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000
  );

  await authChallengesRepo.createTrustedDevice({
    accountId: account.id,
    deviceTokenHash: hashToken(deviceToken),
    label: deviceLabel,
    expiresAt: deviceExpiresAt
  });

  await accountsRepo.touchLastLogin(account.id);

  await auditRepo.record({
    actorAccountId: account.id,
    actorEmail: email,
    action: 'LOGIN_SUCCESS',
    outcome: 'SUCCESS',
    ipAddress,
    details: {
      otp: true
    }
  });

  return {
    token: signJwt(account),
    user: toPublicAccount(account),
    deviceToken
  };
}

async function adminCreateAccount({
  email,
  fullName,
  role,
  homeDepartmentId,
  initialPassword,
  createdBy
}) {
  const { valid, errors } = validatePassword(initialPassword);

  if (!valid) {
    throw ApiError.badRequest(
      'Password does not meet policy.',
      { errors }
    );
  }

  const existing = await accountsRepo.findByEmail(email);

  if (existing) {
    throw ApiError.conflict(
      'An account with this email already exists.'
    );
  }

  const passwordHash = await bcrypt.hash(initialPassword, 12);

  const account = await accountsRepo.createAccount({
    email,
    fullName,
    role,
    state: 'ACTIVE',
    homeDepartmentId,
    passwordHash,
    createdBy
  });

  await auditRepo.record({
    actorAccountId: createdBy,
    action: 'ACCOUNT_CREATED',
    entityType: 'accounts',
    entityId: account.id,
    outcome: 'SUCCESS'
  });

  return toPublicAccount(account);
}

async function me(accountId) {
  const account = await accountsRepo.findById(accountId);

  if (!account) {
    return null;
  }

  return toPublicAccount(account);
}

async function transferSuperAdmin({
  currentSuperAdminId,
  newSuperAdminEmail,
  newSuperAdminPassword,
  actorId
}) {
  const currentAdmin =
    await accountsRepo.findById(currentSuperAdminId);

  if (
    !currentAdmin ||
    currentAdmin.role !== 'SUPER_ADMIN'
  ) {
    throw ApiError.forbidden(
      'Only the current Super Admin can transfer the role.'
    );
  }

  const targetAccount =
    await accountsRepo.findByEmail(newSuperAdminEmail);

  if (!targetAccount) {
    throw ApiError.notFound('Target account not found.');
  }

  if (targetAccount.id === currentSuperAdminId) {
    throw ApiError.badRequest(
      'Cannot transfer Super Admin role to yourself.'
    );
  }

  if (targetAccount.role === 'SUPER_ADMIN') {
    throw ApiError.badRequest(
      'Target account is already a Super Admin.'
    );
  }

  const policyResult =
    validatePassword(newSuperAdminPassword);

  if (!policyResult.valid) {
    throw ApiError.badRequest(
      'New Super Admin password does not meet policy.',
      { errors: policyResult.errors }
    );
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE accounts
       SET role = 'ADMIN', updated_at = now()
       WHERE id = $1`,
      [currentSuperAdminId]
    );

    await client.query(
      `UPDATE accounts
       SET role = 'SUPER_ADMIN',
           password_hash = $2,
           state = 'ACTIVE',
           updated_at = now()
       WHERE id = $1`,
      [
        targetAccount.id,
        await bcrypt.hash(newSuperAdminPassword, 12)
      ]
    );

    await client.query(
      `UPDATE trusted_devices
       SET expires_at = now()
       WHERE account_id IN ($1, $2)`,
      [currentSuperAdminId, targetAccount.id]
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE account_id IN ($1, $2)
       AND used_at IS NULL`,
      [currentSuperAdminId, targetAccount.id]
    );

    await client.query(
      `UPDATE auth_challenges
       SET used_at = now()
       WHERE account_id IN ($1, $2)
       AND used_at IS NULL`,
      [currentSuperAdminId, targetAccount.id]
    );
  });

  await auditRepo.record({
    actorAccountId: actorId,
    actorEmail: (await accountsRepo.findById(actorId))?.email,
    action: 'SUPER_ADMIN_TRANSFERRED',
    entityType: 'accounts',
    entityId: targetAccount.id,
    outcome: 'SUCCESS',
    details: {
      from: currentSuperAdminId,
      to: targetAccount.id,
      toEmail: newSuperAdminEmail
    }
  });

  return {
    message: 'Super Admin role transferred successfully',
    newSuperAdminId: targetAccount.id
  };
}

async function requestAccountActivation({
  email,
  ipAddress
}) {
  const account = await accountsRepo.findByEmail(email);

  if (!account) {
    return {
      message:
        'If the email exists, an activation link has been sent'
    };
  }

  if (account.state === 'ACTIVE') {
    return {
      message: 'Account is already active'
    };
  }

  const recent = await query(
    `SELECT 1
     FROM account_activation_tokens
     WHERE account_id = $1
     AND created_at > now() - interval '1 hour'`,
    [account.id]
  );

  if (recent.rows.length > 0) {
    return {
      success: false,
      message:
        'Too many requests. Please wait before requesting another activation link.'
    };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  );

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE account_activation_tokens
       SET used_at = now()
       WHERE account_id = $1
       AND used_at IS NULL`,
      [account.id]
    );

    await client.query(
      `INSERT INTO account_activation_tokens
       (account_id, token_hash, expires_at, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [account.id, tokenHash, expiresAt, ipAddress || null]
    );
  });

  const response = {
    message:
      'If the email exists, an activation link has been sent'
  };

  if (env.DEV_EXPOSE_OTP) {
    response.dev_token = rawToken;
    response.dev_expires_at = expiresAt.toISOString();
  }

  return response;
}

async function activateAccount({
  token,
  password,
  confirmPassword
}) {
  if (!token || !password || !confirmPassword) {
    throw ApiError.badRequest(
      'Token, password, and confirmPassword are required'
    );
  }

  if (password !== confirmPassword) {
    throw ApiError.badRequest('Passwords do not match');
  }

  const policyResult = validatePassword(password);

  if (!policyResult.valid) {
    throw ApiError.badRequest(
      policyResult.errors.join(', ')
    );
  }

  const tokenHash = hashToken(token);

  const result = await query(
    `SELECT aat.*, a.id as account_id, a.email, a.state
     FROM account_activation_tokens aat
     JOIN accounts a ON a.id = aat.account_id
     WHERE aat.token_hash = $1
     AND aat.used_at IS NULL
     AND aat.expires_at > now()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw ApiError.badRequest(
      'Invalid or expired activation token'
    );
  }

  const activationToken = result.rows[0];

  if (activationToken.state === 'ACTIVE') {
    return {
      message: 'Account is already active'
    };
  }

  await withTransaction(async (client) => {
    const passwordHash =
      await bcrypt.hash(password, 12);

    await client.query(
      `UPDATE accounts
       SET password_hash = $1,
           state = 'ACTIVE',
           updated_at = now()
       WHERE id = $2`,
      [
        passwordHash,
        activationToken.account_id
      ]
    );

    await client.query(
      `UPDATE account_activation_tokens
       SET used_at = now()
       WHERE id = $1`,
      [activationToken.id]
    );
  });

  return {
    message: 'Account has been activated successfully'
  };
}

async function verifyActivationToken({ token }) {
  if (!token) {
    throw ApiError.badRequest('Token is required');
  }

  const tokenHash = hashToken(token);

  const result = await query(
    `SELECT 1
     FROM account_activation_tokens
     WHERE token_hash = $1
     AND used_at IS NULL
     AND expires_at > now()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw ApiError.badRequest(
      'Invalid or expired activation token'
    );
  }

  return {
    valid: true
  };
}

module.exports = {
  login,
  verifyOtp,
  adminCreateAccount,
  me,
  transferSuperAdmin,
  requestAccountActivation,
  activateAccount,
  verifyActivationToken
};