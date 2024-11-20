"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProjectId, getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/teams";
import {
  addTeamMembers,
  addTeamProducts,
  deleteTeam,
  removeTeamMember,
  removeTeamProduct,
  updateTeamName,
  updateTeamProductPermission,
  updateUserTeamRole,
} from "@/modules/ee/teams/team-details/lib/teams";
import { ZTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { z } from "zod";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { ZId } from "@formbricks/types/common";
import { ZTeam } from "./types/teams";

const ZUpdateTeamNameAction = z.object({
  name: ZTeam.shape.name,
  teamId: z.string(),
});

export const updateTeamNameAction = authenticatedActionClient
  .schema(ZUpdateTeamNameAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await updateTeamName(parsedInput.teamId, parsedInput.name);
  });

const ZDeleteTeamAction = z.object({
  teamId: ZId,
});

export const deleteTeamAction = authenticatedActionClient
  .schema(ZDeleteTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await deleteTeam(parsedInput.teamId);
  });

const ZUpdateUserTeamRoleAction = z.object({
  teamId: ZId,
  userId: ZId,
  role: ZTeamRole,
});

export const updateUserTeamRoleAction = authenticatedActionClient
  .schema(ZUpdateUserTeamRoleAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "team",
          teamId: parsedInput.teamId,
          minPermission: "admin",
        },
      ],
    });

    return await updateUserTeamRole(parsedInput.teamId, parsedInput.userId, parsedInput.role);
  });

const ZRemoveTeamMemberAction = z.object({
  teamId: ZId,
  userId: ZId,
});

export const removeTeamMemberAction = authenticatedActionClient
  .schema(ZRemoveTeamMemberAction)
  .action(async ({ ctx, parsedInput }) => {
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);
    const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, teamOrganizationId);

    const { isOwner, isManager } = getAccessFlags(membership?.role);

    const isOwnerOrManager = isOwner || isManager;

    if (!isOwnerOrManager && ctx.user.id === parsedInput.userId) {
      throw new Error("You can not remove yourself from the team");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "team",
          teamId: parsedInput.teamId,
          minPermission: "admin",
        },
      ],
    });

    return await removeTeamMember(parsedInput.teamId, parsedInput.userId);
  });

const ZAddTeamMembersAction = z.object({
  teamId: ZId,
  userIds: z.array(ZId),
});

export const addTeamMembersAction = authenticatedActionClient
  .schema(ZAddTeamMembersAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "team",
          teamId: parsedInput.teamId,
          minPermission: "admin",
        },
      ],
    });

    return await addTeamMembers(parsedInput.teamId, parsedInput.userIds);
  });

const ZUpdateTeamProductPermissionAction = z.object({
  teamId: ZId,
  productId: ZId,
  permission: ZTeamPermission,
});

export const updateTeamProductPermissionAction = authenticatedActionClient
  .schema(ZUpdateTeamProductPermissionAction)
  .action(async ({ ctx, parsedInput }) => {
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);
    const productOrganizationId = await getOrganizationIdFromProjectId(parsedInput.productId);

    if (teamOrganizationId !== productOrganizationId) {
      throw new Error("Team and Product must belong to the same organization");
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

    return await updateTeamProductPermission(
      parsedInput.teamId,
      parsedInput.productId,
      parsedInput.permission
    );
  });

const ZRemoveTeamProductAction = z.object({
  teamId: ZId,
  productId: ZId,
});

export const removeTeamProductAction = authenticatedActionClient
  .schema(ZRemoveTeamProductAction)
  .action(async ({ ctx, parsedInput }) => {
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);
    const productOrganizationId = await getOrganizationIdFromProjectId(parsedInput.productId);

    if (teamOrganizationId !== productOrganizationId) {
      throw new Error("Team and Product must belong to the same organization");
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

    return await removeTeamProduct(parsedInput.teamId, parsedInput.productId);
  });

const ZAddTeamProductsAction = z.object({
  teamId: ZId,
  productIds: z.array(ZId),
});

export const addTeamProductsAction = authenticatedActionClient
  .schema(ZAddTeamProductsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await addTeamProducts(parsedInput.teamId, parsedInput.productIds);
  });
