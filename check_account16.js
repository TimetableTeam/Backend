const { query } = require('./src/db/pool');

async function check() {
  const res = await query('SELECT id, email, role FROM accounts WHERE id = 16');
  console.log('Account 16:', res.rows[0]);
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });