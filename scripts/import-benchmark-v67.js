'use strict';

/**
 * Tanseek Benchmark DB importer for backend v6.7+
 *
 * Usage (from backend root):
 *   node scripts/import-benchmark-v67.js --dry-run
 *   node scripts/import-benchmark-v67.js
 *
 * The script is idempotent for the prepared benchmark namespace:
 * - term name: Tanseek Benchmark 2027
 * - department codes: BM_*
 * - room building: Benchmark Building
 * - account emails: *@tanseek.example.test
 *
 * It NEVER truncates production tables and never assumes CSV ids are DB ids.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.TANSEEK_BENCHMARK_DATA_DIR
  ? path.resolve(process.env.TANSEEK_BENCHMARK_DATA_DIR)
  : path.join(__dirname, '..', 'benchmark_data', 'import_ready');

const DRY_RUN = process.argv.includes('--dry-run');

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((x) => x.trim());
  return rows.slice(1)
    .filter((r) => r.some((x) => String(x).trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function load(name) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) throw new Error(`Missing benchmark file: ${p}`);
  return parseCSV(fs.readFileSync(p, 'utf8'));
}

function asInt(v, nullable = false) {
  if (v === '' || v == null) return nullable ? null : 0;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`Expected integer, got: ${v}`);
  return n;
}

function asBool(v) {
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function nullable(v) {
  return v === '' || v == null ? null : v;
}

function mapGet(map, sourceId, label) {
  const key = String(sourceId);
  if (!map.has(key)) throw new Error(`Missing mapped ${label} for source id ${sourceId}`);
  return map.get(key);
}

function loadAll() {
  return {
    departments: load('departments.csv'),
    accounts: load('accounts.csv'),
    terms: load('academic_terms.csv'),
    courses: load('courses.csv'),
    requirements: load('session_requirements.csv'),
    sections: load('sections.csv'),
    studentGroups: load('student_groups.csv'),
    sectionGroups: load('section_groups.csv'),
    equipment: load('equipment.csv'),
    requiredEquipment: load('required_equipment.csv'),
    rooms: load('rooms.csv'),
    roomEquipment: load('room_equipment.csv'),
    timeSlots: load('time_slots.csv'),
    sectionInstructors: load('section_instructors.csv'),
    availabilitySubmissions: load('availability_submissions.csv'),
    availabilitySlots: load('availability_slots.csv'),
    scheduleVersions: load('schedule_versions.csv'),
    allocations: load('allocations.csv'),
  };
}

function validate(data) {
  const errors = [];
  const ids = (rows) => new Set(rows.map((x) => String(x.id)));
  const depIds = ids(data.departments);
  const accIds = ids(data.accounts);
  const termIds = ids(data.terms);
  const courseIds = ids(data.courses);
  const reqIds = ids(data.requirements);
  const sectionIds = ids(data.sections);
  const groupIds = ids(data.studentGroups);
  const equipIds = ids(data.equipment);
  const roomIds = ids(data.rooms);
  const slotIds = ids(data.timeSlots);
  const subIds = ids(data.availabilitySubmissions);
  const versionIds = ids(data.scheduleVersions);

  const check = (ok, message) => { if (!ok) errors.push(message); };

  for (const c of data.courses) {
    check(depIds.has(String(c.department_id)), `course ${c.id}: missing department ${c.department_id}`);
    check(accIds.has(String(c.created_by)), `course ${c.id}: missing creator ${c.created_by}`);
  }
  for (const r of data.requirements) {
    check(courseIds.has(String(r.course_id)), `requirement ${r.id}: missing course ${r.course_id}`);
    check(termIds.has(String(r.term_id)), `requirement ${r.id}: missing term ${r.term_id}`);
    check(accIds.has(String(r.created_by)), `requirement ${r.id}: missing creator ${r.created_by}`);
  }
  for (const s of data.sections) {
    check(courseIds.has(String(s.course_id)), `section ${s.id}: missing course ${s.course_id}`);
    check(termIds.has(String(s.term_id)), `section ${s.id}: missing term ${s.term_id}`);
    check(reqIds.has(String(s.requirement_id)), `section ${s.id}: missing requirement_id ${s.requirement_id}`);
  }
  for (const g of data.studentGroups) {
    check(depIds.has(String(g.department_id)), `group ${g.id}: missing department ${g.department_id}`);
    check(termIds.has(String(g.term_id)), `group ${g.id}: missing term ${g.term_id}`);
  }
  for (const x of data.sectionGroups) {
    check(sectionIds.has(String(x.section_id)), `section_group: missing section ${x.section_id}`);
    check(groupIds.has(String(x.group_id)), `section_group: missing group ${x.group_id}`);
  }
  for (const x of data.sectionInstructors) {
    check(sectionIds.has(String(x.section_id)), `section_instructor: missing section ${x.section_id}`);
    check(accIds.has(String(x.instructor_id)), `section_instructor: missing instructor ${x.instructor_id}`);
    check(reqIds.has(String(x.requirement_id)), `section_instructor: missing requirement ${x.requirement_id}`);
  }
  for (const x of data.requiredEquipment) {
    check(reqIds.has(String(x.requirement_id)), `required_equipment: missing requirement ${x.requirement_id}`);
    check(equipIds.has(String(x.equipment_id)), `required_equipment: missing equipment ${x.equipment_id}`);
  }
  for (const x of data.roomEquipment) {
    check(roomIds.has(String(x.room_id)), `room_equipment: missing room ${x.room_id}`);
    check(equipIds.has(String(x.equipment_id)), `room_equipment: missing equipment ${x.equipment_id}`);
  }
  for (const s of data.timeSlots) {
    check(termIds.has(String(s.term_id)), `slot ${s.id}: missing term ${s.term_id}`);
  }
  for (const s of data.availabilitySubmissions) {
    check(termIds.has(String(s.term_id)), `availability submission ${s.id}: missing term ${s.term_id}`);
    check(accIds.has(String(s.instructor_id)), `availability submission ${s.id}: missing instructor ${s.instructor_id}`);
  }
  for (const x of data.availabilitySlots) {
    check(subIds.has(String(x.submission_id)), `availability slot: missing submission ${x.submission_id}`);
    check(termIds.has(String(x.term_id)), `availability slot: missing term ${x.term_id}`);
    check(slotIds.has(String(x.slot_id)), `availability slot: missing slot ${x.slot_id}`);
  }
  for (const v of data.scheduleVersions) {
    check(termIds.has(String(v.term_id)), `schedule version ${v.id}: missing term ${v.term_id}`);
    check(accIds.has(String(v.created_by)), `schedule version ${v.id}: missing creator ${v.created_by}`);
  }
  for (const a of data.allocations) {
    check(termIds.has(String(a.term_id)), `allocation ${a.id}: missing term ${a.term_id}`);
    check(versionIds.has(String(a.version_id)), `allocation ${a.id}: missing version ${a.version_id}`);
    check(sectionIds.has(String(a.section_id)), `allocation ${a.id}: missing section ${a.section_id}`);
    check(reqIds.has(String(a.requirement_id)), `allocation ${a.id}: missing requirement ${a.requirement_id}`);
    check(accIds.has(String(a.instructor_id)), `allocation ${a.id}: missing instructor ${a.instructor_id}`);
    check(roomIds.has(String(a.room_id)), `allocation ${a.id}: missing room ${a.room_id}`);
    check(slotIds.has(String(a.start_slot_id)), `allocation ${a.id}: missing slot ${a.start_slot_id}`);
  }

  const sectionReqPairs = new Set(data.sectionInstructors.map((x) => `${x.section_id}|${x.instructor_id}|${x.requirement_id}`));
  for (const a of data.allocations) {
    check(sectionReqPairs.has(`${a.section_id}|${a.instructor_id}|${a.requirement_id}`),
      `allocation ${a.id}: no matching section_instructor triple`);
  }

  if (errors.length) {
    throw new Error(`CSV validation failed (${errors.length}):\n- ${errors.slice(0, 30).join('\n- ')}${errors.length > 30 ? '\n...' : ''}`);
  }
}

async function assertSchema(client) {
  const q = await client.query(`
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (
        (table_name='academic_terms' AND column_name='ends_on') OR
        (table_name='sections' AND column_name='requirement_id') OR
        (table_name='session_requirements' AND column_name IN ('expected_students','frontend_room_type','preferred_windows','notes')) OR
        (table_name='rooms' AND column_name IN ('frontend_type','frontend_status'))
      )
  `);
  const key = new Map(q.rows.map((r) => [`${r.table_name}.${r.column_name}`, r]));
  const required = [
    'academic_terms.ends_on',
    'sections.requirement_id',
    'session_requirements.expected_students',
    'session_requirements.frontend_room_type',
    'session_requirements.preferred_windows',
    'session_requirements.notes',
    'rooms.frontend_type',
    'rooms.frontend_status',
  ];
  const missing = required.filter((k) => !key.has(k));
  if (missing.length) {
    throw new Error(`Database is missing v6.7 schema columns: ${missing.join(', ')}. Run migrations first.`);
  }
  if (key.get('academic_terms.ends_on').is_nullable !== 'YES') {
    throw new Error('academic_terms.ends_on is still NOT NULL. Run 010_term_end_lifecycle.sql first.');
  }
}

async function importData(client, data) {
  const maps = {
    department: new Map(), account: new Map(), term: new Map(), course: new Map(),
    requirement: new Map(), section: new Map(), group: new Map(), equipment: new Map(),
    room: new Map(), slot: new Map(), submission: new Map(), version: new Map(),
  };

  for (const d of data.departments) {
    const r = await client.query(`
      INSERT INTO departments(code,name)
      VALUES($1,$2)
      ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name
      RETURNING id
    `, [d.code, d.name]);
    maps.department.set(String(d.id), r.rows[0].id);
  }

  // Accounts are benchmark-only identities and stay INVITED intentionally.
  for (const a of data.accounts) {
    const homeDepartmentId = mapGet(maps.department, a.home_department_id, 'department');
    const existing = await client.query('SELECT id FROM accounts WHERE lower(email)=lower($1)', [a.email]);
    let id;
    if (existing.rowCount) {
      id = existing.rows[0].id;
      await client.query(`
        UPDATE accounts
        SET full_name=$2, role=$3::account_role, state='INVITED', home_department_id=$4, updated_at=now()
        WHERE id=$1
      `, [id, a.full_name, a.role, homeDepartmentId]);
    } else {
      const r = await client.query(`
        INSERT INTO accounts(email,full_name,role,state,home_department_id)
        VALUES($1,$2,$3::account_role,'INVITED',$4)
        RETURNING id
      `, [a.email, a.full_name, a.role, homeDepartmentId]);
      id = r.rows[0].id;
    }
    maps.account.set(String(a.id), id);
  }

  for (const t of data.terms) {
    const existing = await client.query('SELECT id FROM academic_terms WHERE name=$1 ORDER BY id LIMIT 1', [t.name]);
    let id;
    if (existing.rowCount) {
      id = existing.rows[0].id;
      await client.query(`
        UPDATE academic_terms
        SET starts_on=$2, ends_on=NULL, state=$3::term_state, availability_deadline=$4, updated_at=now()
        WHERE id=$1
      `, [id, t.starts_on, t.state, nullable(t.availability_deadline)]);
    } else {
      const r = await client.query(`
        INSERT INTO academic_terms(name,starts_on,ends_on,state,availability_deadline)
        VALUES($1,$2,NULL,$3::term_state,$4)
        RETURNING id
      `, [t.name, t.starts_on, t.state, nullable(t.availability_deadline)]);
      id = r.rows[0].id;
    }
    maps.term.set(String(t.id), id);
  }

  for (const c of data.courses) {
    const departmentId = mapGet(maps.department, c.department_id, 'department');
    const createdBy = mapGet(maps.account, c.created_by, 'account');
    const r = await client.query(`
      INSERT INTO courses(department_id,code,title,created_by)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(department_id,code) DO UPDATE SET title=EXCLUDED.title, created_by=EXCLUDED.created_by, updated_at=now()
      RETURNING id
    `, [departmentId, c.code, c.title, createdBy]);
    maps.course.set(String(c.id), r.rows[0].id);
  }

  for (const req of data.requirements) {
    const courseId = mapGet(maps.course, req.course_id, 'course');
    const termId = mapGet(maps.term, req.term_id, 'term');
    const createdBy = mapGet(maps.account, req.created_by, 'account');
    const found = await client.query(`
      SELECT id FROM session_requirements
      WHERE course_id=$1 AND term_id=$2 AND kind=$3::session_kind
      ORDER BY id LIMIT 1
    `, [courseId, termId, req.kind]);
    let id;
    const params = [
      courseId, termId, req.kind, asInt(req.sessions_per_week), asInt(req.duration_minutes),
      nullable(req.required_room_kind), createdBy, asInt(req.expected_students, true),
      nullable(req.frontend_room_type), req.preferred_windows || '[]', nullable(req.notes),
    ];
    if (found.rowCount) {
      id = found.rows[0].id;
      await client.query(`
        UPDATE session_requirements SET
          sessions_per_week=$4,
          duration_minutes=$5,
          required_room_kind=$6::room_kind,
          created_by=$7,
          updated_by=$7,
          expected_students=$8,
          frontend_room_type=$9,
          preferred_windows=$10::jsonb,
          notes=$11,
          updated_at=now()
        WHERE id=$12
      `, [...params, id]);
    } else {
      const r = await client.query(`
        INSERT INTO session_requirements(
          course_id,term_id,kind,sessions_per_week,duration_minutes,required_room_kind,
          created_by,expected_students,frontend_room_type,preferred_windows,notes
        ) VALUES($1,$2,$3::session_kind,$4,$5,$6::room_kind,$7,$8,$9,$10::jsonb,$11)
        RETURNING id
      `, params);
      id = r.rows[0].id;
    }
    maps.requirement.set(String(req.id), id);
  }

  for (const e of data.equipment) {
    const r = await client.query(`
      INSERT INTO equipment(name) VALUES($1)
      ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name
      RETURNING id
    `, [e.name]);
    maps.equipment.set(String(e.id), r.rows[0].id);
  }

  for (const room of data.rooms) {
    const managedBy = mapGet(maps.account, room.managed_by, 'account');
    const r = await client.query(`
      INSERT INTO rooms(building,code,kind,capacity,accessible,active,managed_by,frontend_type,frontend_status)
      VALUES($1,$2,$3::room_kind,$4,$5,$6,$7,$8,'available')
      ON CONFLICT(building,code) DO UPDATE SET
        kind=EXCLUDED.kind,
        capacity=EXCLUDED.capacity,
        accessible=EXCLUDED.accessible,
        active=EXCLUDED.active,
        managed_by=EXCLUDED.managed_by,
        frontend_type=EXCLUDED.frontend_type,
        frontend_status='available',
        updated_at=now()
      RETURNING id
    `, [room.building, room.code, room.kind, asInt(room.capacity), asBool(room.accessible), asBool(room.active), managedBy, room.kind === 'LAB' ? 'Computer Lab' : 'Classroom']);
    maps.room.set(String(room.id), r.rows[0].id);
  }

  for (const x of data.requiredEquipment) {
    await client.query(`
      INSERT INTO required_equipment(requirement_id,equipment_id,quantity)
      VALUES($1,$2,$3)
      ON CONFLICT(requirement_id,equipment_id) DO UPDATE SET quantity=EXCLUDED.quantity
    `, [mapGet(maps.requirement, x.requirement_id, 'requirement'), mapGet(maps.equipment, x.equipment_id, 'equipment'), asInt(x.quantity)]);
  }

  for (const x of data.roomEquipment) {
    await client.query(`
      INSERT INTO room_equipment(room_id,equipment_id,quantity)
      VALUES($1,$2,$3)
      ON CONFLICT(room_id,equipment_id) DO UPDATE SET quantity=EXCLUDED.quantity
    `, [mapGet(maps.room, x.room_id, 'room'), mapGet(maps.equipment, x.equipment_id, 'equipment'), asInt(x.quantity)]);
  }

  for (const s of data.sections) {
    const termId = mapGet(maps.term, s.term_id, 'term');
    const courseId = mapGet(maps.course, s.course_id, 'course');
    const createdBy = mapGet(maps.account, s.created_by, 'account');
    const requirementId = mapGet(maps.requirement, s.requirement_id, 'requirement');
    const r = await client.query(`
      INSERT INTO sections(term_id,course_id,code,status,created_by,requirement_id)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(term_id,course_id,code) DO UPDATE SET
        status=EXCLUDED.status,
        created_by=EXCLUDED.created_by,
        requirement_id=EXCLUDED.requirement_id,
        updated_at=now()
      RETURNING id
    `, [termId, courseId, s.code, s.status, createdBy, requirementId]);
    maps.section.set(String(s.id), r.rows[0].id);
  }

  for (const g of data.studentGroups) {
    const termId = mapGet(maps.term, g.term_id, 'term');
    const departmentId = mapGet(maps.department, g.department_id, 'department');
    const r = await client.query(`
      INSERT INTO student_groups(term_id,department_id,name,student_count)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(term_id,department_id,name) DO UPDATE SET student_count=EXCLUDED.student_count
      RETURNING id
    `, [termId, departmentId, g.name, asInt(g.student_count)]);
    maps.group.set(String(g.id), r.rows[0].id);
  }

  for (const x of data.sectionGroups) {
    await client.query(`
      INSERT INTO section_groups(section_id,group_id) VALUES($1,$2)
      ON CONFLICT DO NOTHING
    `, [mapGet(maps.section, x.section_id, 'section'), mapGet(maps.group, x.group_id, 'group')]);
  }

  for (const x of data.sectionInstructors) {
    await client.query(`
      INSERT INTO section_instructors(section_id,instructor_id,requirement_id)
      VALUES($1,$2,$3)
      ON CONFLICT DO NOTHING
    `, [mapGet(maps.section, x.section_id, 'section'), mapGet(maps.account, x.instructor_id, 'account'), mapGet(maps.requirement, x.requirement_id, 'requirement')]);
  }

  for (const slot of data.timeSlots) {
    const termId = mapGet(maps.term, slot.term_id, 'term');
    const r = await client.query(`
      INSERT INTO time_slots(term_id,weekday,starts_at,ends_at,label)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(term_id,weekday,starts_at) DO UPDATE SET ends_at=EXCLUDED.ends_at, label=EXCLUDED.label
      RETURNING id
    `, [termId, asInt(slot.weekday), slot.starts_at, slot.ends_at, nullable(slot.label)]);
    maps.slot.set(String(slot.id), r.rows[0].id);
  }

  for (const sub of data.availabilitySubmissions) {
    const termId = mapGet(maps.term, sub.term_id, 'term');
    const instructorId = mapGet(maps.account, sub.instructor_id, 'account');
    const r = await client.query(`
      INSERT INTO availability_submissions(term_id,instructor_id,state,confirmed_at,revision)
      VALUES($1,$2,$3::availability_state,$4,$5)
      ON CONFLICT(term_id,instructor_id) DO UPDATE SET
        state=EXCLUDED.state,
        confirmed_at=EXCLUDED.confirmed_at,
        revision=EXCLUDED.revision,
        updated_at=now()
      RETURNING id
    `, [termId, instructorId, sub.state, nullable(sub.confirmed_at), asInt(sub.revision)]);
    maps.submission.set(String(sub.id), r.rows[0].id);
  }

  for (const x of data.availabilitySlots) {
    await client.query(`
      INSERT INTO availability_slots(submission_id,term_id,slot_id,kind)
      VALUES($1,$2,$3,$4::availability_kind)
      ON CONFLICT(submission_id,slot_id) DO UPDATE SET kind=EXCLUDED.kind, term_id=EXCLUDED.term_id
    `, [
      mapGet(maps.submission, x.submission_id, 'availability submission'),
      mapGet(maps.term, x.term_id, 'term'),
      mapGet(maps.slot, x.slot_id, 'slot'),
      x.kind,
    ]);
  }

  for (const v of data.scheduleVersions) {
    const termId = mapGet(maps.term, v.term_id, 'term');
    const createdBy = mapGet(maps.account, v.created_by, 'account');
    const r = await client.query(`
      INSERT INTO schedule_versions(term_id,version_number,name,state,created_by,published_by,published_at)
      VALUES($1,$2,$3,$4::schedule_state,$5,NULL,NULL)
      ON CONFLICT(term_id,version_number) DO UPDATE SET
        name=EXCLUDED.name,
        state=EXCLUDED.state,
        created_by=EXCLUDED.created_by,
        published_by=NULL,
        published_at=NULL,
        updated_at=now()
      RETURNING id
    `, [termId, asInt(v.version_number), v.name, v.state, createdBy]);
    maps.version.set(String(v.id), r.rows[0].id);
  }

  for (const a of data.allocations) {
    const params = [
      mapGet(maps.term, a.term_id, 'term'),
      mapGet(maps.version, a.version_id, 'version'),
      mapGet(maps.section, a.section_id, 'section'),
      mapGet(maps.requirement, a.requirement_id, 'requirement'),
      mapGet(maps.account, a.instructor_id, 'account'),
      mapGet(maps.room, a.room_id, 'room'),
      mapGet(maps.slot, a.start_slot_id, 'slot'),
      a.ends_at,
      mapGet(maps.account, a.created_by, 'account'),
    ];
    await client.query(`
      INSERT INTO allocations(term_id,version_id,section_id,requirement_id,instructor_id,room_id,start_slot_id,ends_at,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(version_id,section_id,requirement_id,start_slot_id) DO UPDATE SET
        instructor_id=EXCLUDED.instructor_id,
        room_id=EXCLUDED.room_id,
        ends_at=EXCLUDED.ends_at,
        updated_by=EXCLUDED.created_by,
        updated_at=now()
    `, params);
  }

  return maps;
}

async function verify(client) {
  const term = await client.query(`SELECT id,name,starts_on,ends_on,state FROM academic_terms WHERE name='Tanseek Benchmark 2027' ORDER BY id LIMIT 1`);
  if (!term.rowCount) throw new Error('Benchmark term was not found after import.');
  const termId = term.rows[0].id;
  const counts = {};
  const queries = {
    departments: `SELECT count(*)::int n FROM departments WHERE code LIKE 'BM_%'`,
    accounts: `SELECT count(*)::int n FROM accounts WHERE email LIKE '%@tanseek.example.test'`,
    courses: `SELECT count(*)::int n FROM courses c JOIN departments d ON d.id=c.department_id WHERE d.code LIKE 'BM_%'`,
    requirements: `SELECT count(*)::int n FROM session_requirements WHERE term_id=$1`,
    sections: `SELECT count(*)::int n FROM sections WHERE term_id=$1`,
    groups: `SELECT count(*)::int n FROM student_groups WHERE term_id=$1`,
    slots: `SELECT count(*)::int n FROM time_slots WHERE term_id=$1`,
    submissions: `SELECT count(*)::int n FROM availability_submissions WHERE term_id=$1`,
    availability_rows: `SELECT count(*)::int n FROM availability_slots WHERE term_id=$1`,
    versions: `SELECT count(*)::int n FROM schedule_versions WHERE term_id=$1`,
    allocations: `SELECT count(*)::int n FROM allocations WHERE term_id=$1`,
    rooms: `SELECT count(*)::int n FROM rooms WHERE building='Benchmark Building'`,
  };
  for (const [k, sql] of Object.entries(queries)) {
    const r = await client.query(sql, sql.includes('$1') ? [termId] : []);
    counts[k] = r.rows[0].n;
  }

  const unmapped = await client.query(`SELECT count(*)::int n FROM sections WHERE term_id=$1 AND requirement_id IS NULL`, [termId]);
  const expected = {
    departments: 8, accounts: 72, courses: 20, requirements: 20, sections: 100,
    groups: 200, slots: 20, submissions: 60, availability_rows: 1120,
    versions: 1, allocations: 4, rooms: 20,
  };
  const mismatches = Object.entries(expected).filter(([k, n]) => counts[k] !== n);
  if (unmapped.rows[0].n !== 0) mismatches.push(['sections_without_requirement', unmapped.rows[0].n]);

  console.log('\nImport verification');
  console.table(counts);
  console.log('Term:', term.rows[0]);
  if (mismatches.length) {
    throw new Error(`Verification mismatch: ${mismatches.map(([k, got]) => `${k}=${got}`).join(', ')}`);
  }
  console.log('✅ Benchmark import verified successfully.');
}

async function main() {
  const data = loadAll();
  validate(data);
  console.log('✅ CSV integrity checks passed.');
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Rows: ${Object.values(data).reduce((sum, rows) => sum + rows.length, 0)}`);

  if (DRY_RUN) {
    console.log('✅ Dry run complete. No database changes were made.');
    return;
  }

  const { getPool, closePool } = require('../src/db/pool');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await assertSchema(client);
    await client.query('BEGIN');
    await importData(client, data);
    await verify(client);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error('❌ Benchmark import failed:', err.message);
  process.exit(1);
});
