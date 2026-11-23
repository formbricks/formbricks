import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { formatSnakeCaseToTitleCase, isSafeIdentifier } from "@formbricks/types/safe-identifier";
import { getSurvey } from "@/lib/survey/service";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { validateInputs } from "@/lib/utils/validate";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  getReservedFutureDefaultAttributeKeys,
} from "@/modules/ee/contacts/lib/attribute-key-policy";
import {
  whereAttributeKeysOfDirectory,
  whereDirectoryAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-scope";
import { prepareAttributeColumnsForStorage } from "@/modules/ee/contacts/lib/attribute-storage";
import { whereContactsOfWorkspace } from "@/modules/ee/contacts/lib/contact-directory";
import type { TWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import {
  CONTACTS_OLDEST_FIRST,
  groupContactsByIdentity,
  pickContactForRow,
} from "@/modules/ee/contacts/lib/contact-identity";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { detectAttributeDataType } from "@/modules/ee/contacts/lib/detect-attribute-type";
import {
  SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE,
  SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE,
} from "@/modules/ee/contacts/lib/personal-link-errors";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { segmentFiltersReadHiddenSurvey } from "@/modules/ee/contacts/segments/lib/helper";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import {
  TContact,
  ZContactCSVAttributeMap,
  ZContactCSVDuplicateAction,
  ZContactCSVRecords,
  getContactCSVUploadSchema,
} from "../types/contact";

export const getContactsInSegment = reactCache(async (segmentId: string) => {
  try {
    const segment = await getSegment(segmentId);

    if (!segment) {
      return null;
    }

    const segmentFilterToPrismaQueryResult = await segmentFilterToPrismaQuery(
      segment.id,
      segment.filters,
      segment.workspaceId
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
  workspaceId: true,
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

export const buildContactWhereClause = (workspaceId: string, search?: string): Prisma.ContactWhereInput => {
  const whereClause: Prisma.ContactWhereInput = { ...whereContactsOfWorkspace(workspaceId) };

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

/**
 * A contact's `workspaceId` only records the workspace it was created from, and is null once that
 * workspace is deleted while the directory lives on. A read made through a workspace reports that
 * workspace instead, so `TContact.workspaceId` keeps its type.
 */
const withReportedWorkspace = <T extends { workspaceId: string | null }>(
  contact: T,
  workspaceId: string
): T & { workspaceId: string } => ({ ...contact, workspaceId: contact.workspaceId ?? workspaceId });

/**
 * The contact, when it is in the workspace's contact directory; null otherwise, so a caller holding an
 * authorized workspace id cannot read a contact of another directory.
 */
export const getContactInWorkspace = reactCache(
  async (contactId: string, workspaceId: string): Promise<TContact | null> => {
    validateInputs([contactId, ZId], [workspaceId, ZId]);

    try {
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          ...whereContactsOfWorkspace(workspaceId),
        },
        select: selectContact,
      });
      return contact ? withReportedWorkspace(contact, workspaceId) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

/** Shown by the APIs; the Contacts page translates {@link CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE} instead. */
export const CONTACT_IN_SHARED_DIRECTORY_MESSAGE =
  "This contact is in a contact directory that other workspaces use, so it can't be deleted.";

/** Deleting the contact would also delete its responses and displays in the other workspaces. */
export class ContactInSharedDirectoryError extends OperationNotAllowedError {
  constructor() {
    super(CONTACT_IN_SHARED_DIRECTORY_MESSAGE);
  }
}

/**
 * Deletes a contact of the workspace's contact directory (decision 9). Refused with
 * {@link ContactInSharedDirectoryError} when another workspace uses the directory too, and with
 * `ResourceNotFoundError` when the contact is not in the directory. The share check is part of the
 * delete itself, so a workspace joining the directory meanwhile cannot slip past it.
 */
export const deleteContactInWorkspace = async (contactId: string, workspaceId: string): Promise<TContact> => {
  validateInputs([contactId, ZId], [workspaceId, ZId]);

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ...whereContactsOfWorkspace(workspaceId) },
      select: selectContact,
    });
    if (!contact) {
      throw new ResourceNotFoundError("contact", contactId);
    }

    const { count } = await prisma.contact.deleteMany({
      where: {
        id: contactId,
        directory: { workspaces: { some: { id: workspaceId }, every: { id: workspaceId } } },
      },
    });
    if (count === 0) {
      throw new ContactInSharedDirectoryError();
    }

    return withReportedWorkspace(contact, workspaceId);
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

// Helper to create attribute objects for Prisma create operations with typed columns. Keys are
// connected by the ids the upload already read, as the update path does.
const createAttributeConnections = (
  record: Record<string, string>,
  attributeKeyMap: Map<string, string>,
  attributeTypeMap: Map<string, TAttributeTypeInfo>
) =>
  Object.entries(record).map(([key, value]) => {
    const dataType = attributeTypeMap.get(key)?.dataType ?? "string";
    const columns = prepareAttributeColumnsForStorage(value, dataType);
    const attributeKeyId = attributeKeyMap.get(key);
    if (!attributeKeyId) {
      throw new ValidationError(`Attribute key "${key}" not found in attribute key map`);
    }

    return {
      attributeKey: {
        connect: { id: attributeKeyId },
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
 * Extracts unique identity values, userIds, and attribute keys from CSV data
 */
const extractCsvMetadata = (
  csvData: Record<string, string>[],
  identityKey: string
): {
  csvIdentityValues: string[];
  csvUserIds: string[];
  csvKeys: Set<string>;
  attributeValuesByKey: Map<string, string[]>;
} => {
  const csvIdentityValues = Array.from(new Set(csvData.map((r) => r[identityKey]).filter(Boolean)));
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

  return { csvIdentityValues, csvUserIds, csvKeys, attributeValuesByKey };
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

interface TCsvAttributeValidationError {
  key: string;
  dataType: TContactAttributeDataType;
  invalidValues: string[];
}

/**
 * Validates attribute values against their types.
 * - For EXISTING typed attributes: returns validation errors
 * - For NEW attributes: downgrades to string if values are inconsistent
 */
const validateAndAdjustCsvAttributeTypes = (
  attributeTypeMap: Map<string, TAttributeTypeInfo>,
  attributeValuesByKey: Map<string, string[]>
): TCsvAttributeValidationError[] => {
  const typeValidationWarnings: string[] = [];
  const validationErrors: TCsvAttributeValidationError[] = [];

  for (const [key, typeInfo] of attributeTypeMap) {
    if (typeInfo.dataType === "string") continue;

    const values = attributeValuesByKey.get(key) || [];
    const invalidValues = findInvalidValuesForType(values, typeInfo.dataType);

    if (invalidValues.length === 0) continue;

    if (typeInfo.isExisting) {
      // EXISTING typed attribute: collect error
      validationErrors.push({ key, dataType: typeInfo.dataType, invalidValues });
      continue;
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

  return validationErrors;
};

/**
 * Creates missing attribute keys in the database
 */
const createMissingAttributeKeys = async (
  csvKeys: Set<string>,
  lowercaseToActualKeyMap: Map<string, string>,
  attributeKeyMap: Map<string, string>,
  attributeTypeMap: Map<string, TAttributeTypeInfo>,
  workspaceId: string,
  directoryId: string
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

  const reservedKeys = getReservedFutureDefaultAttributeKeys(missingKeys);
  if (reservedKeys.length > 0) {
    throw new ValidationError(getReservedFutureDefaultAttributeKeyIssue(reservedKeys));
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
      // The directory owns the key; the workspace records where it was created.
      directoryId,
      workspaceId,
    })),
    skipDuplicates: true,
  });

  // Fetch and update the maps with new keys. Read by directory: a key another workspace of a shared
  // directory created at the same moment carries that workspace's id.
  const newAttributeKeys = await prisma.contactAttributeKey.findMany({
    where: {
      ...whereAttributeKeysOfDirectory(directoryId),
      key: { in: Array.from(uniqueMissingKeys.values()) },
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
  /** Existing contacts by identity value, oldest first. One value can match several contacts. */
  identityToContactsMap: Map<string, TExistingContactFromCsv[]>;
  identityKey: string;
  existingUserIds: TExistingUserId[];
  attributeKeyMap: Map<string, string>;
  attributeTypeMap: Map<string, TAttributeTypeInfo>;
  duplicateContactsAction: "skip" | "update" | "overwrite";
  workspaceId: string;
  directoryId: string;
};

type TCsvRecordResult = {
  contact: TContact | null;
  /** The row matched several contacts and updated one of them (spec decision 5). */
  updatedOneOfSeveral: boolean;
};

const missingIdentityMessage = (identityKey: string): string =>
  identityKey === "email"
    ? "Email is required for all contacts"
    : `${identityKey} is required for all contacts`;

/**
 * Processes a single CSV record to create or update a contact
 */
const processCsvRecord = async (
  record: Record<string, string>,
  ctx: TCsvProcessingContext
): Promise<TCsvRecordResult> => {
  const {
    lowercaseToActualKeyMap,
    identityToContactsMap,
    identityKey,
    existingUserIds,
    attributeKeyMap,
    attributeTypeMap,
    duplicateContactsAction,
    workspaceId,
    directoryId,
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

  const identityValue = mappedRecord[identityKey];
  if (!identityValue) {
    throw new ValidationError(missingIdentityMessage(identityKey));
  }

  const matches = identityToContactsMap.get(identityValue) ?? [];
  const existingContact = pickContactForRow(matches, mappedRecord.userId);

  if (!existingContact) {
    // Create new contact in the directory; the workspace records where it was created.
    const created = await prisma.contact.create({
      data: {
        directoryId,
        workspaceId,
        attributes: {
          create: createAttributeConnections(mappedRecord, attributeKeyMap, attributeTypeMap),
        },
      },
      include: contactAttributesInclude,
    });
    // Written for this workspace, so `workspaceId` is set.
    return { contact: { ...created, workspaceId }, updatedOneOfSeveral: false };
  }

  // Handle duplicate based on action
  const contact = await handleDuplicateContact(
    mappedRecord,
    existingContact,
    existingUserIds,
    attributeKeyMap,
    attributeTypeMap,
    duplicateContactsAction,
    workspaceId
  );
  return { contact, updatedOneOfSeveral: contact !== null && matches.length > 1 };
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
  workspaceId: string
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

    const updated = await prisma.contact.update({
      where: { id: existingContact.id },
      data: {
        attributes: {
          // @ts-expect-error - Prisma types don't fully support upsert array
          upsert: attributesToUpsert,
        },
      },
      include: contactAttributesInclude,
    });
    return { ...updated, workspaceId };
  }

  // duplicateContactsAction = "overwrite" here
  await prisma.contactAttribute.deleteMany({
    where: { contactId: existingContact.id },
  });

  const overwritten = await prisma.contact.update({
    where: { id: existingContact.id },
    data: {
      attributes: {
        create: createAttributeConnections(recordToProcess, attributeKeyMap, attributeTypeMap),
      },
    },
    include: contactAttributesInclude,
  });
  return { ...overwritten, workspaceId };
};

export type TCreateContactsFromCSVResult =
  | {
      contacts: TContact[];
      /** Rows that matched several contacts and updated one of them (spec decision 5). */
      multiMatchCount: number;
    }
  | { validationErrors: TCsvAttributeValidationError[] };

/**
 * Creates or updates contacts of `directory` from CSV rows, as uploaded from `workspaceId`. A row matches
 * existing contacts by the directory's matching key (`email` or `externalId`).
 */
export const createContactsFromCSV = async (
  csvData: Record<string, string>[],
  workspaceId: string,
  directory: TWorkspaceContactDirectory,
  duplicateContactsAction: "skip" | "update" | "overwrite",
  attributeMap: Record<string, string>
): Promise<TCreateContactsFromCSVResult> => {
  validateInputs(
    [csvData, ZContactCSVRecords],
    [workspaceId, ZId],
    [duplicateContactsAction, ZContactCSVDuplicateAction],
    [attributeMap, ZContactCSVAttributeMap]
  );

  const identityKey = directory.matchingKey;
  const identityCheck = getContactCSVUploadSchema(identityKey).safeParse(csvData);
  if (!identityCheck.success) {
    throw new ValidationError(identityCheck.error.issues[0].message);
  }

  try {
    // Step 2: Extract metadata from CSV data
    const { csvIdentityValues, csvUserIds, csvKeys, attributeValuesByKey } = extractCsvMetadata(
      csvData,
      identityKey
    );

    // Step 3: Fetch existing data from database
    const [existingContactsByIdentity, existingUserIds, existingAttributeKeys] = await Promise.all([
      prisma.contact.findMany({
        where: {
          directoryId: directory.id,
          attributes: {
            some: {
              attributeKey: whereDirectoryAttributeKey(directory.id, identityKey),
              value: { in: csvIdentityValues },
            },
          },
        },
        select: {
          id: true,
          attributes: { select: { attributeKey: { select: { key: true, id: true } }, value: true } },
        },
        orderBy: CONTACTS_OLDEST_FIRST,
      }),
      prisma.contactAttribute.findMany({
        where: {
          attributeKey: whereDirectoryAttributeKey(directory.id, "userId"),
          value: { in: csvUserIds },
        },
        select: { value: true, contactId: true },
      }),
      prisma.contactAttributeKey.findMany({
        where: whereAttributeKeysOfDirectory(directory.id),
        select: { key: true, id: true, dataType: true },
      }),
    ]);

    // Step 3: Build lookup maps
    const identityToContactsMap = groupContactsByIdentity(existingContactsByIdentity, identityKey);

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
    const validationErrors = validateAndAdjustCsvAttributeTypes(attributeTypeMap, attributeValuesByKey);
    if (validationErrors.length > 0) {
      return { validationErrors };
    }

    // Step 5: Create missing attribute keys
    await createMissingAttributeKeys(
      csvKeys,
      lowercaseToActualKeyMap,
      attributeKeyMap,
      attributeTypeMap,
      workspaceId,
      directory.id
    );

    // Step 6: Process each CSV record
    const processingContext: TCsvProcessingContext = {
      lowercaseToActualKeyMap,
      identityToContactsMap,
      identityKey,
      existingUserIds,
      attributeKeyMap,
      attributeTypeMap,
      duplicateContactsAction,
      workspaceId,
      directoryId: directory.id,
    };

    const CHUNK_SIZE = 50;
    const allResults: TCsvRecordResult[] = [];

    for (let i = 0; i < csvData.length; i += CHUNK_SIZE) {
      const chunk = csvData.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map((record) => processCsvRecord(record, processingContext))
      );
      allResults.push(...chunkResults);
    }

    return {
      contacts: allResults
        .map(({ contact }) => contact)
        .filter((contact): contact is TContact => contact !== null),
      multiMatchCount: allResults.filter(({ updatedOneOfSeveral }) => updatedOneOfSeveral).length,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Personal links to `surveyId` for every contact in `segmentId`, as `actor` asks for them. The list
 * says who is in the segment, so `actor` must be allowed to evaluate its filters (ENG-6870).
 */
export const generatePersonalLinks = async (
  surveyId: string,
  segmentId: string,
  actor: TSurveyActorContext,
  expirationDays?: number
) => {
  const survey = await getSurvey(surveyId);

  if (!survey) {
    return null;
  }

  const segment = await getSegment(segmentId);

  if (!segment) {
    return null;
  }

  // Cross-tenant guard: the segment must belong to the same workspace as the
  // survey the caller is authorized against. Without this, a caller with access
  // to `surveyId`'s workspace could pass a `segmentId` from another workspace and
  // exfiltrate that workspace's contact PII. Mirrors the v2 management API
  // (contact-links/segments) which rejects the same mismatch. The message is a
  // stable error code the client maps to a localized string.
  if (survey.workspaceId !== segment.workspaceId) {
    throw new ValidationError(SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE);
  }

  // Survey-visibility guard (ENG-6870): the contacts a survey-interaction filter matches are the people
  // who saw, started or completed the surveys it reads, so the caller must see every one of them.
  if (await segmentFiltersReadHiddenSurvey(segment.filters, segment.workspaceId, actor, segment.id)) {
    throw new ValidationError(SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE);
  }

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
