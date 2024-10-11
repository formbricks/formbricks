import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Retrieve all environments with widget setup completed
      const environmentsWithWidgetSetupCompleted = await tx.environment.findMany({
        where: {
          widgetSetupCompleted: true,
        },
        select: {
          id: true,
        },
      });

      console.log(
        `Found ${environmentsWithWidgetSetupCompleted.length} environments with widget setup completed.`
      );

      if (environmentsWithWidgetSetupCompleted.length > 0) {
        const environmentIds = environmentsWithWidgetSetupCompleted.map((env) => env.id);

        // Fetch survey counts in a single query
        const surveyCounts = await tx.survey.groupBy({
          by: ["environmentId", "type"],
          where: {
            environmentId: {
              in: environmentIds,
            },
            displays: {
              some: {},
            },
            type: {
              in: ["app", "website"],
            },
          },
          _count: {
            _all: true,
          },
        });

        // Create a map of environmentId to survey counts
        const surveyCountMap = surveyCounts.reduce(
          (acc, survey) => {
            if (!acc[survey.environmentId]) {
              acc[survey.environmentId] = { website: 0, app: 0, link: 0, web: 0 };
            }
            acc[survey.environmentId][survey.type] = survey._count._all;
            return acc;
          },
          {} as Record<string, { website: number; app: number; link: number; web: number }>
        );

        // Update the appSetupCompleted and websiteSetupCompleted flags for each environment
        const updatePromises = environmentsWithWidgetSetupCompleted.map((environment) => {
          const counts = surveyCountMap[environment.id] || { website: 0, app: 0 };

          return tx.environment.update({
            where: { id: environment.id },
            data: {
              appSetupCompleted: counts.app > 0,
              websiteSetupCompleted: counts.website > 0,
            },
          });
        });

        await Promise.all(updatePromises);
      }

      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${(endTime - startTime) / 1000}s`);
    },
    {
      timeout: 50000,
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
