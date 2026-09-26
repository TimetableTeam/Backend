'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');
const { query, withTransaction } = require('../db/pool');
const { env } = require('../config/env');
const { validatePassword } = require('../utils/passwordPolicy');
const { hashPassword } = require('../utils/password');
const accountsRepo = require('../repositories/accountsRepo');
const termsRepo = require('../repositories/termsRepo');
const coursesRepo = require('../repositories/coursesRepo');
const sectionsRepo = require('../repositories/sectionsRepo');
const studentGroupsRepo = require('../repositories/studentGroupsRepo');
const timeSlotsRepo = require('../repositories/timeSlotsRepo');
const roomsRepo = require('../repositories/roomsRepo');
const equipmentRepo = require('../repositories/equipmentRepo');
const studentsRepo = require('../repositories/studentsRepo');
const availabilityRepo = require('../repositories/availabilityRepo');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const allocationsRepo = require('../repositories/allocationsRepo');
const auditRepo = require('../repositories/auditRepo');
const sessionRequirementsRepo = require('../repositories/sessionRequirementsRepo');
const authChallengesRepo = require('../repositories/authChallengesRepo');
const allocationService = require('../services/allocationService');
const recommendationService = require('../services/recommendationService');
const scheduleWorkflowService = require('../services/scheduleWorkflowService');
const scheduleService = require('../services/scheduleService');
const modelService = require('../services/modelService');
const { ROLES } = require('../middleware/authorize');
const { getAccountDepartmentIds } = require('../middleware/departmentGrants');

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const FRONTEND_ROLE_META = {
  SUPER_ADMIN: {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full university-wide system administration and audit access.',
    permissions: ['overview.view','terms.manage','departments.manage','courses.manage','sections.manage','requirements.manage','instructors.assign','section_assignments.manage','registrations.manage','availability.view','labs.check','rooms.view','rooms.manage','schedule.view','schedule.generate','schedule.manage','schedule.submit_review','schedule.review','conflicts.view','conflicts.manage','publish.manage','accounts.manage','roles.manage','audit.view'],
  },
  ADMIN: {
    id: 'admin',
    name: 'Admin',
    description: 'Reviews and adjusts the draft inside the allowed department scope, then publishes the final version.',
    permissions: ['overview.view','schedule.view','schedule.manage','schedule.review','rooms.view','conflicts.view','publish.manage'],
  },
  SCHEDULER: {
    id: 'scheduler',
    name: 'Scheduler',
    description: 'Generates the draft, resolves conflicts and submits the schedule for Admin review. Cannot publish.',
    permissions: ['overview.view','schedule.view','schedule.generate','schedule.manage','schedule.submit_review','rooms.view','conflicts.manage'],
  },
  REGISTRATION_OFFICER: {
    id: 'registration_officer',
    name: 'Registration Officer',
    description: 'Maintains student records and course registrations for the active term.',
    permissions: ['overview.view','registrations.manage'],
  },
  DEPARTMENT_COORDINATOR: {
    id: 'department_coordinator',
    name: 'Department Coordinator',
    description: 'Owns department courses, Lecture/Practical requirements, sections, instructor links and student section assignments.',
    permissions: ['overview.view','courses.manage','sections.manage','requirements.manage','instructors.assign','section_assignments.manage','schedule.view'],
  },
  LAB_MANAGER: {
    id: 'lab_manager',
    name: 'Lab Manager',
    description: 'Maintains rooms/labs, capacity, equipment, closures and requirement compatibility checks.',
    permissions: ['overview.view','rooms.manage','labs.check'],
  },
  LECTURER: {
    id: 'lecturer',
    name: 'Lecturer',
    description: 'Submits and confirms availability, then views the published teaching timetable.',
    permissions: ['overview.view','schedule.view','availability.manage_own'],
  },
  TA: {
    id: 'ta',
    name: 'TA',
    description: 'Submits and confirms availability, and views assigned practical sections and the published timetable.',
    permissions: ['overview.view','schedule.view','availability.manage_own','practical_sections.view_own'],
  },
  STUDENT: {
    id: 'student',
    name: 'Student',
    description: 'Read-only access to registered courses, assigned Lecture/Practical sections and personal published timetable.',
    permissions: ['schedule.view'],
  },
};

function frontendRoleId(dbRole) {
  return FRONTEND_ROLE_META[String(dbRole || '').toUpperCase()]?.id || String(dbRole || '').trim().toLowerCase();
}

function dbRoleFromFrontend(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const match = Object.entries(FRONTEND_ROLE_META).find(([, meta]) => meta.id === normalized);
  if (match) return match[0];
  const upper = raw.toUpperCase();
  return FRONTEND_ROLE_META[upper] ? upper : null;
}

function camelAccount(row) {
  if (!row) return null;
  const dbRole = String(row.role || '').toUpperCase();
  const roleMeta = FRONTEND_ROLE_META[dbRole];
  return {
    id: row.id,
    name: row.full_name,
    fullName: row.full_name,
    full_name: row.full_name,
    email: row.email,
    role: frontendRoleId(dbRole),
    role_code: dbRole,
    role_label: roleMeta?.name || row.role,
    permissions: roleMeta?.permissions || [],
    status: row.state,
    state: row.state,
    departmentId: row.home_department_id,
    department_id: row.home_department_id,
    homeDepartmentId: row.home_department_id,
    home_department_id: row.home_department_id,
    department_name: row.department_name || null,
    university_id: row.university_id || null,
    current_level: row.current_level || null,
    student_id: row.student_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeSessionKind(value) {
  const kind = String(value || '').trim().toUpperCase();
  if (kind === 'LAB') return 'PRACTICAL';
  if (['LECTURE', 'PRACTICAL', 'TUTORIAL'].includes(kind)) return kind;
  return 'LECTURE';
}

function normalizeTermState(value) {
  const state = String(value || 'PLANNING').trim().toUpperCase();
  if (state === 'DRAFT') return 'PLANNING';
  if (state === 'ENDED') return 'ARCHIVED';
  if (['PLANNING','COLLECTING_AVAILABILITY','READY_TO_SCHEDULE','ACTIVE','ARCHIVED'].includes(state)) return state;
  return 'PLANNING';
}

function frontendTermStatus(value) {
  const state = String(value || '').trim().toUpperCase();
  if (state === 'ACTIVE') return 'Active';
  if (state === 'ARCHIVED') return 'Ended';
  return 'Draft';
}

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function frontendTerm(row, holidays = []) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    start: dateOnly(row.starts_on),
    end: dateOnly(row.ends_on),
    status: frontendTermStatus(row.state),
    availability_deadline: dateOnly(row.availability_deadline),
    availabilityDeadline: dateOnly(row.availability_deadline),
    holidays: holidays.map((item) => dateOnly(item.holiday_date ?? item)).filter(Boolean),
  };
}

const ISO_DAY_NAMES = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};
const DAY_TO_ISO = Object.fromEntries(Object.entries(ISO_DAY_NAMES).map(([key, value]) => [value.toLowerCase(), Number(key)]));

function frontendSessionType(kind) {
  const normalized = normalizeSessionKind(kind);
  if (normalized === 'PRACTICAL') return 'Practical';
  if (normalized === 'TUTORIAL') return 'Tutorial';
  return 'Lecture';
}

function frontendRoomType(dbKind, preferredLabel = null) {
  if (preferredLabel) return String(preferredLabel);
  return String(dbKind || '').toUpperCase() === 'LAB' ? 'Computer Lab' : 'Classroom';
}

function backendRoomKind(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return null;
  return text.includes('LAB') ? 'LAB' : 'CLASSROOM';
}

function normalizeFrontendRoomStatus(value, active = true) {
  const status = String(value || '').trim().toLowerCase();
  if (['available', 'pending', 'conflict'].includes(status)) return status;
  return active ? 'available' : 'pending';
}

function frontendRoomTypeFromRow(room) {
  if (room?.frontend_type) return String(room.frontend_type);
  return String(room?.kind || '').toUpperCase() === 'LAB' ? 'Computer Lab' : 'Classroom';
}

function roomEquipmentDisplay(item) {
  const quantity = Number(item?.quantity || 1);
  const name = String(item?.name || '').trim();
  if (!name) return '';
  return quantity > 1 ? `${quantity} ${name}` : name;
}

async function getFrontendRooms({ onlyLabs = false } = {}) {
  await ensureCompatTables();
  const rooms = await roomsRepo.listAll();
  const equipmentByRoom = await roomsRepo.getEquipmentForRooms(rooms.map((r) => r.id));
  const closureRows = rooms.length ? await query(
    `SELECT DISTINCT ON (room_id) room_id, reason
       FROM room_closures
      WHERE room_id = ANY($1::bigint[])
        AND starts_at <= now()
        AND ends_at > now()
      ORDER BY room_id, starts_at DESC`,
    [rooms.map((r) => r.id)]
  ) : { rows: [] };
  const activeClosure = new Map(closureRows.rows.map((row) => [Number(row.room_id), row.reason]));

  const mapped = rooms.map((room) => {
    const closure = room.closure_note || activeClosure.get(Number(room.id)) || '';
    const status = closure ? 'conflict' : normalizeFrontendRoomStatus(room.frontend_status, room.active);
    return {
      id: room.id,
      name: room.code,
      code: room.code,
      building: room.building,
      type: frontendRoomTypeFromRow(room),
      kind: room.kind,
      capacity: Number(room.capacity || 0),
      equipment: (equipmentByRoom.get(room.id) || []).map(roomEquipmentDisplay).filter(Boolean),
      accessibility: Boolean(room.accessible),
      accessible: Boolean(room.accessible),
      status,
      active: Boolean(room.active),
      closure,
      updated_at: room.updated_at,
    };
  });
  return onlyLabs ? mapped.filter((room) => String(room.type).toLowerCase().includes('lab')) : mapped;
}

async function syncFrontendRoomEquipment(roomId, rawItems) {
  if (!Array.isArray(rawItems)) return;
  await query(`DELETE FROM room_equipment WHERE room_id=$1`, [roomId]);
  for (const raw of rawItems) {
    let equipmentId = null;
    let quantity = 1;
    if (raw && typeof raw === 'object') {
      equipmentId = num(raw.equipmentId ?? raw.equipment_id ?? raw.id);
      quantity = num(raw.quantity, 1);
      if (!equipmentId && raw.name) {
        const eq = await equipmentRepo.findOrCreateByName(String(raw.name).trim());
        equipmentId = Number(eq.id);
      }
    } else {
      const text = String(raw || '').trim();
      if (!text) continue;
      const match = text.match(/^(\d+)\s*(?:x|×)?\s+(.+)$/i);
      const name = match ? match[2].trim() : text;
      quantity = match ? Number(match[1]) : 1;
      const eq = await equipmentRepo.findOrCreateByName(name);
      equipmentId = Number(eq.id);
    }
    if (!equipmentId) continue;
    await query(
      `INSERT INTO room_equipment(room_id,equipment_id,quantity)
       VALUES($1,$2,$3)
       ON CONFLICT(room_id,equipment_id) DO UPDATE SET quantity=EXCLUDED.quantity`,
      [roomId, equipmentId, Math.max(1, quantity || 1)]
    );
  }
}

async function resolveFrontendTermId(value) {
  const requested = num(value);
  const active = await getActiveTermId();
  // The frozen frontend uses term_id=1 as a logical "current term" placeholder.
  if (!requested || requested === 1) return active || requested;
  return requested;
}

function requirementState(item) {
  const complete = Boolean(
    item?.course_id &&
    item?.kind &&
    Number(item?.sessions_per_week) > 0 &&
    Number(item?.duration_minutes) > 0 &&
    Number(item?.expected_students || 0) > 0 &&
    item?.required_room_kind
  );
  return complete ? 'READY' : 'INCOMPLETE';
}

async function mapRequirementForFrontend(row) {
  const equipmentRows = await sessionRequirementsRepo.getRequiredEquipment(row.id);
  const requiredEquipment = equipmentRows.map((item) => Number(item.equipment_id));
  const equipmentRequirements = equipmentRows.map((item) => ({
    equipmentId: Number(item.equipment_id),
    equipment_id: Number(item.equipment_id),
    name: item.name,
    quantity: Number(item.quantity || 1),
  }));
  const preferredWindows = Array.isArray(row.preferred_windows) ? row.preferred_windows : [];
  const expectedStudents = Number(row.expected_students || 0);
  const roomType = frontendRoomType(row.required_room_kind, row.frontend_room_type);
  return {
    ...row,
    courseId: row.course_id,
    termId: row.term_id,
    component: row.kind,
    session_type: frontendSessionType(row.kind),
    sessionsPerWeek: row.sessions_per_week,
    weekly_count: row.sessions_per_week,
    durationMinutes: row.duration_minutes,
    duration_minutes: row.duration_minutes,
    expectedStudents,
    expected_students: expectedStudents,
    roomKind: row.required_room_kind,
    required_room_type: roomType,
    requiredEquipment,
    required_equipment: requiredEquipment,
    equipmentRequirements,
    preferredWindowNote: row.preferred_window_note,
    preferred_windows: preferredWindows,
    notes: row.notes || row.preferred_window_note || '',
    state: requirementState(row),
  };
}


