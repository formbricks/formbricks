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

      for (const contact of contacts) {
        const email = contact.attributes.find((attr) => attr.attributeKey.key === "email");
        if (!email) {
          return ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Missing email attribute for one or more contacts",
          });
        }
      }
    }),
});

export type TContactBulkUploadRequest = z.infer<typeof ZContactBulkUploadRequest>;
