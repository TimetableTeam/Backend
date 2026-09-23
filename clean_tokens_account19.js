const { query } = require('./src/db/pool');

async function clean() {
  await query('DELETE FROM password_reset_tokens WHERE account_id = 19');
  console.log('Tokens for account 19 deleted');
  process.exit(0);
}

clean().catch(e => { console.error(e); process.exit(1); });