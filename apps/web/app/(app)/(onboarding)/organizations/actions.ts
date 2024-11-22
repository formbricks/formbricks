"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { sendInviteMemberEmail } from "@/modules/email";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { inviteUser } from "@formbricks/lib/invite/service";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";
import { ZOrganizationRole } from "@formbricks/types/memberships";

const ZInviteOrganizationMemberAction = z.object({
  organizationId: ZId,
  email: z.string(),
  role: ZOrganizationRole,
  inviteMessage: z.string(),
});

export const inviteOrganizationMemberAction = authenticatedActionClient
  .schema(ZInviteOrganizationMemberAction)
  .action(async ({ ctx, parsedInput }) => {
    const session = await getServerSession(authOptions);
    if (INVITE_DISABLED) {
      throw new AuthenticationError("Invite disabled");
    }
    const currentUser = session?.user;
    if (!currentUser) {
      throw new AuthenticationError("Not Authenticated");
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

    const invite = await inviteUser({
      organizationId: parsedInput.organizationId,
      invitee: {
        email: parsedInput.email,
        name: "",
        role: parsedInput.role,
      },
      currentUserId: currentUser.id,
    });

    if (invite) {
      await sendInviteMemberEmail(
        invite.id,
        parsedInput.email,
        ctx.user.name ?? "",
        "",
        true, // is onboarding invite
        parsedInput.inviteMessage,
        ctx.user.locale
      );
    }

    return invite;
  });
