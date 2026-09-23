const { query } = require('./src/db/pool');

async function check() {
  // Check buildings table
  try {
    const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'buildings' ORDER BY ordinal_position");
    console.log('buildings columns:', res.rows.map(x => x.column_name).join(', '));
  } catch (e) {
    console.log('buildings table not found or error:', e.message);
  }
  
  // Check if rooms have building_id
  const res2 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'rooms' ORDER BY ordinal_position");
  console.log('rooms columns:', res2.rows.map(x => x.column_name).join(', '));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });