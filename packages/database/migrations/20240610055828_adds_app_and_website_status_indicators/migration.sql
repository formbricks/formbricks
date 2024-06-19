-- AlterTable
ALTER TABLE "Environment" ADD COLUMN     "appSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "websiteSetupCompleted" BOOLEAN NOT NULL DEFAULT false;
