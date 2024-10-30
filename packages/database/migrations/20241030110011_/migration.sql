-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}';
