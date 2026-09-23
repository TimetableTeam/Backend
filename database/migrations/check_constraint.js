const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  const constraints = await pool.query(`
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'accounts'::regclass AND contype = 'u'
  `);
  console.log('Unique constraints on accounts:');
  constraints.rows.forEach(c => console.log(' -', c.conname));
  
  await pool.end();
}

check().catch(console.error);