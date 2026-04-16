/*
  Warnings:

  - The column `billing` on the `Organization` table is being dropped, but its data IS being
    preserved: `stripeCustomerId` is copied into `OrganizationBilling.stripe_customer_id` and
    the old plan value is stashed in `OrganizationBilling.stripe` as `{"plan": "<value>"}` so
    that a follow-up migration script can create the correct Stripe subscriptions.

*/

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

-- MigrateData: copy stripe_customer_id and plan from the old billing JSON into OrganizationBilling.
-- `stripe_customer_id` is extracted as text (NULL when the key is absent).
-- `stripe` stashes the old plan name so a follow-up script knows which Stripe product to subscribe the org to.
-- `limits` uses a placeholder — Stripe sync will overwrite it once the correct subscription is created.
-- Note: the plan value uses OLD enum values ("free", "startup", "scale", "custom") which do NOT match
-- the new ZCloudBillingPlan enum ("hobby", "pro", "scale", "unknown"). The follow-up migration script
-- must create the correct Stripe subscriptions before the billing sync reads these values.
INSERT INTO "OrganizationBilling" (
    "organization_id",
    "stripe_customer_id",
    "limits",
    "usage_cycle_anchor",
    "stripe",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "billing"->>'stripeCustomerId',
    '{}'::jsonb,
    NULL,
    jsonb_build_object('plan', "billing"->>'plan'),
    NOW(),
    NOW()
FROM "Organization"
WHERE "billing" IS NOT NULL;

-- AlterTable: drop the now-migrated billing column last so the INSERT above can still read from it.
ALTER TABLE "Organization" DROP COLUMN "billing";
