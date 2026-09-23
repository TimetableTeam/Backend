const { query } = require('./src/db/pool');

async function check() {
  const res = await query('SELECT * FROM password_reset_tokens ORDER BY created_at DESC LIMIT 5');
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });