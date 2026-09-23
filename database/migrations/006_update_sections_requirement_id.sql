-- ============================================================
-- Migration 006: Update sections with requirement_id
-- Map sections to their session_requirements based on course_id and term_id
-- ============================================================

BEGIN;

-- Update sections with requirement_id by matching course_id and term_id
-- AI301 sections -> AI301 PRACTICAL requirement
UPDATE sections s
SET requirement_id = sr.id
FROM session_requirements sr
JOIN courses c ON c.id = sr.course_id
WHERE s.course_id = c.id
  AND s.term_id = sr.term_id
  AND c.code = 'AI301'
  AND sr.kind = 'PRACTICAL';

-- AI302 sections -> AI302 PRACTICAL requirement
UPDATE sections s
SET requirement_id = sr.id
FROM session_requirements sr
JOIN courses c ON c.id = sr.course_id
WHERE s.course_id = c.id
  AND s.term_id = sr.term_id
  AND c.code = 'AI302'
  AND sr.kind = 'PRACTICAL';

-- AI303 sections -> AI303 PRACTICAL requirement
UPDATE sections s
SET requirement_id = sr.id
FROM session_requirements sr
JOIN courses c ON c.id = sr.course_id
WHERE s.course_id = c.id
  AND s.term_id = sr.term_id
  AND c.code = 'AI303'
  AND sr.kind = 'PRACTICAL';

-- AI304 sections -> AI304 LECTURE requirement
UPDATE sections s
SET requirement_id = sr.id
FROM session_requirements sr
JOIN courses c ON c.id = sr.course_id
WHERE s.course_id = c.id
  AND s.term_id = sr.term_id
  AND c.code = 'AI304'
  AND sr.kind = 'LECTURE';

-- AI305 sections -> AI305 LECTURE requirement
UPDATE sections s
SET requirement_id = sr.id
FROM session_requirements sr
JOIN courses c ON c.id = sr.course_id
WHERE s.course_id = c.id
  AND s.term_id = sr.term_id
  AND c.code = 'AI305'
  AND sr.kind = 'LECTURE';

-- Verify all sections have requirement_id
SELECT 
  s.id, s.code, s.course_id, s.requirement_id,
  sr.kind as req_kind, c.code as course_code
FROM sections s
LEFT JOIN session_requirements sr ON sr.id = s.requirement_id
LEFT JOIN courses c ON c.id = s.course_id
WHERE s.requirement_id IS NULL;

COMMIT;