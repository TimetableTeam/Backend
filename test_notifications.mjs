async function test() {
  try {
    // First login as admin
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'engramzy9@gmail.com', password: 'QWER2005qwer@' })
    });
    
    const loginData = await loginRes.json();
    console.log('Login:', loginData.success ? 'Success' : 'Failed');
    
    if (!loginData.success) return;
    
    const token = loginData.data.token;
    
    // Test get notifications
    const notifRes = await fetch('http://localhost:5000/api/v1/change-notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const notifData = await notifRes.json();
    console.log('Notifications:', JSON.stringify(notifData, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  }
}

test();