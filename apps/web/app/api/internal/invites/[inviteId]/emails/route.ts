import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { resendInviteOperation } from "../../lib/operations";
import { ZInviteIdParams, ZInviteOrganizationQuery } from "../../schemas";

/** `POST /api/internal/invites/{inviteId}/emails?organizationId=`: send the invite email again. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZInviteIdParams, query: ZInviteOrganizationQuery },
  action: "updated",
  targetType: "invite",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    resendInviteOperation({
      authentication,
      inviteId: parsedInput.params.inviteId,
      organizationId: parsedInput.query.organizationId,
      requestId,
      instance,
      auditLog,
    }),
});
