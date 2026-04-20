-- CreateTable
CREATE TABLE "FeedbackRecordDirectory" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FeedbackRecordDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRecordDirectoryProject" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "feedbackRecordDirectoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "FeedbackRecordDirectoryProject_pkey" PRIMARY KEY ("feedbackRecordDirectoryId","projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackRecordDirectory_organizationId_name_key" ON "FeedbackRecordDirectory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "FeedbackRecordDirectoryProject_projectId_idx" ON "FeedbackRecordDirectoryProject"("projectId");

-- AddForeignKey
ALTER TABLE "FeedbackRecordDirectory" ADD CONSTRAINT "FeedbackRecordDirectory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecordDirectoryProject" ADD CONSTRAINT "FeedbackRecordDirectoryProject_feedbackRecordDirectoryId_fkey" FOREIGN KEY ("feedbackRecordDirectoryId") REFERENCES "FeedbackRecordDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecordDirectoryProject" ADD CONSTRAINT "FeedbackRecordDirectoryProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
