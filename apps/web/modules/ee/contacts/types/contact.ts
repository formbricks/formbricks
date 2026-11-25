import { z } from "zod";
import { TContactAttributeKey, ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import type { TContactDirectoryMatchingKey } from "@/modules/ee/contacts/directories/types";
import {
  CSV_IMPORT_MAX_COLUMNS,
  CSV_IMPORT_MAX_KEY_LENGTH,
  CSV_IMPORT_MAX_RECORDS,
  CSV_IMPORT_MAX_VALUE_LENGTH,
} from "../lib/csv-import-limits";

export const ZContact = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  workspaceId: z.cuid2(),
});

const ZContactTableAttributeData = z.object({
  key: z.string(),
  name: z.string().nullable(),
  value: z.string().nullable(),
  dataType: ZContactAttributeDataType,
});

export const ZContactTableData = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  attributes: z.array(ZContactTableAttributeData),
});

export const ZContactWithAttributes = ZContact.extend({
  attributes: z.record(z.string(), z.string()),
});

export type TContactWithAttributes = z.infer<typeof ZContactWithAttributes>;

export type TContactTableData = z.infer<typeof ZContactTableData>;

export type TContact = z.infer<typeof ZContact>;

// types related to the csv upload:
export const ZContactCSVDuplicateAction = z.enum(["skip", "update", "overwrite"]);
export type TContactCSVDuplicateAction = z.infer<typeof ZContactCSVDuplicateAction>;

