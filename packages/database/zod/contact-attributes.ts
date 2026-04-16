import type { ContactAttribute } from "@prisma/client";
import { z } from "zod";

export const ZContactAttribute = z.object({
  id: z.cuid2().describe("The ID of the contact attribute"),
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the contact attribute was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the contact attribute was last updated"),
  attributeKeyId: z.cuid2().describe("The ID of the attribute key"),
  contactId: z.cuid2().describe("The ID of the contact"),
  value: z
    .string()
    .meta({
      example: "example@email.com",
    })
    .describe("The value of the attribute"),
  valueNumber: z
    .number()
    .nullable()
    .meta({
      example: 123,
    })
    .describe("The numeric value of the attribute (used for number type)"),
  valueDate: z.coerce
    .date()
    .nullable()
    .meta({
      example: "2022-01-19 00:00:00",
    })
    .describe("The date value of the attribute (used for date type)"),
}) satisfies z.ZodType<ContactAttribute>;

ZContactAttribute.meta({
  id: "contactAttribute",
}).describe("A contact attribute value associated with a contact");
