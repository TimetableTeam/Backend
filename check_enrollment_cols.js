const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'student_section_enrollments' ORDER BY ordinal_position");
  console.log('student_section_enrollments columns:', res.rows.map(r => r.column_name).join(', '));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });