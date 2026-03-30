import type { Contact } from "@prisma/client";
import { z } from "zod";

export const ZContact = z.object({
  id: z.cuid2().describe("Unique identifier for the contact"),
  userId: z.string().nullable().describe("Optional external user identifier"),
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("When the contact was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("When the contact was last updated"),
  environmentId: z.string().describe("The environment this contact belongs to"),
}) satisfies z.ZodType<Contact>;

ZContact.meta({
  id: "contact",
}).describe("A person or user who can receive and respond to surveys");
