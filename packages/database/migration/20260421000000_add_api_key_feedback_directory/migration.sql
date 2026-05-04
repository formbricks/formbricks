-- CreateTable
CREATE TABLE "ApiKeyFeedbackDirectory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "feedbackDirectoryId" TEXT NOT NULL,
    "permission" "ApiKeyPermission" NOT NULL,

    CONSTRAINT "ApiKeyFeedbackDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyFeedbackDirectory_apiKeyId_feedbackDirectoryId_key" ON "ApiKeyFeedbackDirectory"("apiKeyId", "feedbackDirectoryId");

-- CreateIndex
CREATE INDEX "ApiKeyFeedbackDirectory_feedbackDirectoryId_idx" ON "ApiKeyFeedbackDirectory"("feedbackDirectoryId");

-- AddForeignKey
ALTER TABLE "ApiKeyFeedbackDirectory" ADD CONSTRAINT "ApiKeyFeedbackDirectory_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyFeedbackDirectory" ADD CONSTRAINT "ApiKeyFeedbackDirectory_feedbackDirectoryId_fkey" FOREIGN KEY ("feedbackDirectoryId") REFERENCES "FeedbackDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
