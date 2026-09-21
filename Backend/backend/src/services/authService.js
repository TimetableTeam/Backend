'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

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
    { sub: account.id, email: account.email, role: account.role, homeDepartmentId: account.home_department_id },
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
    homeDepartmentId: account.home_department_id,
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

  // Constant-shape response for unknown accounts / accounts without a password yet.
  if (!account || !account.password_hash) {
    await auditRepo.record({ actorEmail: email, action: 'LOGIN_FAILED', outcome: 'FAILURE', ipAddress, details: { reason: 'no_account_or_password' } });
    throw ApiError.unauthorized('Invalid email or password.');
  }
  if (account.state === 'DISABLED' || account.state === 'SUSPENDED') {
    await auditRepo.record({ actorAccountId: account.id, actorEmail: email, action: 'LOGIN_FAILED', outcome: 'FAILURE', ipAddress, details: { reason: 'account_' + account.state.toLowerCase() } });
    throw ApiError.unauthorized('This account is not active.');
  }

  const passwordOk = await bcrypt.compare(password, account.password_hash);
  if (!passwordOk) {
    await auditRepo.record({ actorAccountId: account.id, actorEmail: email, action: 'LOGIN_FAILED', outcome: 'FAILURE', ipAddress, details: { reason: 'bad_password' } });
    throw ApiError.unauthorized('Invalid email or password.');
  }

  // ---- Super Admin: never requires OTP -----------------------------------
  if (account.role === 'SUPER_ADMIN') {
    await accountsRepo.touchLastLogin(account.id);
    await auditRepo.record({ actorAccountId: account.id, actorEmail: email, action: 'LOGIN_SUCCESS', outcome: 'SUCCESS', ipAddress, details: { otp: false, reason: 'super_admin_exempt' } });
    return { requiresOtp: false, token: signJwt(account), user: toPublicAccount(account) };
  }

  // ---- Everyone else: trusted device skips OTP, otherwise challenge ------
  if (deviceToken) {
    const trusted = await authChallengesRepo.findTrustedDevice(account.id, hashToken(deviceToken));
    if (trusted) {
      await authChallengesRepo.touchTrustedDevice(trusted.id);
      await accountsRepo.touchLastLogin(account.id);
      await auditRepo.record({ actorAccountId: account.id, actorEmail: email, action: 'LOGIN_SUCCESS', outcome: 'SUCCESS', ipAddress, details: { otp: false, reason: 'trusted_device' } });
      return { requiresOtp: false, token: signJwt(account), user: toPublicAccount(account) };
    }
  }

  const code = generateOtpCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const challenge = await authChallengesRepo.createChallenge({ accountId: account.id, purpose: 'NEW_DEVICE', codeHash, expiresAt });

  await auditRepo.record({ actorAccountId: account.id, actorEmail: email, action: 'LOGIN_OTP_ISSUED', outcome: 'SUCCESS', ipAddress, details: { challengeId: challenge.id } });

  // No mail server exists in this project. In non-production environments we
  // surface the code directly so the flow is testable end-to-end; in
  // production this must be replaced with a real transactional email send.
  // eslint-disable-next-line no-console
  console.log(`[auth] OTP for ${email} (challenge ${challenge.id}): ${code} (expires ${expiresAt.toISOString()})`);

  return {
    requiresOtp: true,
    challengeId: challenge.id,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    devCode: env.DEV_EXPOSE_OTP ? code : undefined,
  };
}

async function verifyOtp({ email, challengeId, code, deviceLabel, ipAddress }) {
  const account = await accountsRepo.findByEmail(email);
  if (!account) throw ApiError.unauthorized('Invalid challenge.');

  const challenge = await authChallengesRepo.findPendingChallenge(challengeId);
  if (!challenge || String(challenge.account_id) !== String(account.id)) {
    throw ApiError.unauthorized('Invalid or already-used challenge.');
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await authChallengesRepo.markChallengeExpired(challenge.id);
    throw ApiError.unauthorized('This code has expired. Please log in again.');
  }
  if (challenge.failed_attempts >= 5) {
    throw ApiError.unauthorized('Too many incorrect attempts. Please log in again.');
  }

  const codeHash = hashToken(code);
  if (codeHash !== challenge.code_hash) {
    await authChallengesRepo.incrementFailedAttempts(challenge.id);
    await auditRepo.record({ actorAccountId: account.id, actorEmail: email, action: 'LOGIN_OTP_FAILED', outcome: 'FAILURE', ipAddress });
    throw ApiError.unauthorized('Incorrect code.');
  }

  await authChallengesRepo.markChallengeUsed(challenge.id);

  const deviceToken = crypto.randomBytes(32).toString('hex');
  const deviceExpiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);
  await authChallengesRepo.createTrustedDevice({ accountId: account.id, deviceTokenHash: hashToken(deviceToken), label: deviceLabel, expiresAt: deviceExpiresAt });

  await accountsRepo.touchLastLogin(account.id);
  await auditRepo.record({ actorAccountId: account.id, actorEmail: email, action: 'LOGIN_SUCCESS', outcome: 'SUCCESS', ipAddress, details: { otp: true } });

  return { token: signJwt(account), user: toPublicAccount(account), deviceToken };
}

/**
 * Practical, minimal provisioning path: an authorized admin creates an
 * already-ACTIVE account with an initial password, instead of the full
 * email-invitation flow (out of scope for this field-training timeline).
 */
async function adminCreateAccount({ email, fullName, role, homeDepartmentId, initialPassword, createdBy }) {
  const { valid, errors } = validatePassword(initialPassword);
  if (!valid) throw ApiError.badRequest('Password does not meet policy.', { errors });

  const existing = await accountsRepo.findByEmail(email);
  if (existing) throw ApiError.conflict('An account with this email already exists.');

  const passwordHash = await bcrypt.hash(initialPassword, 12);
  const account = await accountsRepo.createAccount({ email, fullName, role, state: 'ACTIVE', homeDepartmentId, passwordHash, createdBy });
  await auditRepo.record({ actorAccountId: createdBy, action: 'ACCOUNT_CREATED', entityType: 'accounts', entityId: account.id, outcome: 'SUCCESS' });
  return toPublicAccount(account);
}

module.exports = { login, verifyOtp, adminCreateAccount, toPublicAccount, hashToken };
