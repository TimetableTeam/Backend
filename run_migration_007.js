const { query } = require('./src/db/pool');
const fs = require('fs');

async function run() {
  const sql = fs.readFileSync('./database/migrations/007_add_account_activation_tokens.sql', 'utf8');
  const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    try {
      await query(stmt);
      console.log('Executed:', stmt.trim().substring(0, 60) + '...');
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
  console.log('Done');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });