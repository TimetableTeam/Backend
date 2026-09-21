'use strict';

// Schema comment #9: "at least 8 characters with upper/lowercase letters,
// a digit and a symbol; permit longer passwords."
const SYMBOL_RE = /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/;

function validatePassword(password) {
  const errors = [];
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (typeof password === 'string') {
    if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
    if (!/\d/.test(password)) errors.push('Password must contain a digit.');
    if (!SYMBOL_RE.test(password)) errors.push('Password must contain a symbol.');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validatePassword };
