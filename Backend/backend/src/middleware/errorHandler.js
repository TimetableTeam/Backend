'use strict';

const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

// PostgreSQL error codes we want to translate into clean API responses
// instead of leaking raw driver errors. https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_ERROR_MAP = {
  '23505': { status: 409, message: 'A record with these values already exists.' }, // unique_violation
  '23503': { status: 400, message: 'Referenced record does not exist.' }, // foreign_key_violation
  '23502': { status: 400, message: 'A required field is missing.' }, // not_null_violation
  '23514': { status: 400, message: 'Value violates a database constraint.' }, // check_violation
  '22007': { status: 400, message: 'Invalid date or time value.' },
  '22P02': { status: 400, message: 'Invalid input syntax.' },
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, ...err.extra });
  }

  if (err && typeof err.code === 'string' && PG_ERROR_MAP[err.code]) {
    const mapped = PG_ERROR_MAP[err.code];
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err?.message || 'Internal server error';
  return res.status(500).json({ success: false, message });
}

function notFoundHandler(req, res) {
  return res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
