-- ============================================================
-- TANSEEK | Additional Seed Data for New Tables (Fixed v5)
-- Run after the main seed.sql to populate new tables
-- Uses proper JOINs to handle correct student IDs
-- ============================================================

BEGIN;
SET LOCAL TIME ZONE 'Africa/Cairo';

-- ============================================================
-- Step 1: Insert Student Accounts (idempotent)
-- ============================================================
INSERT INTO accounts (email, full_name, role, state, home_department_id)
SELECT * FROM (VALUES
  ('adam.samir1@student.tanseek.edu','Adam Samir','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('aya.wael2@student.tanseek.edu','Aya Wael','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('mariam.ashraf3@student.tanseek.edu','Mariam Ashraf','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('yassin.khaled4@student.tanseek.edu','Yassin Khaled','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('malak.tarek5@student.tanseek.edu','Malak Tarek','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('omar.ramy6@student.tanseek.edu','Omar Ramy','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('laila.ibrahim7@student.tanseek.edu','Laila Ibrahim','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('ziad.hassan8@student.tanseek.edu','Ziad Hassan','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('nour.gamal9@student.tanseek.edu','Nour Gamal','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('mostafa.mahmoud10@student.tanseek.edu','Mostafa Mahmoud','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('hana.nabil11@student.tanseek.edu','Hana Nabil','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('ali.amin12@student.tanseek.edu','Ali Amin','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('farah.fathy13@student.tanseek.edu','Farah Fathy','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('youssef.adel14@student.tanseek.edu','Youssef Adel','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('salma.hany15@student.tanseek.edu','Salma Hany','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('ahmed.sayed16@student.tanseek.edu','Ahmed Sayed','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='AI')),
  ('undefined.samir17@student.tanseek.edu','undefined Samir','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.wael18@student.tanseek.edu','undefined Wael','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.ashraf19@student.tanseek.edu','undefined Ashraf','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.khaled20@student.tanseek.edu','undefined Khaled','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.tarek21@student.tanseek.edu','undefined Tarek','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.ramy22@student.tanseek.edu','undefined Ramy','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.ibrahim23@student.tanseek.edu','undefined Ibrahim','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.hassan24@student.tanseek.edu','undefined Hassan','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.gamal25@student.tanseek.edu','undefined Gamal','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.mahmoud26@student.tanseek.edu','undefined Mahmoud','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.nabil27@student.tanseek.edu','undefined Nabil','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.amin28@student.tanseek.edu','undefined Amin','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.fathy29@student.tanseek.edu','undefined Fathy','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.adel30@student.tanseek.edu','undefined Adel','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.hany31@student.tanseek.edu','undefined Hany','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS')),
  ('undefined.sayed32@student.tanseek.edu','undefined Sayed','STUDENT'::account_role,'INVITED'::account_state,(SELECT id FROM departments WHERE code='DS'))
) AS v(email, full_name, role, state, home_department_id)
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE email = v.email);

-- ============================================================
-- Students - Insert with explicit account_id lookups
-- ============================================================
WITH student_data AS (
  SELECT * FROM (VALUES
    ('AI27001','Adam Samir','adam.samir1@student.tanseek.edu',1,3),
    ('AI27002','Aya Wael','aya.wael2@student.tanseek.edu',1,3),
    ('AI27003','Mariam Ashraf','mariam.ashraf3@student.tanseek.edu',1,3),
    ('AI27004','Yassin Khaled','yassin.khaled4@student.tanseek.edu',1,3),
    ('AI27005','Malak Tarek','malak.tarek5@student.tanseek.edu',1,3),
    ('AI27006','Omar Ramy','omar.ramy6@student.tanseek.edu',1,3),
    ('AI27007','Laila Ibrahim','laila.ibrahim7@student.tanseek.edu',1,3),
    ('AI27008','Ziad Hassan','ziad.hassan8@student.tanseek.edu',1,3),
    ('AI27009','Nour Gamal','nour.gamal9@student.tanseek.edu',1,3),
    ('AI27010','Mostafa Mahmoud','mostafa.mahmoud10@student.tanseek.edu',1,3),
    ('AI27011','Hana Nabil','hana.nabil11@student.tanseek.edu',1,3),
    ('AI27012','Ali Amin','ali.amin12@student.tanseek.edu',1,3),
    ('AI27013','Farah Fathy','farah.fathy13@student.tanseek.edu',1,3),
    ('AI27014','Youssef Adel','youssef.adel14@student.tanseek.edu',1,3),
    ('AI27015','Salma Hany','salma.hany15@student.tanseek.edu',1,3),
    ('AI27016','Ahmed Sayed','ahmed.sayed16@student.tanseek.edu',1,3),
    ('CS27001','undefined Samir','undefined.samir17@student.tanseek.edu',2,3),
    ('CS27002','undefined Wael','undefined.wael18@student.tanseek.edu',2,3),
    ('CS27003','undefined Ashraf','undefined.ashraf19@student.tanseek.edu',2,3),
    ('CS27004','undefined Khaled','undefined.khaled20@student.tanseek.edu',2,3),
    ('CS27005','undefined Tarek','undefined.tarek21@student.tanseek.edu',2,3),
    ('CS27006','undefined Ramy','undefined.ramy22@student.tanseek.edu',2,3),
    ('CS27007','undefined Ibrahim','undefined.ibrahim23@student.tanseek.edu',2,3),
    ('CS27008','undefined Hassan','undefined.hassan24@student.tanseek.edu',2,3),
    ('CS27009','undefined Gamal','undefined.gamal25@student.tanseek.edu',2,3),
    ('CS27010','undefined Mahmoud','undefined.mahmoud26@student.tanseek.edu',2,3),
    ('CS27011','undefined Nabil','undefined.nabil27@student.tanseek.edu',2,3),
    ('CS27012','undefined Amin','undefined.amin28@student.tanseek.edu',2,3),
    ('CS27013','undefined Fathy','undefined.fathy29@student.tanseek.edu',2,3),
    ('CS27014','undefined Adel','undefined.adel30@student.tanseek.edu',2,3),
    ('CS27015','undefined Hany','undefined.hany31@student.tanseek.edu',2,3),
    ('CS27016','undefined Sayed','undefined.sayed32@student.tanseek.edu',2,3)
  ) AS t(university_id, full_name, email, department_id, academic_level)
)
INSERT INTO students (university_id, full_name, email, department_id, academic_level, account_id, status)
SELECT 
  sd.university_id,
  sd.full_name,
  sd.email,
  sd.department_id,
  sd.academic_level,
  a.id,
  'ACTIVE'
FROM student_data sd
JOIN accounts a ON a.email = sd.email
WHERE NOT EXISTS (SELECT 1 FROM students WHERE university_id = sd.university_id);

-- ============================================================
-- Student Group Members - Use proper JOINs
-- ============================================================
INSERT INTO student_group_members (group_id, student_id, joined_at)
SELECT sgm.group_id, s.id, '2027-09-01T09:00:00Z'::timestamptz
FROM (
  SELECT 1 as group_id, generate_series(1,8) as rn UNION ALL
  SELECT 2, generate_series(9,16) UNION ALL
  SELECT 3, generate_series(17,24) UNION ALL
  SELECT 4, generate_series(25,32)
) sgm
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM students
  ORDER BY id
) s ON s.rn = sgm.rn
ON CONFLICT (group_id, student_id) DO NOTHING;

-- ============================================================
-- Student Course Registrations (idempotent)
-- ============================================================
WITH scr_data AS (
  SELECT * FROM (VALUES
    (1,1,1,1),(2,1,2,1),(3,2,1,1),(4,2,2,1),(5,3,1,1),(6,3,2,1),
    (7,4,1,1),(8,4,2,1),(9,5,1,1),(10,5,2,1),(11,6,1,1),(12,6,2,1),
    (13,7,1,1),(14,7,2,1),(15,8,1,1),(16,8,2,1),(17,9,1,1),(18,9,2,1),
    (19,10,1,1),(20,10,2,1),(21,11,1,1),(22,11,2,1),(23,12,1,1),(24,12,2,1),
    (25,13,1,1),(26,13,2,1),(29,15,1,1),(30,15,2,1),(31,16,1,1),(32,16,2,1),
    (33,17,3,1),(34,17,4,1),(35,18,3,1),(36,18,4,1),
    (37,19,3,1),(38,19,4,1),(39,20,3,1),(40,20,4,1),
    (41,21,3,1),(42,21,4,1),(43,22,3,1),(44,22,4,1),
    (43,23,3,1),(46,23,4,1),(47,24,3,1),(48,24,4,1),
    (49,25,3,1),(50,25,4,1)
  ) AS t(id, student_seq, course_id, term_id)
)
INSERT INTO student_course_registrations (id, student_id, course_id, term_id, state, registered_by, registered_at, updated_at)
OVERRIDING SYSTEM VALUE
SELECT scr.id, s.id, scr.course_id, scr.term_id, 'REGISTERED', 4, 
       '2027-09-01T10:00:00Z'::timestamptz, '2027-09-01T10:00:00Z'::timestamptz
FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM (VALUES
    (1,1,1,1),(2,1,2,1),(3,2,1,1),(4,2,2,1),(5,3,1,1),(6,3,2,1),
    (7,4,1,1),(8,4,2,1),(9,5,1,1),(10,5,2,1),(11,6,1,1),(12,6,2,1),
    (13,7,1,1),(14,7,2,1),(15,8,1,1),(16,8,2,1),(17,9,1,1),(18,9,2,1),
    (19,10,1,1),(20,10,2,1),(21,11,1,1),(22,11,2,1),(23,12,1,1),(24,12,2,1),
    (25,13,1,1),(26,13,2,1),(29,15,1,1),(30,15,2,1),(31,16,1,1),(32,16,2,1),
    (33,17,3,1),(34,17,4,1),(35,18,3,1),(36,18,4,1),
    (37,19,3,1),(38,19,4,1),(39,20,3,1),(40,20,4,1),
    (41,21,3,1),(42,21,4,1),(43,22,3,1),(44,22,4,1),
    (43,23,3,1),(46,23,4,1),(47,24,3,1),(48,24,4,1),
    (49,25,3,1),(50,25,4,1)
  ) AS t(id, student_seq, course_id, term_id)
) scr
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM students
  ORDER BY id
) s ON s.rn = scr.student_seq
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Student Section Enrollments
-- ============================================================
WITH sse_data AS (
  SELECT * FROM (VALUES
    (1,1,1,1,'LECTURE'::session_kind,1),(2,1,1,1,'PRACTICAL'::session_kind,2),
    (3,2,1,2,'LECTURE'::session_kind,4),(4,2,1,2,'PRACTICAL'::session_kind,5),
    (5,3,1,1,'LECTURE'::session_kind,1),(6,3,1,1,'PRACTICAL'::session_kind,2),
    (7,4,1,2,'LECTURE'::session_kind,4),(8,4,1,2,'PRACTICAL'::session_kind,5),
    (9,5,1,1,'LECTURE'::session_kind,1),(10,5,1,1,'PRACTICAL'::session_kind,2),
    (11,6,1,2,'LECTURE'::session_kind,4),(12,6,1,2,'PRACTICAL'::session_kind,5),
    (13,7,1,1,'LECTURE'::session_kind,1),(14,7,1,1,'PRACTICAL'::session_kind,2),
    (15,8,1,2,'LECTURE'::session_kind,4),(16,8,1,2,'PRACTICAL'::session_kind,5),
    (17,9,1,1,'LECTURE'::session_kind,1),(18,9,1,1,'PRACTICAL'::session_kind,2),
    (19,10,1,2,'LECTURE'::session_kind,4),(20,10,1,2,'PRACTICAL'::session_kind,5),
    (21,11,1,1,'LECTURE'::session_kind,1),(22,11,1,1,'PRACTICAL'::session_kind,2),
    (23,12,1,2,'LECTURE'::session_kind,4),(24,12,1,2,'PRACTICAL'::session_kind,5),
    (25,13,1,1,'LECTURE'::session_kind,1),(26,13,1,1,'PRACTICAL'::session_kind,2),
    (27,14,1,2,'LECTURE'::session_kind,4),(28,14,1,2,'PRACTICAL'::session_kind,5),
    (29,15,1,1,'LECTURE'::session_kind,1),(30,15,1,1,'PRACTICAL'::session_kind,2),
    (31,16,1,2,'LECTURE'::session_kind,4),(32,16,1,2,'PRACTICAL'::session_kind,5),
    (33,17,1,1,'LECTURE'::session_kind,1),(34,17,1,1,'PRACTICAL'::session_kind,3),
    (35,18,1,2,'LECTURE'::session_kind,4),(36,18,1,2,'PRACTICAL'::session_kind,6),
    (37,19,1,1,'LECTURE'::session_kind,1),(38,19,1,1,'PRACTICAL'::session_kind,3),
    (39,20,1,2,'LECTURE'::session_kind,4),(40,20,1,2,'PRACTICAL'::session_kind,6),
    (41,21,1,1,'LECTURE'::session_kind,1),(42,21,1,1,'PRACTICAL'::session_kind,3),
    (43,22,1,2,'LECTURE'::session_kind,4),(44,22,1,2,'PRACTICAL'::session_kind,6),
    (45,23,1,1,'LECTURE'::session_kind,1),(46,23,1,1,'PRACTICAL'::session_kind,3),
    (47,24,1,2,'LECTURE'::session_kind,4),(48,24,1,2,'PRACTICAL'::session_kind,6)
  ) AS t(id, reg_seq, term_id, course_id, section_kind, section_id)
)
INSERT INTO student_section_enrollments (id, registration_id, term_id, course_id, section_kind, section_id, state, assigned_by, assigned_at, ended_at)
OVERRIDING SYSTEM VALUE
SELECT 
  sse.id,
  scr.id,
  sse.term_id,
  sse.course_id,
  sse.section_kind,
  sse.section_id,
  'ACTIVE',
  5,
  '2027-09-02T09:00:00Z'::timestamptz,
  NULL
FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM (VALUES
    (1,1,1,1,'LECTURE'::session_kind,1),(2,1,1,1,'PRACTICAL'::session_kind,2),
    (3,2,1,2,'LECTURE'::session_kind,4),(4,2,1,2,'PRACTICAL'::session_kind,5),
    (5,3,1,1,'LECTURE'::session_kind,1),(6,3,1,1,'PRACTICAL'::session_kind,2),
    (7,4,1,2,'LECTURE'::session_kind,4),(8,4,1,2,'PRACTICAL'::session_kind,5),
    (9,5,1,1,'LECTURE'::session_kind,1),(10,5,1,1,'PRACTICAL'::session_kind,2),
    (11,6,1,2,'LECTURE'::session_kind,4),(12,6,1,2,'PRACTICAL'::session_kind,5),
    (13,7,1,1,'LECTURE'::session_kind,1),(14,7,1,1,'PRACTICAL'::session_kind,2),
    (15,8,1,2,'LECTURE'::session_kind,4),(16,8,1,2,'PRACTICAL'::session_kind,5),
    (17,9,1,1,'LECTURE'::session_kind,1),(18,9,1,1,'PRACTICAL'::session_kind,2),
    (19,10,1,2,'LECTURE'::session_kind,4),(20,10,1,2,'PRACTICAL'::session_kind,5),
    (21,11,1,1,'LECTURE'::session_kind,1),(22,11,1,1,'PRACTICAL'::session_kind,2),
    (23,12,1,2,'LECTURE'::session_kind,4),(24,12,1,2,'PRACTICAL'::session_kind,5),
    (25,13,1,1,'LECTURE'::session_kind,1),(26,13,1,1,'PRACTICAL'::session_kind,2),
    (27,14,1,2,'LECTURE'::session_kind,4),(28,14,1,2,'PRACTICAL'::session_kind,5),
    (29,15,1,1,'LECTURE'::session_kind,1),(30,15,1,1,'PRACTICAL'::session_kind,2),
    (31,16,1,2,'LECTURE'::session_kind,4),(32,16,1,2,'PRACTICAL'::session_kind,5),
    (33,17,1,1,'LECTURE'::session_kind,1),(34,17,1,1,'PRACTICAL'::session_kind,3),
    (35,18,1,2,'LECTURE'::session_kind,4),(36,18,1,2,'PRACTICAL'::session_kind,6),
    (37,19,1,1,'LECTURE'::session_kind,1),(38,19,1,1,'PRACTICAL'::session_kind,3),
    (39,20,1,2,'LECTURE'::session_kind,4),(40,20,1,2,'PRACTICAL'::session_kind,6),
    (41,21,1,1,'LECTURE'::session_kind,1),(42,21,1,1,'PRACTICAL'::session_kind,3),
    (43,22,1,2,'LECTURE'::session_kind,4),(44,22,1,2,'PRACTICAL'::session_kind,6),
    (45,23,1,1,'LECTURE'::session_kind,1),(46,23,1,1,'PRACTICAL'::session_kind,3),
    (47,24,1,2,'LECTURE'::session_kind,4),(48,24,1,2,'PRACTICAL'::session_kind,6)
  ) AS t(id, reg_seq, term_id, course_id, section_kind, section_id)
) sse
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM student_course_registrations
  ORDER BY id
) scr ON scr.rn = sse.reg_seq;

-- ============================================================
-- Student Group Members - Ensure all 32 students are linked
-- ============================================================
INSERT INTO student_group_members (group_id, student_id, joined_at)
SELECT sgm.group_id, s.id, '2027-09-01T09:00:00Z'::timestamptz
FROM (
  SELECT 1 as group_id, generate_series(1,8) as rn UNION ALL
  SELECT 2, generate_series(9,16) UNION ALL
  SELECT 3, generate_series(17,24) UNION ALL
  SELECT 4, generate_series(25,32)
) sgm
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn
  FROM students
  ORDER BY id
) s ON s.rn = sgm.rn
ON CONFLICT (group_id, student_id) DO NOTHING;

COMMIT;