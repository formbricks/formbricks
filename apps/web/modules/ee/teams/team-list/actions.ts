"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { createTeam, getTeams, joinTeam, leaveTeam } from "@/modules/ee/teams/team-list/lib/teams";
import { z } from "zod";

const ZGetTeamsAction = z.object({
  organizationId: z.string(),
});

export const getTeamsAction = authenticatedActionClient
  .schema(ZGetTeamsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "billing", "member"],
        },
      ],
    });

    return await getTeams(ctx.user.id, parsedInput.organizationId);
  });

const ZLeaveTeamAction = z.object({
  teamId: z.string(),
});

export const leaveTeamAction = authenticatedActionClient
  .schema(ZLeaveTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      access: [
        {
          type: "team",
          teamId: parsedInput.teamId,
          minPermission: "contributor",
        },
      ],
    });

    return await leaveTeam(ctx.user.id, parsedInput.teamId);
  });

const ZJoinTeamAction = z.object({
  teamId: z.string(),
});

export const joinTeamAction = authenticatedActionClient
  .schema(ZJoinTeamAction)
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

    return await joinTeam(ctx.user.id, parsedInput.teamId);
  });

const ZCreateTeamAction = z.object({
  organizationId: z.string().cuid(),
  name: z.string(),
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

    return await createTeam(parsedInput.organizationId, parsedInput.name);
  });
