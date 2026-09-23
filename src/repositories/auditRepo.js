'use strict';

const { query } = require('../db/pool');

async function record({ actorAccountId, actorEmail, action, entityType, entityId, departmentId, details = {}, outcome = 'SUCCESS', ipAddress = null }) {
  // Never log secrets: caller is responsible for keeping `details` free of
  // passwords, OTP codes, tokens, or session identifiers.
  await query(
    `INSERT INTO audit_events (actor_account_id, actor_email, action, entity_type, entity_id, department_id, details, outcome, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [actorAccountId, actorEmail, action, entityType || null, entityId || null, departmentId || null, JSON.stringify(details), outcome, ipAddress]
  );
}

async function listRecent(limit = 50) {
  const res = await query(`SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT $1`, [limit]);
  return res.rows;
}

module.exports = { record, listRecent };
