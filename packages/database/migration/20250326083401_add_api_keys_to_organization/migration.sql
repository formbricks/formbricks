-- CreateEnum
CREATE TYPE "ApiKeyPermission" AS ENUM ('read', 'write', 'manage');

-- CreateTable
CREATE TABLE "ApiKeyNew" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "label" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ApiKeyNew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyEnvironment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "permission" "ApiKeyPermission" NOT NULL,

    CONSTRAINT "ApiKeyEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyNew_hashedKey_key" ON "ApiKeyNew"("hashedKey");

-- CreateIndex
CREATE INDEX "ApiKeyNew_organizationId_idx" ON "ApiKeyNew"("organizationId");

-- CreateIndex
CREATE INDEX "ApiKeyEnvironment_environmentId_idx" ON "ApiKeyEnvironment"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyEnvironment_apiKeyId_environmentId_key" ON "ApiKeyEnvironment"("apiKeyId", "environmentId");

-- AddForeignKey
ALTER TABLE "ApiKeyNew" ADD CONSTRAINT "ApiKeyNew_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKeyNew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyEnvironment" ADD CONSTRAINT "ApiKeyEnvironment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
