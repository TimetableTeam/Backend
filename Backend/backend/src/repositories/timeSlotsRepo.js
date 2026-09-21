'use strict';

const { query } = require('../db/pool');

async function listByTerm(termId) {
  const res = await query(
    `SELECT id, term_id, weekday, starts_at, ends_at, label
     FROM time_slots WHERE term_id = $1 ORDER BY weekday, starts_at`,
    [termId]
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM time_slots WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

/** Find the slot matching a given term/weekday/start exactly (used to resolve start_slot_id on write). */
async function findByTermWeekdayStart(termId, weekday, start) {
  const res = await query(
    `SELECT * FROM time_slots WHERE term_id = $1 AND weekday = $2 AND starts_at = $3`,
    [termId, weekday, start]
  );
  return res.rows[0] || null;
}

module.exports = { listByTerm, findById, findByTermWeekdayStart };
