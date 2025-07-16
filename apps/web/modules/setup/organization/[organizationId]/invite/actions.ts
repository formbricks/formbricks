"use server";

import { INVITE_DISABLED } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendInviteMemberEmail } from "@/modules/email";
import { inviteUser } from "@/modules/setup/organization/[organizationId]/invite/lib/invite";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";
import { ZUserEmail, ZUserName } from "@formbricks/types/user";

const ZInviteOrganizationMemberAction = z.object({
  email: ZUserEmail,
  organizationId: ZId,
  name: ZUserName,
});

export const inviteOrganizationMemberAction = authenticatedActionClient
  .schema(ZInviteOrganizationMemberAction)
  .action(
    withAuditLogging(
      "created",
      "invite",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: Record<string, any>;
      }) => {
        if (INVITE_DISABLED) {
          throw new AuthenticationError("Invite disabled");
        }

        await checkAuthorizationUpdated({
          userId: ctx.user.id,
          organizationId: parsedInput.organizationId,
          access: [
            {
              type: "organization",
              roles: ["owner", "manager"],
            },
          ],
        });

        ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;

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
      }
    )
  );
