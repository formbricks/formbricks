"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";
import { ZUserEmail, ZUserName } from "@formbricks/types/user";
import { INVITE_DISABLED } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendInviteMemberEmail } from "@/modules/email";
import { applyInviteRateLimit } from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import { checkSetupInviteAuthorization } from "@/modules/setup/organization/[organizationId]/invite/lib/authorization";
import { inviteUser } from "@/modules/setup/organization/[organizationId]/invite/lib/invite";

const ZInviteOrganizationMemberAction = z.object({
  email: ZUserEmail,
  organizationId: ZId,
  name: ZUserName,
});

export const inviteOrganizationMemberAction = authenticatedActionClient
  .inputSchema(ZInviteOrganizationMemberAction)
  .action(
    withAuditLogging("created", "invite", async ({ ctx, parsedInput }) => {
      if (INVITE_DISABLED) {
        throw new AuthenticationError("Invite disabled");
      }

      // Owner-only — see `SETUP_INVITE_ACTION` for why this path is narrower than the org settings
      // invite path.
      await checkSetupInviteAuthorization(ctx.user.id, parsedInput.organizationId);

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;

      // Shares one recipient-counted budget with settings, bulk, and resend invite paths.
      await applyInviteRateLimit(parsedInput.organizationId);

      const invitedUserId = await inviteUser({
        organizationId: parsedInput.organizationId,
        invitee: {
          email: parsedInput.email,
          name: parsedInput.name,
        },
        currentUserId: ctx.user.id,
      });

      await sendInviteMemberEmail(invitedUserId, parsedInput.email, ctx.user.name, "");

      ctx.auditLoggingCtx.inviteId = invitedUserId;
      ctx.auditLoggingCtx.newObject = {
        invitedUserId,
        email: parsedInput.email,
        name: parsedInput.name,
      };

      return invitedUserId;
    })
  );
