"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { getSlackChannels } from "@formbricks/lib/slack/service";
import { ZId } from "@formbricks/types/common";

const ZRefreshChannelsAction = z.object({
  environmentId: ZId,
});

export const refreshChannelsAction = authenticatedActionClient
  .schema(ZRefreshChannelsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["integration", "update"],
    });

    return await getSlackChannels(parsedInput.environmentId);
  });
