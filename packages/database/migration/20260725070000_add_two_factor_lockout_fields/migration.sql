-- Better Auth 1.6.23 two-factor plugin brute-force lockout: adds the failedVerificationCount /
-- lockedUntil columns it reads and writes on every 2FA verification (see better-auth's
-- plugins/two-factor/schema.ts). Additive/nullable-or-defaulted, non-breaking.

-- AlterTable
ALTER TABLE "public"."TwoFactor" ADD COLUMN     "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
