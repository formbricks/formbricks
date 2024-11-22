"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { sendInviteMemberEmail } from "@/modules/email";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { inviteUser } from "@formbricks/lib/invite/service";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";

const ZInviteOrganizationMemberAction = z.object({
  email: z.string(),
  organizationId: ZId,
});

export const inviteOrganizationMemberAction = authenticatedActionClient
  .schema(ZInviteOrganizationMemberAction)
  .action(async ({ ctx, parsedInput }) => {
    if (INVITE_DISABLED) {
      throw new AuthenticationError("Invite disabled");
    }
    const session = await getServerSession(authOptions);
    if (!session) {
      throw new AuthenticationError("Not authenticated");
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

    const organizations = await getOrganizationsByUserId(ctx.user.id);

    const invite = await inviteUser({
      organizationId: organizations[0].id,
      invitee: {
        email: parsedInput.email,
        name: "",
        role: "manager",
      },
      currentUserId: session.user.id,
    });

    if (invite) {
      await sendInviteMemberEmail(
        invite.id,
        parsedInput.email,
        ctx.user.name ?? "",
        "",
        false, // is onboarding invite
        undefined,
        ctx.user.locale
      );
    }

    return invite;
  });
