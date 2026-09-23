const BASE = 'http://localhost:5000/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOSIsImVtYWlsIjoiZW5ncmFtenk5QGdtYWlsLmNvbSIsInJvbGUiOiJTVVBFUl9BRE1JTiIsImhvbWVEZXBhcnRtZW50SWQiOm51bGwsImlhdCI6MTc5MDAzNTY4NiwiZXhwIjoxNzkwMDc4ODg2fQ.ltstEFqDo9TOEUcZeDuulAE9lMDxcwtpTbzQJ5pD3t8';

async function test() {
  try {
    const solveRes = await fetch('http://localhost:5000/api/v1/model/solve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ termId: 1 })
    });
    console.log('Status:', solveRes.status);
    const data = await solveRes.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test().catch(console.error);