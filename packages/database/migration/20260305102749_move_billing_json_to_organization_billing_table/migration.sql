/*
  Warnings:

  - You are about to drop the column `billing` on the `Organization` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "billing";

-- CreateTable
CREATE TABLE "OrganizationBilling" (
    "organization_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "limits" JSONB NOT NULL,
    "usage_cycle_anchor" TIMESTAMP(3),
    "stripe" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBilling_pkey" PRIMARY KEY ("organization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBilling_stripe_customer_id_key" ON "OrganizationBilling"("stripe_customer_id");

-- AddForeignKey
ALTER TABLE "OrganizationBilling" ADD CONSTRAINT "OrganizationBilling_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
