'use strict';

require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 5000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || 'engramzy9@gmail.com',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || '',
  // Dev-only convenience: when true, OTP/challenge codes for non-super-admin
  // logins are returned in the API response instead of only being "emailed"
  // (no mail server exists in this project). NEVER enable in production.
  DEV_EXPOSE_OTP: (process.env.DEV_EXPOSE_OTP || 'true') === 'true' && process.env.NODE_ENV !== 'production',
};

function assertProductionSafety() {
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production');
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL must be set in production');
    if (env.DEV_EXPOSE_OTP) throw new Error('DEV_EXPOSE_OTP must not be enabled in production');
  }
}

module.exports = { env, required, assertProductionSafety };
