const bcrypt = require('bcryptjs');
const { query } = require('./src/db/pool');

async function test() {
  const email = 'adam.samir1@student.tanseek.edu';
  const password = 'StudentPass123!';
  
  // Find account by email
  const res = await query('SELECT * FROM accounts WHERE lower(email) = lower($1)', [email]);
  console.log('Account found:', res.rows.length);
  
  if (res.rows.length > 0) {
    const account = res.rows[0];
    console.log('Account:', account.id, account.email, account.role);
    console.log('Password hash:', account.password_hash);
    
    const match = await bcrypt.compare('StudentPass123!', account.password_hash);
    console.log('Password match:', match);
  }
  
  process.exit(0);
}

require('./src/db/pool'); // Initialize pool
setTimeout(async () => {
  try {
    const bcrypt = require('bcryptjs');
    const { query } = require('./src/db/pool');
    
    const email = 'adam.samir1@student.tanseek.edu';
    const password = 'StudentPass123!';
    
    const res = await query('SELECT * FROM accounts WHERE lower(email) = lower($1)', [email]);
    console.log('Account found:', res.rows.length);
    
    if (res.rows.length > 0) {
      const account = res.rows[0];
      console.log('Account:', account.id, account.email, account.role);
      console.log('Password hash:', account.password_hash);
      
      const bcrypt = require('bcryptjs');
      const match = await bcrypt.compare('StudentPass123!', account.password_hash);
      console.log('Password match:', match);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}, 1000);