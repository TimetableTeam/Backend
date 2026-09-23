require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, withTransaction } = require('./src/db/pool');

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
  console.log('Seeding minimal data for Model solve...');
  
  const sections = parseCSV(path.join(CSV_DIR, 'sections.csv'));
  const requirements = parseCSV(path.join(CSV_DIR, 'course_session_requirements.csv'));
  const courses = parseCSV(path.join(CSV_DIR, 'courses.csv'));
  const rooms = parseCSV(path.join(CSV_DIR, 'rooms.csv'));
  const timeSlots = parseCSV(path.join(CSV_DIR, 'time_slots.csv'));
  const accounts = parseCSV(path.join(CSV_DIR, 'accounts.csv'));
  const sectionInstructors = parseCSV(path.join(CSV_DIR, 'section_instructors.csv'));
  const departments = parseCSV(path.join(CSV_DIR, 'departments.csv'));

  await withTransaction(async (client) => {
    // Clear all dependent data first
    await client.query('DELETE FROM availability_submissions');
    await client.query('DELETE FROM availability_slots');
    await client.query('DELETE FROM room_closures');
    await client.query('DELETE FROM room_equipment');
    await client.query('DELETE FROM required_equipment');
    await client.query('DELETE FROM student_section_enrollments');
    await client.query('DELETE FROM student_course_registrations');
    await client.query('DELETE FROM student_group_members');
    await client.query('DELETE FROM section_groups');
    await client.query('DELETE FROM student_groups');
    await client.query('DELETE FROM allocations');
    await client.query('DELETE FROM schedule_versions');
    await client.query('DELETE FROM section_instructors');
    await client.query('DELETE FROM sections');
    await client.query('DELETE FROM session_requirements');
    await client.query('DELETE FROM courses');
    await client.query('DELETE FROM rooms');
    await client.query('DELETE FROM time_slots');
    await client.query('DELETE FROM accounts WHERE id != 19');
    console.log('Cleared existing data');

    // Departments (needed for courses FK)
    for (const d of departments) {
      await client.query(
        `INSERT INTO departments (id, code, name, created_at) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET code=$2, name=$3`,
        [d.id, d.code, d.name, d.created_at]
      );
    }
    console.log(`Inserted ${departments.length} departments`);

    // Accounts (instructors)
    for (const a of accounts) {
      if (a.id >= 5 && a.id <= 18) { // Only instructors
        await client.query(
          `INSERT INTO accounts (id, email, full_name, role, password_hash, home_department_id, state, created_by, created_at, updated_at, last_login_at) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO UPDATE SET email=$2, full_name=$3, role=$4, password_hash=$5, home_department_id=$6, state=$7, created_by=$8, created_at=$9, updated_at=$10, last_login_at=$11`,
          [a.id, a.email, a.full_name, a.role, a.password_hash, a.home_department_id || null, 'ACTIVE', 19, a.created_at, a.updated_at, a.last_login_at || null]
        );
      }
    }
    console.log(`Inserted instructors`);

    // Courses (DB: id, department_id, code, title, created_by, created_at, updated_at)
    for (const c of courses) {
      if ([1,2,3,4].includes(parseInt(c.id))) {
        await client.query(
          `INSERT INTO courses (id, department_id, code, title, created_by, created_at, updated_at) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET department_id=$2, code=$3, title=$4, created_by=$5, updated_at=$7`,
          [c.id, c.department_id, c.code, c.title, c.created_by, c.created_at, c.created_at]
        );
      }
    }
    console.log(`Inserted courses`);

    // Session requirements
    const reqKindMap = { 'LECTURE_HALL': 'CLASSROOM', 'COMPUTER_LAB': 'LAB', 'GPU_LAB': 'LAB', 'NETWORK_LAB': 'LAB' };
    for (const r of requirements) {
      if (parseInt(r.term_id) === 1) {
        await client.query(
          `INSERT INTO session_requirements (id, course_id, term_id, kind, sessions_per_week, duration_minutes, required_room_kind, preferred_window_note, created_by, updated_by, created_at, updated_at) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO UPDATE SET course_id=$2, term_id=$3, kind=$4, sessions_per_week=$5, duration_minutes=$6, required_room_kind=$7, preferred_window_note=$8, updated_by=$10, updated_at=$12`,
          [r.id, r.course_id, r.term_id, r.kind, r.sessions_per_week, r.duration_minutes, reqKindMap[r.required_room_kind] || 'CLASSROOM', r.preferred_window_note || null, r.created_by, r.updated_by, r.created_at, r.updated_at]
        );
      }
    }
    console.log(`Inserted ${requirements.filter(r => r.term_id == 1).length} session_requirements`);

    // Sections (DB: id, term_id, course_id, code, status, created_by, created_at, updated_at, requirement_id)
    for (const s of sections) {
      if (parseInt(s.term_id) === 1) {
        await client.query(
          `INSERT INTO sections (id, term_id, course_id, code, status, created_by, created_at, updated_at, requirement_id) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET term_id=$2, course_id=$3, code=$4, status=$5, created_by=$6, updated_at=$8, requirement_id=$9`,
          [s.id, s.term_id, s.course_id, s.code, s.status, s.created_by, s.created_at, s.updated_at, s.requirement_id]
        );
      }
    }
    console.log(`Inserted ${sections.filter(s => s.term_id == 1).length} sections`);

    // Rooms (DB: id, building, code, kind, capacity, accessible, active, managed_by, updated_at)
    const kindMap = { 'LECTURE_HALL': 'CLASSROOM', 'COMPUTER_LAB': 'LAB', 'GPU_LAB': 'LAB', 'NETWORK_LAB': 'LAB' };
    for (const r of rooms) {
      if (parseInt(r.id) >= 1 && parseInt(r.id) <= 8) {
        await client.query(
          `INSERT INTO rooms (id, building, code, kind, capacity, accessible, active, managed_by, updated_at) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET building=$2, code=$3, kind=$4, capacity=$5, accessible=$6, active=$7, managed_by=$8, updated_at=$9`,
          [r.id, r.building, r.code, kindMap[r.kind] || 'CLASSROOM', r.capacity, r.accessible === 'true', r.is_active === 'true', r.managed_by || null, '2027-08-01T09:00:00Z']
        );
      }
    }
    console.log(`Inserted rooms`);

    // Time slots (DB: id, term_id, weekday, starts_at, ends_at, label)
    for (const s of timeSlots) {
      if (parseInt(s.term_id) === 1) {
        await client.query(
          `INSERT INTO time_slots (id, term_id, weekday, starts_at, ends_at, label) OVERRIDING SYSTEM VALUE
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET term_id=$2, weekday=$3, starts_at=$4, ends_at=$5, label=$6`,
          [s.id, s.term_id, s.weekday, s.starts_at, s.ends_at, s.label || null]
        );
      }
    }
    console.log(`Inserted ${timeSlots.filter(s => s.term_id == 1).length} time_slots`);

    // Section instructors (DB: section_id, instructor_id, requirement_id)
    // Get requirement_id for each section
    const sectionReqs = {};
    const secRes = await client.query('SELECT id, requirement_id FROM sections WHERE term_id = 1');
    for (const row of secRes.rows) {
      sectionReqs[row.id] = row.requirement_id;
    }
    for (const si of sectionInstructors) {
      const reqId = sectionReqs[si.section_id];
      if (reqId) {
        await client.query(
          `INSERT INTO section_instructors (section_id, instructor_id, requirement_id) VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`,
        [si.section_id, si.instructor_id, reqId]
        );
      }
    }
    console.log(`Inserted ${sectionInstructors.length} section_instructors`);
  });

  console.log('Minimal seeding complete!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });