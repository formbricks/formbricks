/*
  Warnings:

  - The `source` column on the `Webhook` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "WehbhookSource" AS ENUM ('user', 'zapier');

-- AlterTable
ALTER TABLE "Webhook" DROP COLUMN "source",
ADD COLUMN     "source" "WehbhookSource" NOT NULL DEFAULT 'user';
