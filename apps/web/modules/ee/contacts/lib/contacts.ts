import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZOptionalString } from "@formbricks/types/common";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { formatSnakeCaseToTitleCase, isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { validateInputs } from "@/lib/utils/validate";
import { prepareAttributeColumnsForStorage } from "@/modules/ee/contacts/lib/attribute-storage";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { detectAttributeDataType } from "@/modules/ee/contacts/lib/detect-attribute-type";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import {
  TContact,
  TContactWithAttributes,
  ZContactCSVAttributeMap,
  ZContactCSVDuplicateAction,
  ZContactCSVUploadResponse,
} from "../types/contact";
import { transformPrismaContact } from "./utils";

export const getContactsInSegment = reactCache(async (segmentId: string) => {
  try {
    const segment = await getSegment(segmentId);

    if (!segment) {
      return null;
    }

    const segmentFilterToPrismaQueryResult = await segmentFilterToPrismaQuery(
      segment.id,
      segment.filters,
      segment.environmentId
    );

    if (!segmentFilterToPrismaQueryResult.ok) {
      return null;
    }

    const { whereClause } = segmentFilterToPrismaQueryResult.data;

    const requiredAttributes = ["userId", "firstName", "lastName", "email"];

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: requiredAttributes,
              },
            },
          },
          select: {
            attributeKey: {
              select: {
                key: true,
              },
            },
            value: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const contactsWithAttributes = contacts.map((contact) => {
      const attributes = contact.attributes.reduce(
        (acc, attr) => {
          acc[attr.attributeKey.key] = attr.value;
          return acc;
        },
        {} as Record<string, string>
      );
      return {
        contactId: contact.id,
        attributes,
      };
    });

    return contactsWithAttributes;
  } catch (error) {
    logger.error(error, "Failed to get contacts in segment");
    return null;
  }
});

const selectContact = {
  id: true,
  createdAt: true,
  updatedAt: true,
  environmentId: true,
  attributes: {
    select: {
      value: true,
      valueNumber: true,
      valueDate: true,
      attributeKey: {
        select: {
          key: true,
          name: true,
          dataType: true,
        },
      },
    },
  },
} satisfies Prisma.ContactSelect;

export const buildContactWhereClause = (environmentId: string, search?: string): Prisma.ContactWhereInput => {
  const whereClause: Prisma.ContactWhereInput = { environmentId };

  if (search) {
    whereClause.OR = [
      {
        attributes: {
          some: {
            value: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        id: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  return whereClause;
};

export const getContacts = reactCache(
  async (environmentId: string, offset?: number, searchValue?: string): Promise<TContactWithAttributes[]> => {
    validateInputs([environmentId, ZId], [offset, ZOptionalNumber], [searchValue, ZOptionalString]);

    try {
      const contacts = await prisma.contact.findMany({
        where: buildContactWhereClause(environmentId, searchValue),
        select: selectContact,
        take: ITEMS_PER_PAGE,
        skip: offset,
        orderBy: {
          createdAt: "desc",
        },
      });

      return contacts.map((contact) => transformPrismaContact(contact));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getContact = reactCache(async (contactId: string): Promise<TContact | null> => {
  validateInputs([contactId, ZId]);

  try {
    return await prisma.contact.findUnique({
      where: {
        id: contactId,
      },
      select: selectContact,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const deleteContact = async (contactId: string): Promise<TContact | null> => {
  validateInputs([contactId, ZId]);

  try {
    const contact = await prisma.contact.delete({
      where: {
        id: contactId,
      },
      select: selectContact,
    });

    return contact;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

// Shared include clause for contact queries
const contactAttributesInclude = {
  attributes: {
    select: {
      attributeKey: { select: { key: true } },
      value: true,
    },
  },
} satisfies Prisma.ContactInclude;

// Helper to create attribute objects for Prisma create operations with typed columns
const createAttributeConnections = (
  record: Record<string, string>,
  environmentId: string,
  attributeTypeMap: Map<string, TAttributeTypeInfo>
) =>
  Object.entries(record).map(([key, value]) => {
    const dataType = attributeTypeMap.get(key)?.dataType ?? "string";
    const columns = prepareAttributeColumnsForStorage(value, dataType);

    return {
      attributeKey: {
        connect: { key_environmentId: { key, environmentId } },
      },
      value: columns.value,
      valueNumber: columns.valueNumber,
      valueDate: columns.valueDate,
    };
  });

// Helper to handle userId conflicts when updating/overwriting contacts
const resolveUserIdConflict = (
  mappedRecord: Record<string, string>,
  existingContact: { id: string; attributes: { attributeKey: { key: string }; value: string }[] },
  existingUserIds: { value: string; contactId: string }[]
): Record<string, string> => {
  const existingUserId = existingUserIds.find(
    (attr) => attr.value === mappedRecord.userId && attr.contactId !== existingContact.id
  );

  if (!existingUserId) {
    return { ...mappedRecord };
  }

  const { userId: _userId, ...rest } = mappedRecord;
  const existingContactUserId = existingContact.attributes.find(
    (attr) => attr.attributeKey.key === "userId"
  )?.value;

  return {
    ...rest,
    ...(existingContactUserId && { userId: existingContactUserId }),
  };
};

/**
 * Extracts unique emails, userIds, and attribute keys from CSV data
 */
const extractCsvMetadata = (
  csvData: Record<string, string>[]
): {
  csvEmails: string[];
  csvUserIds: string[];
  csvKeys: Set<string>;
  attributeValuesByKey: Map<string, string[]>;
} => {
  const csvEmails = Array.from(new Set(csvData.map((r) => r.email).filter(Boolean)));
  const csvUserIds = Array.from(new Set(csvData.map((r) => r.userId).filter(Boolean)));
  const csvKeys = new Set<string>();
  const attributeValuesByKey = new Map<string, string[]>();

  for (const record of csvData) {
    for (const [key, value] of Object.entries(record)) {
      csvKeys.add(key);

      const existingValues = attributeValuesByKey.get(key) ?? [];
      if (value && value.trim() !== "") {
        existingValues.push(value);
      }
      attributeValuesByKey.set(key, existingValues);
    }
  }

  return { csvEmails, csvUserIds, csvKeys, attributeValuesByKey };
};

/**
 * Builds a map of attribute keys to their detected/existing data types
 */
type TAttributeTypeInfo = {
  dataType: TContactAttributeDataType;
  isExisting: boolean; // true = from DB, false = newly detected
};

const buildAttributeTypeMap = (
  attributeValuesByKey: Map<string, string[]>,
  existingAttributeKeys: { key: string; dataType: TContactAttributeDataType }[],
  lowercaseToActualKeyMap: Map<string, string>
): Map<string, TAttributeTypeInfo> => {
  const attributeTypeMap = new Map<string, TAttributeTypeInfo>();

  for (const [key, values] of attributeValuesByKey) {
    const actualKey = lowercaseToActualKeyMap.get(key.toLowerCase());
    const existingKey = actualKey ? existingAttributeKeys.find((ak) => ak.key === actualKey) : null;

    if (existingKey) {
      attributeTypeMap.set(key, { dataType: existingKey.dataType, isExisting: true });
    } else {
      const firstValue = values.find((v) => v !== "");
      const detectedType = firstValue ? detectAttributeDataType(firstValue) : "string";
      attributeTypeMap.set(key, { dataType: detectedType, isExisting: false });
    }
  }

  return attributeTypeMap;
};

/**
 * Finds invalid values for a given attribute type
 */
const findInvalidValuesForType = (values: string[], dataType: TContactAttributeDataType): string[] => {
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

  return invalidValues;
};

/**
 * Builds an error message for invalid attribute values
 */
const buildInvalidValuesErrorMessage = (
  key: string,
  dataType: TContactAttributeDataType,
  invalidValues: string[]
): string => {
  const sampleInvalid = invalidValues.slice(0, 3).join(", ");
  const additionalCount = invalidValues.length - 3;
  const suffix = additionalCount > 0 ? ` (and ${additionalCount} more)` : "";

  return `Attribute "${key}" is typed as "${dataType}" but CSV contains invalid values: ${sampleInvalid}${suffix}`;
};

/**
 * Validates attribute values against their types.
 * - For EXISTING typed attributes: throws ValidationError if values don't match
 * - For NEW attributes: downgrades to string if values are inconsistent
 */
const validateAndAdjustCsvAttributeTypes = (
  attributeTypeMap: Map<string, TAttributeTypeInfo>,
  attributeValuesByKey: Map<string, string[]>
): void => {
  const typeValidationWarnings: string[] = [];

  for (const [key, typeInfo] of attributeTypeMap) {
    if (typeInfo.dataType === "string") continue;

    const values = attributeValuesByKey.get(key) || [];
    const invalidValues = findInvalidValuesForType(values, typeInfo.dataType);

    if (invalidValues.length === 0) continue;

    if (typeInfo.isExisting) {
      // EXISTING typed attribute: fail the upload
      throw new ValidationError(buildInvalidValuesErrorMessage(key, typeInfo.dataType, invalidValues));
    }

    // NEW attribute: downgrade to string
    attributeTypeMap.set(key, { dataType: "string", isExisting: false });
    typeValidationWarnings.push(
      `Attribute "${key}" has mixed or invalid values for type "${typeInfo.dataType}", treating as string type`
    );
  }

  if (typeValidationWarnings.length > 0) {
    logger.warn({ warnings: typeValidationWarnings }, "Type validation warnings during CSV upload");
  }
};

/**
 * Creates missing attribute keys in the database
 */
const createMissingAttributeKeys = async (
  csvKeys: Set<string>,
  lowercaseToActualKeyMap: Map<string, string>,
  attributeKeyMap: Map<string, string>,
  attributeTypeMap: Map<string, TAttributeTypeInfo>,
  environmentId: string
): Promise<void> => {
  const missingKeys = Array.from(csvKeys).filter((key) => !lowercaseToActualKeyMap.has(key.toLowerCase()));

  if (missingKeys.length === 0) return;

  // Validate that all missing keys are safe identifiers
  const invalidKeys = missingKeys.filter((key) => !isSafeIdentifier(key));
  if (invalidKeys.length > 0) {
    throw new ValidationError(
      `Invalid attribute key(s): ${invalidKeys.join(", ")}. Keys must only contain lowercase letters, numbers, and underscores, and must start with a letter.`
    );
  }

  // Deduplicate by lowercase to avoid creating duplicates like "firstName" and "firstname"
  const uniqueMissingKeys = new Map<string, string>();
  for (const key of missingKeys) {
    const lowerKey = key.toLowerCase();
    if (!uniqueMissingKeys.has(lowerKey)) {
      uniqueMissingKeys.set(lowerKey, key);
    }
  }

  await prisma.contactAttributeKey.createMany({
    data: Array.from(uniqueMissingKeys.values()).map((key) => ({
      key,
      name: formatSnakeCaseToTitleCase(key),
      dataType: attributeTypeMap.get(key)?.dataType ?? "string",
      environmentId,
    })),
    skipDuplicates: true,
  });

  // Fetch and update the maps with new keys
  const newAttributeKeys = await prisma.contactAttributeKey.findMany({
    where: {
      key: { in: Array.from(uniqueMissingKeys.values()) },
      environmentId,
    },
    select: { key: true, id: true, dataType: true },
  });

  for (const attrKey of newAttributeKeys) {
    attributeKeyMap.set(attrKey.key, attrKey.id);
    lowercaseToActualKeyMap.set(attrKey.key.toLowerCase(), attrKey.key);
  }
};

type TExistingContactFromCsv = {
  id: string;
  attributes: { attributeKey: { key: string; id: string }; value: string }[];
};

type TExistingUserId = { value: string; contactId: string };

type TCsvProcessingContext = {
  lowercaseToActualKeyMap: Map<string, string>;
  emailToContactMap: Map<string, TExistingContactFromCsv>;
  existingUserIds: TExistingUserId[];
  attributeKeyMap: Map<string, string>;
  attributeTypeMap: Map<string, TAttributeTypeInfo>;
  duplicateContactsAction: "skip" | "update" | "overwrite";
  environmentId: string;
};

/**
 * Processes a single CSV record to create or update a contact
 */
const processCsvRecord = async (
  record: Record<string, string>,
  ctx: TCsvProcessingContext
): Promise<TContact | null> => {
  const {
    lowercaseToActualKeyMap,
    emailToContactMap,
    existingUserIds,
    attributeKeyMap,
    attributeTypeMap,
    duplicateContactsAction,
    environmentId,
  } = ctx;
  // Map CSV keys to actual DB keys (case-insensitive matching)
  const mappedRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const actualKey = lowercaseToActualKeyMap.get(key.toLowerCase());
    if (!actualKey) {
      throw new ValidationError(`Attribute key "${key}" not found in attribute key map`);
    }
    mappedRecord[actualKey] = value;
  }

  if (!mappedRecord.email) {
    throw new ValidationError("Email is required for all contacts");
  }

  const existingContact = emailToContactMap.get(mappedRecord.email);

  if (!existingContact) {
    // Create new contact
    return prisma.contact.create({
      data: {
        environmentId,
        attributes: {
          create: createAttributeConnections(mappedRecord, environmentId, attributeTypeMap),
        },
      },
      include: contactAttributesInclude,
    });
  }

  // Handle duplicate based on action
  return handleDuplicateContact(
    mappedRecord,
    existingContact,
    existingUserIds,
    attributeKeyMap,
    attributeTypeMap,
    duplicateContactsAction,
    environmentId
  );
};

/**
 * Handles duplicate contact based on the specified action
 */
const handleDuplicateContact = async (
  mappedRecord: Record<string, string>,
  existingContact: TExistingContactFromCsv,
  existingUserIds: TExistingUserId[],
  attributeKeyMap: Map<string, string>,
  attributeTypeMap: Map<string, TAttributeTypeInfo>,
  duplicateContactsAction: "skip" | "update" | "overwrite",
  environmentId: string
): Promise<TContact | null> => {
  if (duplicateContactsAction === "skip") {
    return null;
  }

  const recordToProcess = resolveUserIdConflict(mappedRecord, existingContact, existingUserIds);

  if (duplicateContactsAction === "update") {
    const attributesToUpsert = Object.entries(recordToProcess).map(([key, value]) => {
      const dataType = attributeTypeMap.get(key)?.dataType ?? "string";
      const columns = prepareAttributeColumnsForStorage(value, dataType);

      return {
        where: {
          contactId_attributeKeyId: {
            contactId: existingContact.id,
            attributeKeyId: attributeKeyMap.get(key),
          },
        },
        update: {
          value: columns.value,
          valueNumber: columns.valueNumber,
          valueDate: columns.valueDate,
        },
        create: {
          attributeKeyId: attributeKeyMap.get(key),
          value: columns.value,
          valueNumber: columns.valueNumber,
          valueDate: columns.valueDate,
        },
      };
    });

    return prisma.contact.update({
      where: { id: existingContact.id },
      data: {
        attributes: {
          // @ts-expect-error - Prisma types don't fully support upsert array
          upsert: attributesToUpsert,
        },
      },
      include: contactAttributesInclude,
    });
  }

  // duplicateContactsAction = "overwrite" here
  await prisma.contactAttribute.deleteMany({
    where: { contactId: existingContact.id },
  });

  return prisma.contact.update({
    where: { id: existingContact.id },
    data: {
      attributes: {
        create: createAttributeConnections(recordToProcess, environmentId, attributeTypeMap),
      },
    },
    include: contactAttributesInclude,
  });
};

export const createContactsFromCSV = async (
  csvData: Record<string, string>[],
  environmentId: string,
  duplicateContactsAction: "skip" | "update" | "overwrite",
  attributeMap: Record<string, string>
): Promise<TContact[]> => {
  validateInputs(
    [csvData, ZContactCSVUploadResponse],
    [environmentId, ZId],
    [duplicateContactsAction, ZContactCSVDuplicateAction],
    [attributeMap, ZContactCSVAttributeMap]
  );

  try {
    // Step 1: Extract metadata from CSV data
    const { csvEmails, csvUserIds, csvKeys, attributeValuesByKey } = extractCsvMetadata(csvData);

    // Step 2: Fetch existing data from database
    const [existingContactsByEmail, existingUserIds, existingAttributeKeys] = await Promise.all([
      prisma.contact.findMany({
        where: {
          environmentId,
          attributes: { some: { attributeKey: { key: "email" }, value: { in: csvEmails } } },
        },
        select: {
          id: true,
          attributes: { select: { attributeKey: { select: { key: true, id: true } }, value: true } },
        },
      }),
      prisma.contactAttribute.findMany({
        where: { attributeKey: { key: "userId", environmentId }, value: { in: csvUserIds } },
        select: { value: true, contactId: true },
      }),
      prisma.contactAttributeKey.findMany({
        where: { environmentId },
        select: { key: true, id: true, dataType: true },
      }),
    ]);

    // Step 3: Build lookup maps
    const emailToContactMap = new Map<string, TExistingContactFromCsv>();
    for (const contact of existingContactsByEmail) {
      const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === "email");
      if (emailAttr) {
        emailToContactMap.set(emailAttr.value, contact);
      }
    }

    const attributeKeyMap = new Map<string, string>();
    const lowercaseToActualKeyMap = new Map<string, string>();
    for (const attrKey of existingAttributeKeys) {
      attributeKeyMap.set(attrKey.key, attrKey.id);
      lowercaseToActualKeyMap.set(attrKey.key.toLowerCase(), attrKey.key);
    }

    // Step 4: Detect and validate attribute types
    const attributeTypeMap = buildAttributeTypeMap(
      attributeValuesByKey,
      existingAttributeKeys,
      lowercaseToActualKeyMap
    );
    validateAndAdjustCsvAttributeTypes(attributeTypeMap, attributeValuesByKey);

    // Step 5: Create missing attribute keys
    await createMissingAttributeKeys(
      csvKeys,
      lowercaseToActualKeyMap,
      attributeKeyMap,
      attributeTypeMap,
      environmentId
    );

    // Step 6: Process each CSV record
    const processingContext: TCsvProcessingContext = {
      lowercaseToActualKeyMap,
      emailToContactMap,
      existingUserIds,
      attributeKeyMap,
      attributeTypeMap,
      duplicateContactsAction,
      environmentId,
    };

    const contactPromises = csvData.map((record) => processCsvRecord(record, processingContext));

    const results = await Promise.all(contactPromises);
    return results.filter((contact): contact is TContact => contact !== null);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const generatePersonalLinks = async (surveyId: string, segmentId: string, expirationDays?: number) => {
  const contactsResult = await getContactsInSegment(segmentId);

  if (!contactsResult) {
    return null;
  }

  // Generate survey links for each contact
  const contactLinks = await Promise.all(
    contactsResult.map(async (contact) => {
      const { contactId, attributes } = contact;

      const surveyUrlResult = await getContactSurveyLink(contactId, surveyId, expirationDays);

      if (!surveyUrlResult.ok) {
        logger.error(
          { error: surveyUrlResult.error, contactId: contactId, surveyId: surveyId },
          "Failed to generate survey URL for contact"
        );
        return null;
      }

      return {
        contactId,
        attributes,
        surveyUrl: surveyUrlResult.data,
        expirationDays,
      };
    })
  );

  const filteredContactLinks = contactLinks.filter(Boolean);
  return filteredContactLinks;
};
