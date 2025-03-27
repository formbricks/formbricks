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

  const userIdsInContacts = contacts.flatMap((contact) =>
    contact.attributes.filter((attr) => attr.attributeKey.key === "userId").map((attr) => attr.value)
  );

  const existingUserIds = await prisma.contactAttribute.findMany({
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
  });

  // Find existing contacts by matching email attribute
  const existingContactsByEmail = await prisma.contact.findMany({
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
  });

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

  // Get unique attribute keys from the payload
  const attributeKeys = Array.from(
    new Set(contacts.flatMap((contact) => contact.attributes.map((attr) => attr.attributeKey.key)))
  );

  // Fetch attribute key records for these keys in this environment
  const existingAttributeKeys = await prisma.contactAttributeKey.findMany({
    where: {
      key: { in: attributeKeys },
      environmentId,
    },
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

        // Check if any attributes need updating
        const needsUpdate = contact.attributes.some(
          (attr) => existingAttributesByKey.get(attr.attributeKey.key) !== attr.value
        );

        if (!needsUpdate) {
          // No attributes need to be updated
          return;
        }

        // which attributes need to be updated?
        const attributesToUpdate = contact.attributes.filter(
          (attr) => existingAttributesByKey.get(attr.attributeKey.key) !== attr.value
        );

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

      contactsToCreate.push(contact);
    }
  });

  const filteredContacts = contacts.filter((_, idx) => !contactIdxWithConflictingUserIds.includes(idx));

  try {
    // Execute everything in ONE transaction
    await prisma.$transaction(async (tx) => {
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

      // Create missing attribute keys if needed
      if (missingKeysMap.size > 0) {
        const missingKeysArray = Array.from(missingKeysMap.values());

        // Batch this, not sure if we need to do this.
        // Generally, the number of attribute keys that are missing shouldn't be that high.
        const BATCH_SIZE = 10000;
        for (let i = 0; i < missingKeysArray.length; i += BATCH_SIZE) {
          const batch = missingKeysArray.slice(i, i + BATCH_SIZE);

          const newAttributeKeys = await tx.contactAttributeKey.createManyAndReturn({
            data: batch.map((keyObj) => ({
              key: keyObj.key,
              name: keyObj.name,
              environmentId,
            })),
            select: { key: true, id: true },
            skipDuplicates: true,
          });

          // Refresh the attribute key map for the missing keys
          for (const attrKey of newAttributeKeys) {
            attributeKeyMap[attrKey.key] = attrKey.id;
          }
        }
      }

      // Update names of existing attribute keys if they've changed
      if (attributeKeyNameUpdates.size > 0) {
        const nameUpdatesArray = Array.from(attributeKeyNameUpdates.values());
        const BATCH_SIZE = 10000;

        for (let i = 0; i < nameUpdatesArray.length; i += BATCH_SIZE) {
          const batch = nameUpdatesArray.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map((keyObj) =>
              tx.contactAttributeKey.update({
                where: {
                  key_environmentId: {
                    key: keyObj.key,
                    environmentId,
                  },
                },
                data: { name: keyObj.name },
              })
            )
          );
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
    });

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
