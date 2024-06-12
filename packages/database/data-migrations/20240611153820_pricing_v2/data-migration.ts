import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TSubscriptionStatusLegacy = "active" | "cancelled" | "inactive";

interface TSubscriptionLegacy {
  status: TSubscriptionStatusLegacy;
  unlimited: boolean;
}

interface TFeatures {
  inAppSurvey: TSubscriptionLegacy;
  linkSurvey: TSubscriptionLegacy;
  userTargeting: TSubscriptionLegacy;
  multiLanguage: TSubscriptionLegacy;
}

interface TOrganizationBillingLegacy {
  stripeCustomerId: string | null;
  features: TFeatures;
}

async function main() {
  await prisma.$transaction(
    async (tx) => {
      //   const startTime = Date.now();
      console.log("Starting data migration for pricing v2...");

      // Free tier
      const orgsWithoutBilling = await tx.organization.findMany({
        where: {
          billing: {
            path: ["stripeCustomerId"],
            equals: Prisma.AnyNull,
          },
        },
      });

      console.log("Found orgs with billing to process. teams: ", orgsWithoutBilling.length);

      for (const organization of orgsWithoutBilling) {
        await tx.organization.update({
          where: {
            id: organization.id,
          },
          data: {
            billing: {
              stripeCustomerId: null,
              plan: "free",
              limits: {
                monthly: {
                  responses: 500,
                  miu: 1000,
                },
              },
            },
          },
        });

        const orgsWithBilling = await tx.organization.findMany({
          where: {
            billing: {
              path: ["stripeCustomerId"],
              not: Prisma.AnyNull,
            },
          },
        });

        for (const element of orgsWithBilling) {
          const billing = element.billing as TOrganizationBillingLegacy;
        }
      }
    },
    { timeout: 50000 }
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
