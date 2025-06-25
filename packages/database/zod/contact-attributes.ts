import type { ContactAttribute } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZContactAttribute = z.object({
  id: z.string().cuid2().openapi({
    description: "The ID of the contact attribute",
  }),
  createdAt: z.coerce.date().openapi({
    description: "The date and time the contact attribute was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "The date and time the contact attribute was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  attributeKeyId: z.string().cuid2().openapi({
    description: "The ID of the attribute key",
  }),
  contactId: z.string().cuid2().openapi({
    description: "The ID of the contact",
  }),
  value: z.string().openapi({
    description: "The value of the attribute",
    example: "example@email.com",
  }),
}) satisfies z.ZodType<ContactAttribute>;

ZContactAttribute.openapi({
  ref: "contactAttribute",
  description: "A contact attribute value associated with a contact",
});
