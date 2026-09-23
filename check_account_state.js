const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' ORDER BY ordinal_position");
  console.log('accounts columns:', res.rows.map(x => x.column_name).join(', '));
  
  const res2 = await query("SELECT id, email, role, state FROM accounts LIMIT 5");
  console.log('accounts sample:', res2.rows);
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });