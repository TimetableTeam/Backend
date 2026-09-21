'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { healthCheck } = require('../db/pool');
const { env } = require('../config/env');

const getHealth = asyncHandler(async (req, res) => {
  let db = { connected: false, error: 'DATABASE_URL not configured' };
  if (env.DATABASE_URL) {
    db = await healthCheck();
  }
  res.status(200).json({
    success: true,
    message: 'API is running',
    data: { environment: env.NODE_ENV, database: db },
  });
});

module.exports = { getHealth };
