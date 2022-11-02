-- CreateEnum
CREATE TYPE "FormOrder" AS ENUM ('RANDOM', 'SEQUENTIAL', 'ABTEST');

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "answeringOrder" "FormOrder" NOT NULL DEFAULT 'RANDOM';
