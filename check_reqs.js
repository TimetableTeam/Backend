require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query } = require('./src/db/pool');

async function check() {
  const reqs = await query('SELECT id, term_id, kind FROM session_requirements WHERE term_id = 1 ORDER BY id');
  console.log('session_requirements for term 1:', JSON.stringify(reqs.rows, null, 2));
  
  const sections = await query('SELECT id, course_id, code FROM sections WHERE id BETWEEN 1 AND 12');
  console.log('sections:', JSON.stringify(sections.rows, null, 2));
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });