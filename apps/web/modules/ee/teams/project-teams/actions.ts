"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProjectId, getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import {
  addTeamAccess,
  removeTeamAccess,
  updateTeamAccessPermission,
} from "@/modules/ee/teams/project-teams/lib/teams";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZTeamPermission } from "./types/teams";

const ZRemoveAccessAction = z.object({
  projectId: z.string(),
  teamId: z.string(),
});

export const removeAccessAction = authenticatedActionClient
  .schema(ZRemoveAccessAction)
  .action(async ({ ctx, parsedInput }) => {
    const projectOrganizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    if (projectOrganizationId !== teamOrganizationId) {
      throw new Error("Team and project are not in the same organization");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: projectOrganizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await removeTeamAccess(parsedInput.projectId, parsedInput.teamId);
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
      organizationId: await getOrganizationIdFromProjectId(parsedInput.productId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
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
    const productOrganizationId = await getOrganizationIdFromProjectId(parsedInput.productId);
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

    return await updateTeamAccessPermission(
      parsedInput.productId,
      parsedInput.teamId,
      parsedInput.permission
    );
  });