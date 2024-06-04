import { PrismaClient } from "@prisma/client";

import { TActionClassNoCodeConfig } from "@formbricks/types/actionClasses";

const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      const getConfig = (noCodeConfig: any): TActionClassNoCodeConfig => {
        const cssSelector = noCodeConfig?.cssSelector?.value;
        const innerHtml = noCodeConfig?.innerHtml?.value;
        const pageUrl = noCodeConfig?.pageUrl;

        const urlFilters = pageUrl ? [pageUrl] : [];

        if (!cssSelector && !innerHtml && pageUrl) {
          return {
            type: "pageView",
            urlFilters,
          };
        } else {
          return {
            type: "click",
            elementSelector: {
              ...(cssSelector && { cssSelector }),
              ...(innerHtml && { innerHtml }),
            },
            urlFilters,
          };
        }
      };

      // 1.  Updation of all noCode actions to fit in the latest schema
      const noCodeActionClasses = await tx.actionClass.findMany({
        where: {
          type: "noCode",
        },
        select: {
          id: true,
          noCodeConfig: true,
        },
      });

      console.log(`Found ${noCodeActionClasses.length} noCode action classes to update.`);

      await Promise.all(
        noCodeActionClasses.map((noCodeActionClass) => {
          return tx.actionClass.update({
            where: {
              id: noCodeActionClass.id,
            },
            data: {
              noCodeConfig: getConfig(noCodeActionClass.noCodeConfig),
            },
          });
        })
      );

      const targetAutomaticActionNames = ["Exit Intent (Desktop)", "50% Scroll"];

      // 2.  Update "Exit Intent (Desktop)", "50% Scroll" automatic actions classes that have atleast one survey trigger to noCode actions, update them one by one
      const automaticActionClassesToUpdatePromises = targetAutomaticActionNames.map((name, idx) => {
        return tx.actionClass.updateMany({
          where: {
            name,
            type: "automatic",
            surveys: {
              some: {},
            },
          },
          data: {
            type: "noCode",
            noCodeConfig: {
              type: idx === 0 ? "exitIntent" : "fiftyPercentScroll",
              urlFilters: [],
            },
          },
        });
      });

      console.log(`Updating ${targetAutomaticActionNames.length} automatic action classes...`);

      await Promise.all(automaticActionClassesToUpdatePromises);

      // 3.  Delete all automatic code actions(50% scroll and exit intent)
      const automaticActionClassesToDelete = await tx.actionClass.deleteMany({
        where: {
          name: {
            in: targetAutomaticActionNames,
          },
          type: "automatic",
        },
      });

      console.log(
        `Deleted ${automaticActionClassesToDelete.count} unused automatic action classes of 50% scroll and exit intent.`
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
