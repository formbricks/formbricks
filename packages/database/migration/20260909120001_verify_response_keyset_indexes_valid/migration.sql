-- Guard for the migration immediately before this one, which builds three indexes CONCURRENTLY.
--
-- A concurrent build that is interrupted — a deploy timeout, a dropped connection, an operator
-- cancelling — leaves an INVALID index behind under the name it was building. `CREATE INDEX
-- CONCURRENTLY IF NOT EXISTS` then sees the name on the retry and skips it, so the deploy reports
-- success while the index stays unusable: Postgres will not plan against an invalid index, and the
-- response list quietly falls back to the slow scan with nothing to indicate why.
--
-- This lives in its own migration rather than at the foot of that one because Prisma only runs a
-- migration file without a transaction wrapper when it recognises the file as concurrent, and adding
-- any other statement type — a `DO` block included — flips that heuristic and makes the CREATEs fail.
-- Nothing here is concurrent, so a wrapper is harmless.
--
-- The recovery steps below say "recreate by hand" for a reason that is easy to miss: by the time this
-- guard can fire, the migration that builds the indexes has already been recorded as applied — it has
-- to have been, or this file would not have run. `prisma migrate resolve --rolled-back` refuses an
-- applied migration, so nothing will rebuild them for you. Dropping the invalid index and re-running
-- makes this guard pass on an empty result, which is a green deploy with the index permanently
-- missing: the same silence it exists to prevent, reached by following its own advice.
DO $$
DECLARE invalid_indexes text;
BEGIN
  SELECT string_agg(i.relname, ', ' ORDER BY i.relname) INTO invalid_indexes
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE NOT x.indisvalid
    AND i.relname IN (
      'Response_created_at_id_idx',
      'Response_surveyId_created_at_id_idx',
      'Response_contactId_created_at_id_idx'
    );

  IF invalid_indexes IS NOT NULL THEN
    RAISE EXCEPTION
      'Interrupted concurrent build left these indexes INVALID: %. They are unusable, and IF NOT EXISTS will keep skipping them on every retry. Recover in four steps, and do not stop after the drop: (1) DROP INDEX CONCURRENTLY "<name>"; for each one listed. (2) Recreate each one BY HAND, because the migration that builds them is already recorded as applied and will not run again: CREATE INDEX CONCURRENTLY "Response_created_at_id_idx" ON "Response"(created_at, id); CREATE INDEX CONCURRENTLY "Response_surveyId_created_at_id_idx" ON "Response"("surveyId", created_at, id); CREATE INDEX CONCURRENTLY "Response_contactId_created_at_id_idx" ON "Response"("contactId", created_at, id); -- only the ones named above. (3) prisma migrate resolve --rolled-back 20260909120001_verify_response_keyset_indexes_valid, because this failure is recorded and every later deploy stops with P3009 until it is cleared. (4) Re-run the migrations; this guard then passes because the indexes are valid, not because they are gone.',
      invalid_indexes;
  END IF;
END $$;
