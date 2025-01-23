"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { deleteInvite } from "@/modules/auth/invite/lib/invite";
import { createTeamMembership } from "@/modules/auth/invite/lib/team";
import { ZInviteWithCreator } from "@/modules/auth/invite/types/invites";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { z } from "zod";
import { DEFAULT_LOCALE } from "@formbricks/lib/constants";
import { createMembership } from "@formbricks/lib/membership/service";
import { updateUser } from "@formbricks/lib/user/service";

const ZCreateMembershipAction = z.object({
  invite: ZInviteWithCreator,
});

export const createMembershipAction = authenticatedActionClient
  .schema(ZCreateMembershipAction)
  .action(async ({ ctx, parsedInput }) => {
    if (!ctx.user) return;

    const { invite } = parsedInput;

    await createMembership(invite.organizationId, ctx.user.id, {
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
        ctx.user.id
      );
    }

    await deleteInvite(invite.id);
    await sendInviteAcceptedEmail(
      invite.creator.name ?? "",
      ctx.user.name ?? "",
      invite.creator.email,
      ctx.user.locale ?? DEFAULT_LOCALE
    );

    await updateUser(ctx.user.id, {
      notificationSettings: {
        ...ctx.user.notificationSettings,
        alert: ctx.user.notificationSettings.alert ?? {},
        weeklySummary: ctx.user.notificationSettings.weeklySummary ?? {},
        unsubscribedOrganizationIds: Array.from(
          new Set([
            ...(ctx.user.notificationSettings?.unsubscribedOrganizationIds || []),
            invite.organizationId,
          ])
        ),
      },
    });
  });
