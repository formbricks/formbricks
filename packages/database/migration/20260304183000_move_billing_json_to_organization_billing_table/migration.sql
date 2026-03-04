-- CreateTable
CREATE TABLE "OrganizationBilling" (
    "organization_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "limits" JSONB NOT NULL DEFAULT '{"projects":3,"monthly":{"responses":1500,"miu":2000}}',
    "period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripe" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBilling_pkey" PRIMARY KEY ("organization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBilling_stripe_customer_id_key" ON "OrganizationBilling"("stripe_customer_id");

-- AddForeignKey
ALTER TABLE "OrganizationBilling"
ADD CONSTRAINT "OrganizationBilling_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill from legacy Organization.billing JSON
INSERT INTO "OrganizationBilling" (
  "organization_id",
  "stripe_customer_id",
  "limits",
  "period_start",
  "stripe",
  "created_at",
  "updated_at"
)
SELECT
  o.id,
  NULLIF(o.billing->>'stripeCustomerId', ''),
  COALESCE(o.billing->'limits', '{"projects":3,"monthly":{"responses":1500,"miu":2000}}'::jsonb),
  COALESCE((o.billing->>'periodStart')::timestamptz, CURRENT_TIMESTAMP)::timestamp(3),
  o.billing->'stripe',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
ON CONFLICT ("organization_id") DO NOTHING;

-- Drop legacy billing JSON column
ALTER TABLE "Organization" DROP COLUMN "billing";
