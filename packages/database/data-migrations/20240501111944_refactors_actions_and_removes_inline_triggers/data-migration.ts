import { init } from "@paralleldrive/cuid2";
import { Prisma, PrismaClient } from "@prisma/client";

const createId = init({ length: 5 });
const prisma = new PrismaClient();

const main = async () => {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // 1. copy value of name to key for all action classes where type is code
      const codeActionClasses = await tx.actionClass.findMany({
        where: {
          type: "code",
        },
      });
      console.log(`Found ${codeActionClasses.length} saved code action classes to update.`);

      await Promise.all(
        codeActionClasses.map((codeActionClass) => {
          return tx.actionClass.update({
            where: {
              id: codeActionClass.id,
            },
            data: {
              key: codeActionClass.name,
            },
          });
        })
      );
      console.log("Updated keys for saved code action classes.");

      // 2. find all surveys with inlineTriggers and create action classes for them
      const surveysWithInlineTriggers = await tx.survey.findMany({
        where: {
          inlineTriggers: {
            not: Prisma.JsonNull,
          },
        },
      });
      console.log(`Found ${surveysWithInlineTriggers.length} surveys with inline triggers to process.`);

      // 3. Create action classes for inlineTriggers and update survey to use the newly created action classes
      const getActionClassIdByCode = async (code: string, environmentId: string): Promise<string> => {
        const existingActionClass = await tx.actionClass.findFirst({
          where: {
            type: "code",
            key: code,
            environmentId: environmentId,
          },
        });

        let codeActionId = "";

        if (existingActionClass) {
          codeActionId = existingActionClass.id;
        } else {
          let codeActionClassName = code;

          // check if there is an existing noCode action class with this name
          const existingNoCodeActionClass = await tx.actionClass.findFirst({
            where: {
              name: code,
              environmentId: environmentId,
              NOT: {
                type: "code",
              },
            },
          });

          if (existingNoCodeActionClass) {
            codeActionClassName = `${code}-${createId()}`;
          }

          // create a new private action for codeConfig
          const codeActionClass = await tx.actionClass.create({
            data: {
              name: codeActionClassName,
              key: code,
              type: "code",
              environment: {
                connect: {
                  id: environmentId,
                },
              },
            },
          });
          codeActionId = codeActionClass.id;
        }

        return codeActionId;
      };

      for (const survey of surveysWithInlineTriggers) {
        const { codeConfig, noCodeConfig } = survey.inlineTriggers ?? {};

        if (
          noCodeConfig &&
          Object.keys(noCodeConfig).length > 0 &&
          (!codeConfig || codeConfig.identifier === "")
        ) {
          // surveys with only noCodeConfig

          // create a new private action for noCodeConfig
          const noCodeActionClass = await tx.actionClass.create({
            data: {
              name: `Custom Action-${createId()}`,
              noCodeConfig,
              type: "noCode",
              environment: {
                connect: {
                  id: survey.environmentId,
                },
              },
            },
          });

          // update survey to use the newly created action class
          await tx.survey.update({
            where: {
              id: survey.id,
            },
            data: {
              triggers: {
                create: {
                  actionClassId: noCodeActionClass.id,
                },
              },
            },
          });
        } else if ((!noCodeConfig || Object.keys(noCodeConfig).length === 0) && codeConfig?.identifier) {
          const codeActionId = await getActionClassIdByCode(codeConfig.identifier, survey.environmentId);

          await tx.survey.update({
            where: {
              id: survey.id,
            },
            data: {
              triggers: {
                create: {
                  actionClassId: codeActionId,
                },
              },
            },
          });
        } else if (codeConfig?.identifier && noCodeConfig) {
          // create a new private action for noCodeConfig

          const noCodeActionClass = await tx.actionClass.create({
            data: {
              name: `Custom Action-${createId()}`,
              noCodeConfig,
              type: "noCode",
              environment: {
                connect: {
                  id: survey.environmentId,
                },
              },
            },
          });

          const codeActionId = await getActionClassIdByCode(codeConfig.identifier, survey.environmentId);

          // update survey to use the newly created action classes
          await tx.survey.update({
            where: {
              id: survey.id,
            },
            data: {
              triggers: {
                createMany: {
                  data: [
                    {
                      actionClassId: noCodeActionClass.id,
                    },
                    {
                      actionClassId: codeActionId,
                    },
                  ],
                },
              },
            },
          });
        }
      }

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
