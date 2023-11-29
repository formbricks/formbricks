-- 1. Rename the existing ENUM type.
ALTER TYPE "WehbhookSource" RENAME TO "TempWebhookSource";

-- 2. Create the new ENUM type.
CREATE TYPE "WebhookSource" AS ENUM ('user', 'zapier', 'make', 'n8n');

-- 3. Remove the default.
ALTER TABLE "Webhook" ALTER COLUMN "source" DROP DEFAULT;

-- 4. Change the column type using the USING clause for casting.
ALTER TABLE "Webhook"
ALTER COLUMN "source" TYPE "WebhookSource" USING "source"::text::"WebhookSource";

-- 5. Add the default back.
ALTER TABLE "Webhook" ALTER COLUMN "source" SET DEFAULT 'user';

-- Optionally, if you want to drop the old ENUM type after verifying everything works:
DROP TYPE "TempWebhookSource"; 
