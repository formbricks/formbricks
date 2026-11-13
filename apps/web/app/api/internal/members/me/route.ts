import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZMemberQuery } from "../[userId]/schemas";
import { leaveOrganizationOperation } from "./lib/operations";

/**
 * `DELETE /api/internal/members/me?organizationId=`: the caller's own membership, removed: leave the
 * organization. A static segment, so it is never read as a `{userId}`.
 */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZMemberQuery },
  action: "deleted",
  targetType: "membership",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    leaveOrganizationOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
