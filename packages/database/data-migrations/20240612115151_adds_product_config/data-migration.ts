import { PrismaClient, SurveyType } from "@prisma/client";

const prisma = new PrismaClient();

type channelType = Exclude<SurveyType, "web"> | null;

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Fetch all products
      const products = await tx.product.findMany({
        include: {
          environments: {
            select: {
              surveys: {
                select: {
                  type: true,
                },
              },
            },
          },
        },
      });

      console.log(`Found ${products.length} products to migrate...\n`);

      const channelStatusCounts = {
        [SurveyType.app]: 0,
        [SurveyType.link]: 0,
        [SurveyType.website]: 0,
        null: 0,
      };

      for (const product of products) {
        const surveyTypes = new Set<SurveyType>();

        // Collect all unique survey types for the product
        for (const environment of product.environments) {
          for (const survey of environment.surveys) {
            surveyTypes.add(survey.type);
          }
        }

        let channel: channelType = null;

        if (surveyTypes.size === 0 || surveyTypes.size === 3) {
          channel = null;
        } else if (surveyTypes.size === 1) {
          const type = Array.from(surveyTypes)[0];
          if (type === SurveyType.web) {
            channel = null;
          } else {
            channel = type;
          }
        } else if (surveyTypes.has(SurveyType.link) && surveyTypes.has(SurveyType.app)) {
          channel = SurveyType.app;
        } else if (surveyTypes.has(SurveyType.link) && surveyTypes.has(SurveyType.website)) {
          channel = SurveyType.website;
        }

        channelStatusCounts[channel ?? "null"]++;

        // Update the product with the determined channel and set industry to null
        await tx.product.update({
          where: { id: product.id },
          data: {
            config: {
              channel,
              industry: null,
            },
          },
        });
      }

      console.log(
        `Channel status counts: ${Object.entries(channelStatusCounts).map(
          ([channel, count]) => `\n${channel}: ${count}`
        )}\n`
      );

      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${(endTime - startTime) / 1000}s`);
    },
    {
      timeout: 180000, // 3 minutes
    }
  );
};

main()
  .catch((e: Error) => {
    console.error("Error during migration: ", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
