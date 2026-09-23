const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = 'session_requirements'");
  console.log('session_requirements columns:', res.rows.map(x => `${x.column_name}:${x.udt_name}`).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });