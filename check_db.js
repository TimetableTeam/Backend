const { query } = require('./src/db/pool');

async function check() {
  const sections = await query('SELECT COUNT(*) as cnt FROM sections WHERE term_id = 1');
  console.log('Sections:', sections.rows[0].cnt);
  
  const reqs = await query('SELECT COUNT(*) as cnt FROM session_requirements WHERE term_id = 1');
  console.log('Requirements:', reqs.rows[0].cnt);
  
  const slots = await query('SELECT COUNT(*) as cnt FROM time_slots WHERE term_id = 1');
  console.log('Time slots:', slots.rows[0].cnt);
  
  const rooms = await query('SELECT COUNT(*) as cnt FROM rooms');
  console.log('Rooms:', rooms.rows[0].cnt);
  
  const instructors = await query('SELECT COUNT(*) as cnt FROM accounts WHERE role IN (\'LECTURER\')');
  console.log('Instructors:', instructors.rows[0].cnt);
  
  const students = await query('SELECT COUNT(*) as cnt FROM students');
  console.log('Students:', students.rows[0].cnt);
  
  const enrollments = await query('SELECT COUNT(*) as cnt FROM student_section_enrollments WHERE term_id = 1');
  console.log('Enrollments:', enrollments.rows[0].cnt);
  
  const registrations = await query('SELECT COUNT(*) as cnt FROM student_course_registrations WHERE term_id = 1');
  console.log('Registrations:', registrations.rows[0].cnt);
  
  const groups = await query('SELECT COUNT(*) as cnt FROM student_groups WHERE term_id = 1');
  console.log('Student Groups:', groups.rows[0].cnt);
  
  const groupMembers = await query('SELECT COUNT(*) as cnt FROM student_group_members');
  console.log('Group Members:', groupMembers.rows[0].cnt);
  
  // Check model tables
  const scheduleVersions = await query('SELECT COUNT(*) as cnt FROM schedule_versions WHERE term_id = 1');
  console.log('Schedule Versions:', scheduleVersions.rows[0].cnt);
  
  const allocations = await query('SELECT COUNT(*) as cnt FROM allocations WHERE term_id = 1');
  console.log('Allocations:', allocations.rows[0].cnt);
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });