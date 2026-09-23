const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  const indexes = await pool.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'accounts'
  `);
  console.log('Indexes on accounts:');
  indexes.rows.forEach(c => console.log(' -', c.indexname));
  
  await pool.end();
}

check().catch(console.error);