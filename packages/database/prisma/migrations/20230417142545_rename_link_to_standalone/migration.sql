/*
  Warnings:

  - The values [link] on the enum `SurveyType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SurveyType_new" AS ENUM ('email', 'standalone', 'mobile', 'web');
ALTER TYPE "SurveyType" RENAME TO "SurveyType_old";
ALTER TYPE "SurveyType_new" RENAME TO "SurveyType";
DROP TYPE "SurveyType_old";
COMMIT;
