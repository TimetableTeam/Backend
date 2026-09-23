const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT id, email, role, state FROM accounts WHERE role = 'STUDENT' AND state != 'ACTIVE' LIMIT 5");
  console.log('Non-active students:', res.rows);
  process.exit(0);
}

check().catch(e => console.error(e));