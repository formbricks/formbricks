/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */

/* eslint-disable no-console -- logging is allowed in migration scripts */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (tx) => {
      const emailAttributes = await tx.contactAttribute.findMany({
        where: {
          attributeKey: {
            key: "email",
          },
        },
        select: {
          id: true,
          value: true,
          contact: {
            select: {
              id: true,
              environmentId: true,
              createdAt: true,
            },
          },
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc", // Keep oldest attribute
        },
      });

      // 2. Group by environment and email
      const emailsByEnvironment: Record<
        //  environmentId key
        string,
        // email record
        Record<string, { id: string; contactId: string; createdAt: Date }[]>
      > = {};

      // Group attributes by environment and email
      for (const attr of emailAttributes) {
        const { environmentId } = attr.contact;
        const email = attr.value;

        if (!emailsByEnvironment[environmentId]) {
          emailsByEnvironment[environmentId] = {};
        }

        if (!emailsByEnvironment[environmentId][email]) {
          emailsByEnvironment[environmentId][email] = [];
        }

        emailsByEnvironment[environmentId][email].push({
          id: attr.id,
          contactId: attr.contact.id,
          createdAt: attr.createdAt,
        });
      }

      // 3. Identify and delete duplicates
      const deletionSummary: Record<
        string,
        {
          email: string;
          deletedAttributeIds: string[];
          keptAttributeId: string;
        }[]
      > = {};

      for (const [environmentId, emailGroups] of Object.entries(emailsByEnvironment)) {
        deletionSummary[environmentId] = [];

        for (const [email, attributes] of Object.entries(emailGroups)) {
          if (attributes.length > 1) {
            // Sort by createdAt to ensure we keep the oldest
            attributes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

            // Keep the first (oldest) attribute and delete the rest
            const [kept, ...duplicates] = attributes;
            const duplicateIds = duplicates.map((d) => d.id);

            // Delete duplicate attributes
            await tx.contactAttribute.deleteMany({
              where: {
                id: {
                  in: duplicateIds,
                },
              },
            });

            deletionSummary[environmentId].push({
              email,
              deletedAttributeIds: duplicateIds,
              keptAttributeId: kept.id,
            });
          }
        }
      }

      // 4. Return summary of what was cleaned up
      const summary = {
        totalDuplicateAttributesRemoved: Object.values(deletionSummary).reduce(
          (acc, env) => acc + env.reduce((sum, item) => sum + item.deletedAttributeIds.length, 0),
          0
        ),
      };

      console.log("Data migration completed. Summary: ", summary);
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
