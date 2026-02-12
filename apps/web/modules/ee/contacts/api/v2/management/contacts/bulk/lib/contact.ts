import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { prepareAttributeColumnsForStorage } from "@/modules/ee/contacts/lib/attribute-storage";
import { detectAttributeDataType } from "@/modules/ee/contacts/lib/detect-attribute-type";
import { TContactBulkUploadContact } from "@/modules/ee/contacts/types/contact";

const EMAIL_ATTRIBUTE_KEY = "email";

type TExistingContact = {
  contactId: string;
  attributes: { id: string; attributeKey: { key: string }; createdAt: Date; value: string }[];
};

type TContactToUpdate = {
  contactId: string;
  attributes: {
    id: string;
    createdAt: Date;
    value: string;
    attributeKey: { key: string };
  }[];
};

type TContactToCreate = {
  attributes: {
    value: string;
    attributeKey: { key: string };
  }[];
};

/**
 * Extracts user IDs and unique attribute keys from contacts
 */
const extractContactMetadata = (
  contacts: TContactBulkUploadContact[]
): {
  userIdsInContacts: string[];
  attributeKeys: string[];
} => {
  const userIdsInContacts: string[] = [];
  const attributeKeysSet = new Set<string>();
  const attributeKeys: string[] = [];

  for (const contact of contacts) {
    for (const attr of contact.attributes) {
      if (attr.attributeKey.key === "userId") {
        userIdsInContacts.push(attr.value);
      }

      if (!attributeKeysSet.has(attr.attributeKey.key)) {
        attributeKeys.push(attr.attributeKey.key);
        attributeKeysSet.add(attr.attributeKey.key);
      }
    }
  }

  return { userIdsInContacts, attributeKeys };
};

/**
 * Builds a map of attribute keys to their values for type detection
 */
const buildAttributeValuesByKey = (contacts: TContactBulkUploadContact[]): Map<string, string[]> => {
  const attributeValuesByKey = new Map<string, string[]>();

  for (const contact of contacts) {
    for (const attr of contact.attributes) {
      if (!attributeValuesByKey.has(attr.attributeKey.key)) {
        attributeValuesByKey.set(attr.attributeKey.key, []);
      }
      if (attr.value.trim() !== "") {
        attributeValuesByKey.get(attr.attributeKey.key)!.push(attr.value);
      }
    }
  }

  return attributeValuesByKey;
};

/**
 * Determines data types for attribute keys based on existing keys and detected types
 */
const determineAttributeTypes = (
  attributeValuesByKey: Map<string, string[]>,
  existingAttributeKeys: { key: string; dataType: TContactAttributeDataType }[]
): Map<string, TContactAttributeDataType> => {
  const attributeTypeMap = new Map<string, TContactAttributeDataType>();

  for (const [key, values] of attributeValuesByKey) {
    const existingKey = existingAttributeKeys.find((ak) => ak.key === key);

    if (existingKey) {
      attributeTypeMap.set(key, existingKey.dataType);
    } else {
      const firstValue = values.find((v) => v !== "");
      const detectedType = firstValue ? detectAttributeDataType(firstValue) : "string";
      attributeTypeMap.set(key, detectedType);
    }
  }

  return attributeTypeMap;
};

/**
 * Validates attribute values against their expected types.
 * For NEW keys (not yet in DB): downgrades to string if values are mixed/invalid.
 * For EXISTING keys: returns errors for invalid values (the type is already set in the DB and must be respected).
 */
const validateAndAdjustAttributeTypes = (
  attributeTypeMap: Map<string, TContactAttributeDataType>,
  attributeValuesByKey: Map<string, string[]>,
  existingAttributeKeys: { key: string; dataType: TContactAttributeDataType }[]
): { existingKeyErrors: string[] } => {
  const existingKeySet = new Set(existingAttributeKeys.map((ak) => ak.key));
  const newKeyWarnings: string[] = [];
  const existingKeyErrors: string[] = [];

  for (const [key, dataType] of attributeTypeMap) {
    if (dataType === "string") continue;

    const values = attributeValuesByKey.get(key) || [];
    const invalidValues: string[] = [];

    for (const value of values) {
      const columns = prepareAttributeColumnsForStorage(value, dataType);
      const parseFailed =
        (dataType === "number" && columns.valueNumber === null) ||
        (dataType === "date" && columns.valueDate === null);

      if (parseFailed) {
        invalidValues.push(value);
      }
    }

    if (invalidValues.length === 0) continue;

    if (existingKeySet.has(key)) {
      // Existing key with a set type - invalid values must be rejected
      const sampleInvalid = invalidValues.slice(0, 3).join(", ");
      const additionalCount = invalidValues.length - 3;
      const suffix = additionalCount > 0 ? ` (and ${additionalCount.toString()} more)` : "";
      existingKeyErrors.push(
        `Attribute "${key}" is typed as "${dataType}" but received invalid values: ${sampleInvalid}${suffix}`
      );
    } else {
      // New key - safe to downgrade to string
      attributeTypeMap.set(key, "string");
      newKeyWarnings.push(
        `New attribute "${key}" has mixed or invalid values for type "${dataType}", treating as string type`
      );
    }
  }

  if (newKeyWarnings.length > 0) {
    logger.warn({ errors: newKeyWarnings }, "Type validation warnings during bulk upload");
  }

  return { existingKeyErrors };
};

/**
 * Builds a map from email to contact data for existing contacts
 */
const buildExistingContactMap = (
  existingContactsByEmail: {
    id: string;
    attributes: { id: string; attributeKey: { key: string }; createdAt: Date; value: string }[];
  }[]
): Map<string, TExistingContact> => {
  const contactMap = new Map<string, TExistingContact>();

  for (const contact of existingContactsByEmail) {
    const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === EMAIL_ATTRIBUTE_KEY);

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
  }

  return contactMap;
};

/**
 * Processes a contact that exists in the database to determine if it needs updating
 */
const processExistingContact = (
  contact: TContactBulkUploadContact,
  existingContact: TExistingContact,
  existingUserIds: { value: string }[],
  idx: number,
  contactIdxWithConflictingUserIds: number[],
  contactsToUpdate: TContactToUpdate[],
  filteredContacts: TContactBulkUploadContact[]
): void => {
  const existingAttributesByKey = new Map(
    existingContact.attributes.map((attr) => [attr.attributeKey.key, attr.value])
  );

  const attributesToUpdate = contact.attributes.filter(
    (attr) => existingAttributesByKey.get(attr.attributeKey.key) !== attr.value
  );

  if (attributesToUpdate.length === 0) {
    filteredContacts.push(contact);
    return;
  }

  const userIdAttr = attributesToUpdate.find((attr) => attr.attributeKey.key === "userId");
  if (userIdAttr && existingUserIds.some((u) => u.value === userIdAttr.value)) {
    contactIdxWithConflictingUserIds.push(idx);
    return;
  }

  filteredContacts.push(contact);
  contactsToUpdate.push({
    contactId: existingContact.contactId,
    attributes: attributesToUpdate.map((attr) => {
      const existingAttr = existingContact.attributes.find(
        (a) => a.attributeKey.key === attr.attributeKey.key
      );

      return existingAttr
        ? {
            id: existingAttr.id,
            createdAt: existingAttr.createdAt,
            value: attr.value,
            attributeKey: attr.attributeKey,
          }
        : { id: createId(), createdAt: new Date(), value: attr.value, attributeKey: attr.attributeKey };
    }),
  });
};

/**
 * Processes a new contact to determine if it can be created
 */
const processNewContact = (
  contact: TContactBulkUploadContact,
  existingUserIds: { value: string }[],
  idx: number,
  contactIdxWithConflictingUserIds: number[],
  contactsToCreate: TContactToCreate[],
  filteredContacts: TContactBulkUploadContact[]
): void => {
  const userIdAttr = contact.attributes.find((attr) => attr.attributeKey.key === "userId");

  if (userIdAttr && existingUserIds.some((u) => u.value === userIdAttr.value)) {
    contactIdxWithConflictingUserIds.push(idx);
    return;
  }

  filteredContacts.push(contact);
  contactsToCreate.push(contact);
};

/**
 * Collects missing attribute keys and keys needing name updates
 */
const collectAttributeKeyChanges = (
  filteredContacts: TContactBulkUploadContact[],
  attributeKeyMap: Record<string, string>,
  existingAttributeKeys: { key: string; name: string | null; dataType: TContactAttributeDataType }[]
): {
  missingKeysMap: Map<string, { key: string; name: string }>;
  attributeKeyNameUpdates: Map<string, { key: string; name: string }>;
} => {
  const missingKeysMap = new Map<string, { key: string; name: string }>();
  const attributeKeyNameUpdates = new Map<string, { key: string; name: string }>();

  for (const contact of filteredContacts) {
    for (const attr of contact.attributes) {
      if (attributeKeyMap[attr.attributeKey.key]) {
        const existingKey = existingAttributeKeys.find((ak) => ak.key === attr.attributeKey.key);
        if (existingKey && existingKey.name !== attr.attributeKey.name) {
          attributeKeyNameUpdates.set(attr.attributeKey.key, attr.attributeKey);
        }
      } else {
        missingKeysMap.set(attr.attributeKey.key, attr.attributeKey);
      }
    }
  }

  return { missingKeysMap, attributeKeyNameUpdates };
};

