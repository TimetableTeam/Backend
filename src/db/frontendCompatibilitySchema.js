'use strict';

const { query } = require('./pool');

/**
 * Makes the compatibility-only tables/columns safe to use on deployments
 * where the latest frontend compatibility migration has not been applied yet.
 * It also applies small backwards-compatible schema relaxations required by the frozen frontend lifecycle.
 */
async function ensureFrontendCompatibilitySchema() {
  // A term now receives its end date only when Super Admin explicitly ends it.
  // Existing deployments may still have the original NOT NULL column.
  await query(`ALTER TABLE academic_terms ALTER COLUMN ends_on DROP NOT NULL`);
  await query(`UPDATE academic_terms SET ends_on=NULL WHERE state <> 'ARCHIVED' AND ends_on IS NOT NULL`);

  // Student tables were introduced after the original schema. Some Railway
  // databases were created before that migration, so make the read/write
  // endpoints self-healing instead of returning a generic 500.
  await query(`
    CREATE TABLE IF NOT EXISTS students (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      university_id varchar(50) NOT NULL UNIQUE,
      full_name varchar(180) NOT NULL,
      email varchar(254) NOT NULL,
      department_id bigint NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      academic_level smallint NOT NULL CHECK (academic_level > 0),
      account_id bigint UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      status varchar(20) NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_course_registrations (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      student_id bigint NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      term_id bigint NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
      state varchar(20) NOT NULL DEFAULT 'REGISTERED',
      registration_type varchar(20) NOT NULL DEFAULT 'NORMAL',
      registered_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
      registered_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(student_id, course_id, term_id)
    )
  `);
  await query(`ALTER TABLE student_course_registrations ADD COLUMN IF NOT EXISTS registration_type varchar(20) NOT NULL DEFAULT 'NORMAL'`);

  await query(`
    CREATE TABLE IF NOT EXISTS student_section_enrollments (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      registration_id bigint NOT NULL REFERENCES student_course_registrations(id) ON DELETE CASCADE,
      term_id bigint NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
      course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
      section_kind varchar(20) NOT NULL,
      section_id bigint NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
      state varchar(20) NOT NULL DEFAULT 'ACTIVE',
      assigned_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
      assigned_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz,
      UNIQUE(registration_id, section_kind)
    )
  `);

  const roomsExists = await query(`SELECT to_regclass('public.rooms') AS name`);
  if (roomsExists.rows[0]?.name) {
    // Presentation-only fields used by the frozen Rooms & Labs screen.
    // The normalized scheduler still relies on rooms.kind / rooms.active.
    await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frontend_type text`);
    await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frontend_status varchar(20) NOT NULL DEFAULT 'available'`);
    await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS closure_note text`);
  }

  const reqExists = await query(`SELECT to_regclass('public.session_requirements') AS name`);
  if (reqExists.rows[0]?.name) {
    // The frozen frontend keeps a few presentation-oriented requirement fields
    // that were not present in the normalized baseline schema. Keep them here
    // as compatibility metadata so the backend can round-trip the frontend
    // contract without forcing a frontend rewrite.
    await query(`ALTER TABLE session_requirements ADD COLUMN IF NOT EXISTS expected_students integer`);
    await query(`ALTER TABLE session_requirements ADD COLUMN IF NOT EXISTS frontend_room_type text`);
    await query(`ALTER TABLE session_requirements ADD COLUMN IF NOT EXISTS preferred_windows jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await query(`ALTER TABLE session_requirements ADD COLUMN IF NOT EXISTS notes text`);

    await query(`
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
      )
    `);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS frontend_custom_roles (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name varchar(120) NOT NULL UNIQUE,
      description text,
      permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

module.exports = { ensureFrontendCompatibilitySchema };
