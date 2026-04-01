-- AlterTable: Add nullable workspaceId to all environment-owned models
ALTER TABLE "Webhook" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ContactAttributeKey" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Tag" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Survey" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ActionClass" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Integration" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ApiKeyEnvironment" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Segment" ADD COLUMN "workspaceId" TEXT;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactAttributeKey" ADD CONSTRAINT "ContactAttributeKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionClass" ADD CONSTRAINT "ActionClass_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Webhook_workspaceId_idx" ON "Webhook"("workspaceId");
CREATE INDEX "ContactAttributeKey_workspaceId_created_at_idx" ON "ContactAttributeKey"("workspaceId", "created_at");
CREATE INDEX "Contact_workspaceId_idx" ON "Contact"("workspaceId");
CREATE INDEX "Tag_workspaceId_idx" ON "Tag"("workspaceId");
CREATE INDEX "Survey_workspaceId_updated_at_idx" ON "Survey"("workspaceId", "updated_at");
CREATE INDEX "ActionClass_workspaceId_created_at_idx" ON "ActionClass"("workspaceId", "created_at");
CREATE INDEX "Integration_workspaceId_idx" ON "Integration"("workspaceId");
CREATE INDEX "ApiKeyEnvironment_workspaceId_idx" ON "ApiKeyEnvironment"("workspaceId");
CREATE INDEX "Segment_workspaceId_idx" ON "Segment"("workspaceId");