/**
 * Builds the map of keys to upsert with their data types
 */
const buildKeysToUpsert = (
  missingKeysMap: Map<string, { key: string; name: string }>,
  attributeKeyNameUpdates: Map<string, { key: string; name: string }>,
  attributeTypeMap: Map<string, TContactAttributeDataType>,
  existingAttributeKeys: { key: string; dataType: TContactAttributeDataType }[]
): Map<string, { key: string; name: string; dataType: TContactAttributeDataType }> => {
  const keysToUpsert = new Map<string, { key: string; name: string; dataType: TContactAttributeDataType }>();

  for (const [key, value] of missingKeysMap) {
    const dataType = attributeTypeMap.get(key) ?? "string";
    keysToUpsert.set(key, { key: value.key, name: value.name, dataType });
  }

  for (const [key, value] of attributeKeyNameUpdates) {
    const existingKey = existingAttributeKeys.find((ak) => ak.key === key);
    const dataType = existingKey?.dataType ?? "string";
    keysToUpsert.set(key, { key: value.key, name: value.name, dataType });
  }

  return keysToUpsert;
};

type TAttributeUpsertData = {
  id: string;
  contactId: string;
  attributeKeyId: string;
  value: string;
  valueNumber: number | null;
  valueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Prepares attribute data for new contacts
 */
const prepareAttributesForNewContacts = (
  contactsToCreate: TContactToCreate[],
  newContacts: { id: string; environmentId: string }[],
  attributeKeyMap: Record<string, string>,
  attributeTypeMap: Map<string, TContactAttributeDataType>
): TAttributeUpsertData[] => {
  return contactsToCreate.flatMap((contact, idx) =>
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
};

/**
 * Prepares attribute data for existing contacts
 */
const prepareAttributesForExistingContacts = (
  contactsToUpdate: TContactToUpdate[],
  attributeKeyMap: Record<string, string>,
  attributeTypeMap: Map<string, TContactAttributeDataType>
): TAttributeUpsertData[] => {
  return contactsToUpdate.flatMap((contact) =>
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
};

const BATCH_SIZE = 10000;

/**
 * Upserts attribute keys in batches using raw SQL
 */
const upsertAttributeKeysInBatches = async (
  tx: Prisma.TransactionClient,
  keysToUpsert: Map<string, { key: string; name: string; dataType: TContactAttributeDataType }>,
  environmentId: string,
  attributeKeyMap: Record<string, string>
): Promise<void> => {
  const keysArray = Array.from(keysToUpsert.values());

  for (let i = 0; i < keysArray.length; i += BATCH_SIZE) {
    const batch = keysArray.slice(i, i + BATCH_SIZE);

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

    for (const key of upsertedKeys) {
      attributeKeyMap[key.key] = key.id;
    }
  }
};

/**
 * Upserts contact attributes in batches using raw SQL
 */
const upsertAttributesInBatches = async (
  tx: Prisma.TransactionClient,
  attributesToUpsert: TAttributeUpsertData[]
): Promise<void> => {
  for (let i = 0; i < attributesToUpsert.length; i += BATCH_SIZE) {
    const batch = attributesToUpsert.slice(i, i + BATCH_SIZE);

    const ids = batch.map((a) => a.id);
    const createdAts = batch.map((a) => a.createdAt.toISOString());
    const updatedAts = batch.map((a) => a.updatedAt.toISOString());
    const contactIds = batch.map((a) => a.contactId);
    const values = batch.map((a) => a.value);
    const valueNumbers = batch.map((a) => (a.valueNumber === null ? null : String(a.valueNumber)));
    const valueDates = batch.map((a) => (a.valueDate ? a.valueDate.toISOString() : null));
    const attributeKeyIds = batch.map((a) => a.attributeKeyId);

    await tx.$executeRaw`
      INSERT INTO "ContactAttribute" (
        "id", "created_at", "updated_at", "contactId", "value", "valueNumber", "valueDate", "attributeKeyId"
      )
      SELECT 
        unnest(${ids}::text[]),
        unnest(${createdAts}::text[])::timestamp,
        unnest(${updatedAts}::text[])::timestamp,
        unnest(${contactIds}::text[]),
        unnest(${values}::text[]),
        unnest(${valueNumbers}::text[])::double precision,
        unnest(${valueDates}::text[])::timestamp,
        unnest(${attributeKeyIds}::text[])
      ON CONFLICT ("contactId", "attributeKeyId") DO UPDATE SET
        "value" = EXCLUDED."value",
        "valueNumber" = EXCLUDED."valueNumber",
        "valueDate" = EXCLUDED."valueDate",
        "updated_at" = EXCLUDED."updated_at"
    `;
  }
};

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
  const contactIdxWithConflictingUserIds: number[] = [];
  const { userIdsInContacts, attributeKeys } = extractContactMetadata(contacts);

  const [existingUserIds, existingContactsByEmail, existingAttributeKeys] = await Promise.all([
    prisma.contactAttribute.findMany({
      where: {
        attributeKey: { environmentId, key: "userId" },
        value: { in: userIdsInContacts },
      },
      select: { value: true },
    }),

    prisma.contact.findMany({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeKey: { key: EMAIL_ATTRIBUTE_KEY },
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
      where: { key: { in: attributeKeys }, environmentId },
    }),
  ]);

  // Validate new attribute keys are safe identifiers before proceeding
  const existingKeySet = new Set(existingAttributeKeys.map((ak) => ak.key));
  const invalidNewKeys = attributeKeys.filter((key) => !existingKeySet.has(key) && !isSafeIdentifier(key));

  if (invalidNewKeys.length > 0) {
    return err({
      type: "bad_request",
      details: [
        {
          field: "attributes",
          issue: `Invalid attribute key(s): ${invalidNewKeys.join(", ")}. Keys must only contain lowercase letters, numbers, and underscores, and must start with a letter.`,
        },
      ],
    });
  }

  // Type Detection Phase
  const attributeValuesByKey = buildAttributeValuesByKey(contacts);
  const attributeTypeMap = determineAttributeTypes(attributeValuesByKey, existingAttributeKeys);
  const { existingKeyErrors } = validateAndAdjustAttributeTypes(
    attributeTypeMap,
    attributeValuesByKey,
    existingAttributeKeys
  );

  if (existingKeyErrors.length > 0) {
    return err({
      type: "bad_request",
      details: existingKeyErrors.map((issue) => ({
        field: "attributes",
        issue,
      })),
    });
  }

  // Build contact lookup map
  const contactMap = buildExistingContactMap(existingContactsByEmail);

  // Split contacts into ones to update and ones to create
  const contactsToUpdate: TContactToUpdate[] = [];
  const contactsToCreate: TContactToCreate[] = [];
  const filteredContacts: TContactBulkUploadContact[] = [];

  contacts.forEach((contact, idx) => {
    const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === EMAIL_ATTRIBUTE_KEY);
    const existingContact = emailAttr ? contactMap.get(emailAttr.value) : undefined;

    if (existingContact) {
      processExistingContact(
        contact,
        existingContact,
        existingUserIds,
        idx,
        contactIdxWithConflictingUserIds,
        contactsToUpdate,
        filteredContacts
      );
    } else {
      processNewContact(
        contact,
        existingUserIds,
        idx,
        contactIdxWithConflictingUserIds,
        contactsToCreate,
        filteredContacts
      );
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

        // Collect missing keys and name updates
        const { missingKeysMap, attributeKeyNameUpdates } = collectAttributeKeyChanges(
          filteredContacts,
          attributeKeyMap,
          existingAttributeKeys
        );

        // Build keys to upsert
        const keysToUpsert = buildKeysToUpsert(
          missingKeysMap,
          attributeKeyNameUpdates,
          attributeTypeMap,
          existingAttributeKeys
        );

        // Upsert attribute keys in batches
        if (keysToUpsert.size > 0) {
          await upsertAttributeKeysInBatches(tx, keysToUpsert, environmentId, attributeKeyMap);
        }

        // Create new contacts
        const newContacts = contactsToCreate.map(() => ({ id: createId(), environmentId }));

        if (newContacts.length > 0) {
          await tx.contact.createMany({ data: newContacts });
        }

        // Prepare attributes for both new and existing contacts
        const attributesForNewContacts = prepareAttributesForNewContacts(
          contactsToCreate,
          newContacts,
          attributeKeyMap,
          attributeTypeMap
        );

        const attributesForExistingContacts = prepareAttributesForExistingContacts(
          contactsToUpdate,
          attributeKeyMap,
          attributeTypeMap
        );

        const attributesToUpsert = [...attributesForNewContacts, ...attributesForExistingContacts];

        // Upsert attributes in batches
        if (attributesToUpsert.length > 0) {
          await upsertAttributesInBatches(tx, attributesToUpsert);
        }
      },
      { timeout: 10 * 1000 }
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