/** The cell text a record or attribute map can carry: a string within `maxLength`, without NUL. */
const textProblem = (value: unknown, maxLength: number, label: string): string | null => {
  if (typeof value !== "string") return `${label} must be text`;
  if (value.length > maxLength) return `${label} must be at most ${maxLength} characters`;
  // Postgres can't store NUL in text, and would answer a 500.
  if (value.includes("\u0000")) return `${label} must not contain NUL characters`;
  return null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The first entry of a record or attribute map past a limit, or `null` when every entry is within them. */
const entriesProblem = (
  value: Record<string, unknown>,
  limits: { maxEntries: number; entriesLabel: string; maxValueLength: number; valueLabel: string }
): string | null => {
  const keys = Object.keys(value);
  if (keys.length > limits.maxEntries) {
    return `${limits.entriesLabel} may have at most ${limits.maxEntries} entries`;
  }
  for (const key of keys) {
    const problem =
      textProblem(key, CSV_IMPORT_MAX_KEY_LENGTH, "A column name") ??
      textProblem(value[key], limits.maxValueLength, limits.valueLabel);
    if (problem) return problem;
  }
  return null;
};

/**
 * The import's caps (`csv-import-limits.ts`), checked before the typed schema parses a single entry: a
 * schema reports one issue per bad entry, which for 10,000 records of 160 cells is a million issues. This
 * walk stops at the first problem and reports it once, naming the limit and the record.
 */
const csvRecordsWithinLimits = (records: unknown, ctx: z.RefinementCtx) => {
  // Not an array: the typed schema refuses it with a single issue.
  if (!Array.isArray(records)) return;
  if (records.length > CSV_IMPORT_MAX_RECORDS) {
    ctx.addIssue({ code: "custom", message: `Maximum ${CSV_IMPORT_MAX_RECORDS} records allowed at a time.` });
    return;
  }

  for (const [index, record] of records.entries()) {
    const problem = isPlainObject(record)
      ? entriesProblem(record, {
          maxEntries: CSV_IMPORT_MAX_COLUMNS,
          entriesLabel: "A record",
          maxValueLength: CSV_IMPORT_MAX_VALUE_LENGTH,
          valueLabel: "A value",
        })
      : "A record must map column names to values";
    if (problem) {
      ctx.addIssue({ code: "custom", message: `${problem} (record ${index + 1})`, path: [index] });
      return;
    }
  }
};

/**
 * The attribute key that identifies a contact in a directory is its matching key: `email` or
 * `externalId` (spec decision 11). The request schemas below check it only once the workspace's
 * directory is known, so each comes as a base schema and a builder for one matching key.
 */
const identityKeyLabel = (identityKey: TContactDirectoryMatchingKey): string =>
  identityKey === "email" ? "Email" : identityKey;

/**
 * CSV rows as the import route accepts them, held to the import's caps; the identity column is checked once
 * the workspace's directory is known (`getContactCSVUploadSchema`).
 */
export const ZContactCSVRecords = z
  .unknown()
  .superRefine(csvRecordsWithinLimits)
  .pipe(z.array(z.record(z.string(), z.string())));

export type TContactCSVRecords = z.infer<typeof ZContactCSVRecords>;

/** CSV rows for a directory: each row has the identity column, filled and unique, and userIds are unique. */
export const getContactCSVUploadSchema = (identityKey: TContactDirectoryMatchingKey) =>
  ZContactCSVRecords.superRefine((data, ctx) => {
    for (const record of data) {
      if (!Object.keys(record).includes(identityKey)) {
        ctx.addIssue({
          code: "custom",
          message: `Missing ${identityKey} field for one or more records`,
        });
        return;
      }

      if (!record[identityKey]) {
        ctx.addIssue({
          code: "custom",
          message: `${identityKeyLabel(identityKey)} field is empty for one or more records`,
        });
        return;
      }
    }

    const identityValues = data.map((record) => record[identityKey]);

    if (identityValues.length !== new Set(identityValues).size) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate ${identityKey}s found in the records`,
      });
      return;
    }

    // check for duplicate userIds if present
    const userIds = data.map((record) => record.userId).filter(Boolean);
    if (userIds?.length > 0) {
      const userIdSet = new Set(userIds);
      if (userIds.length !== userIdSet.size) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate userIds found in the records",
        });
        return;
      }
    }

    // An email belongs to one contact of a directory, as identify keeps it. When the directory matches by
    // email the identity check above already covered it; otherwise two rows can't share one either.
    if (identityKey !== "email") {
      const emails = data.map((record) => record.email).filter(Boolean);
      if (emails.length !== new Set(emails).size) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate emails found in the records",
        });
      }
    }
  });

/** The column-to-attribute map's caps, checked before the typed schema as for the records. */
const csvAttributeMapWithinLimits = (attributeMap: unknown, ctx: z.RefinementCtx) => {
  if (!isPlainObject(attributeMap)) return;
  const problem = entriesProblem(attributeMap, {
    maxEntries: CSV_IMPORT_MAX_COLUMNS,
    entriesLabel: "The attribute map",
    maxValueLength: CSV_IMPORT_MAX_KEY_LENGTH,
    valueLabel: "A mapped attribute",
  });
  if (problem) ctx.addIssue({ code: "custom", message: problem });
};

export const ZContactCSVAttributeMap = z
  .unknown()
  .superRefine(csvAttributeMapWithinLimits)
  .pipe(
    z.record(z.string(), z.string()).superRefine((attributeMap, ctx) => {
      const values = Object.values(attributeMap);

      if (new Set(values).size !== values.length) {
        ctx.addIssue({
          code: "custom",
          message: "Attribute map contains duplicate values",
        });
        return;
      }
    })
  );
export type TContactCSVAttributeMap = z.infer<typeof ZContactCSVAttributeMap>;

export const ZContactBulkUploadAttribute = z.object({
  attributeKey: z.object({
    key: z.string(),
    name: z.string(),
  }),
  value: z.string(),
});

export const ZContactBulkUploadContact = z.object({
  attributes: z.array(ZContactBulkUploadAttribute),
});

export type TContactBulkUploadContact = z.infer<typeof ZContactBulkUploadContact>;

// Helper functions for common validation logic
export const validateIdentityAttribute = (
  attributes: z.infer<typeof ZContactBulkUploadAttribute>[],
  ctx: z.RefinementCtx,
  identityKey: TContactDirectoryMatchingKey,
  contactIndex?: number
): { identityAttr?: z.infer<typeof ZContactBulkUploadAttribute>; isValid: boolean } => {
  const identityAttr = attributes.find((attr) => attr.attributeKey.key === identityKey);
  const indexSuffix = contactIndex !== undefined ? ` for contact at index ${contactIndex}` : "";

  if (!identityAttr?.value) {
    ctx.addIssue({
      code: "custom",
      message: `${identityKeyLabel(identityKey)} attribute is required${indexSuffix}`,
    });
    return { isValid: false };
  }

  if (identityKey === "email" && !z.email().safeParse(identityAttr.value).success) {
    ctx.addIssue({
      code: "custom",
      message: `Invalid email format${indexSuffix}`,
    });
    return { identityAttr, isValid: false };
  }

  return { identityAttr, isValid: true };
};

export const validateUniqueAttributeKeys = (
  attributes: z.infer<typeof ZContactBulkUploadAttribute>[],
  ctx: z.RefinementCtx,
  contactIndex?: number
) => {
  const keyOccurrences = new Map<string, number>();
  const duplicateKeys: string[] = [];

  attributes.forEach((attr) => {
    const key = attr.attributeKey.key;
    const count = (keyOccurrences.get(key) ?? 0) + 1;
    keyOccurrences.set(key, count);

    // If this is the second occurrence, add to duplicates
    if (count === 2) {
      duplicateKeys.push(key);
    }
  });

  if (duplicateKeys.length > 0) {
    const indexSuffix = contactIndex !== undefined ? ` for contact at index ${contactIndex}` : "";
    ctx.addIssue({
      code: "custom",
      message: `Duplicate attribute keys found${indexSuffix}. Please ensure each attribute key is unique`,
      params: {
        duplicateKeys,
        ...(contactIndex !== undefined && { contactIndex }),
      },
    });
  }
};

// The `meta` key that lists repeated identity values; `duplicateEmails` predates directories.
const DUPLICATE_IDENTITY_VALUES_PARAM: Record<TContactDirectoryMatchingKey, string> = {
  email: "duplicateEmails",
  externalId: "duplicateExternalIds",
};

const buildContactBulkUploadRequestSchema = (identityKey: TContactDirectoryMatchingKey | null) =>
  z.object({
    workspaceId: z.cuid2(),
    contacts: z
      .array(ZContactBulkUploadContact)
      .max(250, {
        error: "Maximum 250 contacts allowed at a time.",
      })
      .superRefine((contacts, ctx) => {
        // Track all data in a single pass
        const seenIdentityValues = new Set<string>();
        const duplicateIdentityValues = new Set<string>();
        const seenUserIds = new Set<string>();
        const duplicateUserIds = new Set<string>();

        // Process each contact in a single pass
        contacts.forEach((contact, idx) => {
          // 1. Check the identity attribute's existence and validity
          if (identityKey) {
            const { identityAttr, isValid } = validateIdentityAttribute(
              contact.attributes,
              ctx,
              identityKey,
              idx
            );

            if (isValid && identityAttr) {
              if (seenIdentityValues.has(identityAttr.value)) {
                duplicateIdentityValues.add(identityAttr.value);
              } else {
                seenIdentityValues.add(identityAttr.value);
              }
            }
          }

          // 2. Check for userId duplicates
          const userIdAttr = contact.attributes.find((attr) => attr.attributeKey.key === "userId");
          if (userIdAttr?.value) {
            if (seenUserIds.has(userIdAttr.value)) {
              duplicateUserIds.add(userIdAttr.value);
            } else {
              seenUserIds.add(userIdAttr.value);
            }
          }

          // 3. Check for duplicate attribute keys within the same contact using helper function
          validateUniqueAttributeKeys(contact.attributes, ctx, idx);
        });

        // Report all validation issues after the single pass
        if (identityKey && duplicateIdentityValues.size > 0) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate ${identityKey}s found in the records, please ensure each ${identityKey} is unique.`,
            params: {
              [DUPLICATE_IDENTITY_VALUES_PARAM[identityKey]]: Array.from(duplicateIdentityValues),
            },
          });
        }

        if (duplicateUserIds.size > 0) {
          ctx.addIssue({
            code: "custom",
            message: "Duplicate userIds found in the records, please ensure each userId is unique.",
            params: {
              duplicateUserIds: Array.from(duplicateUserIds),
            },
          });
        }
      }),
  });

