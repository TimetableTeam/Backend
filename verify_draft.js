const { query } = require('./src/db/pool');

async function check() {
  // Check latest schedule version
  const versions = await query('SELECT * FROM schedule_versions WHERE term_id = 1 ORDER BY version_number DESC');
  console.log('Schedule Versions:', JSON.stringify(versions.rows, null, 2));
  
  // Check allocations for latest version
  const latestVersion = versions.rows[0];
  const allocs = await query('SELECT * FROM allocations WHERE version_id = $1', [latestVersion.id]);
  console.log('\nLatest version allocations:', allocs.rows.length);
  console.log('Allocations:', JSON.stringify(allocs.rows, null, 2));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });