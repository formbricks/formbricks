-- RenameEnum
ALTER TYPE "ProductTeamPermission" RENAME TO "ProjectTeamPermission";

-- Rename the "Product" table to "Project"
ALTER TABLE "Product" RENAME TO "Project";

-- Rename the "ProductTeam" table to "ProjectTeam"
ALTER TABLE "ProductTeam" RENAME TO "ProjectTeam";

-- Rename columns in "Environment" table
ALTER TABLE "Environment" RENAME COLUMN "productId" TO "projectId";

-- Rename foreign key constraint in "Environment" table
ALTER TABLE "Environment" RENAME CONSTRAINT "Environment_productId_fkey" TO "Environment_projectId_fkey";

-- Rename index in "Environment" table
ALTER INDEX "Environment_productId_idx" RENAME TO "Environment_projectId_idx";

-- Rename columns in "Language" table
ALTER TABLE "Language" RENAME COLUMN "productId" TO "projectId";

-- Rename foreign key constraint in "Language" table
ALTER TABLE "Language" RENAME CONSTRAINT "Language_productId_fkey" TO "Language_projectId_fkey";

-- Rename unique index in "Language" table
ALTER INDEX "Language_productId_code_key" RENAME TO "Language_projectId_code_key";

-- Rename columns in "Survey" table
ALTER TABLE "Survey" RENAME COLUMN "productOverwrites" TO "projectOverwrites";

-- Rename column in "ProjectTeam" table
ALTER TABLE "ProjectTeam" RENAME COLUMN "product_id" TO "projectId";

-- Rename column in "ProjectTeam" table
ALTER TABLE "ProjectTeam" RENAME COLUMN "team_id" TO "teamId";

-- Rename foreign key constraint in "ProjectTeam" table
ALTER TABLE "ProjectTeam" RENAME CONSTRAINT "ProductTeam_product_id_fkey" TO "ProjectTeam_projectId_fkey";

-- Rename foreign key constraint in "ProjectTeam" table
ALTER TABLE "ProjectTeam" RENAME CONSTRAINT "ProductTeam_team_id_fkey" TO "ProjectTeam_teamId_fkey";

-- Rename index in "ProjectTeam" table
ALTER INDEX "ProductTeam_team_id_idx" RENAME TO "ProjectTeam_teamId_idx";

-- Rename foreign key constraint in "Project" table
ALTER TABLE "Project" RENAME CONSTRAINT "Product_organizationId_fkey" TO "Project_organizationId_fkey";

-- Rename index in "Project" table
ALTER INDEX "Product_organizationId_idx" RENAME TO "Project_organizationId_idx";

-- Rename unique index in "Project" table
ALTER INDEX "Product_organizationId_name_key" RENAME TO "Project_organizationId_name_key";

-- Rename primary key constraint in "Project" table
ALTER TABLE "Project" RENAME CONSTRAINT "Product_pkey" TO "Project_pkey";

-- Rename column in "Project" table
ALTER TABLE "ProjectTeam" RENAME CONSTRAINT "ProductTeam_pkey" TO "ProjectTeam_pkey";

-- Rename column in "Team" table
ALTER TABLE "Team" RENAME COLUMN "organization_id" TO "organizationId";

-- Rename index in "Team" table
ALTER INDEX "Team_organization_id_name_key" RENAME TO "Team_organizationId_name_key";

-- RenameForeignKey
ALTER TABLE "Team" RENAME CONSTRAINT "Team_organization_id_fkey" TO "Team_organizationId_fkey";

-- Rename column in "TeamUser" table
ALTER TABLE "TeamUser" RENAME COLUMN "team_id" TO "teamId";

-- Rename column in "TeamUser" table
ALTER TABLE "TeamUser" RENAME COLUMN "user_id" TO "userId";

-- Rename index in "TeamUser" table
ALTER INDEX "TeamUser_user_id_idx" RENAME TO "TeamUser_userId_idx";

-- RenameForeignKey
ALTER TABLE "TeamUser" RENAME CONSTRAINT "TeamUser_team_id_fkey" TO "TeamUser_teamId_fkey";

-- RenameForeignKey
ALTER TABLE "TeamUser" RENAME CONSTRAINT "TeamUser_user_id_fkey" TO "TeamUser_userId_fkey";
