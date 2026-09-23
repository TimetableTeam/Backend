'use strict';

const { query } = require('../db/pool');

async function listByTerm(termId, client) {
  const runner = client || { query };
  const res = await runner.query(
    `SELECT id, term_id, version_number, name, state, created_by, published_by, published_at, created_at, updated_at
     FROM schedule_versions WHERE term_id = $1 ORDER BY version_number DESC`,
    [termId]
  );
  return res.rows;
}

async function findById(id, client) {
  const runner = client || { query };
  const res = await runner.query(`SELECT * FROM schedule_versions WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

/** Look up a version by its (term, version_number) pair. Used to resolve frontend slugs like "draft-v3" to a real row. */
async function findByTermAndVersionNumber(termId, versionNumber, client) {
  const runner = client || { query };
  const res = await runner.query(
    `SELECT * FROM schedule_versions WHERE term_id = $1 AND version_number = $2`,
    [termId, versionNumber]
  );
  return res.rows[0] || null;
}

async function findPublished(termId, client) {
  const runner = client || { query };
  const res = await runner.query(`SELECT * FROM schedule_versions WHERE term_id = $1 AND state = 'PUBLISHED'`, [termId]);
  return res.rows[0] || null;
}

async function nextVersionNumber(termId, client) {
  const runner = client || { query };
  const res = await runner.query(`SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM schedule_versions WHERE term_id = $1`, [termId]);
  return res.rows[0].next;
}

async function createDraft({ termId, name, createdBy }, client) {
  const versionNumber = await nextVersionNumber(termId, client);
  const runner = client || { query };
  const res = await runner.query(
    `INSERT INTO schedule_versions (term_id, version_number, name, state, created_by)
     VALUES ($1,$2,$3,'DRAFT',$4) RETURNING *`,
    [termId, versionNumber, name, createdBy]
  );
  return res.rows[0];
}

/** Publish inside a transaction: archive the previously published version, then publish this one. */
async function publish(client, versionId, publishedBy) {
  const version = (await client.query(`SELECT * FROM schedule_versions WHERE id = $1 FOR UPDATE`, [versionId])).rows[0];
  if (!version) throw new Error('Schedule version not found');

  await client.query(
    `UPDATE schedule_versions SET state = 'ARCHIVED', updated_at = now() WHERE term_id = $1 AND state = 'PUBLISHED'`,
    [version.term_id]
  );
  const res = await client.query(
    `UPDATE schedule_versions SET state = 'PUBLISHED', published_by = $2, published_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [versionId, publishedBy]
  );
  return res.rows[0];
}

module.exports = { listByTerm, findById, findByTermAndVersionNumber, findPublished, nextVersionNumber, createDraft, publish };