'use strict';

const { query } = require('../db/pool');

async function listByCourseTerm(courseId, termId) {
  const res = await query(
    `SELECT * FROM session_requirements WHERE course_id = $1 AND term_id = $2 ORDER BY id`,
    [courseId, termId]
  );
  return res.rows;
}

/** All session requirements for a term, optionally narrowed to one course. Used by the flat /requirements endpoint. */
async function listByTerm(termId, { courseId } = {}) {
  const params = [termId];
  let extra = '';
  if (courseId) {
    params.push(courseId);
    extra = ` AND sr.course_id = $${params.length}`;
  }
  const res = await query(
    `SELECT sr.*, c.code AS course_code, c.title AS course_title, c.department_id
     FROM session_requirements sr JOIN courses c ON c.id = sr.course_id
     WHERE sr.term_id = $1 ${extra}
     ORDER BY c.code, sr.kind`,
    params
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM session_requirements WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function getRequiredEquipment(requirementId) {
  const res = await query(
    `SELECT re.equipment_id, e.name, re.quantity
     FROM required_equipment re JOIN equipment e ON e.id = re.equipment_id
     WHERE re.requirement_id = $1`,
    [requirementId]
  );
  return res.rows;
}

async function createRequirement({ courseId, termId, kind, sessionsPerWeek, durationMinutes, requiredRoomKind, preferredWindowNote, createdBy }) {
  const res = await query(
    `INSERT INTO session_requirements (course_id, term_id, kind, sessions_per_week, duration_minutes, required_room_kind, preferred_window_note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [courseId, termId, kind, sessionsPerWeek, durationMinutes, requiredRoomKind, preferredWindowNote || null, createdBy]
  );
  return res.rows[0];
}

async function addRequiredEquipment(requirementId, equipmentId, quantity) {
  const res = await query(
    `INSERT INTO required_equipment (requirement_id, equipment_id, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (requirement_id, equipment_id) DO UPDATE SET quantity = EXCLUDED.quantity RETURNING *`,
    [requirementId, equipmentId, quantity]
  );
  return res.rows[0];
}

module.exports = { listByCourseTerm, listByTerm, findById, getRequiredEquipment, createRequirement, addRequiredEquipment };
