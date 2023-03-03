-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profileIsValid" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "date_of_birth" DROP NOT NULL,
ALTER COLUMN "date_of_birth" DROP DEFAULT;
UPDATE "users" SET date_of_birth=NULL;