const fs = require('fs');
const path = require('path');

const CSV_DIR = 'C:\\Users\\Pharahos\\Desktop\\Laste worke\\Tanseek_Menna_Model_v2_Starter\\Tanseek_Menna_Model_v2_Starter\\Tanseek_CSV_Data';

const content = fs.readFileSync(path.join(CSV_DIR, 'student_groups.csv'), 'utf-8');
const lines = content.trim().split('\n');
const headers = lines[0].split(',');

for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(',');
  console.log('Student Group', i, 'id:', vals[0], 'term_id:', vals[1], 'dept:', vals[2], 'name:', vals[3], 'student_count:', vals[4]);
}