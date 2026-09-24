-- Term lifecycle: the end date is assigned only when Super Admin explicitly ends the term.
ALTER TABLE academic_terms ALTER COLUMN ends_on DROP NOT NULL;
UPDATE academic_terms SET ends_on = NULL WHERE state <> 'ARCHIVED' AND ends_on IS NOT NULL;
