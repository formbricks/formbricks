/**
 * POST /api/v3/organizations/{organizationId}/invites/{inviteId}/resend — push a pending or expired invite's
 * expiry seven days out and send its email again. Organization owners and managers, signed in as
 * themselves; the operation enforces that and the invite rate limit.
 */
import { z } from "zod";
import { ZUuid } from "@formbricks/types/common";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { resendV3OrganizationInvite } from "../../../../lib/invite-management";

const inviteParamsSchema = z.object({
  organizationId: z.cuid2(),
  inviteId: ZUuid,
});

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "updated",
  targetType: "invite",
  schemas: { params: inviteParamsSchema, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    resendV3OrganizationInvite({
      organizationId: parsedInput.params.organizationId,
      inviteId: parsedInput.params.inviteId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
