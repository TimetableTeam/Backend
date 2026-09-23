const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'section_instructors'");
  console.log('section_instructors:', res.rows.map(x => `${x.column_name}: nullable=${x.is_nullable}, default=${x.column_default}`).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });