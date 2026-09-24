'use strict';

const { createApp } = require('./app');
const { env, assertProductionSafety, assertJwtConfigured } = require('./config/env');
const { healthCheck, closePool } = require('./db/pool');
const { bootstrapSuperAdmin } = require('./db/bootstrapSuperAdmin');
const { ensureFrontendCompatibilitySchema } = require('./db/frontendCompatibilitySchema');

async function start() {
  assertProductionSafety();
  assertJwtConfigured();

  if (env.DATABASE_URL) {
    const db = await healthCheck();
    if (!db.connected) {
      console.error('[startup] Could not connect to PostgreSQL:', db.error);
      console.error('[startup] Set DATABASE_URL correctly in .env and ensure PostgreSQL is running.');
    } else {
      console.log('[startup] PostgreSQL connection OK.');
      try {
        await ensureFrontendCompatibilitySchema();
        console.log('[startup] Frontend compatibility schema OK.');
      } catch (err) {
        console.error('[startup] Frontend compatibility schema check failed:', err.message);
      }
      try {
        await bootstrapSuperAdmin();
      } catch (err) {
        console.error('[startup] Super Admin bootstrap failed:', err.message);
      }
    }
  } else {
    console.warn('[startup] DATABASE_URL is not set. The API will start, but every database-backed route will fail.');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[startup] Tanseek backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal) => {
    console.log(`[shutdown] Received ${signal}, closing server...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[startup] Fatal error during startup:', err);
  process.exit(1);
});
