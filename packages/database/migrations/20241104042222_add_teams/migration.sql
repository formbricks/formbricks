/*
  Warnings:

  - You are about to drop the column `accepted` on the `Invite` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('owner', 'manager', 'member', 'billing');

-- CreateEnum
CREATE TYPE "TeamUserRole" AS ENUM ('admin', 'contributor');

-- CreateEnum
CREATE TYPE "ProductTeamPermission" AS ENUM ('read', 'readWrite', 'manage');

-- AlterTable
ALTER TABLE "Invite" DROP COLUMN "accepted",
ADD COLUMN     "organizationRole" "OrganizationRole" NOT NULL DEFAULT 'member',
ALTER COLUMN "role" DROP NOT NULL,
ALTER COLUMN "role" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "organizationRole" "OrganizationRole" NOT NULL DEFAULT 'member',
ALTER COLUMN "role" DROP NOT NULL;

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
