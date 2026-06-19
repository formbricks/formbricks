-- ENG-1054: Better Auth foundation (additive, non-breaking).
--
-- Adds the columns Better Auth requires onto the existing Account/Session tables and the new
-- TwoFactor table (verified against better-auth@1.6.18 getAuthTables). NextAuth continues to
-- operate unchanged — every change here is additive/nullable. The emailVerified Date->boolean
-- conversion and the Account.type not-null handling are deferred to the phases where Better Auth
-- actually writes those tables (they would break the still-live NextAuth flows).

-- AlterTable
ALTER TABLE "public"."Account" ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "password" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Session" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "public"."TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwoFactor_userId_idx" ON "public"."TwoFactor"("userId");

-- AddForeignKey
ALTER TABLE "public"."TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
