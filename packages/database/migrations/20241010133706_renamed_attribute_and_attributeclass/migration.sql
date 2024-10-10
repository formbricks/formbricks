-- Renaming the tables
ALTER TABLE "AttributeClass" RENAME TO "ContactAttributeKey";
ALTER TABLE "ContactAttributeKey" RENAME CONSTRAINT "AttributeClass_pkey" TO "ContactAttributeKey_pkey";
ALTER TABLE "ContactAttributeKey" RENAME CONSTRAINT "AttributeClass_environmentId_fkey" TO "ContactAttributeKey_environmentId_fkey";

ALTER TABLE "Attribute" RENAME TO "ContactAttribute";
ALTER TABLE "ContactAttribute" RENAME CONSTRAINT "Attribute_pkey" TO "ContactAttribute_pkey";
ALTER TABLE "ContactAttribute" RENAME COLUMN "attributeClassId" TO "attributeKeyId";
ALTER TABLE "ContactAttribute" RENAME CONSTRAINT "Attribute_attributeClassId_fkey" TO "ContactAttribute_attributeKeyId_fkey";
ALTER TABLE "ContactAttribute" RENAME CONSTRAINT "Attribute_contactId_fkey" TO "ContactAttribute_contactId_fkey";

ALTER TABLE "SurveyAttributeFilter" RENAME COLUMN "attributeClassId" TO "attributeKeyId";
ALTER TABLE "SurveyAttributeFilter" RENAME CONSTRAINT "SurveyAttributeFilter_attributeClassId_fkey" TO "SurveyAttributeFilter_attributeKeyId_fkey";

ALTER INDEX "SurveyAttributeFilter_surveyId_attributeClassId_key" RENAME TO "SurveyAttributeFilter_surveyId_attributeKeyId_key";
ALTER INDEX "SurveyAttributeFilter_attributeClassId_idx" RENAME TO "SurveyAttributeFilter_attributeKeyId_idx";
ALTER INDEX "Attribute_contactId_attributeClassId_key" RENAME TO "ContactAttribute_contactId_attributeKeyId_key";
ALTER INDEX "AttributeClass_name_environmentId_key" RENAME TO "ContactAttributeKey_name_environmentId_key";
ALTER INDEX "AttributeClass_environmentId_created_at_idx" RENAME TO "ContactAttributeKey_environmentId_created_at_idx";
ALTER INDEX "AttributeClass_environmentId_archived_idx" RENAME TO "ContactAttributeKey_environmentId_archived_idx";


-- Step 1: Create the new enum type
CREATE TYPE "ContactAttributeType" AS ENUM ('default', 'custom');

-- Step 2: Add the new temporary column for 'type'
ALTER TABLE "ContactAttributeKey" ADD COLUMN "attributeType" "ContactAttributeType";

-- Step 3: Update the new 'type_new' column with mapped values
UPDATE "ContactAttributeKey"
SET "attributeType" = CASE
    WHEN "type" = 'automatic' THEN 'default'::"ContactAttributeType"
    ELSE 'custom'::"ContactAttributeType"
END;

-- Step 4: Drop the old 'type' column
ALTER TABLE "ContactAttributeKey" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "ContactAttributeKey" ALTER COLUMN "attributeType" SET NOT NULL,
ALTER COLUMN "attributeType" SET DEFAULT 'default';

-- DropEnum
DROP TYPE "AttributeType";

-- Step 7: Add the new 'key' column with a default value
ALTER TABLE "ContactAttributeKey" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';

-- Step 8: Copy data from 'name' to 'key'
UPDATE "ContactAttributeKey" SET "key" = "name";

-- Step 9: Make 'name' column nullable
ALTER TABLE "ContactAttributeKey" ALTER COLUMN "name" DROP NOT NULL;

-- Step 10: Drop the old unique index on 'name' and 'environmentId'
DROP INDEX "ContactAttributeKey_name_environmentId_key";

-- Step 11: Create a new unique index on 'key' and 'environmentId'
CREATE UNIQUE INDEX "ContactAttributeKey_key_environmentId_key" ON "ContactAttributeKey"("key", "environmentId");

-- Step 12: Remove the default value from 'key' column
ALTER TABLE "ContactAttributeKey" ALTER COLUMN "key" DROP DEFAULT;