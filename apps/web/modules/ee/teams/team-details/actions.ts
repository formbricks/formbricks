"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { ZTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
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
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
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
          rules: ["team", "update"],
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
          rules: ["team", "delete"],
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
          rules: ["teamMembership", "update"],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          rules: ["teamMembership", "update"],
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
          rules: ["teamMembership", "create"],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          rules: ["productTeam", "update"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "organization",
          rules: ["productTeam", "delete"],
        },
        {
          type: "productTeam",
          productId: parsedInput.productId,
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
          rules: ["productTeam", "create"],
        },
      ],
    });

    return await addTeamProducts(parsedInput.teamId, parsedInput.productIds);
  });
