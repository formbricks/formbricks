import { createId } from "@paralleldrive/cuid2";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // 1. copy value of name to key for all action classes where type is code
      console.log("Fetching code action classes...");
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
      console.log("Fetching surveys with inline triggers...");
      const surveysWithInlineTriggers = await tx.survey.findMany({
        where: {
          inlineTriggers: {
            not: Prisma.JsonNull,
          },
        },
      });
      console.log(`Found ${surveysWithInlineTriggers.length} surveys to process.`);

      // 3. Create action classes for inlineTriggers and update survey to use the newly created action classes
      const getActionClassIdByCode = async (code: string, environmentId: string): Promise<string> => {
        console.log(`Checking if action class already exists for code: ${code}`);
        const existingActionClass = await tx.actionClass.findFirst({
          where: {
            type: "code",
            key: code,
            environmentId: environmentId,
          },
        });

        let codeActionId = "";

        if (existingActionClass) {
          console.log(`Action class already exists for code: ${code}`);
          codeActionId = existingActionClass.id;
        } else {
          console.log(`Creating new code action class for code: ${code}`);
          let codeActionClassName = code;

          // check if there is an existing noCode action class with this name
          console.log(`Checking if there is an existing noCode action class with name: ${code}`);
          const existingNoCodeActionClass = await tx.actionClass.findFirst({
            where: {
              name: code,
              environmentId: environmentId,
              type: "noCode",
            },
          });

          if (existingNoCodeActionClass) {
            console.log(`Found an existing noCode action class with name = ${code}, adding id to name.`);
            codeActionClassName = `${code}--id--${createId()}`;
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

      let index = 0;
      for (const survey of surveysWithInlineTriggers) {
        const { codeConfig, noCodeConfig } = survey.inlineTriggers ?? {};

        console.log(
          `Processing survey ${index + 1}/${surveysWithInlineTriggers.length} with id: ${survey.id}`
        );

        if (
          noCodeConfig &&
          Object.keys(noCodeConfig).length > 0 &&
          (!codeConfig || codeConfig.identifier === "")
        ) {
          // surveys with only noCodeConfig
          console.log("Survey Config has only noCodeConfig. Creating noCode action class.");

          // create a new private action for noCodeConfig
          const noCodeActionClass = await tx.actionClass.create({
            data: {
              name: `Custom Action--id--${createId()}`,
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
          console.log("Survey Config has only codeConfig. Creating code action class.");
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
          console.log("Survey Config has both codeConfig and noCodeConfig.");
          // create a new private action for noCodeConfig

          console.log("Creating noCode action class.");
          const noCodeActionClass = await tx.actionClass.create({
            data: {
              name: `Custom Action--id--${createId()}`,
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
        index++;
        console.log("Created and linked action class.");
      }

      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${(endTime - startTime) / 1000}s`);
    },
    {
      timeout: 50000,
    }
  );
}

main()
  .catch((e: Error) => {
    console.error("Error during migration: ", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("Disconnected from database.");
  });
