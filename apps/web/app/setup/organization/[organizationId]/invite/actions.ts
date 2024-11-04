"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { sendInviteMemberEmail } from "@/modules/email";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
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

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          rules: ["membership", "create"],
        },
      ],
    });

    const organizations = await getOrganizationsByUserId(ctx.user.id);

    const invite = await inviteUser({
      organizationId: organizations[0].id,
      invitee: {
        email: parsedInput.email,
        name: "",
        organizationRole: "manager",
      },
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
