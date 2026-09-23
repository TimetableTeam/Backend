-- ============================================================
-- TANSEEK | Migration 001: Add Missing Student Tables
-- Adds tables required by the Model/CP-SAT that were missing from initial schema
-- Run after initial schema: psql -v ON_ERROR_STOP=1 -f 001_add_missing_student_tables.sql
-- ============================================================

BEGIN;

-- ============================================================
-- Students table (separate from accounts, linked via account_id)
-- The Model expects a separate students table linked 1:1 to accounts
-- ============================================================
CREATE TABLE students (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    university_id varchar(50) NOT NULL UNIQUE,
    full_name varchar(180) NOT NULL,
    email varchar(254) NOT NULL,
    department_id bigint NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    academic_level smallint NOT NULL CHECK (academic_level > 0),
    account_id bigint NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','GRADUATED','WITHDRAWN')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX students_email_unique_ci ON students (lower(email));
CREATE UNIQUE INDEX students_university_id_unique ON students (university_id);

-- ============================================================
-- Student Group Members (many-to-many: students <-> student_groups)
-- The Model expects this table for bulk assignment of students to groups
-- ============================================================
CREATE TABLE student_group_members (
    group_id bigint NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
    student_id bigint NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, student_id)
);

-- ============================================================
-- Student Course Registrations
-- Students register for courses (per term), then get enrolled in sections
-- ============================================================
CREATE TYPE registration_state AS ENUM ('REGISTERED','DROPPED','WAITLISTED','CANCELLED');

CREATE TABLE student_course_registrations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id bigint NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    term_id bigint NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
    state registration_state NOT NULL DEFAULT 'REGISTERED',
    registered_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
    registered_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (student_id, course_id, term_id)
);

-- ============================================================
-- Student Section Enrollments (authoritative source for student timetable)
-- Each registered student gets enrolled in exactly one Lecture section and one Practical section per course
-- ============================================================
CREATE TYPE enrollment_state AS ENUM ('ACTIVE','DROPPED','WAITLISTED','COMPLETED');

CREATE TABLE student_section_enrollments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id bigint NOT NULL REFERENCES student_course_registrations(id) ON DELETE CASCADE,
    term_id bigint NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
    course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    section_kind session_kind NOT NULL, -- LECTURE or PRACTICAL
    section_id bigint NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
    state enrollment_state NOT NULL DEFAULT 'ACTIVE',
    assigned_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    UNIQUE (registration_id, section_kind) -- One active enrollment per kind per registration
);

-- ============================================================
-- Update existing tables to link to students where needed
-- ============================================================

-- Add student_id to accounts for reverse lookup (optional but useful)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS student_id bigint UNIQUE REFERENCES students(id) ON DELETE SET NULL;

-- Add student_id to audit_events for better tracking
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS student_id bigint REFERENCES students(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_account ON students(account_id);
CREATE INDEX IF NOT EXISTS idx_student_course_reg_student ON student_course_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_student_course_reg_term ON student_course_registrations(term_id);
CREATE INDEX IF NOT EXISTS idx_student_section_enr_registration ON student_section_enrollments(registration_id);
CREATE INDEX IF NOT EXISTS idx_student_section_enr_section ON student_section_enrollments(section_id);
CREATE INDEX IF NOT EXISTS idx_student_group_members_student ON student_group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_student_group_members_group ON student_group_members(group_id);

COMMIT;

-- ============================================================
-- Data migration: Create students records from existing accounts with STUDENT role
-- Run this after schema migration to populate students table from existing data
-- ============================================================
-- INSERT INTO students (university_id, full_name, email, department_id, academic_level, account_id, status)
-- SELECT 
--     'STU' || LPAD(a.id::text, 6, '0') as university_id,
--     a.full_name,
--     a.email,
--     a.home_department_id,
--     3 as academic_level, -- Default to level 3, adjust as needed
--     a.id,
--     CASE WHEN a.state = 'ACTIVE' THEN 'ACTIVE' ELSE 'INACTIVE' END
-- FROM accounts a
-- WHERE a.role = 'STUDENT'
-- ON CONFLICT (account_id) DO NOTHING;
--
-- -- Then populate student_group_members from section_groups and student_section_enrollments
-- -- This would be done in a separate data migration script