"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import {
  createTeam,
  deleteTeam,
  getTeamDetails,
  updateTeamDetails,
} from "@/modules/ee/teams/team-list/lib/team";
import { ZTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZCreateTeamAction = z.object({
  organizationId: z.string().cuid(),
  name: z.string().trim().min(1, "Team name is required"),
});

export const createTeamAction = authenticatedActionClient
  .schema(ZCreateTeamAction)
  .action(async ({ ctx, parsedInput }) => {
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
    await checkRoleManagementPermission(parsedInput.organizationId);

    return await createTeam(parsedInput.organizationId, parsedInput.name);
  });

const ZGetTeamDetailsAction = z.object({
  teamId: ZId,
});

export const getTeamDetailsAction = authenticatedActionClient
  .schema(ZGetTeamDetailsAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          teamId: parsedInput.teamId,
          type: "team",
          minPermission: "admin",
        },
      ],
    });

    await checkRoleManagementPermission(organizationId);

    return await getTeamDetails(parsedInput.teamId);
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

const ZUpdateTeamAction = z.object({
  teamId: ZId,
  data: ZTeamSettingsFormSchema,
});

export const updateTeamDetailsAction = authenticatedActionClient
  .schema(ZUpdateTeamAction)
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

    return await updateTeamDetails(parsedInput.teamId, parsedInput.data);
  });

const ZGetTeamRoleAction = z.object({
  teamId: ZId,
});

export const getTeamRoleAction = authenticatedActionClient
  .schema(ZGetTeamRoleAction)
  .action(async ({ ctx, parsedInput }) => {
    return await getTeamRoleByTeamIdUserId(parsedInput.teamId, ctx.user.id);
  });
