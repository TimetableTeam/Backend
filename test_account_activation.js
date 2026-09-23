const { requestAccountActivation } = require('./src/services/authService');

async function test() {
  const res = await requestAccountActivation({ email: 'adam.samir1@student.tanseek.edu' });
  console.log('Request activation:', JSON.stringify(res, null, 2));
  process.exit(0);
}

test().catch(e => console.error(e));