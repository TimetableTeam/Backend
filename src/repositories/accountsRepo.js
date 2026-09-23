'use strict';

const { query } = require('../db/pool');

const PUBLIC_COLUMNS = `id, email, full_name, role, state, home_department_id, created_at, updated_at, last_login_at`;

async function findByEmail(email) {
  const res = await query(`SELECT * FROM accounts WHERE lower(email) = lower($1)`, [email]);
  return res.rows[0] || null;
}

async function findById(id) {
  const res = await query(`SELECT * FROM accounts WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function findPublicById(id) {
  const res = await query(`SELECT ${PUBLIC_COLUMNS} FROM accounts WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function listByRole(role) {
  const res = await query(`SELECT ${PUBLIC_COLUMNS} FROM accounts WHERE role = $1 AND state <> 'DISABLED' ORDER BY full_name`, [role]);
  return res.rows;
}

/** Staff = anyone who can be assigned to teach a session (LECTURER, TA). */
async function listStaff() {
  const res = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM accounts WHERE role IN ('LECTURER','TA') AND state <> 'DISABLED' ORDER BY full_name`
  );
  return res.rows;
}

async function listAll({ role, state, departmentId } = {}) {
  const clauses = [];
  const params = [];
  if (role) {
    params.push(role);
    clauses.push(`role = $${params.length}`);
  }
  if (state) {
    params.push(state);
    clauses.push(`state = $${params.length}`);
  }
  if (departmentId) {
    params.push(departmentId);
    clauses.push(`home_department_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await query(`SELECT ${PUBLIC_COLUMNS} FROM accounts ${where} ORDER BY full_name`, params);
  return res.rows;
}

async function createAccount({ email, fullName, role, state = 'INVITED', homeDepartmentId = null, passwordHash = null, createdBy = null }) {
  const res = await query(
    `INSERT INTO accounts (email, full_name, role, state, home_department_id, password_hash, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [email, fullName, role, state, homeDepartmentId, passwordHash, createdBy]
  );
  return res.rows[0];
}

async function updatePassword(id, passwordHash) {
  const res = await query(
    `UPDATE accounts SET password_hash = $2, state = 'ACTIVE', updated_at = now() WHERE id = $1 RETURNING *`,
    [id, passwordHash]
  );
  return res.rows[0];
}

async function touchLastLogin(id) {
  await query(`UPDATE accounts SET last_login_at = now() WHERE id = $1`, [id]);
}

async function setRole(id, role) {
  const res = await query(`UPDATE accounts SET role = $2, updated_at = now() WHERE id = $1 RETURNING *`, [id, role]);
  return res.rows[0];
}

module.exports = {
  findByEmail,
  findById,
  findPublicById,
  listByRole,
  listStaff,
  listAll,
  createAccount,
  updatePassword,
  touchLastLogin,
  setRole,
};
