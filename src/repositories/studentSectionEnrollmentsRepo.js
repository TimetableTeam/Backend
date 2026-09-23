'use strict';

const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');

async function listByStudent(studentId) {
  const res = await query(
    `SELECT sse.*, s.code as section_code, s.kind as section_kind, c.code as course_code, c.title as course_title
     FROM student_section_enrollments sse
     JOIN sections s ON s.id = sse.section_id
     JOIN courses c ON c.id = sse.course_id
     WHERE sse.student_id = $1
     ORDER BY sse.assigned_at DESC`,
    [studentId]
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(
    `SELECT sse.*, s.code as section_code, s.kind as section_kind, c.code as course_code, c.title as course_title
     FROM student_section_enrollments sse
     JOIN sections s ON s.id = sse.section_id
     JOIN courses c ON c.id = sse.course_id
     WHERE sse.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

async function create(data) {
  const res = await query(
    `INSERT INTO student_section_enrollments (registration_id, term_id, course_id, section_kind, section_id, state, assigned_by, assigned_at, ended_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.registration_id, data.term_id, data.course_id, data.section_kind, data.section_id, data.state || 'ACTIVE', data.assigned_by, data.assigned_at, data.ended_at || null]
  );
  return res.rows[0];
}

async function listBySection(sectionId) {
  const res = await query(
    `SELECT sse.*, st.full_name as student_name, st.university_id, st.email
     FROM student_section_enrollments sse
     JOIN students st ON st.id = sse.student_id
     WHERE sse.section_id = $1 AND sse.state = 'ACTIVE'
     ORDER BY st.full_name`,
    [sectionId]
  );
  return res.rows;
}

module.exports = { listByStudent, findById, create, listBySection };