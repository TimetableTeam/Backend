async function test() {
  // First login as a student
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adam.samir1@student.tanseek.edu', password: 'StudentPass123!' })
  });
  
  const loginData = await loginRes.json();
  console.log('Login:', loginData.success ? 'Success' : 'Failed', loginData.message);
  
  if (!loginData.success) return;
  
  const token = loginData.data.token;
  
  // Get timetable
  const timetableRes = await fetch('http://localhost:5000/api/v1/students/me/timetable', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const timetableData = await timetableRes.json();
  console.log('Timetable status:', timetableRes.status);
  console.log('Timetable:', JSON.stringify(timetableData, null, 2));
}

test().catch(e => console.error(e));