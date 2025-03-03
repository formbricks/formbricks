/*
  Warnings:

  - A unique constraint covering the columns `[personId,attributeClassId]` on the table `Attribute` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Attribute_attributeClassId_personId_key";

-- DropIndex
DROP INDEX "AttributeClass_environmentId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_personId_attributeClassId_key" ON "Attribute"("personId", "attributeClassId");

-- CreateIndex
CREATE INDEX "AttributeClass_environmentId_created_at_idx" ON "AttributeClass"("environmentId", "created_at");

-- CreateIndex
CREATE INDEX "AttributeClass_environmentId_archived_idx" ON "AttributeClass"("environmentId", "archived");
