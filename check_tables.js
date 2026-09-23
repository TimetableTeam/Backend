const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  console.log('Tables:', res.rows.map(x => x.tablename).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });