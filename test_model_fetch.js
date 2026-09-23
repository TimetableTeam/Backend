async function test() {
  // Try localhost instead of 127.0.0.1
  try {
    const response = await fetch('http://localhost:8003/health');
    const data = await response.json();
    console.log('Model health (localhost):', data);
  } catch (e) {
    console.error('Error (localhost):', e.message);
  }
  
  // Try 127.0.0.1
  try {
    const response = await fetch('http://127.0.0.1:8003/health');
    const data = await response.json();
    console.log('Model health (127.0.0.1):', data);
  } catch (e) {
    console.error('Error (127.0.0.1):', e.message);
  }
  
  process.exit(0);
}

test();