-- CreateEnum
CREATE TYPE "ShowOptions" AS ENUM ('once', 'always');

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "brandColor" SET DEFAULT '#334155';

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "show" "ShowOptions" NOT NULL DEFAULT 'once';
