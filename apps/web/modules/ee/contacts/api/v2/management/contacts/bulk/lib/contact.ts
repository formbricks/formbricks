import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { TContactBulkUploadContact } from "@/modules/ee/contacts/types/contact";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const upsertBulkContacts = async (
  contacts: TContactBulkUploadContact[],
  environmentId: string,
  parsedEmails: string[]
): Promise<
  Result<
    {
      contactIdxWithConflictingUserIds: number[];
    },
    ApiErrorResponseV2
  >
> => {
  const emailAttributeKey = "email";
  const contactIdxWithConflictingUserIds: number[] = [];

  let userIdsInContacts: string[] = [];
  let attributeKeysSet: Set<string> = new Set();
  let attributeKeys: string[] = [];

  // both can be done with a single loop:
  contacts.forEach((contact) => {
    contact.attributes.forEach((attr) => {
      if (attr.attributeKey.key === "userId") {
        userIdsInContacts.push(attr.value);
      }

      if (!attributeKeysSet.has(attr.attributeKey.key)) {
        attributeKeys.push(attr.attributeKey.key);
      }

      // Add the attribute key to the set
      attributeKeysSet.add(attr.attributeKey.key);
    });
  });

  const [existingUserIds, existingContactsByEmail, existingAttributeKeys] = await Promise.all([
    prisma.contactAttribute.findMany({
      where: {
        attributeKey: {
          environmentId,
          key: "userId",
        },
        value: {
          in: userIdsInContacts,
        },
      },
      select: {
        value: true,
      },
    }),

    prisma.contact.findMany({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeKey: { key: emailAttributeKey },
            value: { in: parsedEmails },
          },
        },
      },
      select: {
        attributes: {
          select: {
            attributeKey: { select: { key: true } },
            createdAt: true,
            id: true,
            value: true,
          },
        },
        id: true,
      },
    }),

    prisma.contactAttributeKey.findMany({
      where: {
        key: { in: attributeKeys },
        environmentId,
      },
    }),
  ]);

  // Build a map from email to contact id (if the email attribute exists)
  const contactMap = new Map<
    string,
    {
      contactId: string;
      attributes: { id: string; attributeKey: { key: string }; createdAt: Date; value: string }[];
    }
  >();

  existingContactsByEmail.forEach((contact) => {
    const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === emailAttributeKey);

    if (emailAttr) {
      contactMap.set(emailAttr.value, {
        contactId: contact.id,
        attributes: contact.attributes.map((attr) => ({
          id: attr.id,
          attributeKey: { key: attr.attributeKey.key },
          createdAt: attr.createdAt,
          value: attr.value,
        })),
      });
    }
  });

  // Split contacts into ones to update and ones to create
  const contactsToUpdate: {
    contactId: string;
    attributes: {
      id: string;
      createdAt: Date;
      value: string;
      attributeKey: {
        key: string;
      };
    }[];
  }[] = [];

  const contactsToCreate: {
    attributes: {
      value: string;
      attributeKey: {
        key: string;
      };
    }[];
  }[] = [];

  let filteredContacts: TContactBulkUploadContact[] = [];

  contacts.forEach((contact, idx) => {
    const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === emailAttributeKey);

    if (emailAttr && contactMap.has(emailAttr.value)) {
      // if all the attributes passed are the same as the existing attributes, skip the update:
      const existingContact = contactMap.get(emailAttr.value);
      if (existingContact) {
        // Create maps of existing attributes by key
        const existingAttributesByKey = new Map(
          existingContact.attributes.map((attr) => [attr.attributeKey.key, attr.value])
        );

        // Determine which attributes need updating by comparing values.
        const attributesToUpdate = contact.attributes.filter(
          (attr) => existingAttributesByKey.get(attr.attributeKey.key) !== attr.value
        );

        // Check if any attributes need updating
        const needsUpdate = attributesToUpdate.length > 0;

        if (!needsUpdate) {
          filteredContacts.push(contact);
          // No attributes need to be updated
          return;
        }

        // if the attributes to update have a userId that exists in the db, we need to skip the update
        const userIdAttr = attributesToUpdate.find((attr) => attr.attributeKey.key === "userId");

        if (userIdAttr) {
          const existingUserId = existingUserIds.find(
            (existingUserId) => existingUserId.value === userIdAttr.value
          );

          if (existingUserId) {
            contactIdxWithConflictingUserIds.push(idx);
            return;
          }
        }

        filteredContacts.push(contact);
        contactsToUpdate.push({
          contactId: existingContact.contactId,
          attributes: attributesToUpdate.map((attr) => {
            const existingAttr = existingContact.attributes.find(
              (a) => a.attributeKey.key === attr.attributeKey.key
            );

            if (!existingAttr) {
              return {
                id: createId(),
                createdAt: new Date(),
                value: attr.value,
                attributeKey: attr.attributeKey,
              };
            }

            return {
              id: existingAttr.id,
              createdAt: existingAttr.createdAt,
              value: attr.value,
              attributeKey: attr.attributeKey,
            };
          }),
        });
      }
    } else {
      // There can't be a case where the emailAttr is not defined since that should be caught by zod.

      // if the contact has a userId that already exists in the db, we need to skip the create
      const userIdAttr = contact.attributes.find((attr) => attr.attributeKey.key === "userId");
      if (userIdAttr) {
        const existingUserId = existingUserIds.find(
          (existingUserId) => existingUserId.value === userIdAttr.value
        );

        if (existingUserId) {
          contactIdxWithConflictingUserIds.push(idx);
          return;
        }
      }

      filteredContacts.push(contact);
      contactsToCreate.push(contact);
    }
  });

  try {
    // Execute everything in ONE transaction
    await prisma.$transaction(
      async (tx) => {
        const attributeKeyMap = existingAttributeKeys.reduce<Record<string, string>>((acc, keyObj) => {
          acc[keyObj.key] = keyObj.id;
          return acc;
        }, {});

        // Check for missing attribute keys and create them if needed.
        const missingKeysMap = new Map<string, { key: string; name: string }>();
        const attributeKeyNameUpdates = new Map<string, { key: string; name: string }>();

        for (const contact of filteredContacts) {
          for (const attr of contact.attributes) {
            if (!attributeKeyMap[attr.attributeKey.key]) {
              missingKeysMap.set(attr.attributeKey.key, attr.attributeKey);
            } else {
              // Check if the name has changed for existing attribute keys
              const existingKey = existingAttributeKeys.find((ak) => ak.key === attr.attributeKey.key);
              if (existingKey && existingKey.name !== attr.attributeKey.name) {
                attributeKeyNameUpdates.set(attr.attributeKey.key, attr.attributeKey);
              }
            }
          }
        }

        // Handle both missing keys and name updates in a single batch operation
        const keysToUpsert = new Map<string, { key: string; name: string }>();

        // Collect all keys that need to be created or updated
        for (const [key, value] of missingKeysMap) {
          keysToUpsert.set(key, value);
        }

        for (const [key, value] of attributeKeyNameUpdates) {
          keysToUpsert.set(key, value);
        }

        if (keysToUpsert.size > 0) {
          const keysArray = Array.from(keysToUpsert.values());
          const BATCH_SIZE = 10000;

          for (let i = 0; i < keysArray.length; i += BATCH_SIZE) {
            const batch = keysArray.slice(i, i + BATCH_SIZE);

            // Use raw query to perform upsert
            const upsertedKeys = await tx.$queryRaw<{ id: string; key: string }[]>`
            INSERT INTO "ContactAttributeKey" ("id", "key", "name", "environmentId", "created_at", "updated_at")
            SELECT 
              unnest(${Prisma.sql`ARRAY[${batch.map(() => createId())}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((k) => k.key)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((k) => k.name)}]`}),
              ${environmentId},
              NOW(),
              NOW()
            ON CONFLICT ("key", "environmentId") 
            DO UPDATE SET 
              "name" = EXCLUDED."name",
              "updated_at" = NOW()
            RETURNING "id", "key"
          `;

            // Update attribute key map with upserted keys
            for (const key of upsertedKeys) {
              attributeKeyMap[key.key] = key.id;
            }
          }
        }

        // Create new contacts -- should be at most 1000, no need to batch
        const newContacts = contactsToCreate.map(() => ({
          id: createId(),
          environmentId,
        }));

        if (newContacts.length > 0) {
          await tx.contact.createMany({
            data: newContacts,
          });
        }

        // Prepare attributes for both new and existing contacts
        const attributesUpsertForCreatedUsers = contactsToCreate.flatMap((contact, idx) =>
          contact.attributes.map((attr) => ({
            id: createId(),
            contactId: newContacts[idx].id,
            attributeKeyId: attributeKeyMap[attr.attributeKey.key],
            value: attr.value,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        );

        const attributesUpsertForExistingUsers = contactsToUpdate.flatMap((contact) =>
          contact.attributes.map((attr) => ({
            id: attr.id,
            contactId: contact.contactId,
            attributeKeyId: attributeKeyMap[attr.attributeKey.key],
            value: attr.value,
            createdAt: attr.createdAt,
            updatedAt: new Date(),
          }))
        );

        const attributesToUpsert = [...attributesUpsertForCreatedUsers, ...attributesUpsertForExistingUsers];

        // Skip the raw query if there are no attributes to upsert
        if (attributesToUpsert.length > 0) {
          // Process attributes in batches of 10,000
          const BATCH_SIZE = 10000;
          for (let i = 0; i < attributesToUpsert.length; i += BATCH_SIZE) {
            const batch = attributesToUpsert.slice(i, i + BATCH_SIZE);

            // Use a raw query to perform a bulk insert with an ON CONFLICT clause
            await tx.$executeRaw`
            INSERT INTO "ContactAttribute" (
              "id", "created_at", "updated_at", "contactId", "value", "attributeKeyId"
            )
            SELECT 
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.id)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.createdAt)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.updatedAt)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.contactId)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.value)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.attributeKeyId)}]`})
            ON CONFLICT ("contactId", "attributeKeyId") DO UPDATE SET
              "value" = EXCLUDED."value",
              "updated_at" = EXCLUDED."updated_at"
          `;
          }
        }

        contactCache.revalidate({
          environmentId,
        });

        // revalidate all the new contacts:
        for (const newContact of newContacts) {
          contactCache.revalidate({
            id: newContact.id,
          });
        }

        // revalidate all the existing contacts:
        for (const existingContact of existingContactsByEmail) {
          contactCache.revalidate({
            id: existingContact.id,
          });
        }

        contactAttributeKeyCache.revalidate({
          environmentId,
        });

        contactAttributeCache.revalidate({ environmentId });
      },
      { timeout: 10 * 1000 } // 10 seconds timeout
    );

    return ok({
      contactIdxWithConflictingUserIds,
    });
  } catch (error) {
    logger.error({ error }, "Failed to upsert contacts");

    return err({
      type: "internal_server_error",
      details: [{ field: "error", issue: "Failed to upsert contacts" }],
    });
  }
};
