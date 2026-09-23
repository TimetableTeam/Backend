'use strict';

const { query } = require('../db/pool');

// --- auth_challenges (OTP) ------------------------------------------------

async function createChallenge({ accountId, purpose, codeHash, expiresAt }) {
  const res = await query(
    `INSERT INTO auth_challenges (account_id, purpose, code_hash, expires_at) VALUES ($1,$2,$3,$4) RETURNING *`,
    [accountId, purpose, codeHash, expiresAt]
  );
  return res.rows[0];
}

async function findPendingChallenge(id) {
  const res = await query(
    `SELECT * FROM auth_challenges WHERE id = $1 AND state = 'PENDING'`,
    [id]
  );
  return res.rows[0] || null;
}

async function markChallengeUsed(id) {
  await query(`UPDATE auth_challenges SET state = 'USED', consumed_at = now() WHERE id = $1`, [id]);
}

async function markChallengeExpired(id) {
  await query(`UPDATE auth_challenges SET state = 'EXPIRED' WHERE id = $1`, [id]);
}

async function incrementFailedAttempts(id) {
  const res = await query(
    `UPDATE auth_challenges SET failed_attempts = failed_attempts + 1 WHERE id = $1 AND failed_attempts < 5 RETURNING *`,
    [id]
  );
  return res.rows[0] || null;
}

// --- trusted_devices -------------------------------------------------------

async function findTrustedDevice(accountId, deviceTokenHash) {
  const res = await query(
    `SELECT * FROM trusted_devices
     WHERE account_id = $1 AND device_token_hash = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [accountId, deviceTokenHash]
  );
  return res.rows[0] || null;
}

async function touchTrustedDevice(id) {
  await query(`UPDATE trusted_devices SET last_seen_at = now() WHERE id = $1`, [id]);
}

async function createTrustedDevice({ accountId, deviceTokenHash, label, expiresAt }) {
  const res = await query(
    `INSERT INTO trusted_devices (account_id, device_token_hash, label, expires_at) VALUES ($1,$2,$3,$4) RETURNING *`,
    [accountId, deviceTokenHash, label || null, expiresAt]
  );
  return res.rows[0];
}

module.exports = {
  createChallenge,
  findPendingChallenge,
  markChallengeUsed,
  markChallengeExpired,
  incrementFailedAttempts,
  findTrustedDevice,
  touchTrustedDevice,
  createTrustedDevice,
};
