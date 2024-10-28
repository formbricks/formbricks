/* eslint-disable @typescript-eslint/no-non-null-assertion -- Required for userId */

/* eslint-disable no-constant-condition -- Required for the while loop */

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */

/* eslint-disable no-console -- logging is allowed in migration scripts */
import { createId } from "@paralleldrive/cuid2";
import { type ContactAttributeType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TRANSACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

async function runMigration(): Promise<void> {
  const startTime = Date.now();
  console.log("Starting data migration...");

  await prisma.$transaction(
    async (tx) => {
      // 1. Delete existing contactAttributes with attributeKey 'userId'
      const allAttributesWithUserId = await tx.contactAttribute.deleteMany({
        where: {
          attributeKey: { key: "userId" },
        },
      });

      console.log("Deleted:", allAttributesWithUserId.count);

      // 2. Ensure attributeKeys for 'userId' exist for all environments
      // Fetch all unique environmentIds from contacts
      const environmentIds = await tx.contact.findMany({
        select: { environmentId: true },
        distinct: ["environmentId"],
      });

      // Map to store environmentId to attributeKeyId
      const attributeKeyMap = new Map<string, string>();

      // Fetch existing attributeKeys
      const existingUserIdAttributeKeys = await tx.contactAttributeKey.findMany({
        where: {
          key: "userId",
          environmentId: { in: environmentIds.map((e) => e.environmentId) },
        },
        select: { id: true, environmentId: true },
      });

      existingUserIdAttributeKeys.forEach((ak) => {
        attributeKeyMap.set(ak.environmentId, ak.id);
      });

      // Find missing environmentIds
      const missingEnvironmentIds = environmentIds
        .map((e) => e.environmentId)
        .filter((envId) => !attributeKeyMap.has(envId));

      // Create missing attributeKeys
      if (missingEnvironmentIds.length > 0) {
        const newAttributeKeysData = missingEnvironmentIds.map((envId) => ({
          id: createId(),
          key: "userId",
          environmentId: envId,
          // Add other required fields based on your schema
          // For example:
          isUnique: true,
          type: "default" as ContactAttributeType,
        }));

        await tx.contactAttributeKey.createMany({
          data: newAttributeKeysData,
        });

        // Update attributeKeyMap with new keys
        newAttributeKeysData.forEach((ak) => {
          attributeKeyMap.set(ak.environmentId, ak.id);
        });
      }

      // 3. Process contacts in batches
      const BATCH_SIZE = 10000; // Adjust based on your system's capacity
      let skip = 0;
      let processed = 0;

      while (true) {
        // Ensure email, firstName, lastName attributeKeys exist for all environments
        const allEnvironmentsInBatch = await tx.environment.findMany({
          select: { id: true },
          skip,
          take: BATCH_SIZE,
        });
        console.log("Processing attributeKeys for", allEnvironmentsInBatch.length, "environments");

        for (const env of allEnvironmentsInBatch) {
          await tx.environment.update({
            where: { id: env.id },
            data: {
              attributeKeys: {
                upsert: [
                  {
                    where: {
                      key_environmentId: {
                        key: "email",
                        environmentId: env.id,
                      },
                    },
                    update: {
                      isUnique: true,
                    },
                    create: {
                      key: "email",
                      name: "Email",
                      description: "The email of a contact",
                      type: "default",
                      isUnique: true,
                    },
                  },
                  {
                    where: {
                      key_environmentId: {
                        key: "firstName",
                        environmentId: env.id,
                      },
                    },
                    update: {},
                    create: {
                      key: "firstName",
                      name: "First Name",
                      description: "Your contact's first name",
                      type: "default",
                    },
                  },
                  {
                    where: {
                      key_environmentId: {
                        key: "lastName",
                        environmentId: env.id,
                      },
                    },
                    update: {},
                    create: {
                      key: "lastName",
                      name: "Last Name",
                      description: "Your contact's last name",
                      type: "default",
                    },
                  },
                ],
              },
            },
          });
        }

        console.log("Processed attributeKeys for", allEnvironmentsInBatch.length, "environments");

        const contacts = await tx.contact.findMany({
          skip,
          take: BATCH_SIZE,
          select: {
            id: true,
            userId: true,
            environmentId: true,
          },
          where: {
            userId: { not: undefined },
          },
        });

        if (contacts.length === 0) {
          break;
        }

        // Prepare data for contactAttribute.createMany
        const contactAttributesData = contacts.map((contact) => ({
          contactId: contact.id,
          attributeKeyId: attributeKeyMap.get(contact.environmentId)!,
          value: contact.userId!,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        // Insert contactAttributes in bulk
        await tx.contactAttribute.createMany({
          data: contactAttributesData,
        });

        await tx.contact.updateMany({
          where: {
            id: { in: contacts.map((c) => c.id) },
          },
          data: {
            userId: null,
          },
        });

        processed += contacts.length;
        skip += contacts.length;
        console.log(`Processed ${processed.toString()} contacts`);
      }
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
