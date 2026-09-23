'use strict';

const { query } = require('../db/pool');

async function listAll() {
  const res = await query(`SELECT id, code, name, created_at FROM departments ORDER BY name`);
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT id, code, name, created_at FROM departments WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function findByCode(code) {
  const res = await query(`SELECT id, code, name, created_at FROM departments WHERE code = $1`, [code]);
  return res.rows[0] || null;
}

module.exports = { listAll, findById, findByCode };
