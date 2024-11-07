"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { z } from "zod";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { updateInvite } from "@formbricks/lib/invite/service";
import { ZId, ZUuid } from "@formbricks/types/common";
import { ValidationError } from "@formbricks/types/errors";
import { ZInviteUpdateInput } from "@formbricks/types/invites";
import { ZMembershipUpdateInput } from "@formbricks/types/memberships";

const ZUpdateInviteAction = z.object({
  inviteId: ZUuid,
  organizationId: ZId,
  data: ZInviteUpdateInput,
});

export const updateInviteAction = authenticatedActionClient
  .schema(ZUpdateInviteAction)
  .action(async ({ ctx, parsedInput }) => {
    if (!IS_FORMBRICKS_CLOUD && parsedInput.data.role === "billing") {
      throw new ValidationError("Billing role is not allowed");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          data: parsedInput.data,
          schema: ZInviteUpdateInput,
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await updateInvite(parsedInput.inviteId, parsedInput.data);
  });

const ZUpdateMembershipAction = z.object({
  userId: ZId,
  organizationId: ZId,
  data: ZMembershipUpdateInput,
});

export const updateMembershipAction = authenticatedActionClient
  .schema(ZUpdateMembershipAction)
  .action(async ({ ctx, parsedInput }) => {
    if (!IS_FORMBRICKS_CLOUD && parsedInput.data.role === "billing") {
      throw new ValidationError("Billing role is not allowed");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          data: parsedInput.data,
          schema: ZMembershipUpdateInput,
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await updateMembership(parsedInput.userId, parsedInput.organizationId, parsedInput.data);
  });
