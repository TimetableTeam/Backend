const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'password_reset_tokens' ORDER BY ordinal_position");
  console.log('password_reset_tokens:', res.rows.map(x => x.column_name).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });