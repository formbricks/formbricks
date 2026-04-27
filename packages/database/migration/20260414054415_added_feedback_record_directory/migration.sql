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
CREATE TABLE "FeedbackRecordDirectoryWorkspace" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "feedbackRecordDirectoryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "FeedbackRecordDirectoryWorkspace_pkey" PRIMARY KEY ("feedbackRecordDirectoryId","workspaceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackRecordDirectory_organizationId_name_key" ON "FeedbackRecordDirectory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "FeedbackRecordDirectoryWorkspace_workspaceId_idx" ON "FeedbackRecordDirectoryWorkspace"("workspaceId");


-- AddForeignKey
ALTER TABLE "FeedbackRecordDirectory" ADD CONSTRAINT "FeedbackRecordDirectory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecordDirectoryWorkspace" ADD CONSTRAINT "FeedbackRecordDirectoryWorkspace_feedbackRecordDirectoryId_fkey" FOREIGN KEY ("feedbackRecordDirectoryId") REFERENCES "FeedbackRecordDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecordDirectoryWorkspace" ADD CONSTRAINT "FeedbackRecordDirectoryWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Connector → FeedbackRecordDirectory FK
ALTER TABLE "Connector" ADD COLUMN "feedbackRecordDirectoryId" TEXT NOT NULL;
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_feedbackRecordDirectoryId_fkey" FOREIGN KEY ("feedbackRecordDirectoryId") REFERENCES "FeedbackRecordDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Connector_feedbackRecordDirectoryId_idx" ON "Connector"("feedbackRecordDirectoryId");

-- AlterTable
ALTER TABLE "Chart" ADD COLUMN "feedbackRecordDirectoryId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Chart_feedbackRecordDirectoryId_idx" ON "Chart"("feedbackRecordDirectoryId");

-- AddForeignKey
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_feedbackRecordDirectoryId_fkey" FOREIGN KEY ("feedbackRecordDirectoryId") REFERENCES "FeedbackRecordDirectory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