async function resolveDepartmentId(req, explicitValue = null) {
  // The frozen frontend sends courses with a human-readable `department`
  // field, while the normalized backend stores department_id. Accept both.
  const direct = num(
    req.body?.departmentId ?? req.body?.department_id ??
    (explicitValue !== null && /^\d+$/.test(String(explicitValue).trim()) ? explicitValue : null)
  );
  if (direct) return direct;

  // Prefer the authenticated account scope. Read it from the database as a
  // fallback because older JWTs may not contain homeDepartmentId.
  if (req.user?.homeDepartmentId) return Number(req.user.homeDepartmentId);
  if (req.user?.id) {
    const account = await accountsRepo.findById(req.user.id);
    if (account?.home_department_id) return Number(account.home_department_id);
  }

  const label = String(
    explicitValue ?? req.body?.department ?? req.body?.departmentName ?? req.body?.department_code ?? ''
  ).trim();
  if (label) {
    const found = await query(
      `SELECT id FROM departments WHERE lower(name)=lower($1) OR lower(code)=lower($1) LIMIT 1`,
      [label]
    );
    if (found.rows[0]?.id) return Number(found.rows[0].id);
  }
  return null;
}

async function getActiveTerm() {
  return termsRepo.findCurrent();
}

async function getActiveTermId() {
  return (await getActiveTerm())?.id || null;
}

const DEFAULT_TERM_DAYS = [6, 7, 1, 2, 3]; // Saturday -> Wednesday
const DEFAULT_TERM_SLOTS = [
  ['09:00', '11:00'],
  ['11:00', '13:00'],
  ['13:00', '15:00'],
  ['15:00', '17:00'],
];

async function ensureDefaultTermSlots(db, termId) {
  const existing = await db.query(`SELECT 1 FROM time_slots WHERE term_id=$1 LIMIT 1`, [termId]);
  if (existing.rows.length) return;
  for (const weekday of DEFAULT_TERM_DAYS) {
    for (const [start, end] of DEFAULT_TERM_SLOTS) {
      await db.query(
        `INSERT INTO time_slots(term_id,weekday,starts_at,ends_at,label)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(term_id,weekday,starts_at) DO NOTHING`,
        [termId, weekday, start, end, `${start}-${end}`]
      );
    }
  }
}

async function replaceTermHolidays(db, termId, holidays = []) {
  await db.query(`DELETE FROM term_holidays WHERE term_id=$1`, [termId]);
  for (const holiday of holidays) {
    const holidayDate = dateOnly(typeof holiday === 'object' ? holiday.date ?? holiday.holiday_date : holiday);
    if (!holidayDate) continue;
    const reason = typeof holiday === 'object' ? (holiday.reason || null) : null;
    await db.query(
      `INSERT INTO term_holidays(term_id,holiday_date,reason) VALUES($1,$2,$3) ON CONFLICT(term_id,holiday_date) DO UPDATE SET reason=EXCLUDED.reason`,
      [termId, holidayDate, reason]
    );
  }
}

async function deactivateOtherTerms(db, termId) {
  await db.query(
    `UPDATE academic_terms SET state='PLANNING', updated_at=now() WHERE id<>$1 AND state='ACTIVE'`,
    [termId]
  );
}

function validateTermDates(start, availabilityDeadline) {
  if (!start) throw ApiError.badRequest('name and start are required.');
  if (availabilityDeadline && String(dateOnly(availabilityDeadline)) >= String(dateOnly(start))) {
    throw ApiError.badRequest('Availability deadline must be before the term start date.');
  }
}

async function resolveDraft(draftId, termIdQuery) {
  if (/^\d+$/.test(String(draftId))) {
    const byId = await scheduleVersionsRepo.findById(Number(draftId));
    if (byId) return byId;
  }

  const rawDraftId = String(draftId);
  const frozenAlias = /^draft-v\d+$/i.test(rawDraftId);
  const match = /^v(?:ersion)?-?(\d+)$/i.exec(rawDraftId);
  const termId = termIdQuery ? Number(termIdQuery) : await getActiveTermId();
  // Explicit version references (v3/version-3) resolve literally. The frozen
  // frontend's hard-coded draft-v3 is intentionally a logical alias instead.
  if (!frozenAlias && match && termId) {
    const version = await scheduleVersionsRepo.findByTermAndVersionNumber(termId, Number(match[1]));
    if (version) return version;
  }

  // The frozen frontend uses a stable slug (draft-v3). Always bind it to the
  // latest real DRAFT so later versions are never accidentally edited as v3.
  if (termId) {
    const latest = await query(
      `SELECT * FROM schedule_versions WHERE term_id=$1 AND state='DRAFT' ORDER BY version_number DESC LIMIT 1`,
      [termId]
    );
    if (latest.rows[0]) return latest.rows[0];
  }
  return null;
}

async function ensureCompatTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS frontend_custom_roles (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name varchar(120) NOT NULL UNIQUE,
      description text,
      permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lab_checks (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      requirement_id bigint NOT NULL REFERENCES session_requirements(id) ON DELETE CASCADE,
      room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
      status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED')),
      notes text,
      checks jsonb NOT NULL DEFAULT '{}'::jsonb,
      checked_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
      checked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(requirement_id, room_id)
    )
  `);

  await query(`ALTER TABLE student_course_registrations ADD COLUMN IF NOT EXISTS registration_type varchar(20) NOT NULL DEFAULT 'NORMAL'`);
  await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frontend_type text`);
  await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frontend_status varchar(20) NOT NULL DEFAULT 'available'`);
  await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS closure_note text`);
}

// ---------------------------------------------------------------------------
// Auth/profile compatibility
// ---------------------------------------------------------------------------


const getMyProfile = asyncHandler(async (req, res) => {
  const account = await accountsRepo.findPublicById(req.user.id);
  if (!account) throw ApiError.notFound('Account not found.');
  return ok(res, camelAccount(account));
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const name = String(req.body.name ?? req.body.fullName ?? req.body.full_name ?? '').trim();
  if (!name) throw ApiError.badRequest('Name is required.');
  const result = await query(
    `UPDATE accounts SET full_name = $2, updated_at = now() WHERE id = $1 RETURNING id,email,full_name,role,state,home_department_id,created_at,updated_at,last_login_at`,
    [req.user.id, name]
  );
  if (!result.rows[0]) throw ApiError.notFound('Account not found.');
  return ok(res, camelAccount(result.rows[0]));
});

const changeMyPassword = asyncHandler(async (req, res) => {
  const currentPassword = req.body.currentPassword ?? req.body.current_password;
  const newPassword = req.body.newPassword ?? req.body.new_password;
  if (!currentPassword || !newPassword) throw ApiError.badRequest('Current password and new password are required.');

  const account = await accountsRepo.findById(req.user.id);
  if (!account?.password_hash || !(await bcrypt.compare(currentPassword, account.password_hash))) {
    throw ApiError.unauthorized('Current password is incorrect.');
  }
  const policy = validatePassword(newPassword);
  if (!policy.valid) throw ApiError.badRequest(policy.errors.join(', '));
  await accountsRepo.updatePassword(req.user.id, await hashPassword(newPassword));
  return ok(res, { message: 'Password changed successfully.' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  if (!email) throw ApiError.badRequest('Email is required.');
  const generic = { message: 'If the email exists, a reset code has been sent.' };
  const account = await accountsRepo.findByEmail(email);
  if (!account) return ok(res, generic);

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const challenge = await authChallengesRepo.createChallenge({
    accountId: account.id,
    purpose: 'PASSWORD_RESET',
    codeHash: sha256(code),
    expiresAt,
  });

  // Queue the reset code for any mail worker the deployment already uses.
  try {
    await query(
      `INSERT INTO email_queue (to_email, subject, body_text) VALUES ($1,$2,$3)`,
      [account.email, 'Tanseek password reset code', `Your Tanseek password reset code is ${code}. It expires in 10 minutes.`]
    );
  } catch (_) {
    // Older databases may not have the optional queue migration; the challenge still works.
  }

  const data = { ...generic, challengeId: challenge.id, expiresInSeconds: 600 };
  if (env.DEV_EXPOSE_OTP) data.devCode = code;
  return ok(res, data);
});

const resetPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const challengeId = req.body.challengeId ?? req.body.challenge_id;
  const code = String(req.body.code || '');
  const newPassword = req.body.newPassword ?? req.body.new_password;
  if (!email || !challengeId || !code || !newPassword) {
    throw ApiError.badRequest('email, challengeId, code and newPassword are required.');
  }

  const policy = validatePassword(newPassword);
  if (!policy.valid) throw ApiError.badRequest(policy.errors.join(', '));
  const account = await accountsRepo.findByEmail(email);
  const challenge = await authChallengesRepo.findPendingChallenge(challengeId);
  if (!account || !challenge || String(challenge.account_id) !== String(account.id) || challenge.purpose !== 'PASSWORD_RESET') {
    throw ApiError.badRequest('Invalid or expired reset code.');
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await authChallengesRepo.markChallengeExpired(challenge.id);
    throw ApiError.badRequest('Invalid or expired reset code.');
  }
  if (challenge.failed_attempts >= 5) throw ApiError.badRequest('Too many incorrect attempts.');
  if (sha256(code) !== challenge.code_hash) {
    await authChallengesRepo.incrementFailedAttempts(challenge.id);
    throw ApiError.badRequest('Incorrect reset code.');
  }

  await withTransaction(async (client) => {
    const passwordHash = await hashPassword(newPassword);
    await client.query(`UPDATE accounts SET password_hash=$2, state='ACTIVE', updated_at=now() WHERE id=$1`, [account.id, passwordHash]);
    await client.query(`UPDATE auth_challenges SET state='USED', consumed_at=now() WHERE id=$1`, [challenge.id]);
  });
  return ok(res, { message: 'Password has been reset successfully.' });
});

// ---------------------------------------------------------------------------
// Overview / audit
// ---------------------------------------------------------------------------

