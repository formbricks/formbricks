-- DropIndex
DROP INDEX IF EXISTS "ApiKey_hashedKey_key";

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "lookupHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_lookupHash_key" ON "ApiKey"("lookupHash");

