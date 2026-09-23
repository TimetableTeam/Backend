const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debug() {
  const students = await pool.query('SELECT id, university_id, full_name FROM students ORDER BY id');
  console.log('Students:');
  students.rows.forEach(s => console.log(`  ${s.id}: ${s.university_id} - ${s.full_name}`));
  
  const groups = await pool.query('SELECT * FROM student_groups ORDER BY id');
  console.log('\nGroups:');
  groups.rows.forEach(g => console.log(`  ${g.id}: ${g.name}`));
  
  const courses = await pool.query('SELECT id, code FROM courses ORDER BY id');
  console.log('\nCourses:');
  courses.rows.forEach(c => console.log(`  ${c.id}: ${c.code}`));
  
  const sections = await pool.query('SELECT id, code, course_id, requirement_id FROM sections ORDER BY id');
  console.log('\nSections:');
  sections.rows.forEach(s => console.log(`  ${s.id}: ${s.code} (course=${s.course_id}, req=${s.requirement_id})`));
  
  const regs = await pool.query('SELECT * FROM student_course_registrations ORDER BY id');
  console.log('\nRegistrations:');
  regs.rows.forEach(r => console.log(`  ${r.id}: student=${r.student_id}, course=${r.course_id}, term=${r.term_id}`));
  
  const groupsData = await pool.query('SELECT * FROM student_groups ORDER BY id');
  console.log('\nGroups:');
  groupsData.rows.forEach(g => console.log(`  ${g.id}: ${g.name}`));
  
  const studentsTable = await pool.query('SELECT id, university_id FROM students ORDER BY id');
  console.log('\nStudents table:');
  studentsTable.rows.forEach(s => console.log(`  ${s.id}: ${s.university_id}`));
  
  await pool.end();
}

debug().catch(console.error);