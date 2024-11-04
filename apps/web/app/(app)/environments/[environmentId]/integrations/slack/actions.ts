"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProductIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { getSlackChannels } from "@formbricks/lib/slack/service";
import { ZId } from "@formbricks/types/common";

const ZRefreshChannelsAction = z.object({
  environmentId: ZId,
});

export const refreshChannelsAction = authenticatedActionClient
  .schema(ZRefreshChannelsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["integration", "update"],
        },
        {
          type: "product",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
          minPermission: "manage",
        },
      ],
    });

    return await getSlackChannels(parsedInput.environmentId);
  });
