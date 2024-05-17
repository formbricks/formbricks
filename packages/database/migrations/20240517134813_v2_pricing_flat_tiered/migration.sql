-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "billing" SET DEFAULT '{"stripeCustomerId": null, "plan": "free", "limits": {"monthly": {"responses": 500, "miu": 1000}}}';
