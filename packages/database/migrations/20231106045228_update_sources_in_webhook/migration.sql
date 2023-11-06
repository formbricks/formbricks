/*
  Warnings:

  - The `source` column on the `Webhook` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('user', 'zapier', 'make', 'n8n');

-- AlterTable
ALTER TABLE "Webhook" DROP COLUMN "source",
ADD COLUMN     "source" "WebhookSource" NOT NULL DEFAULT 'user';

-- DropEnum
DROP TYPE "WehbhookSource";