const overview = asyncHandler(async (req, res) => {
  const term = await getActiveTerm();
  const termId = term?.id || null;
  const [accounts, deptCount, roomStats, versions, publishedSessions, audit] = await Promise.all([
    query(`SELECT count(*)::int AS count FROM accounts WHERE state <> 'DISABLED'`),
    query(`SELECT count(*)::int AS count FROM departments`),
    query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE kind='LAB')::int AS labs, count(*) FILTER (WHERE active)::int AS available FROM rooms`),
    termId ? query(`SELECT state, count(*)::int AS count FROM schedule_versions WHERE term_id=$1 GROUP BY state`, [termId]) : Promise.resolve({ rows: [] }),
    termId ? query(`SELECT count(*)::int AS count FROM allocations a JOIN schedule_versions v ON v.id=a.version_id WHERE v.term_id=$1 AND v.state='PUBLISHED'`, [termId]) : Promise.resolve({ rows: [{ count: 0 }] }),
    query(`SELECT id,action,entity_type,entity_id,outcome,occurred_at FROM audit_events ORDER BY occurred_at DESC LIMIT 8`),
  ]);

  const stateCount = Object.fromEntries(versions.rows.map((r) => [String(r.state).toUpperCase(), r.count]));
  return ok(res, {
    currentTerm: term ? { id: term.id, name: term.name, status: frontendTermStatus(term.state), start: dateOnly(term.starts_on), end: dateOnly(term.ends_on) } : null,
    activeAccounts: accounts.rows[0]?.count || 0,
    departments: deptCount.rows[0]?.count || 0,
    rooms: roomStats.rows[0]?.total || 0,
    labs: roomStats.rows[0]?.labs || 0,
    availableLabs: roomStats.rows[0]?.available || 0,
    draftVersions: stateCount.DRAFT || 0,
    publishedVersions: stateCount.PUBLISHED || 0,
    publishedSessions: publishedSessions.rows[0]?.count || 0,
    recentActivity: audit.rows,
    role: req.user.role,
    scope: { departmentId: req.user.homeDepartmentId ?? null },
  });
});

const auditLog = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(num(req.query.limit, 100), 1), 500);
  const rows = await auditRepo.listRecent(limit);
  return ok(res, rows);
});

// ---------------------------------------------------------------------------
// Departments / master data / catalog
// ---------------------------------------------------------------------------


const getDepartmentsCompat = asyncHandler(async (req, res) => {
  const rows = await query(`SELECT id,code,name,created_at FROM departments ORDER BY name`);
  return ok(res, { departments: rows.rows.map(r => ({ ...r, active: true })) });
});

const createDepartment = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  if (!code || !name) throw ApiError.badRequest('Department code and name are required.');
  const result = await query(`INSERT INTO departments(code,name) VALUES($1,$2) RETURNING id,code,name,created_at`, [code, name]);
  return created(res, { ...result.rows[0], active: true });
});

const updateDepartment = asyncHandler(async (req, res) => {
  const id = num(req.params.id);
  const existing = await query(`SELECT * FROM departments WHERE id=$1`, [id]);
  if (!existing.rows[0]) throw ApiError.notFound('Department not found.');
  const code = String(req.body.code ?? existing.rows[0].code).trim().toUpperCase();
  const name = String(req.body.name ?? existing.rows[0].name).trim();
  const result = await query(`UPDATE departments SET code=$2,name=$3 WHERE id=$1 RETURNING id,code,name,created_at`, [id, code, name]);
  return ok(res, { ...result.rows[0], active: req.body.active !== false });
});

const deleteDepartment = asyncHandler(async (req, res) => {
  const result = await query(`DELETE FROM departments WHERE id=$1 RETURNING id`, [num(req.params.id)]);
  if (!result.rows[0]) throw ApiError.notFound('Department not found.');
  return res.status(204).send();
});

async function mapMasterRecords(type) {
  const termId = await getActiveTermId();
  if (type === 'terms') {
    const rows = await termsRepo.listAll();
    const holidays = await Promise.all(rows.map((r) => termsRepo.getHolidays(r.id)));
    return rows.map((r, index) => frontendTerm(r, holidays[index]));
  }
  if (type === 'courses') {
    const rows = await coursesRepo.listAll();
    return rows.map((r) => ({ id: r.id, code: r.code, name: r.title, title: r.title, department: r.department_name, department_id: r.department_id, departmentId: r.department_id, contact_hours: 3 }));
  }
  if (type === 'sections') {
    if (!termId) return [];
    const rows = await sectionsRepo.listByTerm(termId);
    const groups = await Promise.all(rows.map((r) => sectionsRepo.getGroupsForSection(r.id)));
    return rows.map((r, i) => ({
      id: r.id, code: r.code, term_id: r.term_id, course_id: r.course_id,
      student_group_id: groups[i][0]?.id || '', size: groups[i][0]?.student_count || 0,
      status: r.status,
    }));
  }
  if (type === 'slots') {
    if (!termId) return [];
    const slots = await timeSlotsRepo.listByTerm(termId);
    const seen = new Set();
    return slots.filter((s) => {
      const k = `${String(s.starts_at).slice(0,5)}-${String(s.ends_at).slice(0,5)}`;
      if (seen.has(k)) return false; seen.add(k); return true;
    }).map((s) => ({ id: s.id, start: String(s.starts_at).slice(0,5), end: String(s.ends_at).slice(0,5), label: s.label }));
  }
  throw ApiError.notFound('Unknown master-data type.');
}

const getMasterData = asyncHandler(async (req, res) => ok(res, { records: await mapMasterRecords(req.params.type) }));

const createMasterData = asyncHandler(async (req, res) => {
  const type = req.params.type;
  if (type === 'terms') {
    const name = String(req.body.name || '').trim();
    const start = req.body.start ?? req.body.startDate ?? req.body.starts_on;
    const availabilityDeadline = req.body.availability_deadline ?? req.body.availabilityDeadline ?? null;
    const state = normalizeTermState(req.body.status);
    if (!name || !start) throw ApiError.badRequest('name and start are required.');
    validateTermDates(start, availabilityDeadline);

    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO academic_terms(name,starts_on,ends_on,state,availability_deadline,created_by)
         VALUES($1,$2,NULL,$3,$4,$5) RETURNING *`,
        [name, start, state, availabilityDeadline || null, req.user.id]
      );
      const term = inserted.rows[0];
      if (state === 'ACTIVE') await deactivateOtherTerms(client, term.id);
      await ensureDefaultTermSlots(client, term.id);
      await replaceTermHolidays(client, term.id, req.body.holidays || []);
      return term;
    });
    const holidays = await termsRepo.getHolidays(result.id);
    return created(res, frontendTerm(result, holidays));
  }
  if (type === 'courses') {
    const departmentLabel = req.body.department ?? req.body.departmentName ?? req.body.department_code ?? null;
    const departmentId = await resolveDepartmentId(req, departmentLabel);
    const title = String(req.body.name ?? req.body.title ?? '').trim();
    const code = String(req.body.code ?? '').trim().toUpperCase();
    if (!departmentId || !code || !title) {
      throw ApiError.badRequest('Department, code and name are required. Use an existing department name/code or a department-scoped Coordinator account.');
    }
    const r = await coursesRepo.createCourse({ departmentId, code, title, createdBy: req.user.id });
    const department = (await query(`SELECT code,name FROM departments WHERE id=$1`, [departmentId])).rows[0];
    return created(res, {
      id:r.id, code:r.code, name:r.title, title:r.title,
      department_id:r.department_id, departmentId:r.department_id,
      department:department?.name || department?.code || departmentLabel || '',
      contact_hours:num(req.body.contact_hours, 3)
    });
  }
  if (type === 'sections') {
    const termId = num(req.body.termId ?? req.body.term_id) || await getActiveTermId();
    const courseId = num(req.body.courseId ?? req.body.course_id);
    if (!termId || !courseId || !req.body.code) throw ApiError.badRequest('termId, courseId and code are required.');
    const section = await sectionsRepo.createSection({ termId, courseId, code: String(req.body.code).toUpperCase(), createdBy: req.user.id });
    const groupId = num(req.body.student_group_id ?? req.body.studentGroupId);
    if (groupId) await query(`INSERT INTO section_groups(section_id,group_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [section.id, groupId]);
    return created(res, { ...section, student_group_id: groupId || '', size: num(req.body.size, 0) });
  }
  throw ApiError.badRequest(`Creating ${type} through master-data is not supported.`);
});

const updateMasterData = asyncHandler(async (req, res) => {
  const type = req.params.type;
  const id = num(req.params.id);
  if (type === 'terms') {
    const current = (await query(`SELECT * FROM academic_terms WHERE id=$1`, [id])).rows[0];
    if (!current) throw ApiError.notFound('Term not found.');
    if (String(current.state).toUpperCase() === 'ARCHIVED') throw ApiError.conflict('Ended terms are read-only.');
    const state = normalizeTermState(req.body.status ?? current.state);
    const start = req.body.start ?? current.starts_on;
    const availabilityDeadline = req.body.availability_deadline ?? req.body.availabilityDeadline ?? current.availability_deadline;
    validateTermDates(start, availabilityDeadline);

    const r = await withTransaction(async (client) => {
      if (state === 'ACTIVE') await deactivateOtherTerms(client, id);
      const updated = await client.query(
        `UPDATE academic_terms
            SET name=$2,starts_on=$3,state=$4,availability_deadline=$5,updated_at=now()
          WHERE id=$1 RETURNING *`,
        [id, req.body.name ?? current.name, start, state, availabilityDeadline || null]
      );
      await ensureDefaultTermSlots(client, id);
      if (Array.isArray(req.body.holidays)) await replaceTermHolidays(client, id, req.body.holidays);
      return updated.rows[0];
    });
    const holidays = await termsRepo.getHolidays(id);
    return ok(res, frontendTerm(r, holidays));
  }
  if (type === 'courses') {
    const current = await coursesRepo.findById(id); if (!current) throw ApiError.notFound('Course not found.');
    const requestedDepartment = req.body.department ?? req.body.departmentName ?? req.body.department_code ?? null;
    const resolvedDepartmentId = (req.body.departmentId !== undefined || req.body.department_id !== undefined || requestedDepartment)
      ? await resolveDepartmentId(req, requestedDepartment)
      : current.department_id;
    if (!resolvedDepartmentId) throw ApiError.badRequest('Department could not be resolved.');
    const r = (await query(`UPDATE courses SET code=$2,title=$3,department_id=$4,updated_at=now() WHERE id=$1 RETURNING *`, [id, req.body.code ?? current.code, req.body.name ?? req.body.title ?? current.title, resolvedDepartmentId])).rows[0];
    const department = (await query(`SELECT code,name FROM departments WHERE id=$1`, [r.department_id])).rows[0];
    return ok(res,{id:r.id,code:r.code,name:r.title,title:r.title,department_id:r.department_id,departmentId:r.department_id,department:department?.name || department?.code || '',contact_hours:num(req.body.contact_hours,3)});
  }
  if (type === 'sections') {
    const current = await sectionsRepo.findById(id); if (!current) throw ApiError.notFound('Section not found.');
    const r = (await query(`UPDATE sections SET code=$2,course_id=$3,updated_at=now() WHERE id=$1 RETURNING *`, [id, req.body.code ?? current.code, num(req.body.course_id ?? req.body.courseId, current.course_id)])).rows[0];
    const groupId = num(req.body.student_group_id ?? req.body.studentGroupId);
    if (groupId) {
      await query(`DELETE FROM section_groups WHERE section_id=$1`, [id]);
      await query(`INSERT INTO section_groups(section_id,group_id) VALUES($1,$2)`, [id, groupId]);
    }
    return ok(res,{...r,student_group_id:groupId || '',size:num(req.body.size,0)});
  }
  throw ApiError.badRequest(`Updating ${type} through master-data is not supported.`);
});

const endAcademicTerm = asyncHandler(async (req, res) => {
  const id = num(req.params.id);
  const current = await termsRepo.findById(id);
  if (!current) throw ApiError.notFound('Term not found.');
  if (String(current.state).toUpperCase() === 'ARCHIVED') throw ApiError.conflict('This term has already ended.');
  if (String(current.state).toUpperCase() !== 'ACTIVE') throw ApiError.conflict('Only the active term can be ended.');

  const today = (await query(`SELECT (now() AT TIME ZONE 'Africa/Cairo')::date AS today`)).rows[0]?.today;
  if (dateOnly(current.starts_on) > dateOnly(today)) throw ApiError.conflict('A term cannot end before its start date.');
  const r = (await query(
    `UPDATE academic_terms SET ends_on=(now() AT TIME ZONE 'Africa/Cairo')::date,state='ARCHIVED',updated_at=now() WHERE id=$1 RETURNING *`,
    [id]
  )).rows[0];
  const holidays = await termsRepo.getHolidays(id);
  return ok(res, frontendTerm(r, holidays));
});

const deleteMasterData = asyncHandler(async (req, res) => {
  const table = { terms:'academic_terms', courses:'courses', sections:'sections' }[req.params.type];
  if (!table) throw ApiError.badRequest('This master-data type cannot be deleted.');
  const result = await query(`DELETE FROM ${table} WHERE id=$1 RETURNING id`, [num(req.params.id)]);
  if (!result.rows[0]) throw ApiError.notFound('Record not found.');
  return res.status(204).send();
});

const planningCatalog = asyncHandler(async (req, res) => {
  const term = await getActiveTerm();
  const termId = num(req.query.term_id ?? req.query.termId) || term?.id || null;
  const [courses, groups, sections, staff, rooms, departments, rawSlots, equipment] = await Promise.all([
    coursesRepo.listAll(),
    termId ? studentGroupsRepo.listByTerm(termId) : [],
    termId ? sectionsRepo.listByTerm(termId) : [],
    accountsRepo.listStaff(),
    roomsRepo.listAll(),
    query(`SELECT id,code,name FROM departments ORDER BY name`).then((r)=>r.rows),
    termId ? timeSlotsRepo.listByTerm(termId) : [],
    equipmentRepo.listAll(),
  ]);

  // The frozen React frontend expects a reusable list of day names and four
  // generic slot templates (s1..sN), not one DB row per weekday. Keep the real
  // DB slot IDs internal and resolve day + template on availability writes.
  const dayNumbers = [...new Set(rawSlots.map((slot) => Number(slot.weekday)))];
  const days = dayNumbers.length
    ? dayNumbers.map((day) => ISO_DAY_NAMES[day]).filter(Boolean)
    : ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];

  const slotTemplates = [];
  const seenTimes = new Set();
  for (const slot of rawSlots) {
    const start = String(slot.starts_at).slice(0,5);
    const end = String(slot.ends_at).slice(0,5);
    const key = `${start}-${end}`;
    if (seenTimes.has(key)) continue;
    seenTimes.add(key);
    slotTemplates.push({ start, end, label: slot.label || `${start}-${end}` });
  }
  slotTemplates.sort((a,b)=>a.start.localeCompare(b.start));
  const slots = slotTemplates.map((slot,index)=>({ id:`s${index+1}`, ...slot }));

  const sectionGroups = termId ? await sectionsRepo.getGroupsForSections(sections.map((section)=>section.id)) : new Map();
  const requirementRows = termId ? await sessionRequirementsRepo.listByTerm(termId) : [];
  const requirementById = new Map(requirementRows.map((item)=>[Number(item.id), item]));

  return ok(res, {
    term: term ? {
      id: term.id,
      name: term.name,
      status: frontendTermStatus(term.state),
      start: dateOnly(term.starts_on),
      end: dateOnly(term.ends_on),
    } : null,
    termId,
    courses: courses.map(c=>({
      id:c.id,
      code:c.code,
      name:c.title,
      title:c.title,
      departmentId:c.department_id,
      department_id:c.department_id,
      department:c.department_name,
      department_name:c.department_name,
    })),
    studentGroups: groups.map(g=>({
      id:g.id,
      name:g.name,
      size:g.student_count,
      student_count:g.student_count,
      departmentId:g.department_id,
      department_id:g.department_id,
      level:g.level ?? null,
    })),
    sections: sections.map(s=>{
      const requirement = requirementById.get(Number(s.requirement_id));
      const group = (sectionGroups.get(s.id) || [])[0] || null;
      const component = requirement?.kind || (/[-_](?:P|PR|LAB)\d*$/i.test(String(s.code)) ? 'PRACTICAL' : 'LECTURE');
      return {
        id:s.id,
        code:s.code,
        course_id:s.course_id,
        courseId:s.course_id,
        component,
        name:`${s.course_title || s.course_code || s.code} · ${frontendSessionType(component)}`,
        size:group?.student_count || 0,
        student_group_id:group?.id || '',
        status:s.status,
      };
    }),
    staff: staff.map(camelAccount),
    rooms,
    departments: departments.map((d)=>({...d, active:true})),
    equipment: equipment.map((item)=>({ id:Number(item.id), label:item.name, name:item.name })),
    roomTypes: ['Classroom', 'Computer Lab', 'Graphics Lab'],
    sessionTypes: ['Lecture', 'Practical'],
    days,
    slots,
  });
});

// ---------------------------------------------------------------------------
// Requirements / instructors
// ---------------------------------------------------------------------------


const getRequirements = asyncHandler(async (req, res) => {
  const termId = num(req.query.termId ?? req.query.term_id) || await getActiveTermId();
  if (!termId) return ok(res, []);
  const courseId = num(req.query.courseId ?? req.query.course_id);
  const rows = await sessionRequirementsRepo.listByTerm(termId, { courseId: courseId || undefined });
  return ok(res, await Promise.all(rows.map(mapRequirementForFrontend)));
});

const getInstructorAssignments = asyncHandler(async (req, res) => {
  const termId = num(req.query.termId ?? req.query.term_id) || await getActiveTermId();
  if (!termId) return ok(res, { assignments: [], staff: [] });

  let rows = await sectionsRepo.listInstructorAssignmentsByTerm(termId, {
    instructorId: num(req.query.instructorId ?? req.query.instructor_id) || undefined,
    courseId: num(req.query.courseId ?? req.query.course_id) || undefined,
  });
  let staff = await accountsRepo.listStaff();

  if (req.user.role === ROLES.DEPARTMENT_COORDINATOR) {
    const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
    rows = rows.filter(r => allowedDeptIds.includes(Number(r.department_id)));
    staff = staff.filter(person => allowedDeptIds.includes(Number(person.home_department_id)));
  }

  const assignments = rows.map(r => ({
    id: `${r.section_id}:${r.instructor_id}:${r.requirement_id}`,
    section_id: r.section_id,
    staff_id: r.instructor_id,
    staff_name: r.instructor_name,
    staff_role: String(r.instructor_role || '').toUpperCase(),
    requirement_id: r.requirement_id,
    sectionId: r.section_id,
    staffId: r.instructor_id,
    instructorId: r.instructor_id,
    instructorName: r.instructor_name,
    requirementId: r.requirement_id,
    sectionCode: r.section_code,
    courseId: r.course_id,
    courseCode: r.course_code,
    courseName: r.course_title,
    departmentId: r.department_id,
    component: r.requirement_kind,
  }));

  return ok(res, {
    assignments,
    staff: staff.map(camelAccount),
  });
});

const getRoomsCompat = asyncHandler(async (req, res) => {
  const rooms = await getFrontendRooms();
  return ok(res, { rooms });
});

const createRequirement = asyncHandler(async (req, res) => {
  const courseId = num(req.body.courseId ?? req.body.course_id);
  const termId = num(req.body.termId ?? req.body.term_id) || await getActiveTermId();
  const kind = normalizeSessionKind(req.body.session_type ?? req.body.component ?? req.body.kind);
  if (!courseId || !termId) throw ApiError.badRequest('courseId and termId are required.');

  const frontendRoomLabel = req.body.required_room_type ?? req.body.roomType ?? req.body.roomKind ?? req.body.required_room_kind ?? null;
  const requiredRoomKind = backendRoomKind(frontendRoomLabel);
  const preferredWindows = Array.isArray(req.body.preferred_windows) ? req.body.preferred_windows : [];
  const notes = String(req.body.notes ?? req.body.preferredWindowNote ?? req.body.preferred_window_note ?? '').trim();

  const requirement = await sessionRequirementsRepo.createRequirement({
    courseId,
    termId,
    kind,
    sessionsPerWeek: num(req.body.weekly_count ?? req.body.sessionsPerWeek ?? req.body.sessions_per_week, 1),
    durationMinutes: num(req.body.duration_minutes ?? req.body.durationMinutes, 120),
    requiredRoomKind,
    preferredWindowNote: notes || null,
    createdBy: req.user.id,
  });

  const updated = (await query(
    `UPDATE session_requirements
     SET expected_students=$2, frontend_room_type=$3, preferred_windows=$4::jsonb, notes=$5, updated_by=$6, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      requirement.id,
      num(req.body.expected_students ?? req.body.expectedStudents, 30),
      frontendRoomLabel || frontendRoomType(requiredRoomKind),
      JSON.stringify(preferredWindows),
      notes || null,
      req.user.id,
    ]
  )).rows[0];

  const rawEquipment = req.body.required_equipment ?? req.body.equipmentRequirements ?? req.body.equipment_requirements ?? [];
  for (const item of rawEquipment) {
    const equipmentId = num(typeof item === 'object' ? (item.equipmentId ?? item.equipment_id ?? item.id) : item);
    const quantity = num(typeof item === 'object' ? item.quantity : 1, 1);
    if (equipmentId) await sessionRequirementsRepo.addRequiredEquipment(updated.id, equipmentId, quantity);
  }
  return created(res, await mapRequirementForFrontend(updated));
});

