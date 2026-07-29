-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Survey_archivedAt_idx" ON "Survey"("archivedAt");
