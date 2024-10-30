/*
  Warnings:

  - The values [mattermost] on the enum `IntegrationType` will be removed. If these variants are still used in the database, this will fail.
  - The values [mattermost] on the enum `WebhookSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "IntegrationType_new" AS ENUM ('googleSheets', 'notion', 'airtable', 'slack');
ALTER TABLE "Integration" ALTER COLUMN "type" TYPE "IntegrationType_new" USING ("type"::text::"IntegrationType_new");
ALTER TYPE "IntegrationType" RENAME TO "IntegrationType_old";
ALTER TYPE "IntegrationType_new" RENAME TO "IntegrationType";
DROP TYPE "IntegrationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "WebhookSource_new" AS ENUM ('user', 'zapier', 'make', 'n8n');
ALTER TABLE "Webhook" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Webhook" ALTER COLUMN "source" TYPE "WebhookSource_new" USING ("source"::text::"WebhookSource_new");
ALTER TYPE "WebhookSource" RENAME TO "WebhookSource_old";
ALTER TYPE "WebhookSource_new" RENAME TO "WebhookSource";
DROP TYPE "WebhookSource_old";
ALTER TABLE "Webhook" ALTER COLUMN "source" SET DEFAULT 'user';
COMMIT;
