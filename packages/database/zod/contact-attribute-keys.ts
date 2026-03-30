import { ContactAttributeDataType, type ContactAttributeKey, ContactAttributeType } from "@prisma/client";
import { z } from "zod";

export const ZContactAttributeKey = z.object({
  id: z.cuid2().describe("The ID of the contact attribute key"),
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the contact attribute key was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the contact attribute key was last updated"),
  isUnique: z
    .boolean()
    .meta({
      example: false,
    })
    .describe("Whether the attribute must have unique values across contacts"),
  key: z
    .string()
    .meta({
      example: "email",
    })
    .describe("The attribute identifier used in the system"),
  name: z
    .string()
    .nullable()
    .meta({
      example: "Email Address",
    })
    .describe("Display name for the attribute"),
  description: z
    .string()
    .nullable()
    .meta({
      example: "The user's email address",
    })
    .describe("Description of the attribute"),
  type: z
    .enum(ContactAttributeType)
    .meta({
      example: "custom",
    })
    .describe("Whether this is a default or custom attribute"),
  dataType: z
    .enum(ContactAttributeDataType)
    .meta({
      example: "string",
    })
    .describe("The data type of the attribute (string, number, date)"),
  environmentId: z.cuid2().describe("The ID of the environment this attribute belongs to"),
}) satisfies z.ZodType<ContactAttributeKey>;

ZContactAttributeKey.meta({
  id: "contactAttributeKey",
}).describe("Defines a possible attribute that can be assigned to contacts");
