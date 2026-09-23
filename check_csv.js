const fs = require('fs');
const path = require('path');

const CSV_DIR = 'C:\\Users\\Pharahos\\Desktop\\Laste worke\\Tanseek_Menna_Model_v2_Starter\\Tanseek_Menna_Model_v2_Starter\\Tanseek_CSV_Data';

const files = ['students.csv', 'student_course_registrations.csv', 'student_section_enrollments.csv', 'student_groups.csv', 'student_group_members.csv', 'section_group_assignments.csv'];

for (const f of files) {
  const content = fs.readFileSync(path.join(CSV_DIR, f), 'utf-8');
  const lines = content.trim().split('\n');
  console.log(`\n=== ${f} ===`);
  console.log('Headers:', lines[0]);
  if (lines[1]) console.log('First row:', lines[1]);
  console.log(`Total rows: ${lines.length - 1}`);
}