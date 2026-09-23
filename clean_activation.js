const { query } = require('./src/db/pool');

async function clean() {
  await query('DELETE FROM account_activation_tokens WHERE account_id = 16');
  console.log('Cleaned');
  await query("UPDATE accounts SET state = 'INVITED' WHERE id = 16");
  console.log('Set to INVITED');
  process.exit(0);
}

clean().catch(e => console.error(e));