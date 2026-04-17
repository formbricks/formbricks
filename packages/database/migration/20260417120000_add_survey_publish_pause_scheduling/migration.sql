ALTER TABLE "Survey"
ADD COLUMN "publishOn" TIMESTAMP(3),
ADD COLUMN "pauseOn" TIMESTAMP(3);

CREATE INDEX "Survey_status_publishOn_idx" ON "Survey"("status", "publishOn");

CREATE INDEX "Survey_status_pauseOn_idx" ON "Survey"("status", "pauseOn");
