-- Tanseek frontend contract compatibility helpers.
-- Safe to run repeatedly.
BEGIN;

ALTER TABLE student_course_registrations
  ADD COLUMN IF NOT EXISTS registration_type varchar(20) NOT NULL DEFAULT 'NORMAL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_course_registrations_type_check'
  ) THEN
    ALTER TABLE student_course_registrations
      ADD CONSTRAINT student_course_registrations_type_check
      CHECK (registration_type IN ('NORMAL','CARRIED','REPEATED'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lab_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requirement_id bigint NOT NULL REFERENCES session_requirements(id) ON DELETE CASCADE,
  room_id bigint REFERENCES rooms(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED')),
  notes text,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requirement_id, room_id)
);

CREATE TABLE IF NOT EXISTS frontend_custom_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE,
  description text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
