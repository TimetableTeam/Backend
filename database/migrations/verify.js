const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verify() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('Tables in database:');
  tables.rows.forEach(t => console.log(' -', t.table_name));
  
  // Check specific tables
  const checks = [
    'students',
    'student_group_members',
    'student_course_registrations',
    'student_section_enrollments',
    'student_group_members',
    'password_reset_tokens',
    'email_queue',
  ];
  
  for (const table of checks) {
    const exists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )
    `, [table]);
    console.log(`Table ${table}: ${exists.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);
  }
  
  await pool.end();
}

verify().catch(console.error);