const bcrypt = require('bcryptjs');
const { query } = require('./src/db/pool');

async function fix() {
  const password = 'StudentPass123!';
  const hash = await bcrypt.hash(password, 12);
  console.log('Hash for StudentPass123!:', hash);
  
  // Update all student accounts (16-47)
  for (let id = 16; id <= 47; id++) {
    await query('UPDATE accounts SET password_hash = $1 WHERE id = $2', [hash, id]);
    console.log(`Updated account ${id}`);
  }
  
  console.log('All student passwords updated');
  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });