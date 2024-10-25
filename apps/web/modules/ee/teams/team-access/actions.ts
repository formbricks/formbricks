"use server";

import { getOrganizationIdFromProductId, getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { addTeamAccess, removeTeamAccess } from "@/modules/ee/teams/team-access/lib/teams";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { ZId } from "@formbricks/types/common";

const ZRemoveAccessAction = z.object({
  productId: z.string(),
  teamId: z.string(),
});

export const removeAccessAction = authenticatedActionClient
  .schema(ZRemoveAccessAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      rules: ["product", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromTeamId(parsedInput.teamId),
      rules: ["team", "update"],
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      rules: ["product", "update"],
    });

    for (const teamId of parsedInput.teamIds) {
      await checkAuthorization({
        userId: ctx.user.id,
        organizationId: await getOrganizationIdFromTeamId(teamId),
        rules: ["team", "update"],
      });
    }

    return await addTeamAccess(parsedInput.productId, parsedInput.teamIds);
  });
