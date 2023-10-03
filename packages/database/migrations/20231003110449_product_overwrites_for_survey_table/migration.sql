/*
  Warnings:

  - You are about to drop the column `brandColor` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `clickOutsideClose` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `darkOverlay` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `highlightBorderColor` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `overwriteBorderHighlight` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `placement` on the `Survey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "brandColor",
DROP COLUMN "clickOutsideClose",
DROP COLUMN "darkOverlay",
DROP COLUMN "highlightBorderColor",
DROP COLUMN "overwriteBorderHighlight",
DROP COLUMN "placement",
ADD COLUMN     "productOverwrites" JSONB;
