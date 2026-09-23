const { query } = require('./src/db/pool');

async function check() {
  const tables = ['courses', 'rooms', 'sections', 'session_requirements', 'student_groups', 'student_section_enrollments', 'student_course_registrations', 'allocations', 'schedule_versions', 'time_slots'];
  for (const t of tables) {
    const res = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' ORDER BY ordinal_position`);
    console.log(`${t}:`, res.rows.map(x => x.column_name).join(', '));
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });