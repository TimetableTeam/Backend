const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_state')");
  console.log('account_state enum:', res.rows.map(x => x.enumlabel).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });