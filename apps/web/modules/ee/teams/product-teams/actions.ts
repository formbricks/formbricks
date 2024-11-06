"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProductId } from "@/lib/utils/helper";
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      access: [
        {
          type: "organization",
          rules: ["productTeam", "delete"],
        },
        {
          type: "team",
          teamId: parsedInput.teamId,
        },
      ],
    });

    return await removeTeamAccess(parsedInput.productId, parsedInput.teamId);
  });

const ZAddAccessAction = z.object({
  productId: z.string(),
  teamIds: z.array(ZId),
});

export const addAccessAction = authenticatedActionClient
  .schema(ZAddAccessAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      access: [
        {
          type: "organization",
          rules: ["productTeam", "create"],
        },
        ...parsedInput.teamIds.map((teamId) => ({
          type: "team" as const,
          teamId,
        })),
      ],
    });

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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      access: [
        {
          type: "organization",
          rules: ["productTeam", "update"],
        },
        {
          type: "team",
          teamId: parsedInput.teamId,
        },
      ],
    });

    return await updateTeamAccessPermission(
      parsedInput.productId,
      parsedInput.teamId,
      parsedInput.permission
    );
  });
