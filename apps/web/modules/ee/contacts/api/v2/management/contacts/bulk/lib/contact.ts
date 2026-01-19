import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { prepareAttributeColumnsForStorage } from "@/modules/ee/contacts/lib/attribute-storage";
import { detectAttributeDataType } from "@/modules/ee/contacts/lib/detect-attribute-type";
import { TContactBulkUploadContact } from "@/modules/ee/contacts/types/contact";

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

  // Type Detection Phase: Analyze attribute values to detect data types
  // For each attribute key, collect all non-empty values and detect type from first value
  const attributeValuesByKey = new Map<string, string[]>();

  contacts.forEach((contact) => {
    contact.attributes.forEach((attr) => {
      if (!attributeValuesByKey.has(attr.attributeKey.key)) {
        attributeValuesByKey.set(attr.attributeKey.key, []);
      }
      if (attr.value.trim() !== "") {
        attributeValuesByKey.get(attr.attributeKey.key)!.push(attr.value);
      }
    });
  });

  // Build a map of attribute keys to their detected/existing data types
  const attributeTypeMap = new Map<string, TContactAttributeDataType>();

  for (const [key, values] of attributeValuesByKey) {
    const existingKey = existingAttributeKeys.find((ak) => ak.key === key);

    if (existingKey) {
      // Use existing dataType for existing keys
      attributeTypeMap.set(key, existingKey.dataType);
    } else {
      // Detect type from first non-empty value for new keys
      const firstValue = values.find((v) => v !== "");
      if (firstValue) {
        const detectedType = detectAttributeDataType(firstValue);
        attributeTypeMap.set(key, detectedType);
      } else {
        attributeTypeMap.set(key, "string"); // default for empty
      }
    }
  }

  // Validate that all values can be converted to their detected/expected type
  // If validation fails for any value, we fallback to treating that attribute as string type
  const typeValidationErrors: string[] = [];

  for (const [key, dataType] of attributeTypeMap) {
    const values = attributeValuesByKey.get(key) || [];

    // Skip validation for string type (always valid)
    if (dataType === "string") continue;

    for (const value of values) {
      try {
        // Test if we can convert the value to the expected type
        prepareAttributeColumnsForStorage(value, dataType);
      } catch {
        // If any value fails conversion, downgrade this attribute to string type for compatibility
        attributeTypeMap.set(key, "string");
        typeValidationErrors.push(
          `Attribute "${key}" has mixed or invalid values for type "${dataType}", treating as string type`
        );
        break; // No need to check remaining values for this key
      }
    }
  }

  // Log validation warnings if any
  if (typeValidationErrors.length > 0) {
    logger.warn({ errors: typeValidationErrors }, "Type validation warnings during bulk upload");
  }

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
            if (attributeKeyMap[attr.attributeKey.key]) {
              // Check if the name has changed for existing attribute keys
              const existingKey = existingAttributeKeys.find((ak) => ak.key === attr.attributeKey.key);
              if (existingKey && existingKey.name !== attr.attributeKey.name) {
                attributeKeyNameUpdates.set(attr.attributeKey.key, attr.attributeKey);
              }
            } else {
              missingKeysMap.set(attr.attributeKey.key, attr.attributeKey);
            }
          }
        }

        // Handle both missing keys and name updates in a single batch operation
        const keysToUpsert = new Map<
          string,
          { key: string; name: string; dataType: TContactAttributeDataType }
        >();

        // Collect all keys that need to be created or updated
        for (const [key, value] of missingKeysMap) {
          const dataType = attributeTypeMap.get(key) ?? "string";
          keysToUpsert.set(key, { ...value, dataType });
        }

        for (const [key, value] of attributeKeyNameUpdates) {
          // For name updates, preserve existing dataType
          const existingKey = existingAttributeKeys.find((ak) => ak.key === key);
          const dataType = existingKey?.dataType ?? "string";
          keysToUpsert.set(key, { ...value, dataType });
        }

        if (keysToUpsert.size > 0) {
          const keysArray = Array.from(keysToUpsert.values());
          const BATCH_SIZE = 10000;

          for (let i = 0; i < keysArray.length; i += BATCH_SIZE) {
            const batch = keysArray.slice(i, i + BATCH_SIZE);

            // Use raw query to perform upsert
            const upsertedKeys = await tx.$queryRaw<{ id: string; key: string }[]>`
            INSERT INTO "ContactAttributeKey" ("id", "key", "name", "environmentId", "dataType", "created_at", "updated_at")
            SELECT 
              unnest(${Prisma.sql`ARRAY[${batch.map(() => createId())}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((k) => k.key)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((k) => k.name)}]`}),
              ${environmentId},
              unnest(${Prisma.sql`ARRAY[${batch.map((k) => k.dataType)}]`}::text[]::"ContactAttributeDataType"[]),
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
          contact.attributes.map((attr) => {
            const dataType = attributeTypeMap.get(attr.attributeKey.key) ?? "string";
            const columns = prepareAttributeColumnsForStorage(attr.value, dataType);

            return {
              id: createId(),
              contactId: newContacts[idx].id,
              attributeKeyId: attributeKeyMap[attr.attributeKey.key],
              value: columns.value,
              valueNumber: columns.valueNumber,
              valueDate: columns.valueDate,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          })
        );

        const attributesUpsertForExistingUsers = contactsToUpdate.flatMap((contact) =>
          contact.attributes.map((attr) => {
            const dataType = attributeTypeMap.get(attr.attributeKey.key) ?? "string";
            const columns = prepareAttributeColumnsForStorage(attr.value, dataType);

            return {
              id: attr.id,
              contactId: contact.contactId,
              attributeKeyId: attributeKeyMap[attr.attributeKey.key],
              value: columns.value,
              valueNumber: columns.valueNumber,
              valueDate: columns.valueDate,
              createdAt: attr.createdAt,
              updatedAt: new Date(),
            };
          })
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
              "id", "created_at", "updated_at", "contactId", "value", "valueNumber", "valueDate", "attributeKeyId"
            )
            SELECT 
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.id)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.createdAt)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.updatedAt)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.contactId)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.value)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.valueNumber)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.valueDate)}]`}),
              unnest(${Prisma.sql`ARRAY[${batch.map((a) => a.attributeKeyId)}]`})
            ON CONFLICT ("contactId", "attributeKeyId") DO UPDATE SET
              "value" = EXCLUDED."value",
              "valueNumber" = EXCLUDED."valueNumber",
              "valueDate" = EXCLUDED."valueDate",
              "updated_at" = EXCLUDED."updated_at"
          `;
          }
        }
      },
      {
        timeout: 10 * 1000, // 10 seconds
      }
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
