-- DropIndex
DROP INDEX "Action_created_at_idx";

-- DropIndex
DROP INDEX "Action_personId_idx";

-- CreateIndex
CREATE INDEX "Action_personId_created_at_idx" ON "Action"("personId", "created_at");
