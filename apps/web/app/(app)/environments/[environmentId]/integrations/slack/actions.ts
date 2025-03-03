"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { getSlackChannels } from "@formbricks/lib/slack/service";
import { ZId } from "@formbricks/types/common";

const ZGetSlackChannelsAction = z.object({
  environmentId: ZId,
});

export const getSlackChannelsAction = authenticatedActionClient
  .schema(ZGetSlackChannelsAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          minPermission: "readWrite",
        },
      ],
    });

    return await getSlackChannels(parsedInput.environmentId);
  });
