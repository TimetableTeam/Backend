const { requestAccountActivation, activateAccount, verifyActivationToken } = require('./src/services/authService');

async function test() {
  try {
    const res1 = await requestAccountActivation({ email: 'adam.samir1@student.tanseek.edu' });
    console.log('Request activation:', JSON.stringify(res1, null, 2));
    
    if (res1.dev_token) {
      const res2 = await activateAccount({ token: res1.dev_token, password: 'NewPass123!', confirmPassword: 'NewPass123!' });
      console.log('Activate:', JSON.stringify(res2, null, 2));
      
      const res3 = await verifyActivationToken({ token: res1.dev_token });
      console.log('Verify:', JSON.stringify(res3, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

test();