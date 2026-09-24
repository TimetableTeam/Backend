BEGIN;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frontend_type text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frontend_status varchar(20) NOT NULL DEFAULT 'available';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS closure_note text;

COMMIT;
