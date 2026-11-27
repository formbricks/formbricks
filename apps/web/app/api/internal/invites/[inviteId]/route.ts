import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteInviteOperation, updateInviteOperation } from "../lib/operations";
import { ZInviteIdParams, ZInviteUpdateBody } from "../schemas";

/** `PATCH /api/internal/invites/{inviteId}`: change the role a pending invite grants. Enterprise-gated. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZInviteIdParams, body: ZInviteUpdateBody },
  action: "updated",
  targetType: "invite",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateInviteOperation({
      authentication,
      inviteId: parsedInput.params.inviteId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/invites/{inviteId}`: withdraw the pending invite. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZInviteIdParams },
  action: "deleted",
  targetType: "invite",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteInviteOperation({
      authentication,
      inviteId: parsedInput.params.inviteId,
      requestId,
      instance,
      auditLog,
    }),
});
