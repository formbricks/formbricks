-- AlterTable
ALTER TABLE "ResponseNote" ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isResolved" BOOLEAN NOT NULL DEFAULT false;
