async function test() {
  const token = '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3';
  const url = 'http://localhost:5000/api/v1/auth/reset-password';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        password: 'NewPass123!',
        confirmPassword: 'NewPass123!'
      })
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    const text = await response.text();
    console.log('Raw response:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('Parsed:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Failed to parse JSON');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();