-- CreateEnum
CREATE TYPE "public"."SurveyScriptMode" AS ENUM ('add', 'replace');

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "customHeadScripts" TEXT;

-- AlterTable
ALTER TABLE "public"."Survey" ADD COLUMN     "customHeadScripts" TEXT,
ADD COLUMN     "customHeadScriptsMode" "public"."SurveyScriptMode" DEFAULT 'add';
