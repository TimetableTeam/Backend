const { query } = require('./src/db/pool');

async function check() {
  // Check published version
  const versionRes = await query(
    `SELECT id FROM schedule_versions WHERE term_id = (SELECT id FROM academic_terms WHERE is_active = true LIMIT 1) AND state = 'PUBLISHED'`
  );
  console.log('Published version:', versionRes.rows);
  
  if (versionRes.rows.length > 0) {
    const versionId = versionRes.rows[0].id;
    
    // Check allocations for that version
    const allocRes = await query(
      `SELECT a.*, s.code as section_code, c.code as course_code
       FROM allocations a
       JOIN sections s ON s.id = a.section_id
       JOIN courses c ON c.id = s.course_id
       WHERE a.version_id = $1
       ORDER BY a.section_id`,
      [versionId]
    );
    console.log('Allocations:', allocRes.rows.length);
    console.log('Sample allocations:', allocRes.rows.slice(0, 3).map(r => ({ section: r.section_code, course: r.course_code })));
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });