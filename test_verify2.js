async function test() {
  try {
    const token = 'ce52d202bea035517834ae2f90f3eb1f01d4dcc4f90fc8f65de6027929f79b07';
    const response = await fetch('http://localhost:5000/api/v1/auth/verify-reset-token?token=' + encodeURIComponent(token));
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();