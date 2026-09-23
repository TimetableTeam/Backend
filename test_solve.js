const { query } = require('./src/db/pool');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function test() {
  // Get super admin account
  const admin = await query('SELECT * FROM accounts WHERE email = $1', ['engramzy9@gmail.com']);
  console.log('Admin:', admin.rows[0] ? 'found' : 'not found');
  
  if (admin.rows[0]) {
    // Generate token
    const token = jwt.sign(
      { 
        sub: admin.rows[0].id, 
        email: admin.rows[0].email, 
        role: admin.rows[0].role,
        homeDepartmentId: admin.rows[0].home_department_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    
    console.log('Token:', token.substring(0, 50) + '...');
    
    // Test model solve
    const response = await fetch('http://localhost:5000/api/v1/model/solve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ termId: 1 })
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  }
  
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });