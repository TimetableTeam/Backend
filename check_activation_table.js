const { query } = require('./src/db/pool');

async function check() {
  try {
    const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'account_activation_tokens' ORDER BY ordinal_position");
    console.log('account_activation_tokens columns:', res.rows.map(x => x.column_name).join(', '));
  } catch (e) {
    console.log('Table does not exist or error:', e.message);
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });