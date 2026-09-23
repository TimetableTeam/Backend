const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'account_id'");
  console.log('account_id:', res.rows);
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });