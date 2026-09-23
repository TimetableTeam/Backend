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
  console.log('Seeding database with CSV data (mapped to DB schema)...');
  
  // Load CSV data
  const sections = parseCSV(path.join(CSV_DIR, 'sections.csv'));
  const requirements = parseCSV(path.join(CSV_DIR, 'course_session_requirements.csv'));
  const courses = parseCSV(path.join(CSV_DIR, 'courses.csv'));
  const rooms = parseCSV(path.join(CSV_DIR, 'rooms.csv'));
  const timeSlots = parseCSV(path.join(CSV_DIR, 'time_slots.csv'));
  const accounts = parseCSV(path.join(CSV_DIR, 'accounts.csv'));
  const roomEquipment = parseCSV(path.join(CSV_DIR, 'room_equipment.csv'));
  const equipment = parseCSV(path.join(CSV_DIR, 'equipment.csv'));
  const requiredEquipment = parseCSV(path.join(CSV_DIR, 'required_equipment.csv'));
  const sectionInstructors = parseCSV(path.join(CSV_DIR, 'section_instructors.csv'));
  const sectionGroupAssignments = parseCSV(path.join(CSV_DIR, 'section_group_assignments.csv'));
  const studentGroups = parseCSV(path.join(CSV_DIR, 'student_groups.csv'));
  const studentGroupMembers = parseCSV(path.join(CSV_DIR, 'student_group_members.csv'));
  const students = parseCSV(path.join(CSV_DIR, 'students.csv'));
  const studentCourseRegistrations = parseCSV(path.join(CSV_DIR, 'student_course_registrations.csv'));
  const studentSectionEnrollments = parseCSV(path.join(CSV_DIR, 'student_section_enrollments.csv'));
  const academicTerms = parseCSV(path.join(CSV_DIR, 'academic_terms.csv'));
  const roomClosures = parseCSV(path.join(CSV_DIR, 'room_closures.csv'));
  const availabilitySlots = parseCSV(path.join(CSV_DIR, 'availability_slots.csv'));
  const availabilitySubmissions = parseCSV(path.join(CSV_DIR, 'availability_submissions.csv'));
  const allocations = parseCSV(path.join(CSV_DIR, 'allocations.csv'));
  const scheduleVersions = parseCSV(path.join(CSV_DIR, 'schedule_versions.csv'));
  const auditEvents = parseCSV(path.join(CSV_DIR, 'audit_events.csv'));
  const departments = parseCSV(path.join(CSV_DIR, 'departments.csv'));
  const accountDepartmentGrants = parseCSV(path.join(CSV_DIR, 'account_department_grants.csv'));
  const termHolidays = parseCSV(path.join(CSV_DIR, 'term_holidays.csv'));

  await withTransaction(async (client) => {
    // Clear existing data for term 1 (in correct order due to FK constraints)
    await client.query('DELETE FROM allocations WHERE term_id = 1');
    await client.query('DELETE FROM schedule_versions WHERE term_id = 1');
    await client.query('DELETE FROM student_section_enrollments WHERE term_id = 1');
    await client.query('DELETE FROM student_course_registrations WHERE term_id = 1');
    await client.query('DELETE FROM student_group_members');
    await client.query('DELETE FROM section_groups');
    await client.query('DELETE FROM student_groups WHERE term_id = 1');
    await client.query('DELETE FROM section_instructors');
    await client.query('DELETE FROM sections WHERE term_id = 1');
    await client.query('DELETE FROM session_requirements WHERE term_id = 1');
    await client.query('DELETE FROM courses WHERE id IN (SELECT id FROM courses WHERE department_id IN (SELECT id FROM departments))');
    await client.query('DELETE FROM rooms');
    await client.query('DELETE FROM time_slots WHERE term_id = 1');
    await client.query('DELETE FROM accounts WHERE id > 19'); // Keep super admin (id 19)
    console.log('Cleared existing data for term 1');

    // Insert academic_terms
    for (const t of academicTerms) {
      await client.query(
        `INSERT INTO academic_terms (id, name, start_date, end_date, is_active, created_at, updated_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [t.id, t.name, t.start_date, t.end_date, t.is_active === 'true', t.created_at, t.updated_at]
      );
    }
    console.log(`Inserted ${academicTerms.length} academic_terms`);

    // Insert departments
    for (const d of departments) {
      await client.query(
        `INSERT INTO departments (id, code, name, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)`,
        [d.id, d.code, d.name, d.created_at, d.updated_at]
      );
    }
    console.log(`Inserted ${departments.length} departments`);

    // Insert accounts (skip if exists)
    for (const a of accounts) {
      await client.query(
        `INSERT INTO accounts (id, email, full_name, role, password_hash, home_department_id, is_active, last_login_at, created_at, updated_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.email, a.full_name, a.role, a.password_hash, a.home_department_id || null, a.is_active === 'true', a.last_login_at || null, a.created_at, a.updated_at]
      );
    }
    console.log(`Inserted/updated ${accounts.length} accounts`);

    // Insert account_department_grants
    for (const g of accountDepartmentGrants) {
      await client.query(
        `INSERT INTO account_department_grants (account_id, department_id, granted_by, created_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [g.account_id, g.department_id, g.granted_by, g.created_at]
      );
    }
    console.log(`Inserted ${accountDepartmentGrants.length} account_department_grants`);

    // Insert courses (DB schema: id, department_id, code, title, created_by, created_at, updated_at)
    for (const c of courses) {
      await client.query(
        `INSERT INTO courses (id, department_id, code, title, created_by, created_at, updated_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET department_id=$2, code=$3, title=$4, created_by=$5, updated_at=$7`,
        [c.id, c.department_id, c.code, c.title, c.created_by, c.created_at, c.updated_at]
      );
    }
    console.log(`Inserted ${courses.length} courses`);

    // Insert session_requirements
    for (const r of requirements) {
      await client.query(
        `INSERT INTO session_requirements (id, course_id, term_id, kind, sessions_per_week, duration_minutes, required_room_kind, preferred_window_note, created_by, updated_by, created_at, updated_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET course_id=$2, term_id=$3, kind=$4, sessions_per_week=$5, duration_minutes=$6, required_room_kind=$7, preferred_window_note=$8, updated_by=$10, updated_at=$12`,
        [r.id, r.course_id, r.term_id, r.kind, r.sessions_per_week, r.duration_minutes, r.required_room_kind, r.preferred_window_note || null, r.created_by, r.updated_by, r.created_at, r.updated_at]
      );
    }
    console.log(`Inserted ${requirements.length} session_requirements`);

    // Insert sections (DB: id, term_id, course_id, code, status, created_by, created_at, updated_at, requirement_id)
    for (const s of sections) {
      await client.query(
        `INSERT INTO sections (id, term_id, course_id, code, status, created_by, created_at, updated_at, requirement_id) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET term_id=$2, course_id=$3, code=$4, status=$5, created_by=$6, updated_at=$8, requirement_id=$9`,
        [s.id, s.term_id, s.course_id, s.code, s.status, s.created_by, s.created_at, s.updated_at, s.requirement_id]
      );
    }
    console.log(`Inserted ${sections.length} sections`);

    // Insert rooms (DB: id, building, code, kind, capacity, accessible, active, managed_by, updated_at)
    for (const r of rooms) {
      await client.query(
        `INSERT INTO rooms (id, building, code, kind, capacity, accessible, active, managed_by, updated_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET building=$2, code=$3, kind=$4, capacity=$5, accessible=$6, active=$7, managed_by=$8, updated_at=$9`,
        [r.id, r.building, r.code, r.kind, r.capacity, r.accessible === 'true', r.is_active === 'true', r.managed_by || null, r.updated_at]
      );
    }
    console.log(`Inserted ${rooms.length} rooms`);

    // Insert time_slots (DB: id, term_id, weekday, starts_at, ends_at, label)
    for (const s of timeSlots) {
      await client.query(
        `INSERT INTO time_slots (id, term_id, weekday, starts_at, ends_at, label) 
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET term_id=$2, weekday=$3, starts_at=$4, ends_at=$5, label=$6`,
        [s.id, s.term_id, s.weekday, s.starts_at, s.ends_at, s.label || null]
      );
    }
    console.log(`Inserted ${timeSlots.length} time_slots`);

    // Insert equipment
    for (const e of equipment) {
      await client.query(
        `INSERT INTO equipment (id, name, created_at, updated_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET name=$2, updated_at=$4`,
        [e.id, e.name, e.created_at, e.updated_at]
      );
    }
    console.log(`Inserted ${equipment.length} equipment`);

    // Insert room_equipment
    for (const re of roomEquipment) {
      await client.query(
        `INSERT INTO room_equipment (room_id, equipment_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [re.room_id, re.equipment_id]
      );
    }
    console.log(`Inserted ${roomEquipment.length} room_equipment`);

    // Insert required_equipment
    for (const re of requiredEquipment) {
      await client.query(
        `INSERT INTO required_equipment (requirement_id, equipment_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [re.requirement_id, re.equipment_id]
      );
    }
    console.log(`Inserted ${requiredEquipment.length} required_equipment`);

    // Insert section_instructors
    for (const si of sectionInstructors) {
      await client.query(
        `INSERT INTO section_instructors (section_id, instructor_id, is_primary, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [si.section_id, si.instructor_id, si.is_primary === 'true', si.created_at, si.updated_at]
      );
    }
    console.log(`Inserted ${sectionInstructors.length} section_instructors`);

    // Insert student_groups
    for (const sg of studentGroups) {
      await client.query(
        `INSERT INTO student_groups (id, term_id, department_id, name, student_count) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET term_id=$2, department_id=$3, name=$4, student_count=$5`,
        [sg.id, sg.term_id, sg.department_id || null, sg.name, sg.student_count || 0]
      );
    }
    console.log(`Inserted ${studentGroups.length} student_groups`);

    // Insert section_groups (DB table for section_group_assignments CSV)
    for (const sga of sectionGroupAssignments) {
      await client.query(
        `INSERT INTO section_groups (section_id, group_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [sga.section_id, sga.group_id]
      );
    }
    console.log(`Inserted ${sectionGroupAssignments.length} section_groups`);

    // Insert student_group_members
    for (const sgm of studentGroupMembers) {
      await client.query(
        `INSERT INTO student_group_members (group_id, student_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [sgm.group_id, sgm.student_id]
      );
    }
    console.log(`Inserted ${studentGroupMembers.length} student_group_members`);

    // Insert students
    for (const s of students) {
      await client.query(
        `INSERT INTO students (id, student_number, full_name, email, is_active, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET student_number=$2, full_name=$3, email=$4, is_active=$5, updated_at=$7`,
        [s.id, s.student_number, s.full_name, s.email, s.is_active === 'true', s.created_at, s.updated_at]
      );
    }
    console.log(`Inserted ${students.length} students`);

    // Insert student_course_registrations
    for (const scr of studentCourseRegistrations) {
      await client.query(
        `INSERT INTO student_course_registrations (id, student_id, course_id, term_id, state, registered_by, registered_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET student_id=$2, course_id=$3, term_id=$4, state=$5, registered_by=$6, registered_at=$7, updated_at=$8`,
        [scr.id, scr.student_id, scr.course_id, scr.term_id, scr.state, scr.registered_by, scr.registered_at, scr.updated_at]
      );
    }
    console.log(`Inserted ${studentCourseRegistrations.length} student_course_registrations`);

    // Insert student_section_enrollments
    for (const sse of studentSectionEnrollments) {
      await client.query(
        `INSERT INTO student_section_enrollments (id, registration_id, term_id, course_id, section_kind, section_id, state, assigned_by, assigned_at, ended_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET registration_id=$2, term_id=$3, course_id=$4, section_kind=$5, section_id=$6, state=$7, assigned_by=$8, assigned_at=$9, ended_at=$10`,
        [sse.id, sse.registration_id, sse.term_id, sse.course_id, sse.section_kind, sse.section_id, sse.state, sse.assigned_by, sse.assigned_at, sse.ended_at || null]
      );
    }
    console.log(`Inserted ${studentSectionEnrollments.length} student_section_enrollments`);

    // Insert room_closures
    for (const rc of roomClosures) {
      await client.query(
        `INSERT INTO room_closures (room_id, term_id, start_date, end_date, reason, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [rc.room_id, rc.term_id, rc.start_date, rc.end_date, rc.reason || null, rc.created_at, rc.updated_at]
      );
    }
    console.log(`Inserted ${roomClosures.length} room_closures`);

    // Insert availability_slots
    for (const av of availabilitySlots) {
      await client.query(
        `INSERT INTO availability_slots (id, term_id, instructor_id, weekday, starts_at, ends_at, preference_level, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET term_id=$2, instructor_id=$3, weekday=$4, starts_at=$5, ends_at=$6, preference_level=$7, updated_at=$9`,
        [av.id, av.term_id, av.instructor_id, av.weekday, av.starts_at, av.ends_at, av.preference_level, av.created_at, av.updated_at]
      );
    }
    console.log(`Inserted ${availabilitySlots.length} availability_slots`);

    // Insert availability_submissions
    for (const av of availabilitySubmissions) {
      await client.query(
        `INSERT INTO availability_submissions (id, term_id, instructor_id, submitted_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET term_id=$2, instructor_id=$3, submitted_at=$4, updated_at=$6`,
        [av.id, av.term_id, av.instructor_id, av.submitted_at, av.created_at, av.updated_at]
      );
    }
    console.log(`Inserted ${availabilitySubmissions.length} availability_submissions`);

    // Insert allocations
    for (const a of allocations) {
      await client.query(
        `INSERT INTO allocations (id, term_id, version_id, section_id, requirement_id, instructor_id, room_id, start_slot_id, ends_at, created_by, updated_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET term_id=$2, version_id=$3, section_id=$4, requirement_id=$5, instructor_id=$6, room_id=$7, start_slot_id=$8, ends_at=$9, created_by=$10, updated_by=$11, updated_at=$13`,
        [a.id, a.term_id, a.version_id || null, a.section_id, a.requirement_id, a.instructor_id, a.room_id, a.start_slot_id, a.ends_at, a.created_by, a.updated_by || null, a.created_at, a.updated_at]
      );
    }
    console.log(`Inserted ${allocations.length} allocations`);

    // Insert schedule_versions
    for (const sv of scheduleVersions) {
      await client.query(
        `INSERT INTO schedule_versions (id, term_id, version_number, name, state, created_by, published_by, published_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET term_id=$2, version_number=$3, name=$4, state=$5, created_by=$6, published_by=$7, published_at=$8, updated_at=$10`,
        [sv.id, sv.term_id, sv.version_number, sv.name, sv.state, sv.created_by, sv.published_by || null, sv.published_at || null, sv.created_at, sv.updated_at]
      );
    }
    console.log(`Inserted ${scheduleVersions.length} schedule_versions`);

    // Insert audit_events
    for (const ae of auditEvents) {
      await client.query(
        `INSERT INTO audit_events (id, actor_account_id, actor_email, action, entity_type, entity_id, outcome, details, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET actor_account_id=$2, actor_email=$3, action=$4, entity_type=$5, entity_id=$6, outcome=$7, details=$8, created_at=$9`,
        [ae.id, ae.actor_account_id, ae.actor_email, ae.action, ae.entity_type, ae.entity_id, ae.outcome, ae.details || null, ae.created_at]
      );
    }
    console.log(`Inserted ${auditEvents.length} audit_events`);

    // Insert term_holidays
    for (const th of termHolidays) {
      await client.query(
        `INSERT INTO term_holidays (term_id, date, name, created_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [th.term_id, th.date, th.name, th.created_at]
      );
    }
    console.log(`Inserted ${termHolidays.length} term_holidays`);
  });

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });