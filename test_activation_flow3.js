const { requestAccountActivation, activateAccount, verifyActivationToken } = require('./src/services/authService');
const { query } = require('./src/db/pool');

async function test() {
  try {
    // Temporarily set a student to INVITED
    const res = await query("UPDATE accounts SET state = 'INVITED' WHERE id = 16 RETURNING id, email, state");
    console.log('Set student to INVITED:', res.rows);
    
    // Now test activation
    const res1 = await requestAccountActivation({ email: 'adam.samir1@student.tanseek.edu' });
    console.log('Request activation (INVITED):', JSON.stringify(res1, null, 2));
    
    if (res1.dev_token) {
      const res2 = await activateAccount({ token: res1.dev_token, password: 'NewPass123!', confirmPassword: 'NewPass123!' });
      console.log('Activate:', JSON.stringify(res2, null, 2));
      
      // Request another token to verify
      const res4 = await requestAccountActivation({ email: 'adam.samir1@student.tanseek.edu' });
      console.log('Request activation (now ACTIVE):', JSON.stringify(res4, null, 2));
    }
    
    // Restore
    await query("UPDATE accounts SET state = 'ACTIVE' WHERE id = 16");
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

test();