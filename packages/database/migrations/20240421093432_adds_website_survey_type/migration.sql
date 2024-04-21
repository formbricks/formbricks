/*
  Warnings:

  - The values [email,mobile] on the enum `SurveyType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SurveyType_new" AS ENUM ('link', 'web', 'website', 'app');
ALTER TABLE "Survey" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Survey" ALTER COLUMN "type" TYPE "SurveyType_new" USING ("type"::text::"SurveyType_new");
ALTER TYPE "SurveyType" RENAME TO "SurveyType_old";
ALTER TYPE "SurveyType_new" RENAME TO "SurveyType";
DROP TYPE "SurveyType_old";
ALTER TABLE "Survey" ALTER COLUMN "type" SET DEFAULT 'web';
COMMIT;