/** The bulk route's body. The identity attribute is checked once the workspace's directory is known. */
export const ZContactBulkUploadRequest = buildContactBulkUploadRequestSchema(null);

/** A bulk request for a directory: each contact has its identity attribute, valid and unique. */
export const getContactBulkUploadRequestSchema = (identityKey: TContactDirectoryMatchingKey) =>
  buildContactBulkUploadRequestSchema(identityKey);

export type TContactBulkUploadRequest = z.infer<typeof ZContactBulkUploadRequest>;

export type TContactBulkUploadResponseBase = {
  status: "success" | "error";
  message: string;
};

export type TContactBulkUploadResponseError = TContactBulkUploadResponseBase & {
  status: "error";
  message: string;
  errors: Record<string, string>[];
};

export type TContactBulkUploadResponseSuccess = TContactBulkUploadResponseBase & {
  processed: number;
  failed: number;
};

// Schema for single contact creation - simplified with flat attributes
const ZContactCreateAttributes = z.record(z.string(), z.string());

/** The create route's body. The identity attribute is checked once the workspace's directory is known. */
export const ZContactCreateRequest = z.object({
  workspaceId: z.cuid2(),
  attributes: ZContactCreateAttributes,
});

/** A create request for a directory: the identity attribute is present, and a valid email for an email directory. */
export const getContactCreateRequestSchema = (identityKey: TContactDirectoryMatchingKey) =>
  ZContactCreateRequest.extend({
    attributes: ZContactCreateAttributes.superRefine((attributes, ctx) => {
      const identityValue = attributes[identityKey];
      if (!identityValue) {
        ctx.addIssue({
          code: "custom",
          message: `${identityKeyLabel(identityKey)} attribute is required`,
        });
      } else if (identityKey === "email" && !z.email().safeParse(identityValue).success) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid email format",
        });
      }
    }),
  });

