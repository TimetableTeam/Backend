-- ============================================================
-- Migration 005: Add requirement_id to sections table
-- The Model expects sections to have requirement_id column
-- ============================================================

BEGIN;

-- Add requirement_id column to sections table
ALTER TABLE sections ADD COLUMN IF NOT EXISTS requirement_id bigint REFERENCES session_requirements(id) ON DELETE RESTRICT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_sections_requirement ON sections(requirement_id);

COMMIT;