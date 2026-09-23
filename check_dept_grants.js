const { query } = require('./src/db/pool');

async function check() {
  // Check account_department_grants table
  const res = await query('SELECT * FROM account_department_grants');
  console.log('account_department_grants:', JSON.stringify(res.rows, null, 2));
  
  // Check departments
  const depts = await query('SELECT * FROM departments');
  console.log('departments:', JSON.stringify(depts.rows, null, 2));
  
  // Check accounts with department_id
  const accounts = await query('SELECT id, email, role, home_department_id FROM accounts');
  console.log('accounts:', JSON.stringify(accounts.rows, null, 2));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });