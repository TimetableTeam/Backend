require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, withTransaction } = require('./src/db/pool');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function test() {
  const token = '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3';
  const password = 'NewPass123!';
  const confirmPassword = 'NewPass123!';
  
  if (!token || !password || !confirmPassword) {
    console.log('Missing required fields');
    return;
  }
  if (password !== confirmPassword) {
    console.log('Passwords do not match');
    return;
  }

  // Validate password policy
  const { validatePassword } = require('./src/utils/passwordPolicy');
  const policyResult = validatePassword(password);
  if (!policyResult.valid) {
    console.log('Password validation failed:', policyResult.errors.join(', '));
    return;
  }
  console.log('Password validation passed');

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  console.log('[DEBUG] tokenHash:', tokenHash);

  const result = await query(
    `SELECT prt.*, a.id as account_id, a.email
     FROM password_reset_tokens prt
     JOIN accounts a ON a.id = prt.account_id
     WHERE prt.token_hash = $1 AND prt.used_at IS NULL AND prt.expires_at > now()`,
    [tokenHash]
  );
  console.log('[DEBUG] query result rows:', result.rows.length);

  if (result.rows.length === 0) {
    console.log('Invalid or expired reset token');
    return;
  }

  const resetToken = result.rows[0];
  console.log('[DEBUG] resetToken:', JSON.stringify(resetToken));

  try {
    await withTransaction(async (client) => {
      // Hash new password
      const passwordHash = await hashPassword(password);
      console.log('[DEBUG] passwordHash:', passwordHash);

      // Update account password
      await client.query(
        `UPDATE accounts SET password_hash = $1, updated_at = now() WHERE id = $2`,
        [passwordHash, resetToken.account_id]
      );
      console.log('[DEBUG] password updated');

      // Mark token as used
      await client.query(
        `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
        [resetToken.id]
      );
      console.log('[DEBUG] token marked used');
    });
    console.log('Transaction completed successfully');
  } catch (err) {
    console.error('Transaction error:', err);
  }
}

test().catch(e => console.error('Test error:', e));