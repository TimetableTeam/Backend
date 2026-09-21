'use strict';

const { query } = require('../db/pool');

async function listAll() {
  const res = await query(`SELECT id, name FROM equipment ORDER BY name`);
  return res.rows;
}

async function findOrCreateByName(name) {
  const existing = await query(`SELECT id, name FROM equipment WHERE name = $1`, [name]);
  if (existing.rows[0]) return existing.rows[0];
  const created = await query(`INSERT INTO equipment (name) VALUES ($1) RETURNING id, name`, [name]);
  return created.rows[0];
}

module.exports = { listAll, findOrCreateByName };
