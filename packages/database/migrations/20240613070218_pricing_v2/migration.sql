-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "billing" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Response_personId_created_at_idx" ON "Response"("personId", "created_at");
