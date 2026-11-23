/**
 * GET  /api/v3/organizations/{organizationId}/member-attribute-keys — the organization's Member attribute
 *      keys, each with how many members hold a value for it.
 * POST /api/v3/organizations/{organizationId}/member-attribute-keys — create a key.
 *
 * Session (Owners and Managers) or an API key with Access Control read (GET) / write (POST); needs Access
 * Control and Dashboards. See `../member-attributes/lib/operations.ts`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createV3MemberAttributeKey, listV3MemberAttributeKeys } from "../member-attributes/lib/operations";
import { ZV3CreateMemberAttributeKeyBody, ZV3OrganizationParams } from "../member-attributes/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3OrganizationParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3MemberAttributeKeys({
      authentication,
      organizationId: parsedInput.params.organizationId,
      requestId,
      instance,
    }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "memberAttributeKey",
  schemas: { params: ZV3OrganizationParams, body: ZV3CreateMemberAttributeKeyBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3MemberAttributeKey({
      authentication,
      organizationId: parsedInput.params.organizationId,
      body: parsedInput.body,
      auditLog,
      requestId,
      instance,
    }),
});
