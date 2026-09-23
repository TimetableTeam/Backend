const { query } = require('./src/db/pool');

async function check() {
  const sv = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'schedule_versions' ORDER BY ordinal_position");
  console.log('schedule_versions:', JSON.stringify(sv.rows, null, 2));
  
  const alloc = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'allocations' ORDER BY ordinal_position");
  console.log('allocations:', JSON.stringify(alloc.rows, null, 2));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });