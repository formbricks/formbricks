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
      'Interrupted concurrent build left these indexes INVALID: %. They are unusable, and IF NOT EXISTS will keep skipping them on every retry. Recover in three steps: (1) DROP INDEX CONCURRENTLY "<name>"; for each one listed, (2) prisma migrate resolve --rolled-back 20260909120001_verify_response_keyset_indexes_valid, because this failure is recorded and every later deploy stops with P3009 until it is cleared, (3) re-run the migrations.',
      invalid_indexes;
  END IF;
END $$;
