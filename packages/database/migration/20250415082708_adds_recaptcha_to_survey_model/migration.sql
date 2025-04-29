-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "recaptcha" JSONB DEFAULT '{"enabled": false, "threshold":0}';