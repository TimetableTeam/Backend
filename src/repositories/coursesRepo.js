'use strict';

const { query } = require('../db/pool');

async function listAll({ departmentId, departmentIds } = {}) {
  const params = [];
  let where = '';
  if (departmentIds && departmentIds.length > 0) {
    params.push(departmentIds);
    where = `WHERE c.department_id = ANY($1::bigint[])`;
  } else if (departmentId) {
    params.push(departmentId);
    where = `WHERE c.department_id = $1`;
  }
  const res = await query(
    `SELECT c.id, c.department_id, d.code AS department_code, d.name AS department_name, c.code, c.title, c.created_at, c.updated_at
     FROM courses c JOIN departments d ON d.id = c.department_id
     ${where} ORDER BY c.code`,
    params
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM courses WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function findByCode(departmentId, code) {
  const res = await query(`SELECT * FROM courses WHERE department_id = $1 AND code = $2`, [departmentId, code]);
  return res.rows[0] || null;
}

async function createCourse({ departmentId, code, title, createdBy }) {
  const res = await query(
    `INSERT INTO courses (department_id, code, title, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [departmentId, code, title, createdBy]
  );
  return res.rows[0];
}

module.exports = { listAll, findById, findByCode, createCourse };
