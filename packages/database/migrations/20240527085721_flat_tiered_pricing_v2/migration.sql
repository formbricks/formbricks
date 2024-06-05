-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "billing" SET DEFAULT '{"stripeCustomerId": null, "plan": "free", "limits": {"monthly": {"responses": 500, "miu": 1000}}}';
