const { query } = require('./src/db/pool');

async function check() {
  const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'students' ORDER BY ordinal_position");
  console.log('students:', res.rows.map(x => x.column_name).join(', '));
  
  const res2 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'student_course_registrations' ORDER BY ordinal_position");
  console.log('student_course_registrations:', res2.rows.map(x => x.column_name).join(', '));
  
  const res3 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'student_section_enrollments' ORDER BY ordinal_position");
  console.log('student_section_enrollments:', res3.rows.map(x => x.column_name).join(', '));
  
  const res4 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'student_groups' ORDER BY ordinal_position");
  console.log('student_groups:', res4.rows.map(x => x.column_name).join(', '));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });