-- ============================================================
-- TANSEEK | Smart Timetable & Room Allocation
-- PostgreSQL 15+ initial schema, 2026-09-19
-- Run on an EMPTY database using: psql -v ON_ERROR_STOP=1 -f Tanseek_PostgreSQL_schema.sql
-- No DROP statements. Use migrations after this initial baseline.
-- Times are local university wall-clock times; timestamps are UTC-aware.
-- Passwords, one-time codes and invitation tokens must be hashed server-side.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_role AS ENUM ('SUPER_ADMIN','ADMIN','SCHEDULER','DEPARTMENT_COORDINATOR','LAB_MANAGER','LECTURER','TA','STUDENT');
CREATE TYPE account_state AS ENUM ('INVITED','ACTIVE','SUSPENDED','DISABLED');
CREATE TYPE challenge_purpose AS ENUM ('ACTIVATE','NEW_DEVICE','PASSWORD_RESET','TRANSFER_SUPER_ADMIN');
CREATE TYPE challenge_state AS ENUM ('PENDING','USED','EXPIRED');
CREATE TYPE term_state AS ENUM ('PLANNING','COLLECTING_AVAILABILITY','READY_TO_SCHEDULE','ACTIVE','ARCHIVED');
CREATE TYPE availability_state AS ENUM ('DRAFT','CONFIRMED');
CREATE TYPE availability_kind AS ENUM ('AVAILABLE','UNAVAILABLE','PREFERRED');
CREATE TYPE schedule_state AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE room_kind AS ENUM ('CLASSROOM','LAB');
CREATE TYPE session_kind AS ENUM ('LECTURE','TUTORIAL','PRACTICAL');

CREATE TABLE departments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email varchar(254) NOT NULL,
  password_hash text,
  full_name varchar(180) NOT NULL,
  role account_role NOT NULL,
  state account_state NOT NULL DEFAULT 'INVITED',
  home_department_id bigint REFERENCES departments(id) ON DELETE RESTRICT,
  created_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  disabled_at timestamptz,
  CONSTRAINT active_requires_password CHECK (state <> 'ACTIVE' OR password_hash IS NOT NULL)
);
CREATE UNIQUE INDEX accounts_email_unique_ci ON accounts (lower(email));
-- Only one active Super Admin at a time. The incoming account remains in
-- its ordinary role until acceptance; promote it in the transfer transaction.
CREATE UNIQUE INDEX one_current_super_admin ON accounts ((role)) WHERE role = 'SUPER_ADMIN' AND state IN ('ACTIVE','INVITED');

-- Explicit cross-department rights. Home department is implicitly allowed for
-- department-scoped roles; the backend must also check action permissions.
CREATE TABLE account_department_grants (
  account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  department_id bigint NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  can_edit_schedule boolean NOT NULL DEFAULT false,
  can_edit_requirements boolean NOT NULL DEFAULT false,
  granted_by bigint NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (account_id, department_id)
);

CREATE TABLE account_invitations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  issued_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_challenges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  purpose challenge_purpose NOT NULL,
  code_hash text NOT NULL,
  state challenge_state NOT NULL DEFAULT 'PENDING',
  failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX auth_challenges_pending_idx ON auth_challenges(account_id, purpose, expires_at) WHERE state = 'PENDING';

CREATE TABLE trusted_devices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_token_hash text NOT NULL UNIQUE,
  label varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX trusted_devices_owner_idx ON trusted_devices(account_id) WHERE revoked_at IS NULL;

CREATE TABLE super_admin_transfers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outgoing_account_id bigint NOT NULL REFERENCES accounts(id),
  incoming_account_id bigint NOT NULL REFERENCES accounts(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  CHECK (outgoing_account_id <> incoming_account_id)
);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_account_id bigint REFERENCES accounts(id) ON DELETE SET NULL,
  actor_email varchar(254),
  action varchar(100) NOT NULL,
  entity_type varchar(80),
  entity_id bigint,
  department_id bigint REFERENCES departments(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome varchar(20) NOT NULL CHECK (outcome IN ('SUCCESS','FAILURE','WARNING')),
  ip_address inet,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_actor_time_idx ON audit_events(actor_account_id, occurred_at DESC);
CREATE INDEX audit_events_action_time_idx ON audit_events(action, occurred_at DESC);
-- Never log passwords, codes, tokens, session cookies or raw availability payloads.

CREATE TABLE academic_terms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(120) NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  state term_state NOT NULL DEFAULT 'PLANNING',
  availability_deadline timestamptz,
  created_by bigint REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on <= ends_on)
);

