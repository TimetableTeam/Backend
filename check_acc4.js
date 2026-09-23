const { query } = require('./src/db/pool');

async function check() {
  const res = await query('SELECT id, email, role FROM accounts WHERE id = 4');
  console.log(res.rows);
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });