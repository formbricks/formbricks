import type { Contact } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZContact = z.object({
  id: z.string().cuid2().openapi({
    description: "Unique identifier for the contact",
  }),
  userId: z.string().nullable().openapi({
    description: "Optional external user identifier",
  }),
  createdAt: z.coerce.date().openapi({
    description: "When the contact was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "When the contact was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  environmentId: z.string().openapi({
    description: "The environment this contact belongs to",
  }),
}) satisfies z.ZodType<Contact>;

ZContact.openapi({
  ref: "contact",
  description: "A person or user who can receive and respond to surveys",
});
