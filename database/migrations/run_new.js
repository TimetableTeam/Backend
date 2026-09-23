#!/usr/bin/env node
/**
 * Run specific migration
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function runMigration(filename) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', err);
  });

  const filePath = path.join(__dirname, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log(`Running migration: ${filename}`);
  try {
    await pool.query(sql);
    console.log(`✅ ${filename} completed successfully`);
  } catch (err) {
    console.error(`❌ ${filename} failed:`, err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node run_new.js <filename>');
  process.exit(1);
}

runMigration(filename).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});