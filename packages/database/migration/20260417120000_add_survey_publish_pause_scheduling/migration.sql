ALTER TABLE "Survey"
ADD COLUMN "publishOn" TIMESTAMP(3),
ADD COLUMN "pauseOn" TIMESTAMP(3);

-- Keep standard CREATE INDEX here: this repo applies schema migrations through Prisma migrate deploy,
-- which runs inside a transaction block and cannot execute CREATE INDEX CONCURRENTLY.
CREATE INDEX "Survey_status_publishOn_idx" ON "Survey"("status", "publishOn");

CREATE INDEX "Survey_status_pauseOn_idx" ON "Survey"("status", "pauseOn");
