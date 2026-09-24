'use strict';

const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');

async function list({ termId = null, departmentId = null, academicLevel = null, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (termId) {
    conditions.push(`EXISTS (SELECT 1 FROM student_course_registrations scr WHERE scr.student_id = s.id AND scr.term_id = $${paramIndex++} AND scr.state = 'REGISTERED')`);
    params.push(termId);
  }
  if (departmentId) {
    conditions.push(`s.department_id = $${paramIndex++}`);
    params.push(departmentId);
  }
  if (academicLevel) {
    conditions.push(`s.academic_level = $${paramIndex++}`);
    params.push(academicLevel);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const countRes = await query(
    `SELECT COUNT(*) FROM students s ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit, offset);
  const dataRes = await query(
    `SELECT s.*, a.email, a.full_name as account_name, a.role
     FROM students s
     LEFT JOIN accounts a ON a.id = s.account_id
     ${whereClause}
     ORDER BY s.full_name
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );

  return {
    data: dataRes.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function findById(id) {
  const res = await query(
    `SELECT s.*, a.email, a.full_name as account_name, a.role
     FROM students s
     LEFT JOIN accounts a ON a.id = s.account_id
     WHERE s.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

async function findByUniversityId(university_id) {
  const res = await query(
    `SELECT s.*, a.email, a.full_name as account_name, a.role
     FROM students s
     LEFT JOIN accounts a ON a.id = s.account_id
     WHERE s.university_id = $1`,
    [university_id]
  );
  return res.rows[0] || null;
}

async function findByEmail(email) {
  const res = await query(
    `SELECT s.*, a.email, a.full_name as account_name, a.role
     FROM students s
     LEFT JOIN accounts a ON a.id = s.account_id
     WHERE lower(s.email) = lower($1)`,
    [email]
  );
  return res.rows[0] || null;
}

async function findByAccountId(accountId) {
  const res = await query(
    `SELECT s.*, a.email, a.full_name as account_name, a.role
     FROM students s
     LEFT JOIN accounts a ON a.id = s.account_id
     WHERE s.account_id = $1`,
    [accountId]
  );
  return res.rows[0] || null;
}

async function create(data) {
  const res = await query(
    `INSERT INTO students (university_id, full_name, email, department_id, academic_level, account_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.university_id, data.full_name, data.email, data.department_id || null, data.academic_level || null, data.account_id || null, data.status || 'ACTIVE', data.created_at || new Date(), data.updated_at || new Date()]
  );
  return res.rows[0];
}

module.exports = { list, findById, findByUniversityId, findByEmail, findByAccountId, create };