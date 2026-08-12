-- The survey list aggregates response counts with `GROUP BY "surveyId", "finished"`. Without
-- "finished" in an index that grouping cannot be served from the index alone, so Postgres falls back
-- to a bitmap heap scan (measured ~40x the buffer traffic of the previous surveyId-only grouping).
-- This index restores an index-only scan.
--
-- Keep standard CREATE INDEX here: this repo applies schema migrations through Prisma migrate deploy,
-- which runs inside a transaction block and cannot execute CREATE INDEX CONCURRENTLY.
CREATE INDEX "Response_surveyId_finished_idx" ON "Response"("surveyId", "finished");
