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

        for (const org of orgsWithBilling) {
          const billing = org.billing as TOrganizationBillingLegacy;

          if (
            billing.features.linkSurvey.unlimited ||
            billing.features.inAppSurvey.unlimited ||
            billing.features.userTargeting.unlimited ||
            billing.features.multiLanguage.unlimited
          ) {
            await tx.organization.update({
              where: {
                id: org.id,
              },
              data: {
                billing: {
                  plan: "enterprise",
                  limits: {
                    monthly: {
                      responses: null,
                      miu: null,
                    },
                  },
                },
              },
            });

            console.log("Updated org to enterprise plan", org.id);
            continue;
          }

          if (
            billing.features.inAppSurvey.status === "active" ||
            billing.features.userTargeting.status === "active" ||
            billing.features.multiLanguage.status === "active"
          ) {
            await tx.organization.update({
              where: {
                id: org.id,
              },
              data: {
                billing: {
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

            console.log("Updated org to free plan", org.id);
            continue;
          }

          if (billing.features.linkSurvey.status === "active") {
            await tx.organization.update({
              where: {
                id: org.id,
              },
              data: {
                billing: {
                  plan: "startup",
                  limits: {
                    monthly: {
                      responses: 2000,
                      miu: 2500,
                    },
                  },
                },
              },
            });

            console.log("Updated org to startup plan", org.id);
            continue;
          }
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
