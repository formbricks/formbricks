import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      //   const startTime = Date.now();
      console.log("Starting data migration for pricing v2...");

      // Free tier
      const orgsWithBilling = await tx.organization.findMany({
        where: {
          billing: {
            path: ["stripeCustomerId"],
            equals: Prisma.AnyNull,
          },
        },
      });

      console.log("Found orgs with billing to process. teams: ", orgsWithBilling.length);

      for (const organization of orgsWithBilling) {
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
