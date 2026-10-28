/**
 * /api/v3/contacts/{contactId}
 *   GET    — one contact with all its attributes.
 *   PATCH  — set attributes (merged) and/or remove attribute keys.
 *   DELETE — delete the contact, its displays and its responses.
 *
 * The workspace is resolved from the contact, never from the request, so the caller cannot choose the
 * scope it is authorized against. An unknown id answers 403, like a contact of another tenant.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3Contact, getV3Contact, updateV3Contact } from "../lib/operations";
import { ZV3ContactIdParams, ZV3PatchContactBody } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3ContactIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Contact({ contactId: parsedInput.params.contactId, authentication, requestId, instance }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "contact",
  schemas: { params: ZV3ContactIdParams, body: ZV3PatchContactBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3Contact({
      contactId: parsedInput.params.contactId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "contact",
  schemas: { params: ZV3ContactIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Contact({
      contactId: parsedInput.params.contactId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
