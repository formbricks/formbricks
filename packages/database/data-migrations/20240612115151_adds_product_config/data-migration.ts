import { PrismaClient, SurveyType } from "@prisma/client";
import { TProductConfigChannel } from "@formbricks/types/product";

const prisma = new PrismaClient();

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

      const updatePromises = products.map((product) => {
        const surveyTypes = new Set<SurveyType>();

        // Collect all unique survey types for the product
        for (const environment of product.environments) {
          for (const survey of environment.surveys) {
            surveyTypes.add(survey.type);
          }
        }

        // Determine the channel based on the survey types, default to null
        let channel: TProductConfigChannel = null;

        if (surveyTypes.size === 0 || surveyTypes.size === 3) {
          // if there are no surveys or all 3 types of surveys (website, app, and link) are present, set channel to null
          channel = null;
        } else if (surveyTypes.size === 1) {
          // if there is only one type of survey, set channel to that type
          const type = Array.from(surveyTypes)[0];
          if (type === SurveyType.web) {
            // if the survey type is web, set channel to null, since web is a legacy type and will be removed
            channel = null;
          } else {
            // if the survey type is not web, set channel to that type
            channel = type;
          }
        } else if (surveyTypes.has(SurveyType.link) && surveyTypes.has(SurveyType.app)) {
          // if both link and app surveys are present, set channel to app
          channel = SurveyType.app;
        } else if (surveyTypes.has(SurveyType.link) && surveyTypes.has(SurveyType.website)) {
          // if both link and website surveys are present, set channel to website
          channel = SurveyType.website;
        }

        // Increment the count for the determined channel
        channelStatusCounts[channel ?? "null"]++;

        // Update the product with the determined channel and set industry to null
        return tx.product.update({
          where: { id: product.id },
          data: {
            config: {
              channel,
              industry: null,
            },
          },
        });
      });

      await Promise.all(updatePromises);

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
