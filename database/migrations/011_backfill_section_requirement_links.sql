-- ============================================================
-- Migration 011: Repair legacy section -> requirement links
--
-- Older compatibility builds accepted a Section component in the UI but did
-- not persist sections.requirement_id. This prevented Instructor Assignment
-- from resolving the requirement for those sections.
--
-- Conservative repair rules:
--   1) Link to the single requirement of the inferred component.
--      Codes ending -P/-PR/-LAB (+ optional digits) infer PRACTICAL;
--      other legacy codes infer LECTURE.
--   2) If still unlinked and the course/term has exactly one requirement total,
--      link to that one requirement.
-- Ambiguous rows remain NULL and must be edited explicitly in the UI.
-- ============================================================

BEGIN;

UPDATE sections AS s
SET requirement_id = (
      SELECT sr.id
      FROM session_requirements sr
      WHERE sr.course_id = s.course_id
        AND sr.term_id = s.term_id
        AND upper(sr.kind::text) = CASE
          WHEN s.code ~* '[-_](P|PR|LAB)[0-9]*$' THEN 'PRACTICAL'
          ELSE 'LECTURE'
        END
      ORDER BY sr.id
      LIMIT 1
    ),
    updated_at = now()
WHERE s.requirement_id IS NULL
  AND 1 = (
    SELECT count(*)
    FROM session_requirements sr2
    WHERE sr2.course_id = s.course_id
      AND sr2.term_id = s.term_id
      AND upper(sr2.kind::text) = CASE
        WHEN s.code ~* '[-_](P|PR|LAB)[0-9]*$' THEN 'PRACTICAL'
        ELSE 'LECTURE'
      END
  );

UPDATE sections AS s
SET requirement_id = (
      SELECT sr.id
      FROM session_requirements sr
      WHERE sr.course_id = s.course_id
        AND sr.term_id = s.term_id
      ORDER BY sr.id
      LIMIT 1
    ),
    updated_at = now()
WHERE s.requirement_id IS NULL
  AND 1 = (
    SELECT count(*)
    FROM session_requirements sr2
    WHERE sr2.course_id = s.course_id
      AND sr2.term_id = s.term_id
  );

COMMIT;
