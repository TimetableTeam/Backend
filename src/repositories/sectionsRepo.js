'use strict';

const { query } = require('../db/pool');

async function listByTerm(termId) {
  const res = await query(
    `SELECT s.id, s.term_id, s.course_id, c.code AS course_code, c.title AS course_title, s.code, s.status, s.created_at, s.updated_at
     FROM sections s JOIN courses c ON c.id = s.course_id
     WHERE s.term_id = $1 ORDER BY c.code, s.code`,
    [termId]
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM sections WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function findByCode(termId, code) {
  const res = await query(
    `SELECT s.* FROM sections s WHERE s.term_id = $1 AND s.code = $2`,
    [termId, code]
  );
  return res.rows[0] || null;
}

async function getGroupsForSection(sectionId) {
  const res = await query(
    `SELECT sg.id, sg.name, sg.student_count
     FROM section_groups s JOIN student_groups sg ON sg.id = s.group_id
     WHERE s.section_id = $1`,
    [sectionId]
  );
  return res.rows;
}

async function getGroupsForSections(sectionIds) {
  if (sectionIds.length === 0) return new Map();
  const res = await query(
    `SELECT s.section_id, sg.id, sg.name, sg.student_count
     FROM section_groups s JOIN student_groups sg ON sg.id = s.group_id
     WHERE s.section_id = ANY($1::bigint[])`,
    [sectionIds]
  );
  const map = new Map();
  for (const row of res.rows) {
    if (!map.has(row.section_id)) map.set(row.section_id, []);
    map.get(row.section_id).push({ id: row.id, name: row.name, student_count: row.student_count });
  }
  return map;
}

/** Instructors qualified/assigned to teach a given section for a given requirement. */
async function getInstructorsForSection(sectionId, requirementId) {
  const res = await query(
    `SELECT si.instructor_id, a.full_name, a.email, a.role
     FROM section_instructors si JOIN accounts a ON a.id = si.instructor_id
     WHERE si.section_id = $1 AND si.requirement_id = $2`,
    [sectionId, requirementId]
  );
  return res.rows;
}

async function isInstructorQualified(sectionId, instructorId, requirementId) {
  const res = await query(
    `SELECT 1 FROM section_instructors WHERE section_id = $1 AND instructor_id = $2 AND requirement_id = $3`,
    [sectionId, instructorId, requirementId]
  );
  return res.rowCount > 0;
}

async function createSection({ termId, courseId, code, createdBy }) {
  const res = await query(
    `INSERT INTO sections (term_id, course_id, code, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [termId, courseId, code, createdBy]
  );
  return res.rows[0];
}

module.exports = {
  listByTerm,
  findById,
  findByCode,
  getGroupsForSection,
  getGroupsForSections,
  getInstructorsForSection,
  isInstructorQualified,
  createSection,
};