-- A slot is a weekly template, e.g. Monday 09:00-10:00.
-- ISO weekday: Monday=1 ... Sunday=7. Holidays override weekly templates.
CREATE TABLE time_slots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id bigint NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  label varchar(80),
  CHECK (starts_at < ends_at),
  UNIQUE (term_id, weekday, starts_at),
  UNIQUE (id, term_id)
);
CREATE TABLE term_holidays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id bigint NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  reason varchar(180),
  UNIQUE (term_id, holiday_date)
);

CREATE TABLE courses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id bigint NOT NULL REFERENCES departments(id),
  code varchar(40) NOT NULL,
  title varchar(180) NOT NULL,
  created_by bigint REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, code)
);
CREATE TABLE student_groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id bigint NOT NULL REFERENCES academic_terms(id),
  department_id bigint NOT NULL REFERENCES departments(id),
  name varchar(100) NOT NULL,
  student_count integer NOT NULL CHECK (student_count > 0),
  UNIQUE (term_id, department_id, name)
);
CREATE TABLE sections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id bigint NOT NULL REFERENCES academic_terms(id),
  course_id bigint NOT NULL REFERENCES courses(id),
  code varchar(50) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CANCELLED')),
  created_by bigint REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_id, course_id, code),
  UNIQUE (id, term_id)
);
CREATE TABLE section_groups (
  section_id bigint NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  group_id bigint NOT NULL REFERENCES student_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (section_id, group_id)
);

-- Coordinator defines course-level defaults. If sections differ, add a
-- section-level override in a later migration; never silently change all sections.
CREATE TABLE session_requirements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id),
  term_id bigint NOT NULL REFERENCES academic_terms(id),
  kind session_kind NOT NULL,
  sessions_per_week integer NOT NULL CHECK (sessions_per_week > 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  required_room_kind room_kind,
  preferred_window_note text,
  created_by bigint NOT NULL REFERENCES accounts(id),
  updated_by bigint REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, term_id)
);
CREATE TABLE equipment (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE
);
CREATE TABLE required_equipment (
  requirement_id bigint NOT NULL REFERENCES session_requirements(id) ON DELETE CASCADE,
  equipment_id bigint NOT NULL REFERENCES equipment(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (requirement_id, equipment_id)
);

-- Lecturers and TAs are accounts, no second staff identity table.
CREATE TABLE section_instructors (
  section_id bigint NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  instructor_id bigint NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  requirement_id bigint NOT NULL REFERENCES session_requirements(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, instructor_id, requirement_id)
);

CREATE TABLE availability_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id bigint NOT NULL REFERENCES academic_terms(id),
  instructor_id bigint NOT NULL REFERENCES accounts(id),
  state availability_state NOT NULL DEFAULT 'DRAFT',
  confirmed_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_id, instructor_id),
  UNIQUE (id, term_id),
  CHECK ((state = 'CONFIRMED') = (confirmed_at IS NOT NULL))
);
CREATE TABLE availability_slots (
  submission_id bigint NOT NULL,
  term_id bigint NOT NULL,
  slot_id bigint NOT NULL,
  kind availability_kind NOT NULL,
  PRIMARY KEY (submission_id, slot_id),
  FOREIGN KEY (submission_id, term_id) REFERENCES availability_submissions(id, term_id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id, term_id) REFERENCES time_slots(id, term_id) ON DELETE CASCADE
);
-- No slot row means UNKNOWN, not AVAILABLE. Confirmation requires a complete
-- answer for all relevant slots; enforce this in the service transaction.

