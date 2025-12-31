/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Survey` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Survey" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Survey_slug_key" ON "public"."Survey"("slug");
