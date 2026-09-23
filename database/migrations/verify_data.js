const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verify() {
  const tables = [
    'students',
    'student_group_members',
    'student_course_registrations',
    'student_section_enrollments',
    'student_group_members',
    'password_reset_tokens',
    'email_queue',
  ];
  
  for (const table of tables) {
    const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`Table ${table}: ${count.rows[0].count} rows`);
  }
  
  // Check specific data
  const students = await pool.query('SELECT id, university_id, full_name FROM students ORDER BY id LIMIT 5');
  console.log('\nSample students:');
  students.rows.forEach(s => console.log(`  ${s.id}: ${s.university_id} - ${s.full_name}`));
  
  const enrollments = await pool.query('SELECT COUNT(*) FROM student_section_enrollments WHERE state = \'ACTIVE\'');
  console.log(`\nActive section enrollments: ${enrollments.rows[0].count}`);
  
  const registrations = await pool.query('SELECT COUNT(*) FROM student_course_registrations WHERE state = \'REGISTERED\'');
  console.log(`Registered course registrations: ${registrations.rows[0].count}`);
  
  const groups = await pool.query('SELECT group_id, COUNT(*) as count FROM student_group_members GROUP BY group_id ORDER BY group_id');
  console.log('\nStudents per group:');
  groups.rows.forEach(g => console.log(`  Group ${g.group_id}: ${g.count} students`));
  
  await pool.end();
}

verify().catch(console.error);