async function test() {
  const token = '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3';
  const url = `http://localhost:5000/api/v1/auth/verify-reset-token?token=${encodeURIComponent(token)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();