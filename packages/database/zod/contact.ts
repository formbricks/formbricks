import { z } from "zod";
import type { Contact } from "../src/prisma";

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
  workspaceId: z.cuid2().describe("The ID of the workspace this contact belongs to"),
  // No `directoryId`: this documents the v2 responses, which never return a contact's directory (decision 9).
}) satisfies z.ZodType<Omit<Contact, "directoryId">>;

ZContact.meta({
  id: "contact",
}).describe("A person or user who can receive and respond to surveys");
