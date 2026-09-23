const { login } = require('./src/services/authService');

async function test() {
  try {
    const result = await login({ 
      email: 'adam.samir1@student.tanseek.edu', 
      password: 'StudentPass123!' 
    });
    console.log('Login result:', result);
  } catch (err) {
    console.error('Login error:', err.message);
    console.error(err);
  }
  process.exit(0);
}

test();