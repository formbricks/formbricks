-- AlterTable
ALTER TABLE "Chart" ADD COLUMN "feedbackRecordDirectoryId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Chart_feedbackRecordDirectoryId_idx" ON "Chart"("feedbackRecordDirectoryId");

-- AddForeignKey
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_feedbackRecordDirectoryId_fkey" FOREIGN KEY ("feedbackRecordDirectoryId") REFERENCES "FeedbackRecordDirectory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
