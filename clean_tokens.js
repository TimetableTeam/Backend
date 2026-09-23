const { query } = require('./src/db/pool');

async function clean() {
  await query('DELETE FROM password_reset_tokens WHERE expires_at < now()');
  console.log('Expired tokens cleaned');
  process.exit(0);
}

clean().catch(e => { console.error(e); process.exit(1); });