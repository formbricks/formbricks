-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationSettings" JSONB NOT NULL DEFAULT '{}';
