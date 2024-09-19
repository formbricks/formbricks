/* eslint-disable no-console -- logging is allowed in migration scripts */
// RAW QUERY ->
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (transactionPrisma) => {
      // Step 1: Use raw SQL to bulk update responses where responseId is not null in displays
      console.log("Running bulk update for responses with valid responseId...");

      const rawQueryResult = await transactionPrisma.$executeRaw`
        WITH updated_displays AS (
          UPDATE public."Response" r
          SET "displayId" = d.id
          FROM public."Display" d
          WHERE r.id = d."responseId"
          RETURNING d.id
        )
        UPDATE public."Display"
        SET "responseId" = NULL
        WHERE id IN (SELECT id FROM updated_displays);
      `;

      console.log("Bulk update completed!");

      // Step 2: Handle the case where a display has a responseId but the corresponding response does not exist
      console.log("Handling displays where the responseId exists but the response is missing...");

      // Find displays where responseId is not null but the corresponding response does not exist
      const displaysWithMissingResponses = await transactionPrisma.display.findMany({
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

      const responseIds = displaysWithMissingResponses
        .map((display) => display.responseId)
        .filter((id): id is string => id !== null);

      // Check which of the responseIds actually exist in the responses table
      const existingResponses = await transactionPrisma.response.findMany({
        where: {
          id: {
            in: responseIds,
          },
        },
        select: {
          id: true,
        },
      });

      const existingResponseIds = new Set(existingResponses.map((response) => response.id));

      // Find displays where the responseId does not exist in the responses table
      const displayIdsToDelete = displaysWithMissingResponses
        .filter((display) => !existingResponseIds.has(display.responseId as unknown as string))
        .map((display) => display.id);

      if (displayIdsToDelete.length > 0) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- displayIdsToDelete is an array of strings
        console.log(`Deleting ${displayIdsToDelete.length} displays where the response is missing...`);

        await transactionPrisma.display.deleteMany({
          where: {
            id: {
              in: displayIdsToDelete,
            },
          },
        });
      }

      console.log("Displays where the response was missing have been deleted.");
      console.log("Data migration completed.");
      console.log(`Affected rows: ${rawQueryResult + displayIdsToDelete.length}`);
    },
    {
      timeout: TRANSACTION_TIMEOUT,
    }
  );

  const endTime = Date.now();
  console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
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
