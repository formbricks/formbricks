/* eslint-disable no-console -- logging is allowed in migration scripts */
// import { PrismaClient } from "@prisma/client";
// const prisma = new PrismaClient();
// async function runMigration(): Promise<void> {
//   await prisma.$transaction(
//     async (tx) => {
//       const startTime = Date.now();
//       console.log("Starting data migration...");
//       // Fetch all displays
//       const displays = await tx.display.findMany({
//         where: {
//           responseId: {
//             not: null,
//           },
//         },
//         select: {
//           id: true,
//           responseId: true,
//           // response: {
//           //   select: { id: true },
//           // },
//         },
//       });
//       if (displays.length === 0) {
//         // Stop the migration if there are no Displays
//         console.log("No Displays found");
//         return;
//       }
//       console.log(`Total displays with responseId: ${displays.length.toString()}`);
//       let totalResponseTransformed = 0;
//       let totalDisplaysDeleted = 0;
//       await Promise.all(
//         displays.map(async (display) => {
//           if (!display.responseId) {
//             return Promise.resolve();
//           }
//           const response = await tx.response.findUnique({
//             where: { id: display.responseId },
//             select: { id: true },
//           });
//           if (response) {
//             totalResponseTransformed++;
//             return Promise.all([
//               tx.response.update({
//                 where: { id: response.id },
//                 data: { display: { connect: { id: display.id } } },
//               }),
//               tx.display.update({
//                 where: { id: display.id },
//                 data: { responseId: null },
//               }),
//             ]);
//           }
//           totalDisplaysDeleted++;
//           return tx.display.delete({
//             where: { id: display.id },
//           });
//         })
//       );
//       console.log(`${totalResponseTransformed.toString()} responses transformed`);
//       console.log(`${totalDisplaysDeleted.toString()} displays deleted`);
//       const endTime = Date.now();
//       console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toString()}s`);
//     },
//     {
//       timeout: 300000, // 5 minutes
//     }
//   );
// }
// function handleError(error: unknown): void {
//   console.error("An error occurred during migration:", error);
//   process.exit(1);
// }
// function handleDisconnectError(): void {
//   console.error("Failed to disconnect Prisma client");
//   process.exit(1);
// }
// function main(): void {
//   runMigration()
//     .catch(handleError)
//     .finally(() => {
//       prisma.$disconnect().catch(handleDisconnectError);
//     });
// }
// main();
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 1000; // Adjust the batch size as needed

async function runMigration(): Promise<void> {
  let totalResponseTransformed = 0;
  let totalDisplaysDeleted = 0;
  let skip = 0;

  const startTime = Date.now();
  console.log("Starting data migration...");

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition -- We need a while loop
  while (true) {
    // Fetch displays in batches
    const displays = await prisma.display.findMany({
      where: {
        responseId: {
          not: null,
        },
      },
      select: {
        id: true,
        responseId: true,
      },
      skip,
      take: BATCH_SIZE, // Fetch in batches
    });

    if (displays.length === 0) {
      console.log("No more displays found");
      break;
    }

    console.log(`Processing batch of ${displays.length.toString()} displays...`);

    // Declare local counters for the batch
    let batchResponseTransformed = 0;
    const displayIdsToDelete: string[] = [];

    // Use Promise.all to parallelize updates within each batch
    await Promise.all(
      displays.map(async (display) => {
        if (!display.responseId) {
          return;
        }

        const response = await prisma.response.findUnique({
          where: { id: display.responseId },
          select: { id: true },
        });

        if (response) {
          batchResponseTransformed++;
          await Promise.all([
            prisma.response.update({
              where: { id: response.id },
              data: { display: { connect: { id: display.id } } },
            }),
            prisma.display.update({
              where: { id: display.id },
              data: { responseId: null },
            }),
          ]);
        } else {
          // Collect display ids to be deleted later in one `deleteMany` call
          displayIdsToDelete.push(display.id);
        }
      })
    );

    // If there are displays to delete, do it in one go with `deleteMany`
    if (displayIdsToDelete.length > 0) {
      await prisma.display.deleteMany({
        where: {
          id: {
            in: displayIdsToDelete,
          },
        },
      });
      totalDisplaysDeleted += displayIdsToDelete.length;
    }

    // After each batch, aggregate the local batch counts to the total counts
    totalResponseTransformed += batchResponseTransformed;

    console.log(
      `Batch processed: ${batchResponseTransformed.toString()} responses transformed, ${displayIdsToDelete.length.toString()} displays deleted`
    );

    // Move to the next batch
    skip += BATCH_SIZE;
  }

  console.log(`${totalResponseTransformed.toString()} total responses transformed`);
  console.log(`${totalDisplaysDeleted.toString()} total displays deleted`);

  const endTime = Date.now();
  console.log(`Data migration completed. Total time: ${((endTime - startTime) / 1000).toString()}s`);
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
