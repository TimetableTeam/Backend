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