-- AlterTable
ALTER TABLE "ApiKeyEnvironment" ADD COLUMN "workspaceId" TEXT;

-- AddForeignKey
ALTER TABLE "ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ApiKeyEnvironment_workspaceId_idx" ON "ApiKeyEnvironment"("workspaceId");

-- Backfill workspaceId from Environment table
UPDATE "ApiKeyEnvironment" ake
SET "workspaceId" = e."workspaceId"
FROM "Environment" e
WHERE ake."environmentId" = e."id"
  AND ake."workspaceId" IS NULL;
