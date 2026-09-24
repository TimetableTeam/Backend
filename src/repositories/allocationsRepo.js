'use strict';

const { query } = require('../db/pool');

async function listByVersion(versionId) {
  const res = await query(
    `SELECT
        al.id, al.term_id, al.version_id, al.section_id, al.requirement_id,
        al.instructor_id, ins.full_name AS instructor_name,
        al.room_id, r.code AS room_code, r.building AS room_building,
        ts.weekday, ts.starts_at AS start, al.ends_at AS end,
        sec.code AS section_code, c.id AS course_id, c.code AS course_code, c.title AS course_title, c.department_id,
        sr.kind AS session_kind,
        al.created_at, al.updated_at
     FROM allocations al
     JOIN accounts ins ON ins.id = al.instructor_id
     JOIN rooms r ON r.id = al.room_id
     JOIN time_slots ts ON ts.id = al.start_slot_id
     JOIN sections sec ON sec.id = al.section_id
     JOIN courses c ON c.id = sec.course_id
     JOIN session_requirements sr ON sr.id = al.requirement_id
     WHERE al.version_id = $1
     ORDER BY ts.weekday, ts.starts_at, r.code`,
    [versionId]
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM allocations WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

/**
 * Existing allocations for a version, shaped exactly for the conflict engine:
 * [{id, weekday, start, end, roomId, instructorId, groupIds:[]}]
 * `excludeId` omits the allocation currently being edited (self-exclusion).
 */
async function listForEngine(versionId, excludeId = null) {
  const res = await query(
    `SELECT al.id, ts.weekday, ts.starts_at AS start, al.ends_at AS end, al.room_id, al.instructor_id, al.section_id
     FROM allocations al JOIN time_slots ts ON ts.id = al.start_slot_id
     WHERE al.version_id = $1 AND ($2::bigint IS NULL OR al.id <> $2)`,
    [versionId, excludeId]
  );
  if (res.rows.length === 0) return [];

  const sectionIds = [...new Set(res.rows.map((r) => r.section_id))];
  const groupsRes = await query(
    `SELECT sg.section_id, sg.group_id FROM section_groups sg WHERE sg.section_id = ANY($1::bigint[])`,
    [sectionIds]
  );
  const groupsBySection = new Map();
  for (const row of groupsRes.rows) {
    if (!groupsBySection.has(row.section_id)) groupsBySection.set(row.section_id, []);
    groupsBySection.get(row.section_id).push(row.group_id);
  }

  return res.rows.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    start: String(r.start).slice(0, 5),
    end: String(r.end).slice(0, 5),
    roomId: r.room_id,
    instructorId: r.instructor_id,
    groupIds: groupsBySection.get(r.section_id) || [],
  }));
}

async function create(client, { termId, versionId, sectionId, requirementId, instructorId, roomId, startSlotId, endsAt, createdBy }) {
  const res = await client.query(
    `INSERT INTO allocations (term_id, version_id, section_id, requirement_id, instructor_id, room_id, start_slot_id, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [termId, versionId, sectionId, requirementId, instructorId, roomId, startSlotId, endsAt, createdBy]
  );
  return res.rows[0];
}

async function update(client, id, { roomId, startSlotId, endsAt, instructorId, updatedBy }) {
  const res = await client.query(
    `UPDATE allocations SET room_id = $2, start_slot_id = $3, ends_at = $4, instructor_id = $5, updated_by = $6, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, roomId, startSlotId, endsAt, instructorId, updatedBy]
  );
  return res.rows[0];
}

async function remove(id) {
  const res = await query(`DELETE FROM allocations WHERE id = $1 RETURNING id`, [id]);
  return res.rowCount > 0;
}

module.exports = { listByVersion, findById, listForEngine, create, update, remove };
