-- Rename table "Person" to "Contact"
ALTER TABLE "Person" RENAME TO "Contact";
ALTER TABLE "Contact" RENAME CONSTRAINT "Person_pkey" TO "Contact_pkey";
ALTER TABLE "Contact" RENAME CONSTRAINT "Person_environmentId_fkey" TO "Contact_environmentId_fkey";

-- Rename column "personId" to "contactId" in "Attribute" table
ALTER TABLE "Attribute" RENAME COLUMN "personId" TO "contactId";

-- Rename column "personId" to "contactId" in "Response" table
ALTER TABLE "Response" RENAME COLUMN "personId" TO "contactId";

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