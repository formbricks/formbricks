import { z } from "zod";

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

export const ZContactBulkUploadAttributeKey = z.object({
  key: z.string(),
  name: z.string(),
});

export type TContactBulkUploadAttributeKey = z.infer<typeof ZContactBulkUploadAttributeKey>;

export const ZContactBulkUploadAttribute = z.object({
  attributeKey: ZContactBulkUploadAttributeKey,
  value: z.string(),
});

export const ZContactBulkUploadContact = z.object({
  attributes: z.array(ZContactBulkUploadAttribute),
});

export type TContactBulkUploadContact = z.infer<typeof ZContactBulkUploadContact>;

export const ZContactBulkUploadRequest = z.object({
  contacts: z
    .array(ZContactBulkUploadContact)
    .max(1000, { message: "Maximum 1000 contacts allowed at a time." })
    .superRefine((contacts, ctx) => {
      // every contact must have an email attribute
      contacts.forEach((contact, idx) => {
        const email = contact.attributes.find((attr) => attr.attributeKey.key === "email");
        if (!email?.value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Missing email attribute for contact at index ${idx}`,
          });
        }

        if (email?.value) {
          // parse the email:
          const parsedEmail = z.string().email().safeParse(email.value);
          if (!parsedEmail.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid email for contact at index ${idx}`,
            });
          }
        }
      });

      const seenEmails = new Set<string>();
      const duplicateEmails = new Set<string>();

      const seenUserIds = new Set<string>();
      const duplicateUserIds = new Set<string>();

      for (const contact of contacts) {
        const email = contact.attributes.find((attr) => attr.attributeKey.key === "email")?.value;
        const userId = contact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value;

        if (email) {
          if (seenEmails.has(email)) {
            duplicateEmails.add(email);
          } else {
            seenEmails.add(email);
          }
        }

        if (userId) {
          if (seenUserIds.has(userId)) {
            duplicateUserIds.add(userId);
          } else {
            seenUserIds.add(userId);
          }
        }
      }

      if (duplicateEmails.size > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate emails found in the records, please ensure each email is unique.",
          params: {
            duplicateEmails: Array.from(duplicateEmails),
          },
        });
      }

      // if userId is present, check for duplicate userIds
      if (duplicateUserIds.size > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate userIds found in the records, please ensure each userId is unique.",
          params: {
            duplicateUserIds: Array.from(duplicateUserIds),
          },
        });
      }

      const contactsWithDuplicateKeys = contacts
        .map((contact, idx) => {
          // Count how many times each attribute key appears
          const keyCounts = contact.attributes.reduce<Record<string, number>>((acc, attr) => {
            const key = attr.attributeKey.key;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {});

          // Find attribute keys that appear more than once
          const duplicateKeys = Object.entries(keyCounts)
            .filter(([_, count]) => count > 1)
            .map(([key]) => key);

          return { idx, duplicateKeys };
        })
        // Only keep contacts that have at least one duplicate key
        .filter(({ duplicateKeys }) => duplicateKeys.length > 0);

      if (contactsWithDuplicateKeys.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Duplicate attribute keys found in the records, please ensure each attribute key is unique.",
          params: {
            contactsWithDuplicateKeys,
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
