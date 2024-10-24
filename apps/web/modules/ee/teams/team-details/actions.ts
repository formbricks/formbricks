"use server";

import { getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { deleteTeam, updateTeamName } from "@/modules/ee/teams/team-details/lib/teams";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { ZId } from "@formbricks/types/common";
import { ZTeam } from "./types/teams";

const ZUpdateTeamNameAction = z.object({
  name: ZTeam.shape.name,
  teamId: z.string(),
});

export const updateTeamNameAction = authenticatedActionClient
  .schema(ZUpdateTeamNameAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      rules: ["team", "update"],
    });

    return await updateTeamName(parsedInput.teamId, parsedInput.name);
  });

const ZDeleteTeamAction = z.object({
  teamId: ZId,
});

export const deleteTeamAction = authenticatedActionClient
  .schema(ZDeleteTeamAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      rules: ["team", "delete"],
    });

    return await deleteTeam(parsedInput.teamId);
  });
