import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { acceptInviteOperation } from "./lib/operations";
import { ZInviteAcceptanceBody } from "./schemas";

/**
 * `POST /api/internal/invites/acceptances`: accept the invite behind an invite link, as the signed-in user it
 * was sent to. Creates the membership with the invite's role (and its team memberships) and spends the
 * invite. Audited as `created` on the membership.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZInviteAcceptanceBody },
  action: "created",
  targetType: "membership",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    acceptInviteOperation({ authentication, body: parsedInput.body, requestId, instance, auditLog }),
});
