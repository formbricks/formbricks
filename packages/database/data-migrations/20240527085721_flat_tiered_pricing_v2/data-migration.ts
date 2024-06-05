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

      //   const surveysWithProductOverwrites = await tx.survey.findMany({
      //     where: {
      //       productOverwrites: {
      //         not: Prisma.JsonNull,
      //       },
      //     },
      //   });

      //   console.log(`Found ${surveysWithProductOverwrites.length} surveys with product overwrites to process.`);

      //   for (const survey of surveysWithProductOverwrites) {
      //     if (survey.productOverwrites) {
      //       const { brandColor, highlightBorderColor, ...rest } = survey.productOverwrites;

      //       if (!brandColor && !highlightBorderColor) {
      //         continue;
      //       }

      //       await tx.survey.update({
      //         where: {
      //           id: survey.id,
      //         },
      //         data: {
      //           styling: {
      //             ...(survey.styling ?? {}),
      //             ...(brandColor && { brandColor: { light: brandColor } }),
      //             ...(highlightBorderColor && { highlightBorderColor: { light: highlightBorderColor } }),
      //             ...((brandColor || highlightBorderColor || Object.keys(survey.styling ?? {}).length > 0) && {
      //               overwriteThemeStyling: true,
      //             }),
      //           },
      //           productOverwrites: {
      //             ...rest,
      //           },
      //         },
      //       });
      //     }
      //   }

      //   const endTime = Date.now();
      //   console.log(`Data migration for styling fixes completed in ${(endTime - startTime) / 1000} seconds.`);
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
