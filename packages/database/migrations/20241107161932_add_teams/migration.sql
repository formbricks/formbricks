-- Drop the `accepted` column on "Invite"
ALTER TABLE "Invite" 
DROP COLUMN "accepted";

-- Rename the `role` column on "Invite" to `deprecatedRole`
ALTER TABLE "Invite" 
RENAME COLUMN "role" TO "deprecatedRole";

-- Drop NOT NULL constraint on `deprecatedRole` in "Invite"
ALTER TABLE "Invite" 
ALTER COLUMN "deprecatedRole" DROP NOT NULL;

-- Drop DEFAULT constraint on `deprecatedRole` in "Invite"
ALTER TABLE "Invite" 
ALTER COLUMN "deprecatedRole" DROP DEFAULT;

-- Rename the `role` column on "Membership" to `deprecatedRole`
ALTER TABLE "Membership" 
RENAME COLUMN "role" TO "deprecatedRole";

-- Drop NOT NULL constraint on `deprecatedRole` in "Membership"
ALTER TABLE "Membership" 
ALTER COLUMN "deprecatedRole" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('owner', 'manager', 'member', 'billing');

-- CreateEnum
CREATE TYPE "TeamUserRole" AS ENUM ('admin', 'contributor');

-- CreateEnum
CREATE TYPE "ProductTeamPermission" AS ENUM ('read', 'readWrite', 'manage');

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "role" "OrganizationRole" NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "role" "OrganizationRole" NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUser" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TeamUserRole" NOT NULL,

    CONSTRAINT "TeamUser_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "ProductTeam" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "product_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "permission" "ProductTeamPermission" NOT NULL DEFAULT 'read',

    CONSTRAINT "ProductTeam_pkey" PRIMARY KEY ("product_id","team_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_organization_id_name_key" ON "Team"("organization_id", "name");

-- CreateIndex
CREATE INDEX "TeamUser_user_id_idx" ON "TeamUser"("user_id");

-- CreateIndex
CREATE INDEX "ProductTeam_team_id_idx" ON "ProductTeam"("team_id");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUser" ADD CONSTRAINT "TeamUser_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUser" ADD CONSTRAINT "TeamUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTeam" ADD CONSTRAINT "ProductTeam_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTeam" ADD CONSTRAINT "ProductTeam_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
