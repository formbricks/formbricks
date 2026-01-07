-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "customHeadScripts" TEXT;

-- AlterTable
ALTER TABLE "public"."Survey" ADD COLUMN     "customHeadScripts" TEXT,
ADD COLUMN     "customHeadScriptsMode" TEXT;
