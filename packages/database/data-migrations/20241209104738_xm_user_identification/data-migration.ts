/* eslint-disable no-constant-condition -- Required for the while loop */

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Required for a while loop here */
import type { DataMigrationScript } from "../../types/migration-runner";

export const xmUserIdentification: DataMigrationScript = {
  type: "data",
  id: "n2u5d3wmcw1t2h8a4vgfu2y9",
  name: "xmUserIdentification",
  run: async ({ tx }) => {
    // Your migration script goes here
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
        take: CONTACTS_BATCH_SIZE,
        select: {
          id: true,
          userId: true,
          environmentId: true,
        },
        where: {
          userId: { not: null },
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
        data: contacts.map((contact) => {
          if (!contact.userId) {
            throw new Error(`Contact with id ${contact.id} has no userId`);
          }

          const userIdAttributeKey = attributeMap.get(contact.environmentId);

          if (!userIdAttributeKey) {
            throw new Error(`Attribute key for userId not found for environment ${contact.environmentId}`);
          }

          return {
            contactId: contact.id,
            value: contact.userId,
            attributeKeyId: userIdAttributeKey,
          };
        }),
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

      if (processedContacts > 0) {
        console.log(`Processed ${processedContacts.toString()} contacts`);
      }
    }

    const totalContactsAfterMigration = await tx.contact.count();

    console.log("Total contacts after migration:", totalContactsAfterMigration);

    // total attributes with userId:
    const totalAttributes = await tx.contactAttribute.count({
      where: {
        attributeKey: {
          key: "userId",
        },
      },
    });

    console.log("Total attributes with userId now:", totalAttributes);

    if (totalContactsAfterMigration !== totalAttributes) {
      throw new Error(
        "Data migration failed. Total contacts after migration does not match total attributes with userId"
      );
    }
  },
};
