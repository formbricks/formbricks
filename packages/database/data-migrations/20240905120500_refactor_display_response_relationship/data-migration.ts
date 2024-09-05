/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting data migration...");

      // Fetch all displays
      const displays = await tx.display.findMany({
        where: {
          responseId: {
            not: null,
          },
        },
        select: {
          id: true,
          responseId: true,
        },
      });

      if (displays.length === 0) {
        // Stop the migration if there are no Displays
        console.log("No Displays found");
        return;
      }

      console.log(`Total displays with responseId: ${displays.length.toString()}`);

      let totalResponseTransformed = 0;
      let totalDisplaysDeleted = 0;

      await Promise.all(
        displays.map(async (display) => {
          if (!display.responseId) return;

          const response = await tx.response.findUnique({
            where: { id: display.responseId },
            select: { id: true },
          });

          if (response) {
            totalResponseTransformed++;
            await tx.response.update({
              where: { id: response.id },
              data: { display: { connect: { id: display.id } } },
            });

            await tx.display.update({
              where: { id: display.id },
              data: { responseId: null },
            });
            return;
          }
          totalDisplaysDeleted++;
          await tx.display.delete({
            where: { id: display.id },
          });
        })
      );

      console.log(`${totalResponseTransformed.toString()} responses transformed`);
      console.log(`${totalDisplaysDeleted.toString()} displays deleted`);
      const endTime = Date.now();
      console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toString()}s`);
    },
    {
      timeout: 180000, // 3 minutes
    }
  );
}

function handleError(error: unknown): void {
  console.error("An error occurred during migration:", error);
  process.exit(1);
}

function handleDisconnectError(): void {
  console.error("Failed to disconnect Prisma client");
  process.exit(1);
}

function main(): void {
  runMigration()
    .catch(handleError)
    .finally(() => {
      prisma.$disconnect().catch(handleDisconnectError);
    });
}

main();
