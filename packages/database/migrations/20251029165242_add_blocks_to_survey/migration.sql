-- AlterTable
ALTER TABLE "public"."Survey" ADD COLUMN     "blocks" JSONB[] DEFAULT ARRAY[]::JSONB[];
