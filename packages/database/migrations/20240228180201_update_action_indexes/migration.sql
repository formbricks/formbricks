-- DropIndex
DROP INDEX "Action_actionClassId_idx";

-- CreateIndex
CREATE INDEX "Action_personId_actionClassId_created_at_idx" ON "Action"("personId", "actionClassId", "created_at");

-- CreateIndex
CREATE INDEX "Action_actionClassId_created_at_idx" ON "Action"("actionClassId", "created_at");
