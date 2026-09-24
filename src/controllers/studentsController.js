'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const studentsRepo = require('../repositories/studentsRepo');
const studentCourseRegistrationsRepo = require('../repositories/studentCourseRegistrationsRepo');
const studentSectionEnrollmentsRepo = require('../repositories/studentSectionEnrollmentsRepo');
const ApiError = require('../utils/ApiError');
const { validatePassword } = require('../utils/passwordPolicy');
const bcrypt = require('bcryptjs');
const { withTransaction, query } = require('../db/pool');
const auditRepo = require('../repositories/auditRepo');

const listStudents = asyncHandler(async (req, res) => {
  const {
    termId,
    departmentId,
    academicLevel,
    page = 1,
    limit = 50
  } = req.query;

  const result = await studentsRepo.list({
    termId: termId ? Number(termId) : null,
    departmentId: departmentId ? Number(departmentId) : null,
    academicLevel: academicLevel ? Number(academicLevel) : null,
    page: Number(page),
    limit: Number(limit)
  });

  return ok(res, result);
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await studentsRepo.findById(req.params.id);

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  return ok(res, student);
});

const getMyProfile = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw ApiError.forbidden(
      'Only students can access this endpoint'
    );
  }

  const student = await studentsRepo.findByAccountId(req.user.id);

  if (!student) {
    throw ApiError.notFound('Student profile not found');
  }

  return ok(res, student);
});

const getMyRegistrations = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw ApiError.forbidden(
      'Only students can access this endpoint'
    );
  }

  const student = await studentsRepo.findByAccountId(req.user.id);

  if (!student) {
    throw ApiError.notFound('Student profile not found');
  }

  const registrations =
    await studentCourseRegistrationsRepo.listByStudent(student.id);

  return ok(res, registrations);
});

const getMyEnrollments = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw ApiError.forbidden(
      'Only students can access this endpoint'
    );
  }

  const student = await studentsRepo.findByAccountId(req.user.id);

  if (!student) {
    throw ApiError.notFound('Student profile not found');
  }

  const enrollments =
    await studentSectionEnrollmentsRepo.listByStudent(student.id);

  return ok(res, enrollments);
});

const getMyTimetable = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw ApiError.forbidden(
      'Only students can access this endpoint'
    );
  }

  const student = await studentsRepo.findByAccountId(req.user.id);

  if (!student) {
    throw ApiError.notFound('Student profile not found');
  }

  const versionRes = await query(
    `SELECT sv.id
     FROM schedule_versions sv
     JOIN academic_terms t ON t.id = sv.term_id
     WHERE sv.state = 'PUBLISHED'
     ORDER BY (t.state = 'ACTIVE') DESC, t.starts_on DESC, sv.published_at DESC
     LIMIT 1`
  );

  if (!versionRes.rows.length) {
    return ok(res, {
      allocations: [],
      message: 'No published schedule'
    });
  }

  const versionId = versionRes.rows[0].id;

  const enrollments =
    await studentSectionEnrollmentsRepo.listByStudent(student.id);

  const activeEnrollmentSectionIds = enrollments
    .filter((e) => e.state === 'ACTIVE')
    .map((e) => e.section_id);

  if (activeEnrollmentSectionIds.length === 0) {
    return ok(res, {
      allocations: [],
      message: 'No active enrollments'
    });
  }

  const allocationsRes = await query(
    `SELECT
       a.*,
       s.code as section_code,
       c.code as course_code,
       c.title as course_title,
       r.code as room_code,
       r.building as room_building,
       ts.weekday,
       ts.starts_at,
       a.ends_at,
       sr.kind as session_kind,
       ins.full_name as instructor_name
     FROM allocations a
     JOIN sections s
       ON s.id = a.section_id
     JOIN courses c
       ON c.id = s.course_id
     JOIN rooms r
       ON r.id = a.room_id
     JOIN time_slots ts
       ON ts.id = a.start_slot_id
     JOIN session_requirements sr
       ON sr.id = a.requirement_id
     JOIN accounts ins
       ON ins.id = a.instructor_id
     WHERE a.version_id = $1
       AND a.section_id = ANY($2::bigint[])
     ORDER BY ts.weekday, ts.starts_at`,
    [versionId, activeEnrollmentSectionIds]
  );

  return ok(res, {
    student: {
      id: student.id,
      name: student.full_name
    },
    allocations: allocationsRes.rows
  });
});

module.exports = {
  listStudents,
  getStudent,
  getMyProfile,
  getMyRegistrations,
  getMyEnrollments,
  getMyTimetable,

  createStudent: asyncHandler(async (req, res) => {
    const {
      university_id,
      full_name,
      email,
      department_id,
      academic_level,
      password
    } = req.body;

    if (
      !university_id ||
      !full_name ||
      !email ||
      !department_id ||
      !academic_level ||
      !password
    ) {
      throw ApiError.badRequest(
        'university_id, full_name, email, department_id, academic_level, and password are required'
      );
    }

    const policyResult = validatePassword(password);

    if (!policyResult.valid) {
      throw ApiError.badRequest(
        'Password does not meet policy.',
        {
          errors: policyResult.errors
        }
      );
    }

    const existingStudentByEmail =
      await studentsRepo.findByEmail(email);

    if (existingStudentByEmail) {
      throw ApiError.conflict(
        'A student with this email already exists'
      );
    }

    const existingStudentByUniversityId =
      await studentsRepo.findByUniversityId(university_id);

    if (existingStudentByUniversityId) {
      throw ApiError.conflict(
        'A student with this university ID already exists'
      );
    }

    const deptRes = await query(
      'SELECT id FROM departments WHERE id = $1',
      [department_id]
    );

    if (!deptRes.rows.length) {
      throw ApiError.badRequest('Invalid department_id');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await withTransaction(async (client) => {
      const accountRes = await client.query(
        `INSERT INTO accounts
         (
           email,
           full_name,
           role,
           state,
           home_department_id,
           password_hash,
           created_by
         )
         VALUES
         (
           $1,
           $2,
           'STUDENT',
           'ACTIVE',
           $3,
           $4,
           $5
         )
         RETURNING *`,
        [
          email,
          full_name,
          department_id,
          passwordHash,
          req.user.id
        ]
      );

      const account = accountRes.rows[0];

      const studentRes = await client.query(
        `INSERT INTO students
         (
           university_id,
           full_name,
           email,
           department_id,
           academic_level,
           account_id,
           status
         )
         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           'ACTIVE'
         )
         RETURNING *`,
        [
          university_id,
          full_name,
          email,
          department_id,
          academic_level,
          account.id
        ]
      );

      const student = studentRes.rows[0];

      await auditRepo.record({
        actorAccountId: req.user.id,
        actorEmail: req.user.email,
        action: 'STUDENT_CREATED',
        entityType: 'students',
        entityId: student.id,
        outcome: 'SUCCESS',
        details: {
          studentId: student.id,
          accountId: account.id
        }
      });

      return {
        account,
        student
      };
    });

    return ok(res, {
      student: {
        id: result.student.id,
        university_id: result.student.university_id,
        full_name: result.student.full_name,
        email: result.student.email,
        department_id: result.student.department_id,
        academic_level: result.student.academic_level,
        status: result.student.status
      }
    });
  })
};