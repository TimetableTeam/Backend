async function test() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'adam.samir1@student.tanseek.edu', password: 'StudentPass123!' })
    });
    
    console.log('Login status:', loginRes.status);
    const data = await loginRes.json();
    console.log('Login response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();