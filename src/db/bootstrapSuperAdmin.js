'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('./pool');
const { env } = require('../config/env');
const { validatePassword } = require('../utils/passwordPolicy');

/**
 * Ensures the Super Admin account exists with the correct role and an active
 * password. Never overwrites an existing password unless the account has no
 * password yet (first-run bootstrap). Never deletes or duplicates accounts.
 */
async function bootstrapSuperAdmin() {
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;

  if (!email) {
    console.warn('[bootstrap] SUPER_ADMIN_EMAIL is not set; skipping Super Admin bootstrap.');
    return;
  }

  const existingRes = await query(`SELECT * FROM accounts WHERE lower(email) = lower($1)`, [email]);
  const existing = existingRes.rows[0];

  if (existing) {
    // Preserve the account. Only fix role/state if they've drifted; never
    // touch the password unless it is currently missing.
    if (existing.role !== 'SUPER_ADMIN' || existing.state !== 'ACTIVE') {
      await query(`UPDATE accounts SET role = 'SUPER_ADMIN', state = 'ACTIVE', updated_at = now() WHERE id = $1`, [existing.id]);
      console.log('[bootstrap] Existing Super Admin account normalized to role=SUPER_ADMIN, state=ACTIVE.');
    }
    if (!existing.password_hash && password) {
      const { valid, errors } = validatePassword(password);
      if (!valid) {
        console.warn('[bootstrap] SUPER_ADMIN_PASSWORD does not meet the password policy:', errors.join(' '));
        return;
      }
      const hash = await bcrypt.hash(password, 12);
      await query(`UPDATE accounts SET password_hash = $2, updated_at = now() WHERE id = $1`, [existing.id, hash]);
      console.log('[bootstrap] Super Admin password set for the first time.');
    } else {
      console.log('[bootstrap] Super Admin account already present; password left untouched.');
    }
    return;
  }

  if (!password) {
    console.warn('[bootstrap] No Super Admin account exists yet and SUPER_ADMIN_PASSWORD is not set. Set it in .env and restart to create the account.');
    return;
  }
  const { valid, errors } = validatePassword(password);
  if (!valid) {
    console.warn('[bootstrap] SUPER_ADMIN_PASSWORD does not meet the password policy:', errors.join(' '));
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO accounts (email, full_name, role, state, password_hash) VALUES ($1,$2,'SUPER_ADMIN','ACTIVE',$3)`,
    [email, 'Super Admin', hash]
  );
  console.log(`[bootstrap] Super Admin account created for ${email}.`);
}

module.exports = { bootstrapSuperAdmin };
