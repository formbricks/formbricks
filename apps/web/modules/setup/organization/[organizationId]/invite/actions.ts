"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { sendInviteMemberEmail } from "@/modules/email";
import { inviteUser } from "@/modules/setup/organization/[organizationId]/invite/lib/invite";
import { z } from "zod";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
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
  .action(async ({ ctx, parsedInput }) => {
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

    const invitedUserId = await inviteUser({
      organizationId: parsedInput.organizationId,
      invitee: {
        email: parsedInput.email,
        name: parsedInput.name,
      },
      currentUserId: ctx.user.id,
    });

    await sendInviteMemberEmail(
      invitedUserId,
      parsedInput.email,
      ctx.user.name,
      "",
      false, // is onboarding invite
      undefined
    );

    return invitedUserId;
  });
