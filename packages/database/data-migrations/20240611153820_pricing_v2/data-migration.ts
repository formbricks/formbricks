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

      console.log(
        `Found ${orgsWithoutBilling.length} organizations without billing information. Moving them to free plan...`
      );

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
      }

      console.log("Moved all organizations without billing to free plan");

      const orgsWithBilling = await tx.organization.findMany({
        where: {
          billing: {
            path: ["stripeCustomerId"],
            not: Prisma.AnyNull,
          },
        },
      });

      console.log(`Found ${orgsWithBilling.length} organizations with billing information`);

      for (const org of orgsWithBilling) {
        const billing = org.billing as TOrganizationBillingLegacy;

        // @ts-expect-error
        if (billing.plan && typeof billing.plan === "string") {
          // no migration needed, already following the latest schema
          continue;
        }

        console.log({ billing });

        if (
          (billing.features.linkSurvey?.status === "active" && billing.features.inAppSurvey?.unlimited) ||
          (billing.features.inAppSurvey?.status === "active" && billing.features.linkSurvey?.unlimited) ||
          (billing.features.userTargeting?.status === "active" && billing.features.userTargeting?.unlimited)
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

          console.log("Updated org with unlimited to enterprise plan: ", org.id);
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

          console.log("Updated org with an active link survey plan to the new startup plan: ", org.id);
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

          console.log("Updated org to free plan: ", org.id);
          continue;
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
