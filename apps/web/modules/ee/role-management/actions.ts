"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { z } from "zod";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { updateInvite } from "@formbricks/lib/invite/service";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId, ZUuid } from "@formbricks/types/common";
import { OperationNotAllowedError, ValidationError } from "@formbricks/types/errors";
import { ZInviteUpdateInput } from "@formbricks/types/invites";
import { ZMembershipUpdateInput } from "@formbricks/types/memberships";

export const checkRoleManagementPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  const isRoleManagementAllowed = await getRoleManagementPermission(organization);
  if (!isRoleManagementAllowed) {
    throw new OperationNotAllowedError("Role management is not allowed for this organization");
  }
};

const ZUpdateInviteAction = z.object({
  inviteId: ZUuid,
  organizationId: ZId,
  data: ZInviteUpdateInput,
});

export const updateInviteAction = authenticatedActionClient
  .schema(ZUpdateInviteAction)
  .action(async ({ ctx, parsedInput }) => {
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

    if (!IS_FORMBRICKS_CLOUD && parsedInput.data.role === "billing") {
      throw new ValidationError("Billing role is not allowed");
    }

    await checkRoleManagementPermission(parsedInput.organizationId);

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

    if (!IS_FORMBRICKS_CLOUD && parsedInput.data.role === "billing") {
      throw new ValidationError("Billing role is not allowed");
    }

    await checkRoleManagementPermission(parsedInput.organizationId);

    return await updateMembership(parsedInput.userId, parsedInput.organizationId, parsedInput.data);
  });
