-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "organizationAccess" JSONB NOT NULL DEFAULT '{}';
