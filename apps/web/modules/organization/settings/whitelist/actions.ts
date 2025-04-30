"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { sendInviteMemberEmail } from "@/modules/email";
import { addUserToWhitelist } from "@/modules/organization/settings/whitelist/lib/whitelist";
import { z } from "zod";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { ZId, ZUuid } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";
import { ZOrganizationRole } from "@formbricks/types/memberships";

const ZAddWhitelistAction = z.object({
  email: z.string(),
  organizationId: ZId,
  role: ZOrganizationRole,
});

export const addWhitelistAction = authenticatedActionClient
  .schema(ZAddWhitelistAction)
  .action(async ({ parsedInput, ctx }) => {
    if (INVITE_DISABLED) {
      throw new AuthenticationError("Invite disabled");
    }

    const currentUserMembership = await getMembershipByUserIdOrganizationId(
      ctx.user.id,
      parsedInput.organizationId
    );
    if (!currentUserMembership) {
      throw new AuthenticationError("User not a member of this organization");
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

    const whitelistedUserId = await addUserToWhitelist({
      email: parsedInput.email,
      organizationId: parsedInput.organizationId,
      currentUserId: ctx.user.id,
    });

    if (whitelistedUserId) {
      alert("Whitelisted user");
    }

    return whitelistedUserId;
  });
