const { query } = require('./src/db/pool');

async function check() {
  const res = await query('SELECT id, email, role FROM accounts ORDER BY id');
  console.log('Accounts:', res.rows.map(x => `${x.id}: ${x.email} (${x.role})`).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });