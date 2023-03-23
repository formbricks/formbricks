/*
  Warnings:

  - The `displayOptions` column on the `Survey` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "displayOptions" AS ENUM ('displayOnce', 'displayMultiple', 'respondMultiple');

-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "displayOptions",
ADD COLUMN     "displayOptions" "displayOptions" NOT NULL DEFAULT 'displayOnce';
