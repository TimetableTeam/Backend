async function test() {
  try {
    const token = '37735dea27ee21466f4ca56e65c56de873651dbdde9f49024199bab68f747335';
    const response = await fetch('http://localhost:5000/api/v1/auth/verify-reset-token?token=' + encodeURIComponent(token));
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();