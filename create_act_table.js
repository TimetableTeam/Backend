const { query } = require('./src/db/pool');

async function run() {
  try {
    // Try creating table outside transaction first
    await query(`
      CREATE TABLE IF NOT EXISTS account_activation_tokens (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          token_hash text NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL,
          used_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          ip_address inet
      )
    `);
    console.log('Table created');
    
    await query(`CREATE INDEX IF NOT EXISTS idx_account_activation_account ON account_activation_tokens(account_id)`);
    console.log('Index 1 created');
    
    await query(`CREATE INDEX IF NOT EXISTS idx_account_activation_token ON account_activation_tokens(token_hash)`);
    console.log('Index 2 created');
    
    // Verify
    const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'account_activation_tokens' ORDER BY ordinal_position");
    console.log('Columns:', res.rows.map(x => x.column_name).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });