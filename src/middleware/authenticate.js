'use strict';

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

/** Requires a valid Bearer JWT; attaches { id, email, role, homeDepartmentId } to req.user. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header.'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      homeDepartmentId: payload.homeDepartmentId ?? null,
    };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token.'));
  }
}

/** Optional auth: attaches req.user if a valid token is present, otherwise continues anonymously. */
function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      homeDepartmentId: payload.homeDepartmentId ?? null,
    };
  } catch {
    // ignore invalid token for optional auth
  }
  return next();
}

module.exports = { authenticate, optionalAuthenticate };
