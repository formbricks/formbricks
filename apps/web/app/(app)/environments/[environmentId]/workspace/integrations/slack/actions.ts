"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { getSlackChannels } from "@/lib/slack/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getWorkspaceIdFromEnvironmentId } from "@/lib/utils/helper";

const ZGetSlackChannelsAction = z.object({
  environmentId: ZId,
});

export const getSlackChannelsAction = authenticatedActionClient
  .inputSchema(ZGetSlackChannelsAction)
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
          type: "workspaceTeam",
          workspaceId: await getWorkspaceIdFromEnvironmentId(parsedInput.environmentId),
          minPermission: "readWrite",
        },
      ],
    });

    return await getSlackChannels(parsedInput.environmentId);
  });
