"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProductId, getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import {
  addTeamAccess,
  removeTeamAccess,
  updateTeamAccessPermission,
} from "@/modules/ee/teams/product-teams/lib/teams";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZTeamPermission } from "./types/teams";

const ZRemoveAccessAction = z.object({
  productId: z.string(),
  teamId: z.string(),
});

export const removeAccessAction = authenticatedActionClient
  .schema(ZRemoveAccessAction)
  .action(async ({ ctx, parsedInput }) => {
    const productOrganizationId = await getOrganizationIdFromProductId(parsedInput.productId);
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    if (productOrganizationId !== teamOrganizationId) {
      throw new Error("Team and product are not in the same organization");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: productOrganizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    await checkRoleManagementPermission(productOrganizationId);

    return await removeTeamAccess(parsedInput.productId, parsedInput.teamId);
  });

const ZAddAccessAction = z.object({
  productId: z.string(),
  teamIds: z.array(ZId),
});

export const addAccessAction = authenticatedActionClient
  .schema(ZAddAccessAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProductId(parsedInput.productId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    await checkRoleManagementPermission(organizationId);

    return await addTeamAccess(parsedInput.productId, parsedInput.teamIds);
  });

const ZUpdateAccessPermissionAction = z.object({
  productId: z.string(),
  teamId: z.string(),
  permission: ZTeamPermission,
});

export const updateAccessPermissionAction = authenticatedActionClient
  .schema(ZUpdateAccessPermissionAction)
  .action(async ({ ctx, parsedInput }) => {
    const productOrganizationId = await getOrganizationIdFromProductId(parsedInput.productId);
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    if (productOrganizationId !== teamOrganizationId) {
      throw new Error("Team and product are not in the same organization");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: productOrganizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    await checkRoleManagementPermission(productOrganizationId);

    return await updateTeamAccessPermission(
      parsedInput.productId,
      parsedInput.teamId,
      parsedInput.permission
    );
  });
