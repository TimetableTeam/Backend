'use strict';

const { Pool } = require('pg');
const { env } = require('../config/env');

let pool = null;

function getPool() {
  if (!pool) {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured. Set it in your .env file.');
    }
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      // Reasonable defaults for a small university project - not overengineered.
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      // Unexpected errors on idle clients should not crash the process.
      // eslint-disable-next-line no-console
      console.error('Unexpected PostgreSQL pool error', err);
    });
  }
  return pool;
}

async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

/** Run `fn(client)` inside a transaction; commits on success, rolls back on throw. */
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  try {
    const res = await query('SELECT 1 AS ok');
    return { connected: true, result: res.rows[0] };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, withTransaction, healthCheck, closePool };