const updateRequirement = asyncHandler(async (req, res) => {
  const id = num(req.params.id);
  const current = await sessionRequirementsRepo.findById(id);
  if (!current) throw ApiError.notFound('Requirement not found.');

  const frontendRoomLabel = req.body.required_room_type ?? req.body.roomType ?? req.body.roomKind ?? req.body.required_room_kind ?? current.frontend_room_type;
  const requiredRoomKind = frontendRoomLabel !== undefined && frontendRoomLabel !== null
    ? backendRoomKind(frontendRoomLabel)
    : current.required_room_kind;
  const preferredWindows = Array.isArray(req.body.preferred_windows)
    ? req.body.preferred_windows
    : (Array.isArray(current.preferred_windows) ? current.preferred_windows : []);
  const notes = req.body.notes !== undefined
    ? String(req.body.notes || '')
    : (current.notes ?? current.preferred_window_note ?? '');

  const result = await query(
    `UPDATE session_requirements
     SET kind=$2,
         sessions_per_week=$3,
         duration_minutes=$4,
         required_room_kind=$5,
         preferred_window_note=$6,
         expected_students=$7,
         frontend_room_type=$8,
         preferred_windows=$9::jsonb,
         notes=$10,
         updated_by=$11,
         updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      id,
      normalizeSessionKind(req.body.session_type ?? req.body.component ?? req.body.kind ?? current.kind),
      num(req.body.weekly_count ?? req.body.sessionsPerWeek ?? req.body.sessions_per_week, current.sessions_per_week),
      num(req.body.duration_minutes ?? req.body.durationMinutes, current.duration_minutes),
      requiredRoomKind,
      notes || null,
      num(req.body.expected_students ?? req.body.expectedStudents, current.expected_students || 30),
      frontendRoomLabel || frontendRoomType(requiredRoomKind),
      JSON.stringify(preferredWindows),
      notes || null,
      req.user.id,
    ]
  );

  const rawEquipment = req.body.required_equipment ?? req.body.equipmentRequirements ?? req.body.equipment_requirements;
  if (Array.isArray(rawEquipment)) {
    await query(`DELETE FROM required_equipment WHERE requirement_id=$1`, [id]);
    for (const item of rawEquipment) {
      const equipmentId = num(typeof item === 'object' ? (item.equipmentId ?? item.equipment_id ?? item.id) : item);
      const quantity = num(typeof item === 'object' ? item.quantity : 1, 1);
      if (equipmentId) await sessionRequirementsRepo.addRequiredEquipment(id, equipmentId, quantity);
    }
  }

  return ok(res, await mapRequirementForFrontend(result.rows[0]));
});

const assignInstructor = asyncHandler(async (req, res) => {
  const sectionId = num(req.params.id ?? req.params.sectionId);
  const instructorId = num(req.body.staffId ?? req.body.staff_id ?? req.body.instructorId ?? req.body.instructor_id);
  let requirementId = num(req.body.requirementId ?? req.body.requirement_id);
  const section = await sectionsRepo.findById(sectionId);
  if (!section) throw ApiError.notFound('Section not found.');

  if (req.user.role === ROLES.DEPARTMENT_COORDINATOR) {
    const course = await coursesRepo.findById(section.course_id);
    const allowedDeptIds = await getAccountDepartmentIds(req.user.id);
    if (!course || !allowedDeptIds.includes(Number(course.department_id))) {
      throw ApiError.forbidden('You cannot assign instructors outside your department scope.');
    }
  }

  if (!requirementId) {
    const reqs = await sessionRequirementsRepo.listByCourseTerm(section.course_id, section.term_id);
    const inferredComponent = inferFrontendComponentFromSection(section);
    const matching = reqs.find((item) => normalizeSessionKind(item.kind) === inferredComponent);
    requirementId = num(section.requirement_id) || matching?.id || reqs[0]?.id;
  }
  if (!instructorId || !requirementId) throw ApiError.badRequest('staffId and requirementId are required.');

  const person = await accountsRepo.findById(instructorId);
  if (!person || !['LECTURER', 'TA'].includes(String(person.role || '').toUpperCase()) || person.state === 'DISABLED') {
    throw ApiError.badRequest('Lecturer/TA not found.');
  }
  const requirement = await sessionRequirementsRepo.findById(requirementId);
  if (!requirement || Number(requirement.course_id) !== Number(section.course_id) || Number(requirement.term_id) !== Number(section.term_id)) {
    throw ApiError.badRequest('Requirement does not belong to this section course/term.');
  }
  if (String(requirement.kind).toUpperCase() === 'LECTURE' && String(person.role).toUpperCase() !== 'LECTURER') {
    throw ApiError.badRequest('Lecture sections must be assigned to a Lecturer.');
  }

  const r = await withTransaction(async (client) => {
    await client.query(`DELETE FROM section_instructors WHERE section_id=$1 AND requirement_id=$2`, [sectionId, requirementId]);
    const inserted = await client.query(
      `INSERT INTO section_instructors(section_id,instructor_id,requirement_id) VALUES($1,$2,$3) RETURNING *`,
      [sectionId, instructorId, requirementId]
    );
    return inserted.rows[0];
  });

  return created(res, {
    id: `${r.section_id}:${r.instructor_id}:${r.requirement_id}`,
    section_id: r.section_id,
    staff_id: r.instructor_id,
    requirement_id: r.requirement_id,
    staff_name: person.full_name,
    staff_role: String(person.role).toUpperCase(),
    sectionId: r.section_id,
    staffId: r.instructor_id,
    instructorId: r.instructor_id,
    requirementId: r.requirement_id,
  });
});

const removeInstructor = asyncHandler(async (req, res) => {
  const result = await query(`DELETE FROM section_instructors WHERE section_id=$1 AND instructor_id=$2 RETURNING instructor_id`, [num(req.params.id ?? req.params.sectionId), num(req.params.staffId)]);
  if (!result.rows[0]) throw ApiError.notFound('Instructor assignment not found.');
  return res.status(204).send();
});

// ---------------------------------------------------------------------------
// Availability / lab checks / rooms
// ---------------------------------------------------------------------------

const getMyAvailability = asyncHandler(async (req, res) => {
  const termId = num(req.query.term_id ?? req.query.termId) || await getActiveTermId();
  if (!termId) return ok(res, { termId:null,state:'DRAFT',slots:[] });
  const submission = await availabilityRepo.getSubmission(termId, req.user.id);
  if (!submission) return ok(res, { termId,state:'DRAFT',slots:[] });
  const rows = await query(`SELECT av.slot_id,av.kind,ts.weekday,ts.starts_at,ts.ends_at FROM availability_slots av JOIN time_slots ts ON ts.id=av.slot_id WHERE av.submission_id=$1 ORDER BY ts.weekday,ts.starts_at`, [submission.id]);
  return ok(res, { termId, state:submission.state, confirmedAt:submission.confirmed_at, slots:rows.rows.map(r=>({slotId:r.slot_id,weekday:r.weekday,start:String(r.starts_at).slice(0,5),end:String(r.ends_at).slice(0,5),status:r.kind})) });
});

const saveMyAvailability = asyncHandler(async (req, res) => {
  const termId = num(req.body.termId ?? req.body.term_id) || await getActiveTermId();
  if (!termId) throw ApiError.badRequest('termId is required.');
  const submission = await availabilityRepo.upsertSubmissionDraft(termId, req.user.id);
  const allSlots = await timeSlotsRepo.listByTerm(termId);
  for (const item of (req.body.slots || [])) {
    let slotId = num(item.slotId ?? item.slot_id);
    if (!slotId) {
      const weekday = num(item.weekday);
      const start = item.start ?? item.starts_at;
      slotId = allSlots.find(s=>Number(s.weekday)===weekday && String(s.starts_at).slice(0,5)===String(start).slice(0,5))?.id;
    }
    if (slotId) await availabilityRepo.setSlot(submission.id, termId, slotId, String(item.status ?? item.kind ?? 'AVAILABLE').toUpperCase());
  }
  return ok(res, { termId,state:'DRAFT' });
});

const confirmMyAvailability = asyncHandler(async (req, res) => {
  const termId = num(req.body.termId ?? req.body.term_id) || await getActiveTermId();
  const submission = termId ? await availabilityRepo.getSubmission(termId, req.user.id) : null;
  if (!submission) throw ApiError.badRequest('Save availability before confirming it.');
  const confirmed = await availabilityRepo.confirmSubmission(submission.id);
  return ok(res, { termId, state:confirmed.state, confirmedAt:confirmed.confirmed_at });
});

const getLabChecks = asyncHandler(async (req, res) => {
  await ensureCompatTables();
  const termId = await resolveFrontendTermId(req.query.termId ?? req.query.term_id);
  if (!termId) return ok(res, { requirements: [], rooms: [] });

  const rawRequirements = await sessionRequirementsRepo.listByTerm(termId);
  const practical = rawRequirements.filter((item) => normalizeSessionKind(item.kind) === 'PRACTICAL');
  const requirements = await Promise.all(practical.map(mapRequirementForFrontend));
  const rooms = await getFrontendRooms({ onlyLabs: true });

  const equipmentRows = rooms.length ? await query(
    `SELECT re.room_id,e.id AS equipment_id,e.name,re.quantity
       FROM room_equipment re
       JOIN equipment e ON e.id=re.equipment_id
      WHERE re.room_id = ANY($1::bigint[])`,
    [rooms.map((room) => room.id)]
  ) : { rows: [] };
  const equipmentByRoom = new Map();
  for (const row of equipmentRows.rows) {
    const key = Number(row.room_id);
    if (!equipmentByRoom.has(key)) equipmentByRoom.set(key, []);
    equipmentByRoom.get(key).push({
      id: Number(row.equipment_id),
      name: row.name,
      quantity: Number(row.quantity || 1),
    });
  }

  const decisionsRes = practical.length ? await query(
    `SELECT DISTINCT ON (requirement_id)
            id,requirement_id,room_id,status,notes,checks,checked_by,checked_at,created_at,updated_at
       FROM lab_checks
      WHERE requirement_id = ANY($1::bigint[])
      ORDER BY requirement_id, COALESCE(checked_at,updated_at,created_at) DESC, id DESC`,
    [practical.map((item) => item.id)]
  ) : { rows: [] };
  const decisionByRequirement = new Map(decisionsRes.rows.map((row) => [Number(row.requirement_id), row]));

  const withCandidates = requirements.map((requirement) => {
    const requiredEquipment = Array.isArray(requirement.equipmentRequirements)
      ? requirement.equipmentRequirements
      : [];
    const expectedStudents = Number(requirement.expected_students || 0);
    const requiredType = String(requirement.required_room_type || '').trim().toLowerCase();

    const candidates = rooms.map((room) => {
      const inventory = equipmentByRoom.get(Number(room.id)) || [];
      const inventoryById = new Map(inventory.map((item) => [Number(item.id), item]));
      const missing = requiredEquipment.filter((need) => {
        const have = inventoryById.get(Number(need.equipmentId ?? need.equipment_id));
        return !have || Number(have.quantity || 0) < Number(need.quantity || 1);
      });
      const capacity_ok = Number(room.capacity || 0) >= expectedStudents;
      const roomType = String(room.type || '').trim();
      const type_ok = !requiredType || roomType.toLowerCase() === requiredType ||
        (requiredType.includes('lab') && roomType.toLowerCase().includes('lab'));
      const equipment_ok = missing.length === 0;
      const availability_ok = room.status === 'available';
      const closure_ok = !room.closure;
      const suitable = capacity_ok && type_ok && equipment_ok && availability_ok && closure_ok;
      return {
        room_id: room.id,
        room_name: room.name,
        building: room.building,
        capacity: room.capacity,
        group_size: expectedStudents,
        room_type: room.type,
        capacity_ok,
        type_ok,
        equipment_ok,
        availability_ok,
        closure_ok,
        missing_equipment: missing.map((item) => Number(item.equipmentId ?? item.equipment_id)),
        closure: room.closure || null,
        suitable,
      };
    }).sort((a,b) => Number(b.suitable) - Number(a.suitable) || Number(b.capacity_ok) - Number(a.capacity_ok));

    const decision = decisionByRequirement.get(Number(requirement.id)) || null;
    return {
      ...requirement,
      candidates,
      decision: decision ? {
        ...decision,
        requirement_id: Number(decision.requirement_id),
        room_id: decision.room_id == null ? null : Number(decision.room_id),
      } : null,
    };
  });

  return ok(res, { requirements: withCandidates, rooms });
});

const saveLabCheck = asyncHandler(async (req, res) => {
  await ensureCompatTables();
  const requirementId = num(req.params.requirementId);
  const roomId = num(req.body.roomId ?? req.body.room_id);
  const status = String(req.body.status || 'CONFIRMED').toUpperCase();
  const checks = req.body.checks || {};
  const result = await query(`INSERT INTO lab_checks(requirement_id,room_id,status,notes,checks,checked_by,checked_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(requirement_id,room_id) DO UPDATE SET status=EXCLUDED.status,notes=EXCLUDED.notes,checks=EXCLUDED.checks,checked_by=EXCLUDED.checked_by,checked_at=now(),updated_at=now() RETURNING *`, [requirementId,roomId,status,req.body.notes || null,JSON.stringify(checks),req.user.id]);
  return ok(res, result.rows[0]);
});


const createRoomCompat = asyncHandler(async (req, res) => {
  await ensureCompatTables();
  const building = String(req.body.building || '').trim();
  const code = String(req.body.code ?? req.body.name ?? '').trim();
  const frontendType = String(req.body.type ?? req.body.frontend_type ?? req.body.kind ?? 'Classroom').trim();
  const kind = backendRoomKind(frontendType) || 'CLASSROOM';
  const capacity = num(req.body.capacity);
  const status = normalizeFrontendRoomStatus(req.body.status, true);
  const closure = String(req.body.closure || '').trim();
  if (!building || !code || !capacity) throw ApiError.badRequest('Name, building and a valid capacity are required.');

  const room = await roomsRepo.createRoom({
    building,
    code,
    kind,
    capacity,
    accessible: Boolean(req.body.accessibility ?? req.body.accessible),
    active: status === 'available' && !closure,
    managedBy: req.user.id,
  });
  await roomsRepo.updateRoom(room.id, {
    frontend_type: frontendType,
    frontend_status: status,
    closure_note: closure || null,
  });
  await syncFrontendRoomEquipment(room.id, req.body.equipment || []);
  const rooms = await getFrontendRooms();
  return created(res, rooms.find((item) => Number(item.id) === Number(room.id)));
});

const updateRoomCompat = asyncHandler(async (req, res) => {
  await ensureCompatTables();
  const id = num(req.params.id);
  const current = await roomsRepo.findById(id);
  if (!current) throw ApiError.notFound('Room not found.');

  const frontendType = String(req.body.type ?? req.body.frontend_type ?? current.frontend_type ?? frontendRoomTypeFromRow(current)).trim();
  const status = normalizeFrontendRoomStatus(req.body.status ?? current.frontend_status, current.active);
  const closure = req.body.closure !== undefined ? String(req.body.closure || '').trim() : (current.closure_note || '');
  const fields = {
    building: req.body.building ?? current.building,
    code: req.body.code ?? req.body.name ?? current.code,
    kind: backendRoomKind(frontendType) || current.kind,
    capacity: req.body.capacity ?? current.capacity,
    accessible: req.body.accessibility ?? req.body.accessible ?? current.accessible,
    active: status === 'available' && !closure,
    frontend_type: frontendType,
    frontend_status: status,
    closure_note: closure || null,
  };
  const room = await roomsRepo.updateRoom(id, fields);
  if (Array.isArray(req.body.equipment)) await syncFrontendRoomEquipment(id, req.body.equipment);
  const rooms = await getFrontendRooms();
  return ok(res, rooms.find((item) => Number(item.id) === Number(room.id)));
});

const deleteRoom = asyncHandler(async (req, res) => {
  const result = await query(`DELETE FROM rooms WHERE id=$1 RETURNING id`, [num(req.params.id)]);
  if (!result.rows[0]) throw ApiError.notFound('Room not found.');
  return res.status(204).send();
});


function inferFrontendComponentFromSection(section, explicitValue = null) {
  const explicit = String(explicitValue || '').trim().toUpperCase();
  if (explicit) return normalizeSessionKind(explicit);
  const code = String(section?.code || '');
  return /[-_](?:P|PR|LAB)\d*$/i.test(code) ? 'PRACTICAL' : 'LECTURE';
}

async function resolveFrontendSlotStart(termId, slotValue, explicitStart = null) {
  const direct = String(explicitStart || '').trim();
  if (direct && /^\d{2}:\d{2}/.test(direct)) return direct.slice(0, 5);

  const slotText = String(slotValue || '').trim();
  if (/^\d{2}:\d{2}/.test(slotText)) return slotText.slice(0, 5);

  const match = /^s(\d+)$/i.exec(slotText);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  const rows = await query(
    `SELECT DISTINCT starts_at FROM time_slots WHERE term_id=$1 ORDER BY starts_at`,
    [termId]
  );
  const row = rows.rows[index];
  return row ? String(row.starts_at).slice(0, 5) : null;
}

async function resolveFrontendAllocationInput(version, body, existing = null) {
  const sectionId = num(body.sectionId ?? body.section_id ?? existing?.section_id);
  if (!sectionId) throw ApiError.badRequest('Section is required.');
  const section = await sectionsRepo.findById(sectionId);
  if (!section) throw ApiError.notFound('Section not found.');
  if (Number(section.term_id) !== Number(version.term_id)) {
    throw ApiError.badRequest('Selected section belongs to another academic term.');
  }

  let instructorId = num(body.instructorId ?? body.instructor_id ?? existing?.instructor_id);
  let requirementId = num(body.requirementId ?? body.requirement_id ?? existing?.requirement_id);
  const componentHint = inferFrontendComponentFromSection(section, body.type ?? body.component);

  // The frozen frontend intentionally sends only section/instructor. The real
  // backend stores the requirement on section_instructors, so resolve that
  // relationship here instead of requiring the React app to know DB ids.
  if (!requirementId || !instructorId) {
    const params = [sectionId, version.term_id];
    let instructorFilter = '';
    if (instructorId) {
      params.push(instructorId);
      instructorFilter = ` AND si.instructor_id=$${params.length}`;
    }
    params.push(componentHint);
    const componentParam = params.length;
    const assignment = await query(
      `SELECT si.instructor_id,si.requirement_id,sr.kind
         FROM section_instructors si
         JOIN session_requirements sr ON sr.id=si.requirement_id
        WHERE si.section_id=$1 AND sr.term_id=$2${instructorFilter}
        ORDER BY CASE WHEN sr.kind::text=$${componentParam} THEN 0 ELSE 1 END, si.requirement_id
        LIMIT 1`,
      params
    );
    if (assignment.rows[0]) {
      instructorId = instructorId || Number(assignment.rows[0].instructor_id);
      requirementId = requirementId || Number(assignment.rows[0].requirement_id);
    }
  }

  if (!requirementId && section.requirement_id) requirementId = Number(section.requirement_id);
  if (!requirementId) {
    const requirements = await sessionRequirementsRepo.listByCourseTerm(section.course_id, version.term_id);
    const matching = requirements.find((item) => normalizeSessionKind(item.kind) === componentHint) || requirements[0];
    requirementId = matching?.id ? Number(matching.id) : null;
  }
  if (!instructorId && requirementId) {
    const row = await query(
      `SELECT instructor_id FROM section_instructors WHERE section_id=$1 AND requirement_id=$2 ORDER BY instructor_id LIMIT 1`,
      [sectionId, requirementId]
    );
    instructorId = row.rows[0]?.instructor_id ? Number(row.rows[0].instructor_id) : null;
  }

  if (!requirementId) throw ApiError.badRequest('This section has no Lecture/Practical requirement. Create the course requirement first.');
  if (!instructorId) throw ApiError.badRequest('This section has no instructor assignment. Department Coordinator action is required.');

  // Resolve the room from what the frontend actually sent for THIS request
  // (numeric id, or the "Room 202 / Room 202 · 30 · Computer Lab" label the
  // Edit Allocation dropdown submits) before ever falling back to the
  // allocation's current room. Folding existing?.room_id into the same
  // nullish-coalescing chain as body.roomId/body.room_id used to short-circuit
  // this block on every edit (existing.room_id is always present on update),
  // so a new room selection was silently discarded and the old room kept.
  let roomId = num(body.roomId ?? body.room_id);
  if (!roomId && body.room) {
    const label = String(body.room).trim().split('·')[0].trim();
    const room = await query(
      `SELECT id FROM rooms
        WHERE lower(code)=lower($1)
           OR lower(concat_ws(' ',building,code))=lower($1)
        ORDER BY id LIMIT 1`,
      [label]
    );
    roomId = room.rows[0]?.id ? Number(room.rows[0].id) : null;
  }
  if (!roomId) roomId = num(existing?.room_id);
  if (!roomId) throw ApiError.badRequest('Selected room or lab was not found.');

  let weekday = num(body.weekday);
  if (!weekday && body.day) weekday = DAY_TO_ISO[String(body.day).trim().toLowerCase()] || null;
  if (!weekday && existing?.start_slot_id) {
    const row = await query(`SELECT weekday FROM time_slots WHERE id=$1`, [existing.start_slot_id]);
    weekday = row.rows[0]?.weekday ? Number(row.rows[0].weekday) : null;
  }
  if (!weekday) throw ApiError.badRequest('Day is required.');

  let start = await resolveFrontendSlotStart(version.term_id, body.slot, body.start ?? body.starts_at ?? body.startTime);
  if (!start && existing?.start_slot_id) {
    const row = await query(`SELECT starts_at FROM time_slots WHERE id=$1`, [existing.start_slot_id]);
    start = row.rows[0]?.starts_at ? String(row.rows[0].starts_at).slice(0,5) : null;
  }
  if (!start) throw ApiError.badRequest('Time slot is required.');

  return { sectionId, requirementId, instructorId, roomId, weekday, start };
}

async function mapAllocationsForFrontend(rows, termId) {
  const slotRows = await query(
    `SELECT DISTINCT starts_at FROM time_slots WHERE term_id=$1 ORDER BY starts_at`,
    [termId]
  );
  const slotByStart = new Map(slotRows.rows.map((row, index) => [String(row.starts_at).slice(0,5), `s${index + 1}`]));
  return rows.map((row) => {
    const start = String(row.start ?? row.starts_at ?? '').slice(0,5);
    const weekday = Number(row.weekday);
    return {
      ...row,
      section_id: row.section_id,
      course_id: row.course_id,
      requirement_id: row.requirement_id,
      instructor_id: row.instructor_id,
      room_id: row.room_id,
      course: row.course_title,
      code: row.course_code,
      section: row.section_code,
      staff: row.instructor_name,
      room: row.room_code,
      day: ISO_DAY_NAMES[weekday] || String(row.weekday || ''),
      slot: slotByStart.get(start) || null,
      type: frontendSessionType(row.session_kind),
      department_id: row.department_id ?? null,
      status: 'ok',
    };
  });
}

async function frontendWorkflow(version, draftId, extra = {}) {
  if (!version) {
    return { draft_id: draftId, draftId, versionId: null, versionNumber: null, status: 'DRAFT', state: 'DRAFT', ...extra };
  }
  const audit = await query(
    `SELECT ae.action,ae.occurred_at,a.full_name AS actor_name
       FROM audit_events ae
       LEFT JOIN accounts a ON a.id=ae.actor_account_id
      WHERE ae.entity_type='schedule_versions' AND ae.entity_id=$1 AND ae.outcome='SUCCESS'
        AND ae.action IN ('SCHEDULE_VERSION_SUBMITTED_FOR_REVIEW','SCHEDULE_VERSION_PUBLISHED')
      ORDER BY ae.occurred_at DESC`,
    [version.id]
  );
  const submitted = audit.rows.find((row) => row.action === 'SCHEDULE_VERSION_SUBMITTED_FOR_REVIEW');
  const published = audit.rows.find((row) => row.action === 'SCHEDULE_VERSION_PUBLISHED');
  const status = String(version.state).toUpperCase() === 'PUBLISHED' ? 'PUBLISHED' : (submitted ? 'READY_FOR_REVIEW' : 'DRAFT');
  return {
    draft_id: draftId,
    draftId,
    versionId: version.id,
    versionNumber: version.version_number,
    status,
    state: version.state,
    submitted_by: submitted?.actor_name || null,
    submitted_at: submitted?.occurred_at || null,
    published_by: published?.actor_name || null,
    published_at: version.published_at || published?.occurred_at || null,
    ...extra,
  };
}

async function frontendPublishedVersion(version, term, allocations) {
  if (!version) return null;
  const publisher = version.published_by
    ? (await query(`SELECT full_name FROM accounts WHERE id=$1`, [version.published_by])).rows[0]?.full_name
    : null;
  const mapped = await mapAllocationsForFrontend(allocations, version.term_id);
  return {
    id: version.id,
    source_draft_id: version.id,
    version_number: version.version_number,
    versionNumber: version.version_number,
    name: version.name,
    term_id: version.term_id,
    term_name: term?.name || '',
    status: 'PUBLISHED',
    published_at: version.published_at,
    publishedAt: version.published_at,
    published_by: publisher || '',
    allocations: mapped,
  };
}

// ---------------------------------------------------------------------------
// Schedule/draft compatibility
// ---------------------------------------------------------------------------

const getDraftWorkflow = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) {
    const termId = num(req.query.termId ?? req.query.term_id) || await getActiveTermId();
    const latest = termId ? (await query(`SELECT * FROM schedule_versions WHERE term_id=$1 ORDER BY version_number DESC LIMIT 1`, [termId])).rows[0] : null;
    if (latest?.state === 'PUBLISHED') {
      const validation = { valid:true, violations:[], allocationCount:(await allocationsRepo.listByVersion(latest.id)).length, empty:false };
      return ok(res, await frontendWorkflow(latest, req.params.draftId, validation));
    }
    return ok(res, await frontendWorkflow(null, req.params.draftId, { valid:true, violations:[], allocationCount:0, empty:true }));
  }
  const validation = await scheduleService.validateVersion(version.id);
  return ok(res, await frontendWorkflow(version, req.params.draftId, validation));
});

const getDraftAllocations = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) return ok(res, { draftId:req.params.draftId, versionId:null, versionNumber:null, state:'DRAFT', allocations:[] });
  const rows = await allocationService.listByVersion(version.id);
  const allocations = await mapAllocationsForFrontend(rows, version.term_id);
  return ok(res, { draftId:req.params.draftId, versionId:version.id, versionNumber:version.version_number, state:version.state, allocations });
});

const generateDraft = asyncHandler(async (req, res) => {
  let version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) {
    const termId = num(req.query.termId ?? req.body.termId ?? req.body.term_id) || await getActiveTermId();
    if (!termId) throw ApiError.badRequest('No academic term exists for schedule generation.');
    version = await scheduleVersionsRepo.createDraft({ termId, name: `Draft from ${req.params.draftId}`, createdBy: req.user.id });
  }
  if (version.state !== 'DRAFT') throw ApiError.conflict('Only a DRAFT version can be generated.');

  const modelData = await modelService.solveTimetable(version.term_id);
  const scheduled = modelData?.scheduled_sessions || modelData?.data?.scheduled_sessions || [];
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM allocations WHERE version_id=$1`, [version.id]);
    for (const session of scheduled) {
      const slot = session.slot || {};
      // Resolve the slot against THIS term's time_slots by weekday+starts_at
      // first, the same safe lookup modelService.solveAndPersistTimetable
      // uses. The solver's own slot.id is an internal index into its solve
      // request, not a time_slots primary key, so trusting it directly (the
      // old `session.start_slot_id ?? slot.id` first) inserted a start_slot_id
      // that often didn't exist in this term, which Postgres rejected as a
      // foreign-key violation ("Referenced record does not exist.").
      let startSlotId = null;
      if (slot.weekday != null && slot.starts_at) {
        const found = await client.query(`SELECT id FROM time_slots WHERE term_id=$1 AND weekday=$2 AND starts_at=$3 LIMIT 1`, [version.term_id, slot.weekday, slot.starts_at]);
        startSlotId = found.rows[0]?.id || null;
      }
      if (!startSlotId) startSlotId = num(session.start_slot_id ?? slot.id);
      if (!startSlotId) continue;
      const endsAt = session.ends_at ?? slot.ends_at;
      const instructorId = num(session.instructor_id ?? session.instructor?.id);
      const roomId = num(session.room_id ?? session.room?.id);
      const sectionId = num(session.section_id);
      const requirementId = num(session.requirement_id);
      if (!endsAt || !instructorId || !roomId || !sectionId || !requirementId) continue;
      await client.query(`INSERT INTO allocations(term_id,version_id,section_id,requirement_id,instructor_id,room_id,start_slot_id,ends_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [version.term_id,version.id,sectionId,requirementId,instructorId,roomId,startSlotId,endsAt,req.user.id]);
    }
  });
  const rows = await allocationService.listByVersion(version.id);
  const allocations = await mapAllocationsForFrontend(rows, version.term_id);
  const workflow = await frontendWorkflow(version, req.params.draftId, { allocationCount: allocations.length });
  return ok(res, { draftId:req.params.draftId,versionId:version.id,state:'DRAFT',scheduled:scheduled.length,allocations,workflow,model:modelData });
});

const submitDraftReview = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) throw ApiError.notFound('Schedule draft not found.');
  const result = await scheduleWorkflowService.submitForReview(version.id, req.user.id, req.body.resolvedConflictIds || req.body.resolved_conflict_ids || []);
  return ok(res, await frontendWorkflow(version, req.params.draftId, { ...result, status: 'READY_FOR_REVIEW' }));
});

const createDraftAllocation = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) throw ApiError.notFound('Schedule draft not found.');
  const p = await resolveFrontendAllocationInput(version, req.body);
  const allocation = await allocationService.createAllocation({versionId:version.id,...p,actor:req.user});
  const rows = await allocationService.listByVersion(version.id);
  const mapped = await mapAllocationsForFrontend(rows.filter((item)=>Number(item.id)===Number(allocation.id)), version.term_id);
  return created(res, mapped[0] || allocation);
});

const updateDraftAllocation = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) throw ApiError.notFound('Schedule draft not found.');
  const existing = await allocationsRepo.findById(num(req.params.allocationId));
  if (!existing || Number(existing.version_id)!==Number(version.id)) throw ApiError.notFound('Allocation not found in this draft.');
  if (req.user.role === ROLES.ADMIN && req.user.homeDepartmentId) {
    const scope = await query(
      `SELECT c.department_id FROM sections s JOIN courses c ON c.id=s.course_id WHERE s.id=$1`,
      [existing.section_id]
    );
    if (Number(scope.rows[0]?.department_id) !== Number(req.user.homeDepartmentId)) {
      throw ApiError.forbidden('DEPARTMENT_SCOPE_VIOLATION');
    }
  }
  const p = await resolveFrontendAllocationInput(version, req.body, existing);
  const updated = await allocationService.updateAllocation({
    allocationId:existing.id,
    roomId:p.roomId,
    instructorId:p.instructorId,
    weekday:p.weekday,
    start:p.start,
    actor:req.user,
  });
  const rows = await allocationService.listByVersion(version.id);
  const mapped = await mapAllocationsForFrontend(rows.filter((item)=>Number(item.id)===Number(updated.id)), version.term_id);
  return ok(res, mapped[0] || updated);
});

const deleteDraftAllocation = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  const existing = await allocationsRepo.findById(num(req.params.allocationId));
  if (!version || !existing || Number(existing.version_id)!==Number(version.id)) throw ApiError.notFound('Allocation not found in this draft.');
  await allocationService.deleteAllocation({allocationId:existing.id,actor:req.user});
  return res.status(204).send();
});

const validateDraft = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) throw ApiError.notFound('Schedule draft not found.');
  const validation = await scheduleWorkflowService.validateDraft(version.id, req.body.resolvedConflictIds || req.body.resolved_conflict_ids || []);

  // The live Conflict Resolution screen promises ranked feasible alternatives.
  // Enrich each conflicting allocation with real recommendations from the same
  // deterministic recommendation engine used by /allocations/recommend.
  const allocationRows = await allocationsRepo.listByVersion(version.id);
  const allocationById = new Map(allocationRows.map((row) => [String(row.id), row]));
  const conflicts = await Promise.all((validation.conflicts || []).map(async (group) => {
    const allocation = allocationById.get(String(group.allocationId));
    if (!allocation) return { ...group, alternatives: [] };

    try {
      const base = {
        termId: version.term_id,
        versionId: version.id,
        sectionId: allocation.section_id,
        requirementId: allocation.requirement_id,
        instructorId: allocation.instructor_id,
        weekday: allocation.weekday,
        start: String(allocation.start).slice(0, 5),
        limit: 5,
        excludeAllocationId: allocation.id,
      };

      let alternatives = await recommendationService.suggestAlternatives({ ...base, sameDayOnly: true });
      // If the current day is saturated, broaden to the configured week rather
      // than showing a dead-end message immediately.
      if (!alternatives.length) {
        alternatives = await recommendationService.suggestAlternatives({ ...base, sameDayOnly: false });
      }

      return { ...group, alternatives };
    } catch (error) {
      // Validation must remain available even when recommendation generation
      // cannot produce a preview for a specific allocation.
      return { ...group, alternatives: [], recommendation_error: error?.message || 'Could not generate alternatives.' };
    }
  }));

  return ok(res, {
    ...validation,
    conflicts,
    hard_conflict_count: conflicts.reduce((sum, item) => sum + Math.max(1, item.conflicts?.length || 0), 0),
  });
});

const publishDraft = asyncHandler(async (req, res) => {
  const version = await resolveDraft(req.params.draftId, req.query.termId);
  if (!version) throw ApiError.notFound('Schedule draft not found.');
  const published = await scheduleWorkflowService.publishDraft(version.id, req.user.id);
  const term = await termsRepo.findById(published.term_id);
  const allocations = await allocationsRepo.listByVersion(published.id);
  return ok(res, await frontendPublishedVersion(published, term, allocations));
});

// ---------------------------------------------------------------------------
// Personal published timetable
// ---------------------------------------------------------------------------

const publishedTimetable = asyncHandler(async (req, res) => {
  const termId = num(req.query.termId ?? req.query.term_id) || await getActiveTermId();
  if (!termId) return ok(res, { version: null, term: null, course_registrations: [], section_enrollments: [] });

  const term = await termsRepo.findById(termId);
  const version = await scheduleVersionsRepo.findPublished(termId);
  if (!version) return ok(res, { version: null, term: term ? { id: term.id, name: term.name } : null, course_registrations: [], section_enrollments: [] });

  let allocations = await allocationsRepo.listByVersion(version.id);
  let student = null;
  let courseRegistrations = [];
  let sectionEnrollments = [];

  if (req.user.role === ROLES.STUDENT) {
    student = await studentsRepo.findByAccountId(req.user.id);
    if (!student) {
      allocations = [];
    } else {
      const regRows = await query(
        `SELECT scr.id,scr.student_id,scr.course_id,scr.term_id,scr.state,scr.registration_type,c.code AS course_code,c.title AS course_name
           FROM student_course_registrations scr
           JOIN courses c ON c.id=scr.course_id
          WHERE scr.student_id=$1 AND scr.term_id=$2 AND scr.state='REGISTERED'
          ORDER BY c.code`,
        [student.id, termId]
      );
      courseRegistrations = regRows.rows.map((r) => ({
        ...r,
        studentId: r.student_id,
        courseId: r.course_id,
        termId: r.term_id,
        registrationType: r.registration_type,
        status: 'ACTIVE',
      }));

      const sectionRows = await query(
        `SELECT sse.*,s.code AS section_code,c.code AS course_code,c.title AS course_name,scr.student_id
           FROM student_section_enrollments sse
           JOIN student_course_registrations scr ON scr.id=sse.registration_id
           JOIN sections s ON s.id=sse.section_id
           JOIN courses c ON c.id=sse.course_id
          WHERE scr.student_id=$1 AND sse.term_id=$2 AND sse.state='ACTIVE'
          ORDER BY c.code,sse.section_kind`,
        [student.id, termId]
      );
      sectionEnrollments = sectionRows.rows.map((r) => ({
        ...r,
        studentId: r.student_id,
        termId: r.term_id,
        courseId: r.course_id,
        sectionId: r.section_id,
        component: r.section_kind,
        status: 'ACTIVE',
      }));
      const allowed = new Set(sectionEnrollments.map((r) => Number(r.section_id)));
      allocations = allocations.filter((a) => allowed.has(Number(a.section_id)));
    }
  } else if ([ROLES.LECTURER, ROLES.TA].includes(req.user.role)) {
    allocations = allocations.filter((a) => Number(a.instructor_id) === Number(req.user.id));
  }

  const frontendVersion = await frontendPublishedVersion(version, term, allocations);
  return ok(res, {
    version: frontendVersion,
    term: term ? { id: term.id, name: term.name } : null,
    student: student ? { ...student, name: student.full_name, current_level: student.academic_level } : null,
    course_registrations: courseRegistrations,
    section_enrollments: sectionEnrollments,
  });
});

// ---------------------------------------------------------------------------
// Student registrations/enrollments
// ---------------------------------------------------------------------------


const getStudentsCompat = asyncHandler(async (req, res) => {
  await ensureCompatTables();
  const departmentId = num(req.query.departmentId ?? req.query.department_id);
  const academicLevel = num(req.query.academicLevel ?? req.query.currentLevel ?? req.query.level);
  const params = [];
  const clauses = [];
  if (departmentId) { params.push(departmentId); clauses.push(`s.department_id=$${params.length}`); }
  if (academicLevel) { params.push(academicLevel); clauses.push(`s.academic_level=$${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(
    `SELECT s.*,a.email AS account_email,a.role,d.name AS department_name,d.code AS department_code
       FROM students s
       LEFT JOIN accounts a ON a.id=s.account_id
       LEFT JOIN departments d ON d.id=s.department_id
       ${where}
      ORDER BY s.full_name`,
    params
  );
  return ok(res, { students: rows.rows.map((r) => ({
    ...r,
    universityId: r.university_id,
    name: r.full_name,
    departmentId: r.department_id,
    currentLevel: r.academic_level,
    current_level: r.academic_level,
    accountId: r.account_id,
    email: r.email || r.account_email,
  })) });
});

const getCourseEnrollments = asyncHandler(async (req,res)=>{
  await ensureCompatTables();
  const studentId=num(req.params.studentId);
  const termId=await resolveFrontendTermId(req.query.term_id ?? req.query.termId);
  const student=(await query(`SELECT s.*,d.name AS department_name FROM students s LEFT JOIN departments d ON d.id=s.department_id WHERE s.id=$1`,[studentId])).rows[0] || null;
  const params=[studentId]; let termSql=''; if(termId){params.push(termId);termSql=` AND scr.term_id=$2`;}
  const rows=await query(`SELECT scr.id,scr.student_id,scr.course_id,scr.term_id,scr.state,scr.registration_type,c.code AS course_code,c.title AS course_name FROM student_course_registrations scr JOIN courses c ON c.id=scr.course_id WHERE scr.student_id=$1${termSql} ORDER BY c.code`,params);
  const registrations=rows.rows.map(r=>({
    ...r,
    studentId:r.student_id,
    courseId:r.course_id,
    termId:r.term_id,
    registrationType:r.registration_type,
    status:String(r.state||'REGISTERED').toUpperCase()==='REGISTERED'?'ACTIVE':String(r.state||'').toUpperCase(),
  }));
  return ok(res,{ student:student ? {...student,name:student.full_name,current_level:student.academic_level} : null, registrations });
});

const createCourseEnrollment = asyncHandler(async (req,res)=>{
  await ensureCompatTables();
  const studentId=num(req.body.studentId ?? req.body.student_id);
  let courseId=num(req.body.courseId ?? req.body.course_id);
  if(!courseId && req.body.course_code){
    courseId=(await query(`SELECT id FROM courses WHERE code=$1 LIMIT 1`,[String(req.body.course_code).trim()])).rows[0]?.id || null;
  }
  const termId=await resolveFrontendTermId(req.body.termId ?? req.body.term_id);
  const registrationType=String(req.body.registrationType ?? req.body.registration_type ?? 'NORMAL').toUpperCase();
  if(!studentId||!courseId||!termId) throw ApiError.badRequest('studentId, course and termId are required.');
  if(!['NORMAL','CARRIED','REPEATED'].includes(registrationType)) throw ApiError.badRequest('Invalid registrationType.');
  try {
    const r=(await query(`INSERT INTO student_course_registrations(student_id,course_id,term_id,state,registration_type,registered_by,registered_at,updated_at) VALUES($1,$2,$3,'REGISTERED',$4,$5,now(),now()) RETURNING *`,[studentId,courseId,termId,registrationType,req.user.id])).rows[0];
    const c=(await query(`SELECT code,title FROM courses WHERE id=$1`,[courseId])).rows[0];
    return created(res,{...r,studentId:r.student_id,courseId:r.course_id,termId:r.term_id,registrationType:r.registration_type,course_code:c?.code,course_name:c?.title,status:'ACTIVE'});
  } catch(err){ if(err.code==='23505') throw ApiError.conflict('This student is already registered in this course.'); throw err; }
});

const deleteCourseEnrollment = asyncHandler(async (req,res)=>{
  const id=num(req.params.id);
  const result=await withTransaction(async(client)=>{await client.query(`DELETE FROM student_section_enrollments WHERE registration_id=$1`,[id]);return client.query(`DELETE FROM student_course_registrations WHERE id=$1 RETURNING id`,[id]);});
  if(!result.rows[0]) throw ApiError.notFound('Course enrollment not found.'); return res.status(204).send();
});

const getSectionEnrollments = asyncHandler(async (req,res)=>{
  await ensureCompatTables();
  const studentId=num(req.params.studentId);
  const termId=await resolveFrontendTermId(req.query.term_id ?? req.query.termId);
  const student=(await query(`SELECT s.*,d.name AS department_name FROM students s LEFT JOIN departments d ON d.id=s.department_id WHERE s.id=$1`,[studentId])).rows[0] || null;
  const params=[studentId]; let termSql=''; if(termId){params.push(termId);termSql=` AND sse.term_id=$2`;}
  const rows=await query(`SELECT sse.*,s.code AS section_code,c.code AS course_code,c.title AS course_name,scr.student_id FROM student_section_enrollments sse JOIN student_course_registrations scr ON scr.id=sse.registration_id JOIN sections s ON s.id=sse.section_id JOIN courses c ON c.id=sse.course_id WHERE scr.student_id=$1${termSql} ORDER BY c.code,sse.section_kind`,params);
  const assignments=rows.rows.map(r=>({
    ...r,
    studentId:r.student_id,
    termId:r.term_id,
    courseId:r.course_id,
    sectionId:r.section_id,
    component:r.section_kind,
    status:String(r.state||'ACTIVE').toUpperCase(),
  }));
  return ok(res,{ student:student ? {...student,name:student.full_name,current_level:student.academic_level} : null, assignments });
});

const createSectionEnrollment = asyncHandler(async (req,res)=>{
  await ensureCompatTables();
  const studentId=num(req.body.studentId ?? req.body.student_id);
  const termId=await resolveFrontendTermId(req.body.termId ?? req.body.term_id);
  let courseId=num(req.body.courseId ?? req.body.course_id);
  let sectionId=num(req.body.sectionId ?? req.body.section_id);
  if(!courseId && req.body.course_code){
    courseId=(await query(`SELECT id FROM courses WHERE code=$1 LIMIT 1`,[String(req.body.course_code).trim()])).rows[0]?.id || null;
  }
  if(!sectionId && req.body.section_code){
    sectionId=(await query(`SELECT id FROM sections WHERE code=$1 AND ($2::bigint IS NULL OR term_id=$2) LIMIT 1`,[String(req.body.section_code).trim(),termId])).rows[0]?.id || null;
  }
  const component=normalizeSessionKind(req.body.component ?? req.body.section_kind);
  if(!studentId||!termId||!courseId||!sectionId) throw ApiError.badRequest('student, course, section and term are required.');

  const section=(await query(`SELECT s.id,s.course_id,s.term_id,c.department_id,sr.kind AS requirement_kind FROM sections s JOIN courses c ON c.id=s.course_id LEFT JOIN session_requirements sr ON sr.id=s.requirement_id WHERE s.id=$1`,[sectionId])).rows[0];
  if(!section) throw ApiError.notFound('Section not found.');
  if(Number(section.course_id)!==Number(courseId)) throw ApiError.badRequest('Selected section belongs to another course.');
  if(Number(section.term_id)!==Number(termId)) throw ApiError.badRequest('Selected section belongs to another term.');
  if(section.requirement_kind && normalizeSessionKind(section.requirement_kind)!==component) throw ApiError.badRequest('Selected section does not match the requested component.');
  if(req.user.role===ROLES.DEPARTMENT_COORDINATOR && req.user.homeDepartmentId && Number(section.department_id)!==Number(req.user.homeDepartmentId)) throw ApiError.forbidden('DEPARTMENT_SCOPE_VIOLATION');

  const reg=(await query(`SELECT * FROM student_course_registrations WHERE student_id=$1 AND term_id=$2 AND course_id=$3 AND state='REGISTERED'`,[studentId,termId,courseId])).rows[0];
  if(!reg) throw ApiError.conflict('Register the course before assigning a section.');

  const r=(await query(`INSERT INTO student_section_enrollments(registration_id,term_id,course_id,section_kind,section_id,state,assigned_by,assigned_at) VALUES($1,$2,$3,$4,$5,'ACTIVE',$6,now()) ON CONFLICT(registration_id,section_kind) DO UPDATE SET section_id=EXCLUDED.section_id,state='ACTIVE',assigned_by=EXCLUDED.assigned_by,assigned_at=now(),ended_at=NULL RETURNING *`,[reg.id,termId,courseId,component,sectionId,req.user.id])).rows[0];
  const c=(await query(`SELECT code FROM courses WHERE id=$1`,[courseId])).rows[0];
  const sec=(await query(`SELECT code FROM sections WHERE id=$1`,[sectionId])).rows[0];
  return created(res,{...r,studentId,termId:r.term_id,courseId:r.course_id,sectionId:r.section_id,component:r.section_kind,course_code:c?.code,section_code:sec?.code,status:'ACTIVE'});
});

const deleteSectionEnrollment = asyncHandler(async(req,res)=>{const r=await query(`DELETE FROM student_section_enrollments WHERE id=$1 RETURNING id`,[num(req.params.id)]);if(!r.rows[0])throw ApiError.notFound('Section assignment not found.');return res.status(204).send();});

// ---------------------------------------------------------------------------
// Admin accounts/roles
// ---------------------------------------------------------------------------

const BUILTIN_PERMISSIONS = Object.fromEntries(
  Object.entries(FRONTEND_ROLE_META).map(([dbRole, meta]) => [dbRole, meta.permissions])
);

const listAdminAccounts = asyncHandler(async (req,res) => {
  const roleFilter = req.query.role ? dbRoleFromFrontend(req.query.role) : undefined;
  const rows = await query(
    `SELECT a.id,a.email,a.full_name,a.role,a.state,a.home_department_id,a.created_at,a.updated_at,a.last_login_at,
            d.name AS department_name,
            s.id AS student_id,s.university_id,s.academic_level AS current_level
       FROM accounts a
       LEFT JOIN departments d ON d.id=a.home_department_id
       LEFT JOIN students s ON s.account_id=a.id
      WHERE ($1::text IS NULL OR a.role::text=$1)
        AND ($2::text IS NULL OR a.state::text=$2)
        AND ($3::bigint IS NULL OR a.home_department_id=$3)
      ORDER BY a.full_name`,
    [roleFilter || null, req.query.state ? String(req.query.state).toUpperCase() : null, num(req.query.departmentId)]
  );
  return ok(res, { accounts: rows.rows.map(camelAccount) });
});

const createAdminAccount = asyncHandler(async (req,res) => {
  const email=String(req.body.email||'').trim();
  const name=String(req.body.name??req.body.fullName??'').trim();
  const dbRole=dbRoleFromFrontend(req.body.role);
  const password=req.body.password??req.body.initialPassword;
  const departmentId=num(req.body.department_id??req.body.departmentId??req.body.homeDepartmentId);
  if(!email||!name||!dbRole||!password) throw ApiError.badRequest('Name, email, role and an initial password are required.');
  if(!Object.values(ROLES).includes(dbRole)) throw ApiError.badRequest('Selected role does not exist.');
  const policy=validatePassword(password); if(!policy.valid) throw ApiError.badRequest(policy.errors.join(', '));

  const row = await withTransaction(async (client) => {
    const passwordHash = await hashPassword(password);
    const inserted = await client.query(
      `INSERT INTO accounts(email,full_name,role,state,home_department_id,password_hash,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,email,full_name,role,state,home_department_id,created_at,updated_at,last_login_at`,
      [email,name,dbRole,String(req.body.status??req.body.state??'ACTIVE').toUpperCase(),departmentId,passwordHash,req.user.id]
    );
    const account = inserted.rows[0];

    if (dbRole === 'STUDENT') {
      const universityId = String(req.body.university_id ?? req.body.universityId ?? `STU${account.id}`).trim();
      const currentLevel = num(req.body.current_level ?? req.body.currentLevel, 1);
      const studentInsert = await client.query(
        `INSERT INTO students(university_id,full_name,email,department_id,academic_level,status,account_id)
         VALUES($1,$2,$3,$4,$5,'ACTIVE',$6)
         ON CONFLICT (account_id) DO UPDATE SET
           university_id=EXCLUDED.university_id,full_name=EXCLUDED.full_name,email=EXCLUDED.email,
           department_id=EXCLUDED.department_id,academic_level=EXCLUDED.academic_level
         RETURNING id,university_id,academic_level`,
        [universityId,name,email,departmentId,currentLevel,account.id]
      );
      account.student_id = studentInsert.rows[0].id;
      account.university_id = studentInsert.rows[0].university_id;
      account.current_level = studentInsert.rows[0].academic_level;
    }
    return account;
  });

  if (departmentId) {
    const d=await query(`SELECT name FROM departments WHERE id=$1`,[departmentId]);
    row.department_name=d.rows[0]?.name||null;
  }
  return created(res,camelAccount(row));
});

const updateAdminAccount = asyncHandler(async(req,res) => {
  const id=num(req.params.id);
  const current=await accountsRepo.findById(id);
  if(!current) throw ApiError.notFound('Account not found.');
  if(id===Number(req.user.id)&&String(req.body.status??req.body.state??current.state).toUpperCase()==='DISABLED') throw ApiError.badRequest('You cannot disable the account you are using.');
  const dbRole=dbRoleFromFrontend(req.body.role??current.role);
  if(!dbRole||!Object.values(ROLES).includes(dbRole)) throw ApiError.badRequest('Selected role does not exist.');
  let passwordHash=current.password_hash;
  if(req.body.password??req.body.newPassword){
    const p=req.body.password??req.body.newPassword;
    const policy=validatePassword(p); if(!policy.valid) throw ApiError.badRequest(policy.errors.join(', '));
    passwordHash=await hashPassword(p);
  }
  const departmentId=num(req.body.department_id??req.body.departmentId??req.body.homeDepartmentId,current.home_department_id);
  const result=await withTransaction(async(client)=>{
    const updated=await client.query(
      `UPDATE accounts SET full_name=$2,email=$3,role=$4,state=$5,home_department_id=$6,password_hash=$7,updated_at=now()
       WHERE id=$1 RETURNING id,email,full_name,role,state,home_department_id,created_at,updated_at,last_login_at`,
      [id,req.body.name??req.body.fullName??current.full_name,req.body.email??current.email,dbRole,String(req.body.status??req.body.state??current.state).toUpperCase(),departmentId,passwordHash]
    );
    const account=updated.rows[0];
    if(dbRole==='STUDENT'){
      const universityId=String(req.body.university_id??req.body.universityId??`STU${id}`).trim();
      const currentLevel=num(req.body.current_level??req.body.currentLevel,1);
      const student=await client.query(
        `INSERT INTO students(university_id,full_name,email,department_id,academic_level,status,account_id)
         VALUES($1,$2,$3,$4,$5,'ACTIVE',$6)
         ON CONFLICT (account_id) DO UPDATE SET
           university_id=EXCLUDED.university_id,full_name=EXCLUDED.full_name,email=EXCLUDED.email,
           department_id=EXCLUDED.department_id,academic_level=EXCLUDED.academic_level,state='ACTIVE'
         RETURNING id,university_id,academic_level`,
        [universityId,account.full_name,account.email,departmentId,currentLevel,id]
      );
      account.student_id=student.rows[0].id;
      account.university_id=student.rows[0].university_id;
      account.current_level=student.rows[0].academic_level;
    }
    return account;
  });
  if(departmentId){const d=await query(`SELECT name FROM departments WHERE id=$1`,[departmentId]);result.department_name=d.rows[0]?.name||null;}
  return ok(res,camelAccount(result));
});

const deleteAdminAccount=asyncHandler(async(req,res)=>{const id=num(req.params.id);if(id===Number(req.user.id))throw ApiError.badRequest('You cannot delete the account you are using.');const target=await accountsRepo.findById(id);if(!target)throw ApiError.notFound('Account not found.');if(target.role==='SUPER_ADMIN'){const count=(await query(`SELECT count(*)::int AS c FROM accounts WHERE role='SUPER_ADMIN' AND state<>'DISABLED'`)).rows[0].c;if(count<=1)throw ApiError.conflict('Cannot delete the last SUPER_ADMIN.');}await query(`DELETE FROM accounts WHERE id=$1`,[id]);return res.status(204).send();});

const listAdminRoles = asyncHandler(async(req,res) => {
  await ensureCompatTables();
  const custom=(await query(`SELECT * FROM frontend_custom_roles ORDER BY name`)).rows;
  const built=Object.entries(FRONTEND_ROLE_META).map(([dbRole,meta])=>({
    id:meta.id,
    name:meta.name,
    description:meta.description,
    permissions:meta.permissions,
    built_in:true,
    builtIn:true,
    isBuiltIn:true,
    db_role:dbRole,
  }));
  const customRoles=custom.map(r=>({
    id:String(r.id),
    name:r.name,
    description:r.description||'',
    permissions:Array.isArray(r.permissions)?r.permissions:[],
    built_in:false,
    builtIn:false,
    isBuiltIn:false,
    assignable:false,
  }));
  return ok(res,{ roles:[...built,...customRoles] });
});

const createAdminRole=asyncHandler(async(req,res)=>{await ensureCompatTables();const name=String(req.body.name||'').trim();const permissions=Array.isArray(req.body.permissions)?[...new Set(req.body.permissions)]:[];if(!name)throw ApiError.badRequest('Role name is required.');if(!permissions.length)throw ApiError.badRequest('Select at least one permission.');const r=(await query(`INSERT INTO frontend_custom_roles(name,description,permissions,created_by) VALUES($1,$2,$3,$4) RETURNING *`,[name,req.body.description||null,JSON.stringify(permissions),req.user.id])).rows[0];return created(res,{id:String(r.id),name:r.name,description:r.description||'',permissions:r.permissions||[],built_in:false,builtIn:false,isBuiltIn:false,assignable:false});});
const updateAdminRole=asyncHandler(async(req,res)=>{await ensureCompatTables();if(Object.values(FRONTEND_ROLE_META).some(meta=>meta.id===String(req.params.id)))throw ApiError.forbidden('Built-in roles are protected.');const r=(await query(`UPDATE frontend_custom_roles SET name=COALESCE($2,name),description=COALESCE($3,description),permissions=COALESCE($4::jsonb,permissions),updated_at=now() WHERE id=$1 RETURNING *`,[num(req.params.id),req.body.name||null,req.body.description??null,req.body.permissions?JSON.stringify([...new Set(req.body.permissions)]):null])).rows[0];if(!r)throw ApiError.notFound('Role not found.');return ok(res,{id:String(r.id),name:r.name,description:r.description||'',permissions:r.permissions||[],built_in:false,builtIn:false,isBuiltIn:false,assignable:false});});
const deleteAdminRole=asyncHandler(async(req,res)=>{await ensureCompatTables();if(Object.values(FRONTEND_ROLE_META).some(meta=>meta.id===String(req.params.id)))throw ApiError.forbidden('Built-in roles are protected.');const r=await query(`DELETE FROM frontend_custom_roles WHERE id=$1 RETURNING id`,[num(req.params.id)]);if(!r.rows[0])throw ApiError.notFound('Role not found.');return res.status(204).send();});

module.exports = {
  getMyProfile, updateMyProfile, changeMyPassword, forgotPassword, resetPassword,
  overview, auditLog,
  getDepartmentsCompat, createDepartment, updateDepartment, deleteDepartment,
  getMasterData, createMasterData, updateMasterData, endAcademicTerm, deleteMasterData, planningCatalog,
  getRequirements, createRequirement, updateRequirement, getInstructorAssignments, assignInstructor, removeInstructor,
  getMyAvailability, saveMyAvailability, confirmMyAvailability,
  getLabChecks, saveLabCheck, getRoomsCompat, createRoomCompat, updateRoomCompat, deleteRoom,
  getDraftWorkflow, getDraftAllocations, generateDraft, submitDraftReview,
  createDraftAllocation, updateDraftAllocation, deleteDraftAllocation, validateDraft, publishDraft,
  publishedTimetable,
  getStudentsCompat, getCourseEnrollments, createCourseEnrollment, deleteCourseEnrollment,
  getSectionEnrollments, createSectionEnrollment, deleteSectionEnrollment,
  listAdminAccounts, createAdminAccount, updateAdminAccount, deleteAdminAccount,
  listAdminRoles, createAdminRole, updateAdminRole, deleteAdminRole,
};
