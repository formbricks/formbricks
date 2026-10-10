-- Keyset pagination for `GET /api/v3/responses` orders by `(created_at, id)`, with `id` as the
-- tie-breaker that makes the order total. The page predicate is a row-constructor comparison,
-- `(created_at, id) < ($1, $2)`, and that only lands in the Index Cond when `id` is part of the index.
--
-- Measured on a 300k-row Response-shaped table with 50-row `created_at` tie groups, paging a
-- surveyId-scoped list for 20 rows — rows discarded by filter, and shared buffer hits:
--
--     index                       predicate           discarded   buffers
--     (surveyId, created_at)      OR expansion             4000      1832
--     (surveyId, created_at)      row-constructor             2        23
--     (surveyId, created_at, id)  row-constructor             0         4
--
-- The predicate form does most of the work — the row constructor reaches the Index Cond even against
-- the narrow index. These indexes close the remainder, which is the rows still discarded when a cursor
-- lands inside a tie group.
--
-- ADDING, NOT REPLACING. RFC §2f says the narrow indexes must be dropped in the same change because
-- the planner "kept choosing the narrow index" when both were present. That did not reproduce: with
-- both installed it chose the wide index for the scoped and the workspace-wide page alike, same Index
-- Cond, same plan. That claim was most likely measured against the OR form, where the narrow index is
-- equally usable and the planner has no reason to prefer a wider one.
--
-- So the narrow indexes stay for now and are dropped in a follow-up, once production plans confirm the
-- wide ones are being chosen. The remaining argument for dropping them is write amplification on the
-- highest-volume table in the product, which is real but is not worth coupling to the change that adds
-- their replacements — a drop is the half that cannot be rolled back by deleting a migration.
--
-- CONCURRENTLY works here because Prisma's parser accepts every statement in this file, and a file it
-- parses runs one statement at a time in autocommit, with nothing around it. So several concurrent
-- builds can share it. The parser rejects `DROP INDEX CONCURRENTLY`, and a file it cannot parse is sent
-- as one string, which PostgreSQL runs as one implicit transaction once it holds a second statement.
-- The drop fails there, so it survives only alone in a migration of its own. That is the other reason
-- the drops are a separate change. "How Prisma applies a migration file" in packages/database/README.md
-- has the full rule.
--
-- No cleanup DROP before each CREATE, because neither spelling can live in this file: squawk rejects a
-- plain `DROP INDEX` (correctly — ACCESS EXCLUSIVE), and a concurrent one cannot share a file with
-- these CREATEs. That leaves one hazard: an interrupted concurrent build leaves an INVALID index of
-- that name behind, and `IF NOT EXISTS` then makes the retry skip it, so this migration would report
-- success while the index stayed unusable — the planner ignores invalid indexes.
--
-- The migration that follows this one checks for exactly that and fails loudly. It has to be a
-- separate file: the parser rejects a `DO $$ … $$` block, so adding one here would turn this whole
-- file into one implicit transaction and break the CREATEs.

-- No lock timeout, set explicitly so that no server, role or earlier-file default applies one either.
-- `lock_timeout` does not only bound acquiring the SHARE UPDATE EXCLUSIVE lock. A concurrent build also
-- waits, under the same timeout, for every transaction that wrote to "Response", and for every
-- transaction in the database still holding an older snapshot, on any table. A short value fails the
-- build whenever a long report query, a `pg_dump` backup or a `REPEATABLE READ` transaction left open
-- outlasts it, and leaves an INVALID index behind (ENG-3701). The build's own lock never blocks reads
-- or writes, so a timeout protects nothing here. With 0 a busy deploy waits instead of failing, and
-- `pg_stat_progress_create_index` shows what it waits for.
--
-- Deliberately NO `statement_timeout`: these builds are long by nature on a table this size, and a
-- global limit would abort a healthy migration. Same reasoning `.squawk.toml` gives for excluding
-- `require-statement-timeout`.
SET lock_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Response_created_at_id_idx" ON "Response"(created_at, id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Response_surveyId_created_at_id_idx" ON "Response"("surveyId", created_at, id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Response_contactId_created_at_id_idx" ON "Response"("contactId", created_at, id);

-- Do not leak the timeout into whatever migration shares this connection next.
RESET lock_timeout;

