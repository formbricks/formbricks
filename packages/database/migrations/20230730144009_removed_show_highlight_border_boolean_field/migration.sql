/*
  Warnings:

  - You are about to drop the column `showHighlightBorder` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "showHighlightBorder",
ALTER COLUMN "highlightBorderColor" DROP NOT NULL,
ALTER COLUMN "highlightBorderColor" DROP DEFAULT;
