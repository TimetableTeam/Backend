BEGIN;

ALTER TABLE session_requirements
  ADD COLUMN IF NOT EXISTS expected_students integer,
  ADD COLUMN IF NOT EXISTS frontend_room_type text,
  ADD COLUMN IF NOT EXISTS preferred_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

COMMIT;
