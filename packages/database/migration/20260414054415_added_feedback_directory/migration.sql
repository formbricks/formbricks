-- CreateTable
CREATE TABLE "FeedbackDirectory" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FeedbackDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackDirectoryWorkspace" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "feedbackDirectoryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "FeedbackDirectoryWorkspace_pkey" PRIMARY KEY ("feedbackDirectoryId","workspaceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackDirectory_organizationId_name_key" ON "FeedbackDirectory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "FeedbackDirectoryWorkspace_workspaceId_idx" ON "FeedbackDirectoryWorkspace"("workspaceId");


-- AddForeignKey
ALTER TABLE "FeedbackDirectory" ADD CONSTRAINT "FeedbackDirectory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackDirectoryWorkspace" ADD CONSTRAINT "FeedbackDirectoryWorkspace_feedbackDirectoryId_fkey" FOREIGN KEY ("feedbackDirectoryId") REFERENCES "FeedbackDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackDirectoryWorkspace" ADD CONSTRAINT "FeedbackDirectoryWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Connector → FeedbackDirectory FK
ALTER TABLE "Connector" ADD COLUMN "feedbackDirectoryId" TEXT NOT NULL;
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_feedbackDirectoryId_fkey" FOREIGN KEY ("feedbackDirectoryId") REFERENCES "FeedbackDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Connector_feedbackDirectoryId_idx" ON "Connector"("feedbackDirectoryId");

-- AlterTable
ALTER TABLE "Chart" ADD COLUMN "feedbackDirectoryId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Chart_feedbackDirectoryId_idx" ON "Chart"("feedbackDirectoryId");

-- AddForeignKey
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_feedbackDirectoryId_fkey" FOREIGN KEY ("feedbackDirectoryId") REFERENCES "FeedbackDirectory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
