-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "isFinished" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "NoCodeForm" ADD COLUMN     "isFinished" BOOLEAN NOT NULL DEFAULT false;
