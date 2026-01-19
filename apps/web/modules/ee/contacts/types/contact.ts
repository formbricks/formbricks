import { z } from "zod";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

export const ZContact = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string().cuid2(),
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
  attributes: z.record(z.string()),
});

export type TContactWithAttributes = z.infer<typeof ZContactWithAttributes>;

export type TContactTableData = z.infer<typeof ZContactTableData>;

export type TContact = z.infer<typeof ZContact>;

export type TTransformPersonInput = {
  id: string;
  environmentId: string;
  attributes: {
    value: string;
    attributeKey: {
      key: string;
      name: string | null;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
};

// types related to the csv upload:
export const ZContactCSVDuplicateAction = z.enum(["skip", "update", "overwrite"]);
export type TContactCSVDuplicateAction = z.infer<typeof ZContactCSVDuplicateAction>;

export const ZContactCSVUploadResponse = z
  .array(z.record(z.string()))
  .max(10000, { message: "Maximum 10000 records allowed at a time." })
  .superRefine((data, ctx) => {
    for (const record of data) {
      if (!Object.keys(record).includes("email")) {
        return ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Missing email field for one or more records",
        });
      }

      if (!record.email) {
        return ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email field is empty for one or more records",
        });
      }
    }

    // check for duplicate emails
    const emails = data.map((record) => record.email);
    const emailSet = new Set(emails);

    if (emails.length !== emailSet.size) {
      return ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate emails found in the records",
      });
    }

    // check for duplicate userIds if present
    const userIds = data.map((record) => record.userId).filter(Boolean);
    if (userIds?.length > 0) {
      const userIdSet = new Set(userIds);
      if (userIds.length !== userIdSet.size) {
        return ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate userIds found in the records",
        });
      }
    }
  });

export type TContactCSVUploadResponse = z.infer<typeof ZContactCSVUploadResponse>;

export const ZContactCSVAttributeMap = z.record(z.string(), z.string()).superRefine((attributeMap, ctx) => {
  const values = Object.values(attributeMap);

  if (new Set(values).size !== values.length) {
    return ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Attribute map contains duplicate values",
    });
  }
});
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
export const validateEmailAttribute = (
  attributes: z.infer<typeof ZContactBulkUploadAttribute>[],
  ctx: z.RefinementCtx,
  contactIndex?: number
): { emailAttr?: z.infer<typeof ZContactBulkUploadAttribute>; isValid: boolean } => {
  const emailAttr = attributes.find((attr) => attr.attributeKey.key === "email");
  const indexSuffix = contactIndex !== undefined ? ` for contact at index ${contactIndex}` : "";

  if (!emailAttr?.value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Email attribute is required${indexSuffix}`,
    });
    return { isValid: false };
  }

  // Check email format
  const parsedEmail = z.string().email().safeParse(emailAttr.value);
  if (!parsedEmail.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid email format${indexSuffix}`,
    });
    return { emailAttr, isValid: false };
  }

  return { emailAttr, isValid: true };
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
      code: z.ZodIssueCode.custom,
      message: `Duplicate attribute keys found${indexSuffix}. Please ensure each attribute key is unique`,
      params: {
        duplicateKeys,
        ...(contactIndex !== undefined && { contactIndex }),
      },
    });
  }
};

export const ZContactBulkUploadRequest = z.object({
  environmentId: z.string().cuid2(),
  contacts: z
    .array(ZContactBulkUploadContact)
    .max(250, { message: "Maximum 250 contacts allowed at a time." })
    .superRefine((contacts, ctx) => {
      // Track all data in a single pass
      const seenEmails = new Set<string>();
      const duplicateEmails = new Set<string>();
      const seenUserIds = new Set<string>();
      const duplicateUserIds = new Set<string>();

      // Process each contact in a single pass
      contacts.forEach((contact, idx) => {
        // 1. Check email existence and validity using helper function
        const { emailAttr, isValid } = validateEmailAttribute(contact.attributes, ctx, idx);

        if (isValid && emailAttr) {
          // Check for duplicate emails across contacts
          if (seenEmails.has(emailAttr.value)) {
            duplicateEmails.add(emailAttr.value);
          } else {
            seenEmails.add(emailAttr.value);
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
      if (duplicateEmails.size > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate emails found in the records, please ensure each email is unique.",
          params: {
            duplicateEmails: Array.from(duplicateEmails),
          },
        });
      }

      if (duplicateUserIds.size > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate userIds found in the records, please ensure each userId is unique.",
          params: {
            duplicateUserIds: Array.from(duplicateUserIds),
          },
        });
      }
    }),
});

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
export const ZContactCreateRequest = z.object({
  environmentId: z.string().cuid2(),
  attributes: z.record(z.string(), z.string()).superRefine((attributes, ctx) => {
    // Check if email attribute exists and is valid
    const email = attributes.email;
    if (!email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email attribute is required",
      });
    } else {
      // Check email format
      const parsedEmail = z.string().email().safeParse(email);
      if (!parsedEmail.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid email format",
        });
      }
    }
  }),
});

export type TContactCreateRequest = z.infer<typeof ZContactCreateRequest>;

// Type for contact response with flattened attributes
export const ZContactResponse = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  environmentId: z.string().cuid2(),
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
              code: z.ZodIssueCode.custom,
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
            code: z.ZodIssueCode.custom,
            message: "Either email or userId is required",
            path: [emailIndex, "value"],
          });

          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either email or userId is required",
            path: [userIdIndex, "value"],
          });
        }
      }

      // Validate email format if key is "email" and has a value
      attributes.forEach((attr, index) => {
        if (attr.key === "email" && attr.value && attr.value.trim() !== "") {
          const emailResult = z.string().email().safeParse(attr.value);
          if (!emailResult.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Invalid email format",
              path: [index, "value"],
            });
          }
        }
      });
    }),
});

export type TEditContactAttributesForm = z.infer<typeof ZEditContactAttributesForm>;
