import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createInviteShareLinkOperation } from "../../lib/operations";
import { ZInviteIdParams } from "../../schemas";

/** `POST /api/internal/invites/{inviteId}/share-links`: a fresh link to the pending invite, to share by hand. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZInviteIdParams },
  action: "updated",
  targetType: "invite",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createInviteShareLinkOperation({
      authentication,
      inviteId: parsedInput.params.inviteId,
      requestId,
      instance,
      auditLog,
    }),
});
