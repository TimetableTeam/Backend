const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'student_course_registrations' ORDER BY ordinal_position");
  console.log('student_course_registrations columns:', res.rows.map(r => r.column_name).join(', '));
  
  // Check a few rows
  const res2 = await query('SELECT * FROM student_course_registrations LIMIT 5');
  console.log('Sample registrations:', JSON.stringify(res2.rows, null, 2));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });