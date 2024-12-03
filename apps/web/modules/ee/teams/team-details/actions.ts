"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProjectId, getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/teams";
import {
  addTeamMembers,
  addTeamProjects,
  deleteTeam,
  removeTeamMember,
  removeTeamProject,
  updateTeamName,
  updateTeamProjectPermission,
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
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

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

    return await updateTeamName(parsedInput.teamId, parsedInput.name);
  });

const ZDeleteTeamAction = z.object({
  teamId: ZId,
});

export const deleteTeamAction = authenticatedActionClient
  .schema(ZDeleteTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

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
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
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

    await checkRoleManagementPermission(organizationId);

    return await updateUserTeamRole(parsedInput.teamId, parsedInput.userId, parsedInput.role);
  });

const ZRemoveTeamMemberAction = z.object({
  teamId: ZId,
  userId: ZId,
});

export const removeTeamMemberAction = authenticatedActionClient
  .schema(ZRemoveTeamMemberAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

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

    const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, organizationId);

    const { isOwner, isManager } = getAccessFlags(membership?.role);

    const isOwnerOrManager = isOwner || isManager;

    if (!isOwnerOrManager && ctx.user.id === parsedInput.userId) {
      throw new Error("You can not remove yourself from the team");
    }

    await checkRoleManagementPermission(organizationId);

    return await removeTeamMember(parsedInput.teamId, parsedInput.userId);
  });

const ZAddTeamMembersAction = z.object({
  teamId: ZId,
  userIds: z.array(ZId),
});

export const addTeamMembersAction = authenticatedActionClient
  .schema(ZAddTeamMembersAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
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

    await checkRoleManagementPermission(organizationId);

    return await addTeamMembers(parsedInput.teamId, parsedInput.userIds);
  });

const ZUpdateTeamProjectPermissionAction = z.object({
  teamId: ZId,
  projectId: ZId,
  permission: ZTeamPermission,
});

export const updateTeamProjectPermissionAction = authenticatedActionClient
  .schema(ZUpdateTeamProjectPermissionAction)
  .action(async ({ ctx, parsedInput }) => {
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);
    const projectOrganizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

    if (teamOrganizationId !== projectOrganizationId) {
      throw new Error("Team and Project must belong to the same organization");
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

    await checkRoleManagementPermission(projectOrganizationId);

    return await updateTeamProjectPermission(
      parsedInput.teamId,
      parsedInput.projectId,
      parsedInput.permission
    );
  });

const ZRemoveTeamProjectAction = z.object({
  teamId: ZId,
  projectId: ZId,
});

export const removeTeamProjectAction = authenticatedActionClient
  .schema(ZRemoveTeamProjectAction)
  .action(async ({ ctx, parsedInput }) => {
    const teamOrganizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);
    const projectOrganizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

    if (teamOrganizationId !== projectOrganizationId) {
      throw new Error("Team and Project must belong to the same organization");
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

    await checkRoleManagementPermission(projectOrganizationId);

    return await removeTeamProject(parsedInput.teamId, parsedInput.projectId);
  });

const ZAddTeamProjectsAction = z.object({
  teamId: ZId,
  projectIds: z.array(ZId),
});

export const addTeamProjectsAction = authenticatedActionClient
  .schema(ZAddTeamProjectsAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

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

    return await addTeamProjects(parsedInput.teamId, parsedInput.projectIds);
  });
