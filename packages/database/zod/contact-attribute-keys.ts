import { type ContactAttributeKey, ContactAttributeType } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZContactAttributeKey = z.object({
  id: z.string().cuid2().openapi({
    description: "The ID of the contact attribute key",
  }),
  createdAt: z.coerce.date().openapi({
    description: "The date and time the contact attribute key was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "The date and time the contact attribute key was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  isUnique: z.boolean().openapi({
    description: "Whether the attribute must have unique values across contacts",
    example: false,
  }),
  key: z.string().openapi({
    description: "The attribute identifier used in the system",
    example: "email",
  }),
  name: z.string().nullable().openapi({
    description: "Display name for the attribute",
    example: "Email Address",
  }),
  description: z.string().nullable().openapi({
    description: "Description of the attribute",
    example: "The user's email address",
  }),
  type: z.nativeEnum(ContactAttributeType).openapi({
    description: "Whether this is a default or custom attribute",
    example: "custom",
  }),
  environmentId: z.string().cuid2().openapi({
    description: "The ID of the environment this attribute belongs to",
  }),
}) satisfies z.ZodType<ContactAttributeKey>;

ZContactAttributeKey.openapi({
  ref: "contactAttributeKey",
  description: "Defines a possible attribute that can be assigned to contacts",
});
