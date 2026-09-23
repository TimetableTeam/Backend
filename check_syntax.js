const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Pharahos\\Documents\\Default Project\\F---B final\\backend\\src\\controllers\\studentsController.js', 'utf-8');
const lines = content.split('\n');
for (let i = 28; i < 40; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}