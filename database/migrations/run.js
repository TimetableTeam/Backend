#!/usr/bin/env node
/**
 * Migration Runner
 * Runs all migration files in order
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function runMigrations() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  // Never print DATABASE_URL itself because it may contain credentials.
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', err);
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (done.rowCount) {
      console.log(`⏭️  ${file} already applied; skipping`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`\nRunning migration: ${file}`);
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT DO NOTHING', [file]);
      console.log(`✅ ${file} completed successfully`);
    } catch (err) {
      console.error(`❌ ${file} failed:`, err.message);
      throw err;
    }
  }

  console.log('\n✅ All migrations completed successfully!');
  await pool.end();
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});