'use strict';

const { getPool, closePool } = require('../src/db/pool');

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const term = await client.query(`
      SELECT id,name,starts_on,ends_on,state,availability_deadline
      FROM academic_terms
      WHERE name='Tanseek Benchmark 2027'
      ORDER BY id LIMIT 1
    `);
    if (!term.rowCount) throw new Error('Tanseek Benchmark 2027 not found.');
    const termId = term.rows[0].id;
    const checks = {
      departments: [`SELECT count(*)::int n FROM departments WHERE code LIKE 'BM_%'`, []],
      accounts: [`SELECT count(*)::int n FROM accounts WHERE email LIKE '%@tanseek.example.test'`, []],
      courses: [`SELECT count(*)::int n FROM courses c JOIN departments d ON d.id=c.department_id WHERE d.code LIKE 'BM_%'`, []],
      requirements: [`SELECT count(*)::int n FROM session_requirements WHERE term_id=$1`, [termId]],
      sections: [`SELECT count(*)::int n FROM sections WHERE term_id=$1`, [termId]],
      unmapped_sections: [`SELECT count(*)::int n FROM sections WHERE term_id=$1 AND requirement_id IS NULL`, [termId]],
      groups: [`SELECT count(*)::int n FROM student_groups WHERE term_id=$1`, [termId]],
      slots: [`SELECT count(*)::int n FROM time_slots WHERE term_id=$1`, [termId]],
      submissions: [`SELECT count(*)::int n FROM availability_submissions WHERE term_id=$1`, [termId]],
      availability_rows: [`SELECT count(*)::int n FROM availability_slots WHERE term_id=$1`, [termId]],
      schedule_versions: [`SELECT count(*)::int n FROM schedule_versions WHERE term_id=$1`, [termId]],
      allocations: [`SELECT count(*)::int n FROM allocations WHERE term_id=$1`, [termId]],
      rooms: [`SELECT count(*)::int n FROM rooms WHERE building='Benchmark Building'`, []],
    };
    const out = {};
    for (const [name, [sql, params]] of Object.entries(checks)) {
      out[name] = (await client.query(sql, params)).rows[0].n;
    }
    console.log('Term:', term.rows[0]);
    console.table(out);
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error('❌ Verify failed:', err.message);
  process.exit(1);
});
