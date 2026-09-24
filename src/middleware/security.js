'use strict';

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

function intFromEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Local frontend development can generate many API reads (React StrictMode also
// runs effects twice). Rate limiting localhost makes integration testing fail
// with 429s even though nothing abusive is happening. Keep limits enabled in
// production, but disable them automatically in development/test. Production
// limits remain configurable through environment variables.
const rateLimitsDisabled =
  process.env.DISABLE_RATE_LIMIT === 'true' ||
  process.env.NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'test';

const apiLimiter = rateLimit({
  windowMs: intFromEnv('API_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  // 100 was too small for this SPA because one page can legitimately load
  // catalog, rooms, requirements, workflow and user data in parallel.
  max: intFromEnv('API_RATE_LIMIT_MAX', 1000),
  skip: () => rateLimitsDisabled,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: intFromEnv('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: intFromEnv('AUTH_RATE_LIMIT_MAX', 20),
  skip: () => rateLimitsDisabled,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: intFromEnv('PASSWORD_RESET_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000),
  max: intFromEnv('PASSWORD_RESET_RATE_LIMIT_MAX', 5),
  skip: () => rateLimitsDisabled,
  message: {
    success: false,
    message: 'Too many password reset requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  securityHeaders,
  apiLimiter,
  authLimiter,
  passwordResetLimiter
};
