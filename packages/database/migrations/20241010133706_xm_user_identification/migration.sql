-- Rename table "Person" to "Contact"
ALTER TABLE "Person" RENAME TO "Contact";
ALTER TABLE "Contact" RENAME CONSTRAINT "Person_pkey" TO "Contact_pkey";
ALTER TABLE "Contact" RENAME CONSTRAINT "Person_environmentId_fkey" TO "Contact_environmentId_fkey";
-- Rename column "personId" to "contactId" in "Attribute" table
ALTER TABLE "Attribute" RENAME COLUMN "personId" TO "contactId";

-- Rename column "personId" to "contactId" in "Response" table
ALTER TABLE "Response" RENAME COLUMN "personId" TO "contactId";
ALTER TABLE "Response" RENAME COLUMN "personAttributes" TO "contactAttributes";

-- Rename column "personId" to "contactId" in "Display" table
ALTER TABLE "Display" RENAME COLUMN "personId" TO "contactId";

-- If there are any foreign key constraints involving "personId", they should be renamed to "contactId" as well.
ALTER TABLE "Attribute" RENAME CONSTRAINT "Attribute_personId_fkey" TO "Attribute_contactId_fkey";
ALTER TABLE "Response" RENAME CONSTRAINT "Response_personId_fkey" TO "Response_contactId_fkey";
ALTER TABLE "Display" RENAME CONSTRAINT "Display_personId_fkey" TO "Display_contactId_fkey";

-- Rename indexes
ALTER INDEX "Person_environmentId_idx" RENAME TO "Contact_environmentId_idx";
ALTER INDEX "Person_environmentId_userId_key" RENAME TO "Contact_environmentId_userId_key";
ALTER INDEX "Attribute_personId_attributeClassId_key" RENAME TO "Attribute_contactId_attributeClassId_key";
ALTER INDEX "Response_personId_created_at_idx" RENAME TO "Response_contactId_created_at_idx";
ALTER INDEX "Display_personId_created_at_idx" RENAME TO "Display_contactId_created_at_idx";

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
ALTER TABLE "ContactAttributeKey" ADD COLUMN "type_new" "ContactAttributeType";

-- Step 3: Update the new 'type_new' column with mapped values
UPDATE "ContactAttributeKey"
SET "type_new" = CASE
    WHEN "type" = 'automatic' THEN 'default'::"ContactAttributeType"
    ELSE 'custom'::"ContactAttributeType"
END;

-- Step 4: Drop the old 'type' column
ALTER TABLE "ContactAttributeKey" DROP COLUMN "type";

-- DropEnum
DROP TYPE "AttributeType";

-- Step 5: Rename the new 'type_new' column to 'type'
ALTER TABLE "ContactAttributeKey" RENAME COLUMN "type_new" TO "type";

-- AlterTable
ALTER TABLE "ContactAttributeKey" ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'custom';

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

-- Testing this rn
-- ALTER TABLE "Contact" DROP COLUMN "userId";

ALTER TABLE "Contact" ALTER COLUMN "userId" DROP NOT NULL;
DROP INDEX "Contact_environmentId_userId_key";

-- Step 12: Remove the default value from 'key' column
ALTER TABLE "ContactAttributeKey" ALTER COLUMN "key" DROP DEFAULT;

DROP INDEX "ContactAttributeKey_environmentId_archived_idx";
ALTER TABLE "ContactAttributeKey" DROP COLUMN "archived";

ALTER TABLE "ContactAttributeKey" ADD COLUMN "isUnique" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "ContactAttribute_attributeKeyId_value_idx" ON "ContactAttribute"("attributeKeyId", "value");