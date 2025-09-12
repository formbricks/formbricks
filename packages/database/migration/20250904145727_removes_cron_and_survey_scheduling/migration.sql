/*
  Warnings:

  - The values [scheduled] on the enum `SurveyStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `closeOnDate` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `runOnDate` on the `Survey` table. All the data in the column will be lost.

*/

-- Update any scheduled surveys to paused
UPDATE "public"."Survey" SET "status" = 'paused' WHERE "status" = 'scheduled';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."SurveyStatus_new" AS ENUM ('draft', 'inProgress', 'paused', 'completed');
ALTER TABLE "public"."Survey" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Survey" ALTER COLUMN "status" TYPE "public"."SurveyStatus_new" USING ("status"::text::"public"."SurveyStatus_new");
ALTER TYPE "public"."SurveyStatus" RENAME TO "SurveyStatus_old";
ALTER TYPE "public"."SurveyStatus_new" RENAME TO "SurveyStatus";
DROP TYPE "public"."SurveyStatus_old";
ALTER TABLE "public"."Survey" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Survey" DROP COLUMN "closeOnDate",
DROP COLUMN "runOnDate";
