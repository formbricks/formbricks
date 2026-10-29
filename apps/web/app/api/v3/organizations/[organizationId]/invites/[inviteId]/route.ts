/**
 * DELETE /api/v3/organizations/{organizationId}/invites/{inviteId} — delete a pending invite. Nothing is
 * deleted unless `confirm=true` is in the query; without it the call answers a `preview`. Organization
 * owners and managers, signed in as themselves; the operation enforces that.
 */
import { z } from "zod";
import { ZUuid } from "@formbricks/types/common";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteV3OrganizationInvite } from "../../../lib/invite-management";
import { ZV3ConfirmQuery } from "../../../lib/members-schemas";

const inviteParamsSchema = z.object({
  organizationId: z.cuid2(),
  inviteId: ZUuid,
});

export const DELETE = withV3ApiWrapper({
  auth: "session",
  action: "deleted",
  targetType: "invite",
  schemas: { params: inviteParamsSchema, query: ZV3ConfirmQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3OrganizationInvite({
      organizationId: parsedInput.params.organizationId,
      inviteId: parsedInput.params.inviteId,
      confirm: parsedInput.query.confirm === "true",
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
