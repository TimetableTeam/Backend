'use strict';

const { query } = require('../db/pool');

async function getSubmission(termId, instructorId) {
  const res = await query(
    `SELECT id, term_id, instructor_id, state, confirmed_at, revision
     FROM availability_submissions WHERE term_id = $1 AND instructor_id = $2`,
    [termId, instructorId]
  );
  return res.rows[0] || null;
}

/** Returns { submissionState, slots: { 'weekday-HH:MM': kind } } shaped exactly for the conflict engine. */
async function getAvailabilityForEngine(termId, instructorId) {
  const submission = await getSubmission(termId, instructorId);
  if (!submission) return { submissionState: null, slots: {} };

  const res = await query(
    `SELECT ts.weekday, ts.starts_at, av.kind
     FROM availability_slots av JOIN time_slots ts ON ts.id = av.slot_id AND ts.term_id = av.term_id
     WHERE av.submission_id = $1`,
    [submission.id]
  );

  const slots = {};
  for (const row of res.rows) {
    const start = String(row.starts_at).slice(0, 5);
    slots[`${row.weekday}-${start}`] = row.kind;
  }
  return { submissionState: submission.state, slots };
}

/** Batch version for multiple instructors (used by recommendation engine over many candidates). */
async function getAvailabilityForEngineBatch(termId, instructorIds) {
  const map = new Map();
  for (const id of instructorIds) {
    map.set(id, await getAvailabilityForEngine(termId, id));
  }
  return map;
}

async function upsertSubmissionDraft(termId, instructorId) {
  const res = await query(
    `INSERT INTO availability_submissions (term_id, instructor_id, state)
     VALUES ($1,$2,'DRAFT')
     ON CONFLICT (term_id, instructor_id) DO UPDATE SET state = 'DRAFT', confirmed_at = NULL, updated_at = now(), revision = availability_submissions.revision + 1
     RETURNING *`,
    [termId, instructorId]
  );
  return res.rows[0];
}

async function setSlot(submissionId, termId, slotId, kind) {
  const res = await query(
    `INSERT INTO availability_slots (submission_id, term_id, slot_id, kind) VALUES ($1,$2,$3,$4)
     ON CONFLICT (submission_id, slot_id) DO UPDATE SET kind = EXCLUDED.kind
     RETURNING *`,
    [submissionId, termId, slotId, kind]
  );
  return res.rows[0];
}

async function confirmSubmission(submissionId) {
  const res = await query(
    `UPDATE availability_submissions SET state = 'CONFIRMED', confirmed_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [submissionId]
  );
  return res.rows[0];
}

module.exports = {
  getSubmission,
  getAvailabilityForEngine,
  getAvailabilityForEngineBatch,
  upsertSubmissionDraft,
  setSlot,
  confirmSubmission,
};
