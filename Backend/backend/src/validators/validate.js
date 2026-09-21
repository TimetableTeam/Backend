'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Minimal, dependency-free request validator.
 * `schema` maps field name -> validator function(value) => string|null (error message or null if valid).
 * Reads from req.body by default; pass `source` to validate req.query/req.params instead.
 */
function validateBody(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const target = req[source] || {};
    const errors = {};
    for (const [field, validator] of Object.entries(schema)) {
      const message = validator(target[field], target);
      if (message) errors[field] = message;
    }
    if (Object.keys(errors).length > 0) {
      return next(ApiError.badRequest('Validation failed.', { errors }));
    }
    return next();
  };
}

// --- Reusable field validators -------------------------------------------

const required = (label = 'This field') => (v) => (v === undefined || v === null || v === '' ? `${label} is required.` : null);

const isString = (label = 'This field') => (v) => (v !== undefined && v !== null && typeof v !== 'string' ? `${label} must be a string.` : null);

const isEmail = (label = 'Email') => (v) => {
  if (v === undefined || v === null || v === '') return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : `${label} must be a valid email.`;
};

const isInt = (label = 'This field') => (v) => (v !== undefined && v !== null && !Number.isInteger(Number(v)) ? `${label} must be an integer.` : null);

const isPositiveInt = (label = 'This field') => (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? null : `${label} must be a positive integer.`;
};

const isOneOf = (values, label = 'This field') => (v) => (v !== undefined && v !== null && !values.includes(v) ? `${label} must be one of: ${values.join(', ')}.` : null);

const isTime = (label = 'This field') => (v) => (v !== undefined && v !== null && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v) ? `${label} must be HH:MM.` : null);

const isWeekday = (label = 'Weekday') => (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? null : `${label} must be an integer 1-7 (Mon-Sun).`;
};

/** Combine multiple validator functions; returns first failure. */
function all(...validators) {
  return (v, obj) => {
    for (const validator of validators) {
      const msg = validator(v, obj);
      if (msg) return msg;
    }
    return null;
  };
}

module.exports = { validateBody, required, isString, isEmail, isInt, isPositiveInt, isOneOf, isTime, isWeekday, all };
