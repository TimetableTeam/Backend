const { query } = require('./src/db/pool');

async function check() {
  // Check academic_terms structure
  const termsRes = await query('SELECT * FROM academic_terms');
  console.log('Academic terms:', JSON.stringify(termsRes.rows, null, 2));
  
  // Check schedule_versions
  const versionRes = await query('SELECT * FROM schedule_versions');
  console.log('Schedule versions:', JSON.stringify(versionRes.rows, null, 2));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });