"use server";

import { getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { createTeam, getTeams, joinTeam, leaveTeam } from "@/modules/ee/teams/team-list/lib/teams";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";

const ZGetTeamsAction = z.object({
  organizationId: z.string(),
});

export const getTeamsAction = authenticatedActionClient
  .schema(ZGetTeamsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      rules: ["team", "read"],
    });

    return await getTeams(ctx.user.id, parsedInput.organizationId);
  });

const ZLeaveTeamAction = z.object({
  teamId: z.string(),
});

export const leaveTeamAction = authenticatedActionClient
  .schema(ZLeaveTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      rules: ["team", "update"],
    });

    return await leaveTeam(ctx.user.id, parsedInput.teamId);
  });

const ZJoinTeamAction = z.object({
  teamId: z.string(),
});

export const joinTeamAction = authenticatedActionClient
  .schema(ZJoinTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      rules: ["teamMembership", "delete"],
    });

    return await joinTeam(ctx.user.id, parsedInput.teamId);
  });

const ZCreateTeamAction = z.object({
  organizationId: z.string(),
  name: z.string(),
});

export const createTeamAction = authenticatedActionClient
  .schema(ZCreateTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      rules: ["team", "create"],
    });

    return await createTeam(parsedInput.organizationId, parsedInput.name);
  });
