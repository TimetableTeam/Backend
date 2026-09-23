const { query } = require('./src/db/pool');

async function check() {
  try {
    const res = await query("SELECT * FROM account_activation_tokens LIMIT 1");
    console.log('Table exists, rows:', res.rows.length);
  } catch (e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });