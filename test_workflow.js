const { query } = require('./src/db/pool');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function test() {
  // Get super admin account
  const admin = await query('SELECT * FROM accounts WHERE email = $1', ['engramzy9@gmail.com']);
  
  const token = jwt.sign(
    { sub: admin.rows[0].id, email: admin.rows[0].email, role: admin.rows[0].role, homeDepartmentId: admin.rows[0].home_department_id },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  
  console.log('Token:', token.substring(0, 50) + '...');
  
  // Test submit for review (Scheduler workflow)
  const versionId = 8; // Latest draft
  
  const submitResponse = await fetch(`http://localhost:5000/api/v1/model/schedule-versions/${versionId}/submit-review`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolvedConflictIds: [] })
  });
  const submitData = await submitResponse.json();
  console.log('Submit for Review:', submitResponse.status, JSON.stringify(submitData, null, 2));
  
  // Test review draft (Admin workflow)
  const reviewResponse = await fetch(`http://localhost:5000/api/v1/model/schedule-versions/${versionId}/review`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  const reviewData = await reviewResponse.json();
  console.log('Review Draft:', reviewResponse.status, JSON.stringify(reviewData, null, 2).substring(0, 500));
  
  // Test revalidate draft
  const revalidateResponse = await fetch(`http://localhost:5000/api/v1/model/schedule-versions/${versionId}/revalidate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  const revalidateData = await revalidateResponse.json();
  console.log('Revalidate Draft:', revalidateResponse.status, JSON.stringify(revalidateData, null, 2));
  
  // Test publish draft
  const publishResponse = await fetch(`http://localhost:5000/api/v1/model/schedule-versions/${versionId}/publish`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ term_id: 1, name: 'Fall 2027 Schedule', published_by: admin.rows[0].id })
  });
  const publishData = await publishResponse.json();
  console.log('Publish Draft:', publishResponse.status, JSON.stringify(publishData, null, 2));
  
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });