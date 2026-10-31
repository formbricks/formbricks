import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { updateMemberRoleOperation } from "./lib/operations";
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
