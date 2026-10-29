/**
 * PATCH  /api/v3/organizations/{organizationId}/members/{userId} — change a member's role (member or manager).
 * DELETE /api/v3/organizations/{organizationId}/members/{userId} — remove a member.
 *
 * Both change nothing unless `confirm` is true (body for PATCH, query for DELETE) and answer a `preview`
 * otherwise. Organization owners and managers, signed in as themselves; the operation enforces that and the
 * role rules, so the MCP tools get the same answers.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { removeV3OrganizationMember, updateV3OrganizationMemberRole } from "../../../lib/members";
import { ZV3ConfirmQuery } from "../../../lib/members-schemas";

const memberParamsSchema = z.object({
  organizationId: z.cuid2(),
  userId: z.cuid2(),
});

export const PATCH = withV3ApiWrapper({
  auth: "session",
  action: "updated",
  targetType: "membership",
  schemas: {
    params: memberParamsSchema,
    query: ZV3EmptyQuery,
    // Parsed by the operation, so the MCP tool that calls it directly gets the same 400.
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3OrganizationMemberRole({
      organizationId: parsedInput.params.organizationId,
      userId: parsedInput.params.userId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "session",
  action: "deleted",
  targetType: "membership",
  schemas: { params: memberParamsSchema, query: ZV3ConfirmQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    removeV3OrganizationMember({
      organizationId: parsedInput.params.organizationId,
      userId: parsedInput.params.userId,
      confirm: parsedInput.query.confirm === "true",
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
