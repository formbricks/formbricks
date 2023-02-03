/*
  Warnings:

  - The primary key for the `Customer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Membership` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `organisationId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organisationId` to the `Form` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organisationId` to the `Membership` table without a default value. This is not possible if the table is not empty.
*/

-- AlterTable
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_workspaceId_fkey";

-- AlterTable
ALTER TABLE "Form" DROP CONSTRAINT "Form_workspaceId_fkey";

-- AlterTable
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_workspaceId_fkey";

-- AlterTable
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_customerEmail_customerWorkspaceId_fkey";

-- AlterTable
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_pkey";

-- AlterTable
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_pkey";



-- AlterTable
ALTER TABLE "Customer"
RENAME COLUMN "workspaceId" TO "organisationId";

-- AlterTable
ALTER TABLE "Form"
RENAME COLUMN "workspaceId" TO "organisationId";

-- AlterTable
ALTER TABLE "Membership"
RENAME COLUMN "workspaceId" TO "organisationId";

-- AlterTable
ALTER TABLE "Submission"
RENAME COLUMN "customerWorkspaceId" TO "customerOrganisationId";

-- AlterTable
ALTER TABLE "Workspace" RENAME TO "Organisation";



-- AlterTable
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_pkey" PRIMARY KEY ("email", "organisationId");

-- AlterTable
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId", "organisationId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_customerEmail_customerOrganisationId_fkey" FOREIGN KEY ("customerEmail", "customerOrganisationId") REFERENCES "Customer"("email", "organisationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Organisation" RENAME CONSTRAINT "Workspace_pkey" TO "Organisation_pkey";