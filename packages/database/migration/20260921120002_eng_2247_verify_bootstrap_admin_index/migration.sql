-- Guard for the migration immediately before this one, which builds "User_isBootstrapAdmin_key"
-- CONCURRENTLY.
--
-- An interrupted concurrent build — a deploy timeout, a dropped connection, an operator cancelling —
-- leaves an INVALID index under that name. `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` then sees
-- the name on the retry and skips it, so the deploy reports success while the index enforces nothing:
-- Postgres does not use an invalid index to check uniqueness. The fresh-instance race this whole
-- change exists to close would be silently open again, on an instance that believes it is fixed.
--
-- Its own file for the same reason that one is: Prisma only runs a migration without a transaction
-- wrapper when it recognises the file as concurrent, and a `DO` block flips that heuristic. Nothing
-- here is concurrent, so a wrapper is harmless.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    WHERE NOT x.indisvalid
      AND i.relname = 'User_isBootstrapAdmin_key'
  ) THEN
    RAISE EXCEPTION
      'Interrupted concurrent build left "User_isBootstrapAdmin_key" INVALID. It enforces nothing, and IF NOT EXISTS will keep skipping it on every retry, so the ENG-2247 sign-up race is open. Recover in four steps, and do not stop after the drop: (1) DROP INDEX CONCURRENTLY "User_isBootstrapAdmin_key"; (2) recreate it BY HAND, because the migration that builds it is already recorded as applied and will not run again: CREATE UNIQUE INDEX CONCURRENTLY "User_isBootstrapAdmin_key" ON "User"("isBootstrapAdmin"); if that fails on a duplicate, two accounts already hold the marker and one must be cleared first; (3) prisma migrate resolve --rolled-back 20260921120002_eng_2247_verify_bootstrap_admin_index, because this failure is recorded and every later deploy stops with P3009 until it is cleared; (4) re-run the migrations, so this guard passes because the index is valid rather than because it is gone.';
  END IF;
END $$;
