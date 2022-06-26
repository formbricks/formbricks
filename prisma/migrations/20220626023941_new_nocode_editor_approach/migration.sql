/*
  Warnings:

  - You are about to drop the column `pages` on the `NoCodeForm` table. All the data in the column will be lost.
  - You are about to drop the column `pagesDraft` on the `NoCodeForm` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NoCodeForm" DROP COLUMN "pages",
DROP COLUMN "pagesDraft",
ADD COLUMN     "blocks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "blocksDraft" JSONB NOT NULL DEFAULT '[]';
