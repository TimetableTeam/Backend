const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'academic_terms' ORDER BY ordinal_position");
  console.log('academic_terms:', res.rows.map(x => x.column_name).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });