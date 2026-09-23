const { query } = require('./src/db/pool');

async function check() {
  const tables = ['courses', 'session_requirements', 'sections', 'rooms', 'time_slots'];
  for (const t of tables) {
    const res = await query(`SELECT column_name, is_identity FROM information_schema.columns WHERE table_name = '${t}' AND column_name = 'id'`);
    console.log(`${t}:`, res.rows[0]);
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });