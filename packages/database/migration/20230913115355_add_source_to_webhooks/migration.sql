-- CreateEnum
CREATE TYPE "WehbhookSource" AS ENUM ('user', 'zapier');

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "source" "WehbhookSource" NOT NULL DEFAULT 'user';
