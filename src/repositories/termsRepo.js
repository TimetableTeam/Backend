'use strict';

const { query } = require('../db/pool');

async function listAll() {
  const res = await query(
    `SELECT id, name, starts_on, ends_on, state, availability_deadline, created_at, updated_at
     FROM academic_terms ORDER BY starts_on DESC`
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM academic_terms WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function findActive() {
  const res = await query(`SELECT * FROM academic_terms WHERE state = 'ACTIVE' ORDER BY starts_on DESC LIMIT 1`);
  return res.rows[0] || null;
}

async function findCurrent() {
  const res = await query(
    `SELECT * FROM academic_terms
     WHERE state <> 'ARCHIVED'
     ORDER BY CASE WHEN state='ACTIVE' THEN 0 ELSE 1 END, starts_on DESC
     LIMIT 1`
  );
  return res.rows[0] || null;
}

async function findActiveOrLatest() {
  const active = await query(`SELECT * FROM academic_terms WHERE state = 'ACTIVE' ORDER BY starts_on DESC LIMIT 1`);
  if (active.rows[0]) return active.rows[0];
  const latest = await query(`SELECT * FROM academic_terms ORDER BY starts_on DESC LIMIT 1`);
  return latest.rows[0] || null;
}

async function getHolidays(termId) {
  const res = await query(`SELECT holiday_date, reason FROM term_holidays WHERE term_id = $1`, [termId]);
  return res.rows;
}

module.exports = { listAll, findById, findActive, findCurrent, findActiveOrLatest, getHolidays };
