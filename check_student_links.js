const { query } = require('./src/db/pool');

async function check() {
  const res = await query(
    `SELECT s.id, s.full_name, s.account_id, a.email, a.role 
     FROM students s 
     JOIN accounts a ON a.id = s.account_id 
     WHERE a.role = 'STUDENT' 
     LIMIT 10`
  );
  console.log('Student-Account links:', JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });