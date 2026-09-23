'use strict';

const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');

async function listByStudent(studentId) {
  const res = await query(
    `SELECT scr.*, c.code as course_code, c.title as course_title
     FROM student_course_registrations scr
     JOIN courses c ON c.id = scr.course_id
     WHERE scr.student_id = $1
     ORDER BY scr.registered_at DESC`,
    [studentId]
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(
    `SELECT scr.*, c.code as course_code, c.title as course_title
     FROM student_course_registrations scr
     JOIN courses c ON c.id = scr.course_id
     WHERE scr.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

async function create(data) {
  const res = await query(
    `INSERT INTO student_course_registrations (student_id, course_id, term_id, state, registered_by, registered_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.student_id, data.course_id, data.term_id, data.state || 'REGISTERED', data.registered_by, data.registered_at, data.updated_at]
  );
  return res.rows[0];
}

module.exports = { listByStudent, findById, create };