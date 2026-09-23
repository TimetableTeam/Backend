require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, withTransaction } = require('./src/db/pool');
const bcrypt = require('bcryptjs');

const CSV_DIR = 'C:\\Users\\Pharahos\\Desktop\\Laste worke\\Tanseek_Menna_Model_v2_Starter\\Tanseek_Menna_Model_v2_Starter\\Tanseek_CSV_Data';

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || null;
    });
    rows.push(row);
  }
  return rows;
}

async function seed() {
  console.log('Seeding student accounts and data...');
  
  const accounts = parseCSV(path.join(CSV_DIR, 'accounts.csv'));
  const students = parseCSV(path.join(CSV_DIR, 'students.csv'));
  const studentCourseRegistrations = parseCSV(path.join(CSV_DIR, 'student_course_registrations.csv'));
  const studentSectionEnrollments = parseCSV(path.join(CSV_DIR, 'student_section_enrollments.csv'));
  const studentGroups = parseCSV(path.join(CSV_DIR, 'student_groups.csv'));
  const studentGroupMembers = parseCSV(path.join(CSV_DIR, 'student_group_members.csv'));
  const sectionGroupAssignments = parseCSV(path.join(CSV_DIR, 'section_group_assignments.csv'));

  // Filter student accounts (19-47)
  const studentAccounts = accounts.filter(a => a.id >= 19 && a.id <= 47);
  console.log(`Found ${studentAccounts.length} student accounts to create`);

  await withTransaction(async (client) => {
    // Create student accounts (19-47)
    for (const a of studentAccounts) {
      // Check if account already exists
      const existing = await client.query('SELECT id FROM accounts WHERE id = $1', [a.id]);
      if (existing.rows.length > 0) {
        console.log(`Account ${a.id} (${a.email}) already exists, skipping`);
        continue;
      }
      
      const passwordHash = await bcrypt.hash('StudentPass123!', 12);
      await client.query(
        `INSERT INTO accounts (id, email, full_name, role, password_hash, home_department_id, state, created_by, created_at, updated_at, last_login_at) OVERRIDING SYSTEM VALUE
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET email=$2, full_name=$3, role=$4, password_hash=$5, updated_at=$10`,
        [a.id, a.email, a.full_name || 'Student', a.role, passwordHash, a.home_department_id || null, 'ACTIVE', 19, a.created_at, a.updated_at, a.last_login_at || null]
      );
      console.log(`Created account ${a.id}: ${a.email}`);
    }

    // Insert students
    for (const s of students) {
      const existing = await client.query('SELECT id FROM students WHERE id = $1', [s.id]);
      if (existing.rows.length > 0) {
        console.log(`Student ${s.id} already exists, skipping`);
        continue;
      }
      await client.query(
        `INSERT INTO students (id, university_id, full_name, email, department_id, academic_level, account_id, status, created_at, updated_at) OVERRIDING SYSTEM VALUE
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET university_id=$2, full_name=$3, email=$4, department_id=$5, academic_level=$6, account_id=$7, status=$8, updated_at=$10`,
        [s.id, s.university_id, s.full_name, s.email, s.department_id || null, s.academic_level || null, s.account_id || null, s.status, s.created_at, s.updated_at]
      );
    }
    console.log(`Inserted ${students.length} students`);

    // Insert student_course_registrations for term 1
    let regCount = 0;
    for (const scr of studentCourseRegistrations) {
      if (scr.term_id == 1) {
        const existing = await client.query('SELECT id FROM student_course_registrations WHERE id = $1', [scr.id]);
        if (existing.rows.length > 0) continue;
        await client.query(
          `INSERT INTO student_course_registrations (id, student_id, course_id, term_id, state, registered_by, registered_at, updated_at) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET student_id=$2, course_id=$3, term_id=$4, state=$5, registered_by=$6, registered_at=$7, updated_at=$8`,
          [scr.id, scr.student_id, scr.course_id, scr.term_id, scr.state, scr.registered_by, scr.registered_at, scr.updated_at]
        );
        regCount++;
      }
    }
    console.log(`Inserted ${regCount} course registrations`);

    // Insert student_section_enrollments for term 1
    let enrollCount = 0;
    for (const sse of studentSectionEnrollments) {
      if (sse.term_id == 1) {
        const existing = await client.query('SELECT id FROM student_section_enrollments WHERE id = $1', [sse.id]);
        if (existing.rows.length > 0) continue;
        await client.query(
          `INSERT INTO student_section_enrollments (id, registration_id, term_id, course_id, section_kind, section_id, state, assigned_by, assigned_at, ended_at) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id) DO UPDATE SET registration_id=$2, term_id=$3, course_id=$4, section_kind=$5, section_id=$6, state=$7, assigned_by=$8, assigned_at=$9, ended_at=$10`,
          [sse.id, sse.registration_id, sse.term_id, sse.course_id, sse.section_kind, sse.section_id, sse.state, sse.assigned_by, sse.assigned_at, sse.ended_at || null]
        );
        enrollCount++;
      }
    }
    console.log(`Inserted ${enrollCount} section enrollments`);

    // Insert student_groups for term 1
    for (const sg of studentGroups) {
      if (sg.term_id == 1) {
        const existing = await client.query('SELECT id FROM student_groups WHERE id = $1', [sg.id]);
        if (existing.rows.length > 0) continue;
        await client.query(
          `INSERT INTO student_groups (id, term_id, department_id, name, student_count) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET term_id=$2, department_id=$3, name=$4, student_count=$5`,
          [sg.id, sg.term_id, sg.department_id || null, sg.name, sg.student_count || 0]
        );
      }
    }
    console.log(`Inserted ${studentGroups.filter(s => s.term_id == 1).length} student groups`);

    // Insert section_groups (from section_group_assignments CSV)
    for (const sga of sectionGroupAssignments) {
      const existing = await client.query('SELECT 1 FROM section_groups WHERE section_id = $1 AND group_id = $2', [sga.section_id, sga.group_id]);
      if (existing.rows.length > 0) continue;
      await client.query(
        `INSERT INTO section_groups (section_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [sga.section_id, sga.group_id]
      );
    }
    console.log(`Inserted ${sectionGroupAssignments.length} section group assignments`);

    // Insert student_group_members
    for (const sgm of studentGroupMembers) {
      const existing = await client.query('SELECT 1 FROM student_group_members WHERE group_id = $1 AND student_id = $2', [sgm.group_id, sgm.student_id]);
      if (existing.rows.length > 0) continue;
      await client.query(
        `INSERT INTO student_group_members (group_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [sgm.group_id, sgm.student_id]
      );
    }
    console.log(`Inserted ${studentGroupMembers.length} student group members`);
  });

  console.log('Student seeding complete!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });