const { spawn } = require('child_process');

const server = spawn('node', ['src/server.js'], {
  cwd: 'C:\\Users\\Pharahos\\Documents\\Default Project\\F---B final\\backend',
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log(`[STDOUT] ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`[STDERR] ${data}`);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
});

// Wait a bit for server to start, then test login
setTimeout(async () => {
  try {
    const response = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'adam.samir1@student.tanseek.edu', password: 'StudentPass123!' })
    });
    
    console.log('Login status:', response.status);
    const data = await response.json();
    console.log('Login response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Login test error:', err.message);
  } finally {
    server.kill();
  }
}, 3000);