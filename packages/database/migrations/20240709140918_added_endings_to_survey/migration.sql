-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "endings" JSONB[] DEFAULT ARRAY[]::JSONB[];
