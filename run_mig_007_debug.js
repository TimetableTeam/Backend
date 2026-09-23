const { query } = require('./src/db/pool');
const fs = require('fs');

async function run() {
  const sql = fs.readFileSync('./database/migrations/007_add_account_activation_tokens.sql', 'utf8');
  console.log('SQL:', sql);
  
  const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    console.log('Executing:', stmt.trim().substring(0, 80));
    try {
      await query(stmt);
      console.log('  OK');
    } catch (e) {
      console.error('Error:', e.message);
      console.error('  Statement:', stmt.trim());
    }
  }
  console.log('Done');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });