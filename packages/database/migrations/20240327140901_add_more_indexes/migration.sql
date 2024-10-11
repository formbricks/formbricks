-- DropIndex
DROP INDEX "Display_personId_idx";

-- DropIndex
DROP INDEX "Survey_environmentId_idx";

-- CreateIndex
CREATE INDEX "Action_created_at_idx" ON "Action"("created_at");

-- CreateIndex
CREATE INDEX "ActionClass_environmentId_created_at_idx" ON "ActionClass"("environmentId", "created_at");

-- CreateIndex
CREATE INDEX "Display_personId_created_at_idx" ON "Display"("personId", "created_at");

-- CreateIndex
CREATE INDEX "Survey_environmentId_updated_at_idx" ON "Survey"("environmentId", "updated_at");
