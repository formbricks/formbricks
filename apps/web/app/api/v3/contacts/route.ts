/**
 * /api/v3/contacts
 *   GET  — list a workspace's contacts, newest first, optionally filtered by userId or one attribute.
 *   POST — create the contact for a userId, or update it when it already exists.
 *
 * Session cookie, API key or OAuth token. Agent-first (ADR 0015): everything the Contacts screens did is
 * reachable here, behind the same workspace access check and the same Enterprise entitlement.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3Contacts, upsertV3Contact } from "./lib/operations";
import { ZV3ContactListQuery, ZV3UpsertContactBody } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3ContactListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Contacts({ query: parsedInput.query, authentication, requestId, instance }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "createdUpdated",
  targetType: "contact",
  schemas: { body: ZV3UpsertContactBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    upsertV3Contact({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
