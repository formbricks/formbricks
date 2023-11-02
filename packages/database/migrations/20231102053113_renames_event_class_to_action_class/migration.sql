-- AlterTable
ALTER TABLE "ActionClass" RENAME CONSTRAINT "EventClass_pkey" TO "ActionClass_pkey";

-- RenameForeignKey
ALTER TABLE "ActionClass" RENAME CONSTRAINT "EventClass_environmentId_fkey" TO "ActionClass_environmentId_fkey";

-- RenameIndex
ALTER INDEX "EventClass_name_environmentId_key" RENAME TO "ActionClass_name_environmentId_key";
