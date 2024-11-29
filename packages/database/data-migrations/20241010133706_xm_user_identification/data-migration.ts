/* eslint-disable @typescript-eslint/no-non-null-assertion -- Required for userId */

/* eslint-disable no-constant-condition -- Required for the while loop */

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
      const totalContacts = await tx.contact.count();

      // Check if any contacts still have a userId
      const contactsWithUserId = await tx.contact.count({
        where: {
          userId: { not: null },
        },
      });

      // If no contacts have a userId, migration is already complete
      if (totalContacts > 0 && contactsWithUserId === 0) {
        console.log("Migration already completed. No contacts with userId found.");
        return;
      }

      const BATCH_SIZE = 10000; // Adjust based on your system's capacity
      let skip = 0;

      while (true) {
        // Ensure email, firstName, lastName attributeKeys exist for all environments
        const allEnvironmentsInBatch = await tx.environment.findMany({
          select: { id: true },
          skip,
          take: BATCH_SIZE,
        });

        if (allEnvironmentsInBatch.length === 0) {
          break;
        }

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
                      type: "default",
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
                    update: {
                      type: "default",
                    },
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
                    update: {
                      type: "default",
                    },
                    create: {
                      key: "lastName",
                      name: "Last Name",
                      description: "Your contact's last name",
                      type: "default",
                    },
                  },
                  {
                    where: {
                      key_environmentId: {
                        key: "userId",
                        environmentId: env.id,
                      },
                    },
                    update: {
                      type: "default",
                      isUnique: true,
                    },
                    create: {
                      key: "userId",
                      name: "User ID",
                      description: "The user ID of a contact",
                      type: "default",
                      isUnique: true,
                    },
                  },
                ],
              },
            },
          });
        }

        skip += allEnvironmentsInBatch.length;
      }

      const CONTACTS_BATCH_SIZE = 20000;
      let skipContacts = 0;
      let processedContacts = 0;

      // delete userIds for these environments:
      const { count } = await tx.contactAttribute.deleteMany({
        where: {
          attributeKey: {
            key: "userId",
          },
        },
      });

      console.log("Deleted userId attributes for", count, "contacts");

      while (true) {
        const contacts = await tx.contact.findMany({
          skip: skipContacts,
          take: CONTACTS_BATCH_SIZE,
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

        const environmentIdsByContacts = contacts.map((c) => c.environmentId);

        const attributeMap = new Map<string, string>();

        const userIdAttributeKeys = await tx.contactAttributeKey.findMany({
          where: {
            key: "userId",
            environmentId: {
              in: environmentIdsByContacts,
            },
          },
          select: { id: true, environmentId: true },
        });

        userIdAttributeKeys.forEach((ak) => {
          attributeMap.set(ak.environmentId, ak.id);
        });

        // Insert contactAttributes in bulk
        await tx.contactAttribute.createMany({
          data: contacts.map((contact) => ({
            contactId: contact.id,
            value: contact.userId!,
            attributeKeyId: attributeMap.get(contact.environmentId)!,
          })),
        });

        await tx.contact.updateMany({
          where: {
            id: { in: contacts.map((c) => c.id) },
          },
          data: {
            userId: null,
          },
        });

        processedContacts += contacts.length;
        skipContacts += contacts.length;

        if (processedContacts > 0) {
          console.log(`Processed ${processedContacts.toString()} contacts`);
        }
      }

      // total attributes with userId:
      const totalAttributes = await tx.contactAttribute.count({
        where: {
          attributeKey: {
            key: "userId",
          },
        },
      });

      console.log("Total attributes with userId now:", totalAttributes);
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
