const { query } = require('./src/db/pool');

async function verify() {
  // Check schedule_versions
  const versions = await query('SELECT * FROM schedule_versions WHERE term_id = 1 ORDER BY version_number DESC');
  console.log('Schedule versions:', JSON.stringify(versions.rows, null, 2));
  
  // Check allocations
  const allocs = await query('SELECT * FROM allocations WHERE version_id = (SELECT id FROM schedule_versions WHERE term_id = 1 ORDER BY version_number DESC LIMIT 1)');
  console.log('Allocations count:', allocs.rows.length);
  console.log('Allocations:', JSON.stringify(allocs.rows, null, 2));
  
  process.exit(0);
}

verify().catch(e => { console.error(e); process.exit(1); });