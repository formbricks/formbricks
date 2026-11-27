import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteMemberOperation, updateMemberRoleOperation } from "./lib/operations";
import { ZMemberPathParams, ZMemberQuery, ZMemberUpdateBody } from "./schemas";

/**
 * `PATCH /api/internal/members/{userId}?organizationId=`: change a member's organization role.
 * Enterprise-gated. Internal and session-only.
 */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZMemberPathParams, query: ZMemberQuery, body: ZMemberUpdateBody },
  action: "updated",
  targetType: "membership",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateMemberRoleOperation({
      authentication,
      userId: parsedInput.params.userId,
      organizationId: parsedInput.query.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/members/{userId}?organizationId=`: remove a member from the organization. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZMemberPathParams, query: ZMemberQuery },
  action: "deleted",
  targetType: "membership",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteMemberOperation({
      authentication,
      userId: parsedInput.params.userId,
      organizationId: parsedInput.query.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
