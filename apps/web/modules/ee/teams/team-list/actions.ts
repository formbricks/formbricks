"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { createTeam, getTeams } from "@/modules/ee/teams/team-list/lib/teams";
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