export type TContactCreateRequest = z.infer<typeof ZContactCreateRequest>;

// Type for contact response with flattened attributes
export const ZContactResponse = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  workspaceId: z.cuid2(),
  attributes: z.record(z.string(), z.string()),
});

export type TContactResponse = z.infer<typeof ZContactResponse>;

// Schema for editing contact attributes in a form
export const ZAttributeRow = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
});

export const ZEditContactAttributesForm = z.object({
  attributes: z
    .array(ZAttributeRow)
    .min(1, "At least one attribute is required")
    .superRefine((attributes, ctx) => {
      // Check for duplicate keys and mark each duplicate row
      const keyOccurrences = new Map<string, number[]>();
      attributes.forEach((attr, index) => {
        if (attr.key) {
          const indices = keyOccurrences.get(attr.key) || [];
          indices.push(index);
          keyOccurrences.set(attr.key, indices);
        }
      });

      // Mark all duplicate rows with errors
      keyOccurrences.forEach((indices, key) => {
        if (indices.length > 1) {
          indices.forEach((index) => {
            ctx.addIssue({
              code: "custom",
              message: `Duplicate key: ${key}`,
              path: [index, "key"],
            });
          });
        }
      });

      // Check that at least one of email or userId has a value
      const emailAttr = attributes.find((attr) => attr.key === "email");
      const userIdAttr = attributes.find((attr) => attr.key === "userId");
      const hasEmail = emailAttr?.value && emailAttr.value.trim() !== "";
      const hasUserId = userIdAttr?.value && userIdAttr.value.trim() !== "";

      if (!hasEmail && !hasUserId) {
        // Find the indices to show errors on the relevant fields
        const emailIndex = attributes.findIndex((attr) => attr.key === "email");
        const userIdIndex = attributes.findIndex((attr) => attr.key === "userId");

        // When both are empty, show "Either email or userId is required" on both fields
        if (emailIndex !== -1 && userIdIndex !== -1) {
          ctx.addIssue({
            code: "custom",
            message: "Either email or userId is required",
            path: [emailIndex, "value"],
          });

          ctx.addIssue({
            code: "custom",
            message: "Either email or userId is required",
            path: [userIdIndex, "value"],
          });
        }
      }

      // Validate email format if key is "email" and has a value
      attributes.forEach((attr, index) => {
        if (attr.key === "email" && attr.value && attr.value.trim() !== "") {
          const emailResult = z.email().safeParse(attr.value);
          if (!emailResult.success) {
            ctx.addIssue({
              code: "custom",
              message: "Invalid email format",
              path: [index, "value"],
            });
          }
        }
      });
    }),
});

export type TEditContactAttributesForm = z.infer<typeof ZEditContactAttributesForm>;

/**
 * Creates a dynamic schema for editing contact attributes with data type validation.
 * This extends the base ZEditContactAttributesForm with additional validation based on attribute data types.
 *
 * @param attributeKeys - Array of contact attribute keys with their data types
 * @param t - Translation function for error messages
 * @returns Zod schema with type-specific validation
 */
export const createEditContactAttributesSchema = (
  attributeKeys: TContactAttributeKey[],
  t: (key: string) => string
) => {
  return ZEditContactAttributesForm.superRefine((data, ctx) => {
    // Validate data types for each attribute
    data.attributes.forEach((attr, index) => {
      if (!attr.key) return;

      const attributeKey = attributeKeys.find((ak) => ak.key === attr.key);
      if (!attributeKey) return;

      const { dataType } = attributeKey;
      const hasValue = attr.value && attr.value.trim() !== "";

      // For typed fields (date/number), require a value - use delete button to remove
      if (dataType === "date") {
        if (!hasValue) {
          ctx.addIssue({
            code: "custom",
            message: t("workspace.contacts.date_value_required"),
            path: ["attributes", index, "value"],
          });
          return;
        }
        // Validate date format
        const date = new Date(attr.value);
        if (Number.isNaN(date.getTime())) {
          ctx.addIssue({
            code: "custom",
            message: t("workspace.contacts.invalid_date_format"),
            path: ["attributes", index, "value"],
          });
        }
      } else if (dataType === "number") {
        if (!hasValue) {
          ctx.addIssue({
            code: "custom",
            message: t("workspace.contacts.number_value_required"),
            path: ["attributes", index, "value"],
          });
          return;
        }
        // Validate number format
        if (Number.isNaN(Number(attr.value))) {
          ctx.addIssue({
            code: "custom",
            message: t("workspace.contacts.invalid_number_format"),
            path: ["attributes", index, "value"],
          });
        }
      }
    });
  });
};
