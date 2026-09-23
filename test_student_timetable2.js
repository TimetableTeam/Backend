const { query } = require('./src/db/pool');

async function check() {
  // Check student enrollments for Adam Samir (student_id 1)
  const enrollRes = await query(
    `SELECT sse.*, s.code as section_code, c.code as course_code
     FROM student_section_enrollments sse
     JOIN student_course_registrations scr ON scr.id = sse.registration_id
     JOIN sections s ON s.id = sse.section_id
     JOIN courses c ON c.id = sse.course_id
     WHERE scr.student_id = 1 AND sse.state = 'ACTIVE'`
  );
  console.log('Enrollments for student 1:', JSON.stringify(enrollRes.rows, null, 2));
  
  // Check allocations for published version 8
  const allocRes = await query(
    `SELECT a.*, s.code as section_code, c.code as course_code
     FROM allocations a
     JOIN sections s ON s.id = a.section_id
     JOIN courses c ON c.id = s.course_id
     WHERE a.version_id = 8
     ORDER BY a.section_id`
  );
  console.log('Allocations for version 8:', allocRes.rows.length);
  console.log('Sample allocations:', allocRes.rows.slice(0, 5).map(r => ({ section: r.section_code, course: r.course_code })));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });