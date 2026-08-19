-- DropIndex
DROP INDEX IF EXISTS "public"."ApiKey_hashedKey_key";

-- AlterTable
ALTER TABLE "public"."ApiKey" ADD COLUMN IF NOT EXISTS "lookupHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_lookupHash_key" ON "public"."ApiKey"("lookupHash");

