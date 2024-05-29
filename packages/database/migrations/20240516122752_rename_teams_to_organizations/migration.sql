-- Rename table from "Team" to "Organization"
ALTER TABLE "Team" RENAME TO "Organization";
ALTER TABLE "Organization" RENAME CONSTRAINT "Team_pkey" TO "Organization_pkey";

-- Rename column in the "Product" table
ALTER TABLE "Product" RENAME COLUMN "teamId" TO "organizationId";

-- Rename column in the "Invite" table
ALTER TABLE "Invite" RENAME COLUMN "teamId" TO "organizationId";

-- Rename column in the "Membership" table
ALTER TABLE "Membership" RENAME COLUMN "teamId" TO "organizationId";

-- Rename foreign key constraints
ALTER TABLE "Invite" RENAME CONSTRAINT "Invite_teamId_fkey" TO "Invite_organizationId_fkey";
ALTER TABLE "Membership" RENAME CONSTRAINT "Membership_teamId_fkey" TO "Membership_organizationId_fkey";
ALTER TABLE "Product" RENAME CONSTRAINT "Product_teamId_fkey" TO "Product_organizationId_fkey";

-- Rename indexes
ALTER INDEX "Invite_email_teamId_idx" RENAME TO "Invite_email_organizationId_idx";
ALTER INDEX "Invite_teamId_idx" RENAME TO "Invite_organizationId_idx";
ALTER INDEX "Membership_teamId_idx" RENAME TO "Membership_organizationId_idx";
ALTER INDEX "Product_teamId_idx" RENAME TO "Product_organizationId_idx";
ALTER INDEX "Product_teamId_name_key" RENAME TO "Product_organizationId_name_key";

-- Drop and recreate primary key on Membership table
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_pkey";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId", "organizationId");
