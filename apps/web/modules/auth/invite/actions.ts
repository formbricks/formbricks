"use server";

import { actionClient } from "@/lib/utils/action-client";
import { deleteInvite, getInvite } from "@/modules/auth/invite/lib/invite";
import { createTeamMembership } from "@/modules/auth/invite/lib/team";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { z } from "zod";
import { DEFAULT_LOCALE } from "@formbricks/lib/constants";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { getUser, updateUser } from "@formbricks/lib/user/service";
import { InvalidInputError } from "@formbricks/types/errors";

const ZCreateMembershipAction = z.object({
  token: z.string(),
  userId: z.string(),
});

export const createMembershipAction = actionClient
  .schema(ZCreateMembershipAction)
  .action(async ({ parsedInput }) => {
    const { userId, token } = parsedInput;

    const { inviteId, email } = verifyInviteToken(token);

    const invite = await getInvite(inviteId);

    if (!invite) {
      throw new InvalidInputError("Invite not found");
    }

    const user = await getUser(userId);

    if (!user) {
      throw new InvalidInputError("User not found");
    }

    if (user?.email?.toLowerCase() !== email?.toLowerCase()) {
      throw new InvalidInputError("User email does not match invite email");
    }

    await createMembership(invite.organizationId, user.id, {
      accepted: true,
      role: invite.role,
    });

    if (invite.teamIds) {
      await createTeamMembership(
        {
          organizationId: invite.organizationId,
          role: invite.role,
          teamIds: invite.teamIds,
        },
        user.id
      );
    }

    await deleteInvite(invite.id);
    await sendInviteAcceptedEmail(
      invite.creator.name ?? "",
      user.name ?? "",
      invite.creator.email,
      user.locale ?? DEFAULT_LOCALE
    );

    await updateUser(user.id, {
      notificationSettings: {
        ...user.notificationSettings,
        alert: user.notificationSettings.alert ?? {},
        weeklySummary: user.notificationSettings.weeklySummary ?? {},
        unsubscribedOrganizationIds: Array.from(
          new Set([...(user.notificationSettings?.unsubscribedOrganizationIds || []), invite.organizationId])
        ),
      },
    });
  });
