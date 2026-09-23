const bcrypt = require('bcryptjs');

async function check() {
  const password = 'StudentPass123!';
  const hash = await bcrypt.hash(password, 12);
  console.log('Hash for StudentPass123!:', hash);
  
  // Check against the database
  const { query } = require('./src/db/pool');
  const res = await query('SELECT password_hash FROM accounts WHERE id = 16');
  console.log('DB hash for account 16:', res.rows[0]?.password_hash);
  
  const match = await bcrypt.compare('StudentPass123!', res.rows[0]?.password_hash);
  console.log('Match:', match);
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });