'use strict';

const { query } = require('../db/pool');

async function listByTerm(termId) {
  const res = await query(
    `SELECT sg.id, sg.term_id, sg.department_id, d.code AS department_code, sg.name, sg.student_count
     FROM student_groups sg JOIN departments d ON d.id = sg.department_id
     WHERE sg.term_id = $1 ORDER BY sg.name`,
    [termId]
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM student_groups WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function createGroup({ termId, departmentId, name, studentCount }) {
  const res = await query(
    `INSERT INTO student_groups (term_id, department_id, name, student_count) VALUES ($1,$2,$3,$4) RETURNING *`,
    [termId, departmentId, name, studentCount]
  );
  return res.rows[0];
}

module.exports = { listByTerm, findById, createGroup };
