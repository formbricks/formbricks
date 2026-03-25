-- AlterTable
ALTER TABLE "ActionClass" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "ContactAttributeKey" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "ActionClass_projectId_createdAt_idx" ON "ActionClass"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_projectId_idx" ON "Contact"("projectId");

-- CreateIndex
CREATE INDEX "ContactAttributeKey_projectId_createdAt_idx" ON "ContactAttributeKey"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Integration_projectId_idx" ON "Integration"("projectId");

-- CreateIndex
CREATE INDEX "Segment_projectId_idx" ON "Segment"("projectId");

-- CreateIndex
CREATE INDEX "Survey_projectId_updatedAt_idx" ON "Survey"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "Tag_projectId_idx" ON "Tag"("projectId");

-- CreateIndex
CREATE INDEX "Webhook_projectId_idx" ON "Webhook"("projectId");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactAttributeKey" ADD CONSTRAINT "ContactAttributeKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionClass" ADD CONSTRAINT "ActionClass_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
