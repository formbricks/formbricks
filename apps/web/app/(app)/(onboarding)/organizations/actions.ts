"use server";

import { z } from "zod";
import { sendInviteMemberEmail } from "@formbricks/email";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { inviteUser } from "@formbricks/lib/invite/service";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";
import { ZMembershipRole } from "@formbricks/types/memberships";

const ZInviteOrganizationMemberAction = z.object({
  organizationId: ZId,
  email: z.string(),
  role: ZMembershipRole,
  inviteMessage: z.string(),
});

export const inviteOrganizationMemberAction = authenticatedActionClient
  .schema(ZInviteOrganizationMemberAction)
  .action(async ({ ctx, parsedInput }) => {
    if (INVITE_DISABLED) {
      throw new AuthenticationError("Invite disabled");
    }

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      rules: ["membership", "create"],
    });

    const invite = await inviteUser({
      organizationId: parsedInput.organizationId,
      invitee: {
        email: parsedInput.email,
        name: "",
        role: parsedInput.role,
      },
    });

    if (invite) {
      await sendInviteMemberEmail(
        invite.id,
        parsedInput.email,
        ctx.user.name ?? "",
        "",
        true, // is onboarding invite
        parsedInput.inviteMessage
      );
    }

    return invite;
  });
