-- ADOMS SAPA baseline import compatibility columns.
-- Draft only: do not execute until the schema deployment step is authorized.

BEGIN;

ALTER TABLE adoms2."audit_log"
  ADD COLUMN IF NOT EXISTS "target" text,
  ADD COLUMN IF NOT EXISTS "what" text;

COMMIT;
