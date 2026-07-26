-- better-auth@1.6.22's two-factor plugin adds a failed-verification lockout: two new columns on
-- its TwoFactor table (getAuthTables). Both are optional/defaulted, so this is purely additive.

-- AlterTable
ALTER TABLE "public"."TwoFactor" ADD COLUMN     "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
