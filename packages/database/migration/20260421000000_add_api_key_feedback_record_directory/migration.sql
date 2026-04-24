-- CreateTable
CREATE TABLE "ApiKeyFeedbackRecordDirectory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "feedbackRecordDirectoryId" TEXT NOT NULL,
    "permission" "ApiKeyPermission" NOT NULL,

    CONSTRAINT "ApiKeyFeedbackRecordDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyFeedbackRecordDirectory_apiKeyId_feedbackRecordDirect_key" ON "ApiKeyFeedbackRecordDirectory"("apiKeyId", "feedbackRecordDirectoryId");

-- CreateIndex
CREATE INDEX "ApiKeyFeedbackRecordDirectory_feedbackRecordDirectoryId_idx" ON "ApiKeyFeedbackRecordDirectory"("feedbackRecordDirectoryId");

-- AddForeignKey
ALTER TABLE "ApiKeyFeedbackRecordDirectory" ADD CONSTRAINT "ApiKeyFeedbackRecordDirectory_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyFeedbackRecordDirectory" ADD CONSTRAINT "ApiKeyFeedbackRecordDirectory_feedbackRecordDirectoryId_fkey" FOREIGN KEY ("feedbackRecordDirectoryId") REFERENCES "FeedbackRecordDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
