const fs = require('fs');
const path = require('path');

const CSV_DIR = 'C:\\Users\\Pharahos\\Desktop\\Laste worke\\Tanseek_Menna_Model_v2_Starter\\Tanseek_Menna_Model_v2_Starter\\Tanseek_CSV_Data';

const content = fs.readFileSync(path.join(CSV_DIR, 'student_group_members.csv'), 'utf-8');
const lines = content.trim().split('\n');
const headers = lines[0].split(',');

const groupCounts = {};
for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(',');
  const groupId = vals[0];
  groupCounts[groupId] = (groupCounts[groupId] || 0) + 1;
}

console.log('Group member counts:', groupCounts);