CREATE TABLE rooms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building varchar(120) NOT NULL,
  code varchar(50) NOT NULL,
  kind room_kind NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  accessible boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  managed_by bigint REFERENCES accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building, code)
);
CREATE TABLE room_equipment (
  room_id bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  equipment_id bigint NOT NULL REFERENCES equipment(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (room_id, equipment_id)
);
CREATE TABLE room_closures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  created_by bigint NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);
CREATE INDEX room_closures_room_time_idx ON room_closures(room_id, starts_at, ends_at);

CREATE TABLE schedule_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id bigint NOT NULL REFERENCES academic_terms(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  name varchar(120) NOT NULL,
  state schedule_state NOT NULL DEFAULT 'DRAFT',
  created_by bigint NOT NULL REFERENCES accounts(id),
  published_by bigint REFERENCES accounts(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_id, version_number),
  UNIQUE (id, term_id),
  CHECK ((state = 'PUBLISHED') = (published_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_published_version_per_term ON schedule_versions(term_id) WHERE state = 'PUBLISHED';

CREATE TABLE allocations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id bigint NOT NULL,
  version_id bigint NOT NULL,
  section_id bigint NOT NULL,
  requirement_id bigint NOT NULL,
  instructor_id bigint NOT NULL REFERENCES accounts(id),
  room_id bigint NOT NULL REFERENCES rooms(id),
  start_slot_id bigint NOT NULL,
  ends_at time NOT NULL,
  created_by bigint NOT NULL REFERENCES accounts(id),
  updated_by bigint REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_id, term_id) REFERENCES schedule_versions(id, term_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, term_id) REFERENCES sections(id, term_id),
  FOREIGN KEY (requirement_id, term_id) REFERENCES session_requirements(id, term_id),
  FOREIGN KEY (start_slot_id, term_id) REFERENCES time_slots(id, term_id),
  FOREIGN KEY (section_id, instructor_id, requirement_id)
    REFERENCES section_instructors(section_id, instructor_id, requirement_id),
  UNIQUE (version_id, section_id, requirement_id, start_slot_id)
);
CREATE INDEX allocations_room_version_idx ON allocations(version_id, room_id, start_slot_id);
CREATE INDEX allocations_staff_version_idx ON allocations(version_id, instructor_id, start_slot_id);

CREATE TABLE change_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version_id bigint NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
  recipient_account_id bigint REFERENCES accounts(id) ON DELETE SET NULL,
  recipient_group_id bigint REFERENCES student_groups(id) ON DELETE SET NULL,
  reason text NOT NULL,
  delivery_state varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_state IN ('PENDING','SENT','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CHECK (num_nonnulls(recipient_account_id, recipient_group_id) = 1)
);

COMMIT;

-- APPLICATION / PUBLICATION GATES (must run in a transaction; not guaranteed
-- by simple FKs):
-- 1. Confirmed availability for every assigned lecturer/TA in the term;
--    selected time must be AVAILABLE or PREFERRED. Missing row is unavailable.
-- 2. Section groups belong to the same term as section; section course matches
--    requirement course; instructor role is LECTURER/TA.
-- 3. Slot length and consecutive slots cover requirement.duration_minutes;
--    ends_at is valid, same day, and within working hours/holiday rules.
-- 4. No overlapping time intervals per room, instructor, or ANY student group
--    in the same schedule version. Prevent concurrent publishes via term lock.
-- 5. Room active, not closed, right type, enough capacity for distinct groups,
--    and enough quantity of every required equipment item.
-- 6. On publish: lock term; validate all Must conditions; ARCHIVE previous
--    PUBLISHED version; mark new version PUBLISHED; log actor and changes.
-- 7. Enforce role + department scopes on every backend endpoint. ADMIN edits
--    only draft allocations in own department; SCHEDULER publishes. Never
--    expose password hashes, code hashes, token hashes, or raw audit secrets.
-- 8. Initial SUPER_ADMIN bootstrap must happen from a protected deployment
--    command/env secret with an Argon2id hash; never hardcode credentials here.
-- 9. Validate password policy in the backend: at least 8 characters with
--    upper/lowercase letters, a digit and a symbol; permit longer passwords.
--    New-device email challenge is required on activation and untrusted devices.
-- 10. Super Admin transfer: confirm current owner by email challenge, invite
--     the incoming ordinary account, then in one transaction demote old owner,
--     promote new owner and record audit event. Never log the challenge code.
