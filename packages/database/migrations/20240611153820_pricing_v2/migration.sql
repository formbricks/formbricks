-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "billing" SET DEFAULT '{"stripeCustomerId": null, "plan": "free", "limits": {"monthly": {"responses": 500, "miu": 1000}}}';

-- CreateIndex
CREATE INDEX "Response_personId_created_at_idx" ON "Response"("personId", "created_at");
