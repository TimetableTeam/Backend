const fs = require('fs');
const path = require('path');

const CSV_DIR = 'C:\\Users\\Pharahos\\Desktop\\Laste worke\\Tanseek_Menna_Model_v2_Starter\\Tanseek_Menna_Model_v2_Starter\\Tanseek_CSV_Data';

const content = fs.readFileSync(path.join(CSV_DIR, 'students.csv'), 'utf-8');
const lines = content.trim().split('\n');
const headers = lines[0].split(',');
const accountIdx = headers.indexOf('account_id');
console.log('account_id index:', accountIdx);
for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(',');
  console.log(`Row ${i}: account_id = ${vals[accountIdx]}`);
}